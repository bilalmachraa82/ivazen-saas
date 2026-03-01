/**
 * fetch-efatura-portal Edge Function
 * Fetches real invoice data from e-Fatura portal using session-based auth
 *
 * WARNING: As of Feb 2026, AT is rolling out mandatory 2FA (SMS OTP) for all
 * portal logins. This approach may fail for accounts with 2FA enabled.
 * The official AT SOAP webservice with mTLS (sync-efatura) is NOT affected
 * by 2FA and is the recommended long-term approach.
 *
 * This function works for accounts that still use NIF+password only.
 * It uses the same authentication flow as the e-Fatura web portal:
 * 1. Login via acesso.gov.pt with NIF + password
 * 2. Maintain session cookies
 * 3. Call obterDocumentosAdquirente.action for purchase invoices
 *
 * Known limitations:
 * - 2FA (SMS OTP) blocks automated login - no workaround possible
 * - Maximum 300 documents per request (no pagination in portal API)
 * - Undocumented internal API - may change without notice
 *
 * Requires: Client NIF + Portal das Financas password (from at_credentials table)
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENABLE_WITHHOLDINGS_CANDIDATES = Deno.env.get(
  "AT_WITHHOLDINGS_CANDIDATES_V1",
) === "1";
const ENABLE_WITHHOLDINGS_AUTO_PROMOTION = Deno.env.get(
  "AT_WITHHOLDINGS_AUTO_PROMOTION_V1",
) === "1";
const WITHHOLDING_AUTO_PROMOTION_THRESHOLD = 80;

interface FetchRequest {
  clientId: string;
  accountantId?: string;
  startDate?: string;
  endDate?: string;
  type?: "compras" | "vendas" | "ambos";
  syncWithholdings?: boolean;
}

interface PortalInvoice {
  nifEmitente: string;
  nomeEmitente: string;
  numerodocumento: string;
  dataEmissao: string;
  tipoDocumento: string;
  atcud: string;
  valorTotal: number;
  valorIVA: number;
  baseTributavel: number;
  actividadeEmitente?: string;
  situacao?: string;
  sourceType: "compras" | "vendas";
  raw?: Record<string, unknown>;
}

interface WithholdingCandidate {
  beneficiaryNif: string;
  beneficiaryName: string | null;
  incomeCategory: "B" | "F";
  grossAmount: number;
  withholdingAmount: number;
  withholdingRate: number | null;
  paymentDate: string;
  documentReference: string;
  detectedKeys: string[];
  confidenceScore: number;
  detectionReason: string;
  rawPayload: Record<string, unknown>;
}

interface WithholdingExtractionDiagnostics {
  vendasInvoicesSeen: number;
  receiptLikeInvoices: number;
  retentionSignalInvoices: number;
  receiptWithSignalInvoices: number;
  extractedCandidates: number;
  excludedNotReceiptLike: number;
  excludedNoRetentionSignal: number;
  excludedMissingCoreFields: number;
}

async function resolveCandidateAccountantId(
  supabase: any,
  clientId: string,
  fallbackAccountantId: string | null,
): Promise<string | null> {
  if (fallbackAccountantId) return fallbackAccountantId;

  const { data, error } = await supabase
    .from("client_accountants")
    .select("accountant_id")
    .eq("client_id", clientId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      `[fetch-efatura-portal] Failed to resolve accountant_id for client ${clientId}: ${error.message}`,
    );
    return null;
  }

  return data?.accountant_id || null;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

interface FlattenedRawEntry {
  key: string;
  value: unknown;
  normalizedKey: string;
  normalizedValue: string;
}

function flattenRawEntries(
  raw: Record<string, unknown>,
): FlattenedRawEntry[] {
  const entries: FlattenedRawEntry[] = [];
  const visit = (value: unknown, path: string, depth: number) => {
    if (depth > 6) return;

    if (Array.isArray(value)) {
      value.forEach((item, idx) => visit(item, `${path}[${idx}]`, depth + 1));
      return;
    }

    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const nextPath = path ? `${path}.${k}` : k;
        visit(v, nextPath, depth + 1);
      }
      return;
    }

    if (!path) return;
    entries.push({
      key: path,
      value,
      normalizedKey: normalizeKey(path),
      normalizedValue: normalizeKey(String(value ?? "")),
    });
  };

  visit(raw, "", 0);
  return entries;
}

function isReceiptLikeDocumentType(docType: string | null | undefined): boolean {
  const normalized = String(docType || "").toUpperCase();
  return ["FR", "RG", "R", "RP", "RE", "FTR", "RC"].includes(normalized);
}

function hasReceiptLikeSemantic(raw: Record<string, unknown>): boolean {
  const merged = flattenRawEntries(raw)
    .map((entry) => `${entry.key}:${String(entry.value ?? "")}`.toLowerCase())
    .join(" | ");

  return (
    merged.includes("recibo") ||
    merged.includes("fatura-recibo") ||
    merged.includes("fatura recibo") ||
    merged.includes("ato isolado")
  );
}

function hasExplicitRetentionSignal(raw: Record<string, unknown>): boolean {
  const patterns = [
    "retencao",
    "impostoretido",
    "withholding",
    "irsretido",
    "retencaofonte",
    "retencaonafonte",
  ];
  return flattenRawEntries(raw).some((entry) =>
    patterns.some((p) =>
      entry.normalizedKey.includes(p) || entry.normalizedValue.includes(p)
    )
  );
}

function parseLooseNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;

  const cleaned = raw.replace(/\s/g, "").replace(/[€$%]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Handle both PT (1.234,56) and US (1,234.56) formats.
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLooseDate(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmyDash = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyDash) return `${dmyDash[3]}-${dmyDash[2]}-${dmyDash[1]}`;

  const dmySlash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmySlash) return `${dmySlash[3]}-${dmySlash[2]}-${dmySlash[1]}`;

  return null;
}

function findFirstNumberByPatterns(
  raw: Record<string, unknown>,
  patterns: string[],
): { value: number | null; key: string | null } {
  const normalizedPatterns = patterns.map(normalizeKey);
  for (const entry of flattenRawEntries(raw)) {
    if (!entry.normalizedKey) continue;
    if (
      normalizedPatterns.some((p) =>
        entry.normalizedKey.includes(p) || entry.normalizedValue.includes(p)
      )
    ) {
      const parsed = parseLooseNumber(entry.value);
      if (parsed != null) return { value: parsed, key: entry.key };
    }
  }
  return { value: null, key: null };
}

function inferIncomeCategory(raw: Record<string, unknown>): "B" | "F" {
  const merged = flattenRawEntries(raw)
    .map((entry) => `${entry.key}:${String(entry.value ?? "")}`.toLowerCase())
    .join(" | ");

  if (
    merged.includes("renda") || merged.includes("predial") ||
    merged.includes("locador") || merged.includes("locat") ||
    merged.includes("arrendamento")
  ) {
    return "F";
  }
  return "B";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateWithholdingConfidence(params: {
  hasExplicitRetentionSignal: boolean;
  isReceiptLike: boolean;
  amountDetected: boolean;
  rateDetected: boolean;
  grossDetected: boolean;
  withholdingAmount: number;
  grossAmount: number;
  withholdingRate: number | null;
}): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  if (params.isReceiptLike) {
    score += 20;
    reasons.push("receipt_like_doc");
  }
  if (params.hasExplicitRetentionSignal) {
    score += 25;
    reasons.push("explicit_retention_fields");
  }
  if (params.amountDetected) {
    score += 15;
    reasons.push("retention_amount_detected");
  }
  if (params.rateDetected) {
    score += 15;
    reasons.push("retention_rate_detected");
  }
  if (params.grossDetected) {
    score += 10;
    reasons.push("gross_amount_detected");
  }
  if (
    params.withholdingAmount >= 0 &&
    params.grossAmount > 0 &&
    params.withholdingAmount <= params.grossAmount
  ) {
    score += 10;
    reasons.push("amount_vs_gross_coherent");
  }
  if (
    params.withholdingRate != null &&
    params.withholdingRate >= 0 &&
    params.withholdingRate <= 100
  ) {
    score += 5;
    reasons.push("rate_in_valid_range");
  }

  return { score: Math.min(score, 100), reason: reasons.join(",") };
}

function extractWithholdingCandidate(
  invoice: PortalInvoice,
  clientNif: string,
  clientName: string | null,
): WithholdingCandidate | null {
  const raw = invoice.raw || {};

  const ratePick = findFirstNumberByPatterns(raw, [
    "taxaretencao",
    "taxaretencaoirs",
    "percentagemretencao",
    "retencaotaxa",
    "taxairs",
    "withholdingtaxpercentage",
    "withholdingrate",
  ]);
  const amountPick = findFirstNumberByPatterns(raw, [
    "valorretencaoirs",
    "valorretencao",
    "retencaoirs",
    "retencaonafonte",
    "retencaofonte",
    "impostoretido",
    "valorretido",
    "retencao",
    "withholdingtaxamount",
    "withholdingamount",
  ]);
  const grossPick = findFirstNumberByPatterns(raw, [
    "valordostrabalhos",
    "valorbruto",
    "baseincidencia",
    "basetributavel",
    "valortributavel",
    "valorsemretencao",
    "iliquido",
    "valor",
    "importancia",
  ]);

  const detectedKeys = [ratePick.key, amountPick.key, grossPick.key].filter(
    (v): v is string => Boolean(v),
  );

  const explicitRetentionSignal = hasExplicitRetentionSignal(raw);

  const docType = String(invoice.tipoDocumento || "").toUpperCase();
  const isReceiptLike = isReceiptLikeDocumentType(docType) ||
    hasReceiptLikeSemantic(raw);

  // Conservative: only import if it is receipt-like AND has explicit retention-related fields.
  if (!isReceiptLike || !explicitRetentionSignal) return null;

  const grossAmount = grossPick.value ??
    (invoice.baseTributavel > 0 ? invoice.baseTributavel : invoice.valorTotal);

  if (!(grossAmount > 0)) return null;

  let withholdingAmount = amountPick.value ?? 0;
  let withholdingRate = ratePick.value;

  if (withholdingRate != null && withholdingRate > 1 && withholdingRate <= 100) {
    // already in percentage
  } else if (withholdingRate != null && withholdingRate > 0 && withholdingRate <= 1) {
    withholdingRate = round2(withholdingRate * 100);
  }

  if (withholdingAmount <= 0 && withholdingRate != null && withholdingRate > 0) {
    withholdingAmount = round2(grossAmount * (withholdingRate / 100));
  }
  if (
    (withholdingRate == null || withholdingRate <= 0) &&
    withholdingAmount > 0
  ) {
    withholdingRate = round2((withholdingAmount / grossAmount) * 100);
  }

  const paymentDate = parseLooseDate(
    raw.dataPagamento || raw.dataRecibo || raw.dataEmissao || invoice.dataEmissao,
  );

  const documentReference = String(invoice.numerodocumento || "").trim();

  if (!paymentDate || !documentReference) return null;

  const confidence = calculateWithholdingConfidence({
    hasExplicitRetentionSignal: explicitRetentionSignal,
    isReceiptLike,
    amountDetected: amountPick.value != null,
    rateDetected: ratePick.value != null,
    grossDetected: grossPick.value != null || invoice.baseTributavel > 0 ||
      invoice.valorTotal > 0,
    withholdingAmount,
    grossAmount,
    withholdingRate: withholdingRate != null ? round2(withholdingRate) : null,
  });

  return {
    beneficiaryNif: clientNif,
    beneficiaryName: clientName,
    incomeCategory: inferIncomeCategory(raw),
    grossAmount: round2(grossAmount),
    withholdingAmount: round2(withholdingAmount),
    withholdingRate: withholdingRate != null ? round2(withholdingRate) : null,
    paymentDate,
    documentReference,
    detectedKeys,
    confidenceScore: confidence.score,
    detectionReason: confidence.reason,
    rawPayload: raw,
  };
}

async function upsertWithholdingsDirectFromPortalInvoices(
  supabase: any,
  clientId: string,
  clientNif: string,
  clientName: string | null,
  invoices: PortalInvoice[],
): Promise<{
  inserted: number;
  skipped: number;
  errors: number;
  candidates: number;
  diagnostics: WithholdingExtractionDiagnostics;
  sampleKeys: string[];
}> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let candidates = 0;
  const keySet = new Set<string>();
  const diagnostics: WithholdingExtractionDiagnostics = {
    vendasInvoicesSeen: 0,
    receiptLikeInvoices: 0,
    retentionSignalInvoices: 0,
    receiptWithSignalInvoices: 0,
    extractedCandidates: 0,
    excludedNotReceiptLike: 0,
    excludedNoRetentionSignal: 0,
    excludedMissingCoreFields: 0,
  };

  for (const inv of invoices) {
    if (inv.sourceType !== "vendas") continue;
    diagnostics.vendasInvoicesSeen++;
    const raw = inv.raw || {};
    const isReceiptLike = isReceiptLikeDocumentType(inv.tipoDocumento) ||
      hasReceiptLikeSemantic(raw);
    const hasSignal = hasExplicitRetentionSignal(raw);
    if (isReceiptLike) diagnostics.receiptLikeInvoices++;
    else diagnostics.excludedNotReceiptLike++;
    if (hasSignal) diagnostics.retentionSignalInvoices++;
    else diagnostics.excludedNoRetentionSignal++;
    if (isReceiptLike && hasSignal) diagnostics.receiptWithSignalInvoices++;

    const candidate = extractWithholdingCandidate(inv, clientNif, clientName);
    if (!candidate) {
      if (isReceiptLike && hasSignal) diagnostics.excludedMissingCoreFields++;
      continue;
    }
    candidates++;
    diagnostics.extractedCandidates++;
    for (const k of candidate.detectedKeys) keySet.add(k);

    const fiscalYear = Number(candidate.paymentDate.slice(0, 4));

    const { data: existing } = await supabase
      .from("tax_withholdings")
      .select("id")
      .eq("beneficiary_nif", candidate.beneficiaryNif)
      .eq("document_reference", candidate.documentReference)
      .eq("fiscal_year", fiscalYear)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      skipped++;
      continue;
    }

    const { data: sales } = await supabase
      .from("sales_invoices")
      .select("id")
      .eq("client_id", clientId)
      .eq("supplier_nif", clientNif)
      .eq("document_number", candidate.documentReference)
      .limit(1)
      .maybeSingle();

    const sourceSalesInvoiceId = sales?.id || null;

    const { error } = await supabase.from("tax_withholdings").insert({
      client_id: clientId,
      fiscal_year: fiscalYear,
      beneficiary_nif: candidate.beneficiaryNif,
      beneficiary_name: candidate.beneficiaryName,
      income_category: candidate.incomeCategory,
      location_code: "C",
      gross_amount: candidate.grossAmount,
      exempt_amount: 0,
      dispensed_amount: 0,
      withholding_rate: candidate.withholdingRate,
      withholding_amount: candidate.withholdingAmount,
      payment_date: candidate.paymentDate,
      document_reference: candidate.documentReference,
      source_sales_invoice_id: sourceSalesInvoiceId,
      status: "draft",
      notes:
        `AT auto portal_json; docType=${inv.tipoDocumento || "?"}; keys=${
          candidate.detectedKeys.join(",") || "none"
        }`,
      is_non_resident: false,
    });

    if (error) {
      errors++;
      console.error(
        "[fetch-efatura-portal] Withholding insert error:",
        error.message,
      );
    } else {
      inserted++;
    }
  }

  return {
    inserted,
    skipped,
    errors,
    candidates,
    diagnostics,
    sampleKeys: Array.from(keySet).slice(0, 20),
  };
}

async function upsertWithholdingCandidatesFromPortalInvoices(
  supabase: any,
  clientId: string,
  clientNif: string,
  clientName: string | null,
  accountantId: string | null,
  syncId: string | null,
  invoices: PortalInvoice[],
): Promise<{
  candidates: number;
  highConfidence: number;
  pendingReview: number;
  promoted: number;
  inserted: number;
  skipped: number;
  errors: number;
  diagnostics: WithholdingExtractionDiagnostics;
  sampleKeys: string[];
}> {
  let candidates = 0;
  let highConfidence = 0;
  let pendingReview = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let promoted = 0;
  const sampleKeys = new Set<string>();
  const autoPromotionIds: string[] = [];
  const diagnostics: WithholdingExtractionDiagnostics = {
    vendasInvoicesSeen: 0,
    receiptLikeInvoices: 0,
    retentionSignalInvoices: 0,
    receiptWithSignalInvoices: 0,
    extractedCandidates: 0,
    excludedNotReceiptLike: 0,
    excludedNoRetentionSignal: 0,
    excludedMissingCoreFields: 0,
  };
  const resolvedAccountantId = await resolveCandidateAccountantId(
    supabase,
    clientId,
    accountantId,
  );

  if (!resolvedAccountantId) {
    console.warn(
      `[fetch-efatura-portal] accountant_id could not be resolved for client ${clientId}. Candidates will be inserted without accountant_id.`,
    );
  }

  for (const inv of invoices) {
    if (inv.sourceType !== "vendas") continue;
    diagnostics.vendasInvoicesSeen++;
    const raw = inv.raw || {};
    const isReceiptLike = isReceiptLikeDocumentType(inv.tipoDocumento) ||
      hasReceiptLikeSemantic(raw);
    const hasSignal = hasExplicitRetentionSignal(raw);
    if (isReceiptLike) diagnostics.receiptLikeInvoices++;
    else diagnostics.excludedNotReceiptLike++;
    if (hasSignal) diagnostics.retentionSignalInvoices++;
    else diagnostics.excludedNoRetentionSignal++;
    if (isReceiptLike && hasSignal) diagnostics.receiptWithSignalInvoices++;

    // Read candidate using the beneficiary from client profile/NIF extracted in caller.
    // Candidate already contains conservative gates and confidence scoring.
    // We pass placeholders and replace with effective values below.
    const candidate = extractWithholdingCandidate(inv, clientNif, clientName);

    if (!candidate) {
      if (isReceiptLike && hasSignal) diagnostics.excludedMissingCoreFields++;
      continue;
    }
    candidates++;
    diagnostics.extractedCandidates++;
    candidate.detectedKeys.forEach((k) => sampleKeys.add(k));

    const fiscalYear = Number(candidate.paymentDate.slice(0, 4));
    const isHighConfidence = candidate.confidenceScore >=
      WITHHOLDING_AUTO_PROMOTION_THRESHOLD;
    if (isHighConfidence) highConfidence++;
    else pendingReview++;

    const { data: salesRow } = await supabase
      .from("sales_invoices")
      .select("id")
      .eq("client_id", clientId)
      .eq("supplier_nif", clientNif)
      .eq("document_number", candidate.documentReference)
      .limit(1)
      .maybeSingle();

    const lookupColumns = ["id", "status", "confidence_score"];

    const { data: existingCandidate, error: existingError } = await supabase
      .from("at_withholding_candidates")
      .select(lookupColumns.join(", "))
      .eq("client_id", clientId)
      .eq("beneficiary_nif", candidate.beneficiaryNif)
      .eq("document_reference", candidate.documentReference)
      .eq("fiscal_year", fiscalYear)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      errors++;
      console.error(
        "[fetch-efatura-portal] Candidate lookup error:",
        existingError.message,
      );
      continue;
    }

    let candidateId: string | null = null;
    let candidateStatus = "pending";

    if (existingCandidate?.id) {
      candidateId = String(existingCandidate.id);
      candidateStatus = String(existingCandidate.status || "pending");

      const statusToPersist = candidateStatus === "pending"
        ? "pending"
        : candidateStatus;

      const updatePayload: Record<string, unknown> = {
        payment_date: candidate.paymentDate,
        beneficiary_name: candidate.beneficiaryName,
        income_category: candidate.incomeCategory,
        gross_amount: candidate.grossAmount,
        withholding_amount: candidate.withholdingAmount,
        withholding_rate: candidate.withholdingRate,
        status: statusToPersist,
        sync_history_id: syncId,
        source_sync_history_id: syncId,
        source_sales_invoice_id: salesRow?.id || null,
        confidence_score: candidate.confidenceScore,
        confidence: candidate.confidenceScore,
        detection_reason: candidate.detectionReason,
        detected_keys: candidate.detectedKeys,
        raw_payload: candidate.rawPayload,
      };

      if (resolvedAccountantId) {
        updatePayload.accountant_id = resolvedAccountantId;
      }

      const { error: updateError } = await supabase
        .from("at_withholding_candidates")
        .update(updatePayload)
        .eq("id", candidateId);

      if (updateError) {
        errors++;
        console.error(
          "[fetch-efatura-portal] Candidate update error:",
          updateError.message,
        );
        continue;
      }

      skipped++;
    } else {
      const insertPayload: Record<string, unknown> = {
        client_id: clientId,
        fiscal_year: fiscalYear,
        payment_date: candidate.paymentDate,
        document_reference: candidate.documentReference,
        beneficiary_nif: candidate.beneficiaryNif,
        beneficiary_name: candidate.beneficiaryName,
        income_category: candidate.incomeCategory,
        gross_amount: candidate.grossAmount,
        withholding_amount: candidate.withholdingAmount,
        withholding_rate: candidate.withholdingRate,
        status: "pending",
        sync_history_id: syncId,
        source_sync_history_id: syncId,
        source_sales_invoice_id: salesRow?.id || null,
        confidence_score: candidate.confidenceScore,
        confidence: candidate.confidenceScore,
        detection_reason: candidate.detectionReason,
        detected_keys: candidate.detectedKeys,
        raw_payload: candidate.rawPayload,
      };

      if (resolvedAccountantId) {
        insertPayload.accountant_id = resolvedAccountantId;
      }

      const { data: insertedCandidate, error: insertError } = await supabase
        .from("at_withholding_candidates")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        errors++;
        console.error(
          "[fetch-efatura-portal] Candidate insert error:",
          insertError.message,
        );
        continue;
      }

      candidateId = String(insertedCandidate.id);
      inserted++;
    }

    if (
      candidateId &&
      candidateStatus === "pending" &&
      candidate.confidenceScore >= WITHHOLDING_AUTO_PROMOTION_THRESHOLD
    ) {
      autoPromotionIds.push(candidateId);
    }
  }

  if (
    ENABLE_WITHHOLDINGS_AUTO_PROMOTION &&
    autoPromotionIds.length > 0
  ) {
    const { data: promoteResult, error: promoteError } = await supabase.rpc(
      "promote_withholding_candidates",
      {
        p_client_id: clientId,
        p_ids: autoPromotionIds,
        p_mode: "auto",
      },
    );

    if (promoteError) {
      errors++;
      console.error(
        "[fetch-efatura-portal] Auto promotion error:",
        promoteError.message,
      );
    } else {
      promoted = Number(promoteResult?.promoted || 0);
      pendingReview = Math.max(candidates - promoted, 0);
    }
  } else {
    pendingReview = candidates;
  }

  return {
    candidates,
    highConfidence,
    pendingReview,
    promoted,
    inserted,
    skipped,
    errors,
    diagnostics,
    sampleKeys: Array.from(sampleKeys).slice(0, 20),
  };
}

// Extract cookies from Set-Cookie headers
function extractCookies(headers: Headers): string {
  const cookies: string[] = [];
  // Deno handles multiple Set-Cookie headers via getSetCookie
  const setCookieHeaders = headers.getSetCookie?.() || [];
  for (const setCookie of setCookieHeaders) {
    const cookiePart = setCookie.split(";")[0];
    if (cookiePart) cookies.push(cookiePart);
  }
  // Also try the standard way
  const singleHeader = headers.get("set-cookie");
  if (singleHeader && cookies.length === 0) {
    const parts = singleHeader.split(",");
    for (const part of parts) {
      const cookiePart = part.split(";")[0]?.trim();
      if (cookiePart && cookiePart.includes("=")) cookies.push(cookiePart);
    }
  }
  return cookies.join("; ");
}

// Merge cookie strings
function mergeCookies(...cookieStrings: string[]): string {
  const cookieMap = new Map<string, string>();
  for (const cs of cookieStrings) {
    if (!cs) continue;
    for (const pair of cs.split("; ")) {
      const [name] = pair.split("=");
      if (name) cookieMap.set(name.trim(), pair);
    }
  }
  return Array.from(cookieMap.values()).join("; ");
}

function extractCsrfFromCookies(cookieString: string): string | null {
  const csrfNames = ["XSRF-TOKEN", "CSRF-TOKEN", "_csrf", "csrfToken"];
  for (const name of csrfNames) {
    const match = cookieString.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

function extractCsrfFromHtml(
  html: string,
): { token: string; header: string } | null {
  const tokenMatch = html.match(
    /name=["']_csrf["']\s+content=["']([^"']+)["']/i,
  );
  const headerMatch = html.match(
    /name=["']_csrf_header["']\s+content=["']([^"']+)["']/i,
  );
  if (!tokenMatch?.[1]) return null;
  return {
    token: tokenMatch[1],
    header: headerMatch?.[1] || "X-CSRF-TOKEN",
  };
}

// Decrypt password using AES-256-GCM (same as sync-efatura)
async function decryptPassword(
  encryptedData: string,
  secret: string,
): Promise<string> {
  if (!encryptedData || typeof encryptedData !== "string") {
    throw new Error("Password vazia");
  }

  // Backward compatibility: some legacy rows were stored as plaintext.
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    return encryptedData;
  }

  const [saltB64, ivB64, ciphertextB64] = encryptedData.split(":");

  const fromBase64 = (b64: string): Uint8Array => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ciphertextB64);
  const saltBuffer = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength,
  ) as ArrayBuffer;
  const ivBuffer = iv.buffer.slice(
    iv.byteOffset,
    iv.byteOffset + iv.byteLength,
  ) as ArrayBuffer;
  const ciphertextBuffer = ciphertext.buffer.slice(
    ciphertext.byteOffset,
    ciphertext.byteOffset + ciphertext.byteLength,
  ) as ArrayBuffer;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    key,
    ciphertextBuffer,
  );

  return new TextDecoder().decode(decrypted);
}

// Step 1: Login to Portal das Financas
async function loginToPortal(
  nif: string,
  password: string,
): Promise<{ success: boolean; cookies: string; error?: string }> {
  try {
    console.log(
      `[fetch-efatura-portal] Login attempt: NIF=${nif}, password length=${password.length}`,
    );

    const loginSubmitUrl = "https://www.acesso.gov.pt/v2/submitNifForm";
    const loginPageUrl =
      "https://www.acesso.gov.pt/v2/loginForm?partID=EFPF&path=painelAdquirente.action";

    let sessionCookies = "";

    // Retry once if CSRF token is stale/missing.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const loginPageResp = await fetch(loginPageUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      console.log(
        `[fetch-efatura-portal] Login page attempt ${attempt}: status=${loginPageResp.status}, finalUrl=${loginPageResp.url}`,
      );

      const pageCookies = extractCookies(loginPageResp.headers);
      sessionCookies = mergeCookies(sessionCookies, pageCookies);
      const loginPageHtml = await loginPageResp.text();

      const allHiddenFields: Record<string, string> = {};
      const hiddenMatches = loginPageHtml.matchAll(
        /<input[^>]*type=["']hidden["'][^>]*>/gi,
      );
      for (const m of hiddenMatches) {
        const nameMatch = m[0].match(/name=["']([^"']+)["']/);
        const valueMatch = m[0].match(/value=["']([^"']*)["']/);
        if (nameMatch) {
          allHiddenFields[nameMatch[1]] = valueMatch ? valueMatch[1] : "";
        }
      }

      const csrfFromCookies = extractCsrfFromCookies(sessionCookies);
      const csrfFromMeta = extractCsrfFromHtml(loginPageHtml);
      const csrfToken = csrfFromMeta?.token || csrfFromCookies;

      console.log(
        `[fetch-efatura-portal] Hidden fields found: ${
          JSON.stringify(Object.keys(allHiddenFields))
        }`,
      );
      console.log(
        `[fetch-efatura-portal] CSRF from cookies: ${
          csrfFromCookies ? "yes" : "no"
        }, from meta: ${csrfFromMeta ? "yes" : "no"}`,
      );

      // Submit login form — include all hidden fields plus auth data and CSRF if available.
      const formData = new URLSearchParams();

      for (const [key, value] of Object.entries(allHiddenFields)) {
        formData.append(key, value);
      }

      formData.set("partID", "EFPF");
      formData.set("authVersion", "1");
      formData.set("selectedAuthMethod", "N");
      formData.set("username", nif);
      formData.set("password", password);
      formData.set("path", allHiddenFields.path || "painelAdquirente.action");

      if (csrfToken) {
        formData.set("_csrf", csrfToken);
      }

      const loginHeaders: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": sessionCookies,
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": loginPageUrl,
      };

      if (csrfToken) {
        loginHeaders["X-XSRF-TOKEN"] = csrfToken;
        loginHeaders["X-CSRF-TOKEN"] = csrfToken;
        if (csrfFromMeta?.header) {
          loginHeaders[csrfFromMeta.header] = csrfToken;
        }
      }

      const loginResp = await fetch(loginSubmitUrl, {
        method: "POST",
        headers: loginHeaders,
        body: formData.toString(),
        redirect: "manual",
      });

      const loginCookies = extractCookies(loginResp.headers);
      sessionCookies = mergeCookies(sessionCookies, loginCookies);

      // Check for redirect to e-Fatura portal
      const location = loginResp.headers.get("location");
      const loginBody = await loginResp.text();

      console.log(
        `[fetch-efatura-portal] Login submit attempt ${attempt}: status=${loginResp.status}, location=${
          location || "none"
        }, bodyLength=${loginBody.length}, bodyPreview=${
          loginBody.substring(0, 500).replace(/\n/g, " ")
        }`,
      );

      if (loginBody.length > 500) {
        console.log(
          `[fetch-efatura-portal] Login body mid: ${
            loginBody.substring(500, 1500).replace(/\n/g, " ")
          }`,
        );
      }

      const csrfBlocked = loginResp.status === 403 ||
        loginBody.includes("invalidCsrfToken");
      if (csrfBlocked && attempt === 1) {
        console.log(
          `[fetch-efatura-portal] CSRF rejection on attempt 1. Retrying once with fresh token.`,
        );
        continue;
      }
      if (csrfBlocked) {
        console.log(
          `[fetch-efatura-portal] Login blocked: CSRF token required/invalid after retry (status=${loginResp.status})`,
        );
        return {
          success: false,
          cookies: "",
          error: "Portal AT requer token CSRF válido. Tente novamente.",
        };
      }

      // NEW SPA detection: check for successful login via data attributes
      if (
        loginResp.status === 200 &&
        loginBody.includes("data-session-user-nif") &&
        !loginBody.includes("data-submit-nif-form-username")
      ) {
        console.log(
          `[fetch-efatura-portal] SPA login success detected via data attributes`,
        );
        return { success: true, cookies: sessionCookies };
      }

      // NEW SPA detection: if the login form was re-rendered with our NIF, credentials are wrong
      if (loginBody.includes(`data-submit-nif-form-username="${nif}"`)) {
        console.log(
          `[fetch-efatura-portal] SPA login FAILED: login form re-rendered with submitted NIF`,
        );
        return {
          success: false,
          cookies: "",
          error: "Credenciais inválidas. Verifique NIF e password.",
        };
      }

      // If we got a redirect, follow it to get the e-Fatura session
      if (
        location &&
        (location.includes("faturas.portaldasfinancas") ||
          location.includes("efatura"))
      ) {
        console.log(
          `[fetch-efatura-portal] Following redirect to: ${location}`,
        );
        const redirectResp = await fetch(location, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Cookie": sessionCookies,
            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          redirect: "manual",
        });

        const redirectCookies = extractCookies(redirectResp.headers);
        sessionCookies = mergeCookies(sessionCookies, redirectCookies);
        console.log(
          `[fetch-efatura-portal] Redirect 1: status=${redirectResp.status}`,
        );

        // May have further redirects
        const location2 = redirectResp.headers.get("location");
        if (location2) {
          console.log(
            `[fetch-efatura-portal] Following redirect 2 to: ${location2}`,
          );
          const redirect2Resp = await fetch(location2, {
            method: "GET",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Cookie": sessionCookies,
            },
            redirect: "manual",
          });
          const redirect2Cookies = extractCookies(redirect2Resp.headers);
          sessionCookies = mergeCookies(sessionCookies, redirect2Cookies);
          console.log(
            `[fetch-efatura-portal] Redirect 2: status=${redirect2Resp.status}`,
          );
        }

        return { success: true, cookies: sessionCookies };
      }

      // Try to extract redirect form from HTML body (some login flows use form-based redirect)
      if (
        loginBody.includes("loginRedirectForm") ||
        loginBody.includes("redirectForm")
      ) {
        console.log(`[fetch-efatura-portal] Found redirect form in HTML body`);
        // Extract form action and hidden fields
        const actionMatch = loginBody.match(/action="([^"]+)"/);
        const formAction = actionMatch ? actionMatch[1] : "";

        if (formAction && formAction.includes("faturas.portaldasfinancas")) {
          // Extract all hidden inputs
          const hiddenFields = new URLSearchParams();
          const inputMatches = loginBody.matchAll(
            /name="([^"]+)"[^>]*value="([^"]*)"/g,
          );
          for (const match of inputMatches) {
            hiddenFields.append(match[1], match[2]);
          }

          const formResp = await fetch(formAction, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Cookie": sessionCookies,
            },
            body: hiddenFields.toString(),
            redirect: "manual",
          });

          const formCookies = extractCookies(formResp.headers);
          sessionCookies = mergeCookies(sessionCookies, formCookies);
          console.log(
            `[fetch-efatura-portal] Form redirect: status=${formResp.status}`,
          );
          return { success: true, cookies: sessionCookies };
        }
      }

      // Check if login actually failed - use SPECIFIC Portuguese AT portal error messages only
      if (
        loginBody.includes("dados de autenticação inválidos") ||
        loginBody.includes("Credenciais inválidas") ||
        loginBody.includes("autenticação falhou")
      ) {
        console.log(
          `[fetch-efatura-portal] Login FAILED: specific auth error found in response`,
        );
        return {
          success: false,
          cookies: "",
          error: "Credenciais inválidas. Verifique NIF e password.",
        };
      }

      // Check for 2FA requirement — use specific patterns to avoid false positives
      // Generic words like 'SMS' appear in portal menus/footers even without 2FA
      const has2FA = (loginBody.includes("código de segurança") &&
        loginBody.includes("confirmar")) ||
        loginBody.includes("introduza o código") ||
        loginBody.includes("código enviado por SMS") ||
        loginBody.includes("segundo fator de autenticação") ||
        (loginBody.includes("2FA") && loginBody.includes("verificação"));
      if (has2FA) {
        console.log(
          `[fetch-efatura-portal] Login blocked by 2FA requirement. Body preview: ${
            loginBody.substring(0, 500)
          }`,
        );
        return {
          success: false,
          cookies: "",
          error:
            "Portal AT exige autenticação de dois factores (2FA/SMS). Sincronização automática não disponível.",
        };
      }

      // If we got this far without a clear redirect or error, try anyway with current cookies
      console.log(
        `[fetch-efatura-portal] No clear redirect or error detected. Proceeding with current cookies.`,
      );
      return { success: true, cookies: sessionCookies };
    }

    return {
      success: false,
      cookies: "",
      error: "Falha inesperada no fluxo de login.",
    };
  } catch (error: any) {
    console.error("[fetch-efatura-portal] Login error:", error);
    return {
      success: false,
      cookies: "",
      error: `Login failed: ${error.message}`,
    };
  }
}

// Step 1b: Bootstrap session on e-Fatura domain after successful login
// Follows redirects up to 5 times and merges cookies from each response
// Returns success only if final page is NOT a login form
async function bootstrapPortalSession(
  cookies: string,
  maxRedirects: number = 5,
): Promise<{ success: boolean; cookies: string; error?: string }> {
  try {
    console.log(
      `[fetch-efatura-portal] Bootstrapping session on faturas.portaldasfinancas.gov.pt`,
    );

    const bootstrapUrl =
      "https://faturas.portaldasfinancas.gov.pt/painelAdquirente.action";
    let currentUrl = bootstrapUrl;
    let currentCookies = cookies;
    let redirectCount = 0;

    // Follow redirects up to maxRedirects times
    while (redirectCount < maxRedirects) {
      console.log(
        `[fetch-efatura-portal] Bootstrap request ${
          redirectCount + 1
        }: ${currentUrl}`,
      );

      const resp = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Cookie": currentCookies,
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
      });

      console.log(
        `[fetch-efatura-portal] Bootstrap response: status=${resp.status}`,
      );

      // Merge cookies from this response
      const newCookies = extractCookies(resp.headers);
      currentCookies = mergeCookies(currentCookies, newCookies);

      // Check for redirect
      const location = resp.headers.get("location");
      if (location && (redirectCount < maxRedirects - 1)) {
        currentUrl = location;
        redirectCount++;
        console.log(
          `[fetch-efatura-portal] Following redirect to: ${location}`,
        );
        continue;
      }

      // Final response reached - check if it's a login page
      const bodyText = await resp.text();

      // Check for login form indicators
      const hasLoginForm =
        /name=["']username["']|name=["']nif["']|action=["'].*login/i.test(
          bodyText,
        );

      if (hasLoginForm) {
        console.log(
          `[fetch-efatura-portal] Bootstrap FAILED: Final page contains login form`,
        );
        return {
          success: false,
          cookies: "",
          error: "Session not established - login form still present",
        };
      }

      console.log(
        `[fetch-efatura-portal] Bootstrap SUCCESS: Session established, no login form detected`,
      );
      return { success: true, cookies: currentCookies };
    }

    console.log(
      `[fetch-efatura-portal] Bootstrap exceeded max redirects (${maxRedirects})`,
    );
    return {
      success: false,
      cookies: "",
      error: "Too many redirects during bootstrap",
    };
  } catch (error: any) {
    console.error("[fetch-efatura-portal] Bootstrap error:", error);
    return {
      success: false,
      cookies: "",
      error: `Bootstrap failed: ${error.message}`,
    };
  }
}

// Step 2: Fetch invoices from the portal JSON endpoint
async function fetchInvoicesFromPortal(
  cookies: string,
  nif: string,
  startDate: string,
  endDate: string,
  type: "compras" | "vendas",
): Promise<
  {
    success: boolean;
    invoices: PortalInvoice[];
    totalRecords: number;
    error?: string;
  }
> {
  try {
    const endpoint = type === "compras"
      ? "https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosAdquirente.action"
      : "https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosEmitente.action";

    const params = new URLSearchParams({
      dataInicioFilter: startDate,
      dataFimFilter: endDate,
      ambitoAquisicaoFilter: "TODOS",
      _: Date.now().toString(),
    });

    const resp = await fetch(`${endpoint}?${params.toString()}`, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": cookies,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer":
          "https://faturas.portaldasfinancas.gov.pt/consultarDocumentosAdquirente.action",
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (
        text.includes("login") || text.includes("autenticacao") ||
        resp.status === 302
      ) {
        return {
          success: false,
          invoices: [],
          totalRecords: 0,
          error: "Sessão expirada. Tente novamente.",
        };
      }
      return {
        success: false,
        invoices: [],
        totalRecords: 0,
        error: `Portal returned ${resp.status}`,
      };
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      // Probably got redirected to login page
      return {
        success: false,
        invoices: [],
        totalRecords: 0,
        error: "Sessão expirada ou credenciais inválidas.",
      };
    }

    const data = await resp.json();

    // The portal returns an object with "linhas" array
    const linhas = data.linhas || data.lines || data.documentos || [];
    const totalRecords = data.totalElementos || data.totalRecords ||
      linhas.length;

    const invoices: PortalInvoice[] = linhas.map((l: any) => ({
      nifEmitente: l.nifEmitente || l.nif || "",
      nomeEmitente: l.nomeEmitente || l.nome || "",
      numerodocumento: l.numerodocumento || l.numDocumento ||
        l.documentNumber || "",
      dataEmissao: l.dataEmissao || l.data || "",
      tipoDocumento: l.tipoDocumento || l.tipo || "FT",
      atcud: l.atcud || "",
      valorTotal: parseFloat(l.valorTotal || l.total || 0),
      valorIVA: parseFloat(l.valorIVA || l.iva || 0),
      baseTributavel: parseFloat(l.baseTributavel || l.baseIncidencia || 0),
      actividadeEmitente: l.actividadeEmitente || l.actividade || undefined,
      situacao: l.situacao || l.estado || undefined,
      sourceType: type,
      raw: l,
    }));

    return { success: true, invoices, totalRecords };
  } catch (error: any) {
    console.error("[fetch-efatura-portal] Fetch error:", error);
    return {
      success: false,
      invoices: [],
      totalRecords: 0,
      error: error.message,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isServiceRole = token === supabaseServiceKey;

    const {
      clientId,
      accountantId,
      startDate,
      endDate,
      type = "compras",
      syncWithholdings = false,
    }: FetchRequest = await req.json();
    let requestingUserId: string | null = null;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId is required", success: false }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Security: allow only service-role internal calls OR authenticated accountant
    // explicitly associated with the target client.
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        token,
      );
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      requestingUserId = user.id;

      const { data: roleRow, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "accountant")
        .limit(1)
        .maybeSingle();

      if (roleError || !roleRow) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Forbidden: accountant role required",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: linkRow, error: linkError } = await supabase
        .from("client_accountants")
        .select("client_id")
        .eq("accountant_id", user.id)
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle();

      if (linkError || !linkRow) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Forbidden: no access to this client",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Get client credentials (portal NIF + password)
    const credentialsQuery = supabase
      .from("at_credentials")
      .select("*")
      .eq("client_id", clientId)
      .limit(1);

    const requestedAccountantId = typeof accountantId === "string" &&
        accountantId.trim().length > 0
      ? accountantId.trim()
      : null;

    const { data: credentials, error: credentialsError } = requestingUserId
      ? await credentialsQuery.eq("accountant_id", requestingUserId)
      : (requestedAccountantId
        ? await credentialsQuery.eq("accountant_id", requestedAccountantId)
        : await credentialsQuery);

    if (credentialsError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao carregar credenciais AT: ${credentialsError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const cred = credentials?.[0];
    if (!cred) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Credenciais AT não configuradas para este cliente.",
          missingConfig: { credentials: true },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get client NIF from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("nif, full_name")
      .eq("id", clientId)
      .single();

    const clientNif = cred.portal_nif || profile?.nif;
    const clientName = profile?.full_name || null;
    if (!clientNif) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "NIF do cliente não encontrado.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Decrypt portal password
    const encryptionSecret = Deno.env.get("AT_ENCRYPTION_KEY") ||
      supabaseServiceKey.substring(0, 32);
    let portalPassword: string;

    const passwordField = cred.portal_password_encrypted ||
      cred.encrypted_password;
    if (!passwordField) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Password do Portal das Finanças não configurada.",
          missingConfig: { portal_password: true },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    try {
      portalPassword = await decryptPassword(passwordField, encryptionSecret);
      console.log(
        `[fetch-efatura-portal] Decrypted password length=${portalPassword.length}`,
      );
    } catch (err) {
      console.error("[fetch-efatura-portal] Decrypt error:", err);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Erro ao desencriptar credenciais.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Calculate date range (default: current quarter)
    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const quarterStart = new Date(
      now.getFullYear(),
      (currentQuarter - 1) * 3,
      1,
    );
    const quarterEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);

    const effectiveStartDate = startDate ||
      quarterStart.toISOString().split("T")[0];
    const effectiveEndDate = endDate || quarterEnd.toISOString().split("T")[0];

    // Create sync history entry
    const { data: syncEntry } = await supabase
      .from("at_sync_history")
      .insert({
        client_id: clientId,
        sync_type: type,
        sync_method: "portal",
        start_date: effectiveStartDate,
        end_date: effectiveEndDate,
        status: "running",
        metadata: { method: "portal_json", nif: clientNif },
      })
      .select("id")
      .single();

    const syncId = syncEntry?.id;

    console.log(`[fetch-efatura-portal] Logging in for NIF ${clientNif}...`);

    // Step 1: Login
    const loginResult = await loginToPortal(clientNif, portalPassword);

    if (!loginResult.success) {
      if (syncId) {
        await supabase.from("at_sync_history").update({
          status: "error",
          error_message: loginResult.error,
          completed_at: new Date().toISOString(),
        }).eq("id", syncId);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: loginResult.error || "Login falhou",
          syncId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[fetch-efatura-portal] Login OK. Bootstrapping session on e-Fatura domain...`,
    );

    // Step 1b: Bootstrap session on e-Fatura domain
    const bootstrapResult = await bootstrapPortalSession(loginResult.cookies);

    if (!bootstrapResult.success) {
      if (syncId) {
        await supabase.from("at_sync_history").update({
          status: "error",
          error_message: bootstrapResult.error || "Session bootstrap failed",
          completed_at: new Date().toISOString(),
        }).eq("id", syncId);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: bootstrapResult.error || "Session bootstrap falhou",
          syncId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[fetch-efatura-portal] Session bootstrap OK. Fetching invoices...`,
    );

    // Step 2: Fetch invoices
    const allInvoices: PortalInvoice[] = [];
    const queries: Array<"compras" | "vendas"> = [];
    const queryResults: Map<
      string,
      { success: boolean; count: number; error?: string }
    > = new Map();
    let hasErrors = false;
    let hasSuccesses = false;

    if (type === "compras" || type === "ambos") queries.push("compras");
    if (type === "vendas" || type === "ambos") queries.push("vendas");

    for (const queryType of queries) {
      const result = await fetchInvoicesFromPortal(
        bootstrapResult.cookies,
        clientNif,
        effectiveStartDate,
        effectiveEndDate,
        queryType,
      );

      if (result.success) {
        allInvoices.push(...result.invoices);
        queryResults.set(queryType, {
          success: true,
          count: result.invoices.length,
        });
        hasSuccesses = true;
        console.log(
          `[fetch-efatura-portal] ${queryType}: ${result.invoices.length} invoices`,
        );
      } else {
        queryResults.set(queryType, {
          success: false,
          count: 0,
          error: result.error,
        });
        hasErrors = true;
        console.error(
          `[fetch-efatura-portal] ${queryType} error: ${result.error}`,
        );
      }
    }

    // BUG 4 FIX: Determine overall status based on query results
    let overallStatus = "success";
    let overallError: string | null = null;

    if (!hasSuccesses && hasErrors) {
      // All queries failed
      overallStatus = "error";
      overallError = Array.from(queryResults.values())
        .filter((r) => r.error)
        .map((r) => r.error)
        .join("; ");
    } else if (hasErrors && hasSuccesses) {
      // Some queries succeeded, some failed
      overallStatus = "partial";
    }

    console.log(
      `[fetch-efatura-portal] Query status: ${overallStatus}, hasSuccesses=${hasSuccesses}, hasErrors=${hasErrors}`,
    );

    // Step 3: Map to invoices table format and insert
    let insertedCount = 0;
    let skippedCount = 0;
    let insertedPurchases = 0;
    let skippedPurchases = 0;
    let insertedSales = 0;
    let skippedSales = 0;
    let withholdingsInserted = 0;
    let withholdingsSkipped = 0;
    let withholdingsErrors = 0;
    let withholdingsCandidates = 0;
    let withholdingsHighConfidence = 0;
    let withholdingsPendingReview = 0;
    let withholdingsPromoted = 0;
    let withholdingsSampleKeys: string[] = [];
    let withholdingsDiagnostics: WithholdingExtractionDiagnostics = {
      vendasInvoicesSeen: 0,
      receiptLikeInvoices: 0,
      retentionSignalInvoices: 0,
      receiptWithSignalInvoices: 0,
      extractedCandidates: 0,
      excludedNotReceiptLike: 0,
      excludedNoRetentionSignal: 0,
      excludedMissingCoreFields: 0,
    };
    let withholdingsMode: "direct" | "candidates" = "direct";

    for (const inv of allInvoices) {
      const targetTable = inv.sourceType === "vendas" ? "sales_invoices" : "invoices";
      const isSale = targetTable === "sales_invoices";
      const supplierNif = isSale ? clientNif : (inv.nifEmitente || "PORTAL");

      // Check for duplicates
      if (inv.numerodocumento) {
        const duplicateQuery = supabase
          .from(targetTable)
          .select("id")
          .eq("client_id", clientId)
          .eq("document_number", inv.numerodocumento)
          .limit(1);

        const { data: existing } = isSale
          ? await duplicateQuery.eq("supplier_nif", clientNif)
          : await duplicateQuery.eq("supplier_nif", inv.nifEmitente || "PORTAL");

        if (existing && existing.length > 0) {
          skippedCount++;
          if (isSale) skippedSales++;
          else skippedPurchases++;
          continue;
        }
      }

      // Parse date (DD-MM-YYYY or YYYY-MM-DD)
      let docDate = inv.dataEmissao;
      const dmyMatch = docDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (dmyMatch) {
        docDate = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
      }

      // Determine VAT rate category
      const vatRate = inv.baseTributavel > 0
        ? Math.round((inv.valorIVA / inv.baseTributavel) * 100)
        : 0;

      const vatFields: Record<string, number | null> = {
        base_standard: null,
        vat_standard: null,
        base_intermediate: null,
        vat_intermediate: null,
        base_reduced: null,
        vat_reduced: null,
        base_exempt: null,
      };

      if (vatRate >= 20) {
        vatFields.base_standard = inv.baseTributavel;
        vatFields.vat_standard = inv.valorIVA;
      } else if (vatRate >= 10) {
        vatFields.base_intermediate = inv.baseTributavel;
        vatFields.vat_intermediate = inv.valorIVA;
      } else if (vatRate >= 4) {
        vatFields.base_reduced = inv.baseTributavel;
        vatFields.vat_reduced = inv.valorIVA;
      } else if (inv.baseTributavel > 0) {
        vatFields.base_exempt = inv.baseTributavel;
      }

      const dateObj = new Date(docDate);
      const fiscalPeriod = `${dateObj.getFullYear()}${
        String(dateObj.getMonth() + 1).padStart(2, "0")
      }`;

      const commonPayload = {
        client_id: clientId,
        supplier_nif: supplierNif,
        supplier_name: inv.nomeEmitente || null,
        document_date: docDate,
        document_number: inv.numerodocumento || null,
        document_type: inv.tipoDocumento || "FT",
        atcud: inv.atcud || null,
        total_amount: inv.valorTotal,
        total_vat: inv.valorIVA,
        ...vatFields,
        fiscal_period: fiscalPeriod,
        fiscal_region: "PT",
      };

      const { error } = isSale
        ? await supabase.from("sales_invoices").insert({
          ...commonPayload,
          customer_nif: inv.nifEmitente || null,
          customer_name: inv.nomeEmitente || null,
          image_path: `at-portal-sales/${clientId}/${inv.numerodocumento || Date.now()}`,
          status: "validated",
          validated_at: new Date().toISOString(),
          notes: "Imported from AT portal (vendas)",
        })
        : await supabase.from("invoices").insert({
          ...commonPayload,
          image_path: `efatura-portal/${clientId}/${inv.numerodocumento || Date.now()}`,
          status: "pending",
          efatura_source: "portal_json",
          data_authority: "at_portal",
        });

      if (!error) {
        insertedCount++;
        if (isSale) insertedSales++;
        else insertedPurchases++;
      } else {
        console.error(
          `[fetch-efatura-portal] Insert error (${targetTable}):`,
          error.message,
        );
      }
    }

    if (syncWithholdings) {
      if (ENABLE_WITHHOLDINGS_CANDIDATES) {
        withholdingsMode = "candidates";
        const candidateResult = await upsertWithholdingCandidatesFromPortalInvoices(
          supabase,
          clientId,
          clientNif,
          clientName,
          cred.accountant_id || null,
          syncId || null,
          allInvoices,
        );
        withholdingsInserted = candidateResult.inserted;
        withholdingsSkipped = candidateResult.skipped;
        withholdingsErrors = candidateResult.errors;
        withholdingsCandidates = candidateResult.candidates;
        withholdingsHighConfidence = candidateResult.highConfidence;
        withholdingsPendingReview = candidateResult.pendingReview;
        withholdingsPromoted = candidateResult.promoted;
        withholdingsSampleKeys = candidateResult.sampleKeys;
        withholdingsDiagnostics = candidateResult.diagnostics;
      } else {
        withholdingsMode = "direct";
        const withholdingResult = await upsertWithholdingsDirectFromPortalInvoices(
          supabase,
          clientId,
          clientNif,
          clientName,
          allInvoices,
        );
        withholdingsInserted = withholdingResult.inserted;
        withholdingsSkipped = withholdingResult.skipped;
        withholdingsErrors = withholdingResult.errors;
        withholdingsCandidates = withholdingResult.candidates;
        withholdingsHighConfidence = withholdingResult.candidates;
        withholdingsPendingReview = 0;
        withholdingsPromoted = withholdingResult.inserted;
        withholdingsSampleKeys = withholdingResult.sampleKeys;
        withholdingsDiagnostics = withholdingResult.diagnostics;
      }

      console.log(
        `[fetch-efatura-portal] Withholdings sync (${withholdingsMode}): candidates=${withholdingsCandidates}, inserted=${withholdingsInserted}, promoted=${withholdingsPromoted}, pendingReview=${withholdingsPendingReview}, skipped=${withholdingsSkipped}, errors=${withholdingsErrors}`,
      );
    }

    // Update sync history
    if (syncId) {
      await supabase.from("at_sync_history").update({
        status: overallStatus,
        error_message: overallError,
        records_imported: insertedCount,
        completed_at: new Date().toISOString(),
        metadata: {
          method: "portal_json",
          nif: clientNif,
          total_found: allInvoices.length,
          inserted: insertedCount,
          skipped: skippedCount,
          directions: {
            compras: {
              inserted: insertedPurchases,
              skipped: skippedPurchases,
              totalRecords: queryResults.get("compras")?.count || 0,
              error: queryResults.get("compras")?.error || null,
            },
            vendas: {
              inserted: insertedSales,
              skipped: skippedSales,
              totalRecords: queryResults.get("vendas")?.count || 0,
              error: queryResults.get("vendas")?.error || null,
            },
          },
          queryDetails: Object.fromEntries(queryResults),
          syncWithholdings,
          withholdings: {
            mode: withholdingsMode,
            candidates: withholdingsCandidates,
            highConfidence: withholdingsHighConfidence,
            pendingReview: withholdingsPendingReview,
            promoted: withholdingsPromoted,
            inserted: withholdingsInserted,
            skipped: withholdingsSkipped,
            errors: withholdingsErrors,
            sampleKeys: withholdingsSampleKeys,
            diagnostics: withholdingsDiagnostics,
          },
        },
      }).eq("id", syncId);
    }

    // Update credentials last sync
    await supabase.from("at_credentials").update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: overallStatus,
      last_sync_error: overallError,
    }).eq("client_id", clientId);

    console.log(
      `[fetch-efatura-portal] Done: status=${overallStatus}, ${insertedCount} inserted, ${skippedCount} skipped`,
    );

    // BUG 4 FIX: Return appropriate success/error based on overall status
    if (overallStatus === "error") {
      return new Response(
        JSON.stringify({
          success: false,
          error: overallError || "Sync queries failed",
          syncId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const responseInvoices = allInvoices.map(({ raw: _raw, ...rest }) => rest);

    return new Response(
      JSON.stringify({
        success: true,
        status: overallStatus,
        count: insertedCount,
        invoicesProcessed: allInvoices.length,
        invoices: responseInvoices,
        syncId,
        skipped: skippedCount,
        withholdings: {
          enabled: syncWithholdings,
          mode: withholdingsMode,
          candidates: withholdingsCandidates,
          highConfidence: withholdingsHighConfidence,
          pendingReview: withholdingsPendingReview,
          promoted: withholdingsPromoted,
          inserted: withholdingsInserted,
          skipped: withholdingsSkipped,
          errors: withholdingsErrors,
          sampleKeys: withholdingsSampleKeys,
          diagnostics: withholdingsDiagnostics,
        },
        message: insertedCount > 0
          ? `${insertedCount} facturas importadas do portal e-Fatura`
          : allInvoices.length > 0
          ? `${skippedCount} facturas já existem na base de dados`
          : "Nenhuma factura encontrada no período seleccionado",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[fetch-efatura-portal] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
