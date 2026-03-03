/**
 * sync-efatura Edge Function
 *
 * Syncs invoices from AT (Autoridade Tributária) via the official SOAP/mTLS
 * webservice, proxied through an external VPS connector (Node/OpenSSL).
 *
 * Why external connector:
 * - Supabase Edge runs on Deno/rustls and may fail AT legacy TLS handshakes.
 *
 * Requires AT_CONNECTOR_URL and AT_CONNECTOR_TOKEN secrets configured.
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SyncRequest {
  clientId: string;
  accountantId?: string;
  environment: "test" | "production";
  type: "compras" | "vendas" | "ambos";
  startDate?: string;
  endDate?: string;
  nif?: string;
}

interface ATLineSummary {
  taxCode: string;
  taxPercentage: number;
  taxCountryRegion: string;
  amount: number;
  taxAmount: number;
}

interface ATInvoice {
  supplierNif: string;
  supplierName: string;
  customerNif: string;
  customerName?: string;
  documentNumber: string;
  documentDate: string;
  documentType: string;
  atcud?: string;
  grossTotal: number;
  netTotal: number;
  taxPayable: number;
  lineSummary: ATLineSummary[];
}

type SyncReasonCode =
  | "AT_YEAR_UNAVAILABLE"
  | "AT_STARTDATE_FUTURE"
  | "AT_EMPTY_LIST"
  | "AT_AUTH_FAILED"
  | "AT_SCHEMA_RESPONSE_ERROR"
  | "INVALID_CLIENT_NIF"
  | "YEAR_IN_FUTURE"
  | "UNKNOWN_AT_ERROR";

type ConnectorQuery = {
  success: boolean;
  totalRecords: number;
  invoices: ATInvoice[];
  errorMessage?: string;
};

type ConnectorResponse = {
  success: boolean;
  compras?: ConnectorQuery;
  vendas?: ConnectorQuery;
  timingMs?: number;
  error?: string;
};

const TAX_CODE_MAPPING: Record<string, { base: string; vat: string | null }> = {
  NOR: { base: "base_standard", vat: "vat_standard" },
  INT: { base: "base_intermediate", vat: "vat_intermediate" },
  RED: { base: "base_reduced", vat: "vat_reduced" },
  ISE: { base: "base_exempt", vat: null },
};

function getFiscalPeriodYYYYMM(dateYYYYMMDD: string): string {
  const y = dateYYYYMMDD.slice(0, 4);
  const m = dateYYYYMMDD.slice(5, 7);
  return `${y}${m}`;
}

function getTodayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidPortugueseNif(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{9}$/.test(value.trim());
}

function parseFiscalYear(startDate: string): number | null {
  if (!isIsoDate(startDate)) return null;
  return Number(startDate.slice(0, 4)) || null;
}

function buildRequestMetadata(
  requestedStartDate: string,
  requestedEndDate: string,
  effectiveStartDate: string,
  effectiveEndDate: string,
  fiscalYear: number | null,
) {
  return {
    requestedStartDate,
    requestedEndDate,
    effectiveStartDate,
    effectiveEndDate,
    fiscalYear,
    requested_start_date: requestedStartDate,
    requested_end_date: requestedEndDate,
    effective_start_date: effectiveStartDate,
    effective_end_date: effectiveEndDate,
    fiscal_year: fiscalYear,
  };
}

function isAtEmptyListMessage(msg: string | null | undefined): boolean {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("lista de faturas vazia") ||
    m.includes("lista de facturas vazia") ||
    m.includes("no invoices found") ||
    m.includes("sem faturas")
  );
}

function classifyReasonCode(
  message: string | null | undefined,
): SyncReasonCode {
  const m = String(message || "").toLowerCase();

  if (!m) return "UNKNOWN_AT_ERROR";
  if (m.includes("data início é futura") || m.includes("startdate")) {
    return "AT_STARTDATE_FUTURE";
  }
  if (m.includes("ano não disponível") || m.includes("ano nao disponivel")) {
    return "AT_YEAR_UNAVAILABLE";
  }
  if (
    m.includes("lista de faturas vazia") ||
    m.includes("lista de facturas vazia")
  ) return "AT_EMPTY_LIST";
  if (
    m.includes("autentic") ||
    m.includes("credencia") ||
    m.includes("não autorizado") ||
    m.includes("nao autorizado") ||
    m.includes("unauthorized") ||
    m.includes("forbidden")
  ) {
    return "AT_AUTH_FAILED";
  }
  if (
    m.includes("linesummary") ||
    m.includes("particle 2.1") ||
    m.includes("simple-type") ||
    m.includes("customertaxid")
  ) {
    return "AT_SCHEMA_RESPONSE_ERROR";
  }

  return "UNKNOWN_AT_ERROR";
}

function pickReasonCode(
  codes: SyncReasonCode[],
  fallbackMessage?: string | null,
): SyncReasonCode {
  const priority: SyncReasonCode[] = [
    "INVALID_CLIENT_NIF",
    "YEAR_IN_FUTURE",
    "AT_AUTH_FAILED",
    "AT_STARTDATE_FUTURE",
    "AT_YEAR_UNAVAILABLE",
    "AT_SCHEMA_RESPONSE_ERROR",
    "AT_EMPTY_LIST",
    "UNKNOWN_AT_ERROR",
  ];

  for (const p of priority) {
    if (codes.includes(p)) return p;
  }

  return classifyReasonCode(fallbackMessage);
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return "";
  // Common AT formats: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  // Fallback: DD-MM-YYYY
  const dmy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return dateStr;
}

function mergeVatTotals(lineSummary: ATLineSummary[]): Record<string, number> {
  const vatTotals: Record<string, number> = {
    base_exempt: 0,
    base_reduced: 0,
    base_intermediate: 0,
    base_standard: 0,
    vat_reduced: 0,
    vat_intermediate: 0,
    vat_standard: 0,
  };

  for (const line of lineSummary || []) {
    const mapping = TAX_CODE_MAPPING[line.taxCode];
    if (!mapping) continue;
    vatTotals[mapping.base] += Number(line.amount) || 0;
    if (mapping.vat) {
      vatTotals[mapping.vat] += Number(line.taxAmount) || 0;
    }
  }

  return vatTotals;
}

async function decryptPassword(
  encryptedData: string,
  secret: string,
): Promise<string> {
  const [saltB64, ivB64, ciphertextB64] = encryptedData.split(":");

  const fromBase64 = (b64: string): Uint8Array => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
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

function isEncryptedPayload(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

async function decodeStoredSecret(
  value: unknown,
  secret: string,
  fieldLabel: string,
): Promise<string | null> {
  if (typeof value !== "string" || !value.trim()) return null;

  if (!isEncryptedPayload(value)) {
    // Backward compatibility for legacy rows written in plain text.
    console.warn(
      `[sync-efatura] ${fieldLabel} stored in plaintext format (legacy row)`,
    );
    return value;
  }

  try {
    return await decryptPassword(value, secret);
  } catch (error: any) {
    const hasExplicitKey = Boolean(Deno.env.get("AT_ENCRYPTION_KEY"));
    console.error(
      `[sync-efatura] Failed to decrypt ${fieldLabel}: ${
        error?.message || String(error)
      } | AT_ENCRYPTION_KEY present: ${hasExplicitKey} | payload length: ${value.length}`,
    );
    return null;
  }
}

function isLikelyWfaUsername(value: string | null): boolean {
  if (!value) return false;
  return /^\d{9}\/\d+$/.test(value.trim());
}

function isLikelyAuthMessage(msg: string | null | undefined): boolean {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("autentic") ||
    m.includes("credencia") ||
    m.includes("não autorizado") ||
    m.includes("nao autorizado") ||
    m.includes("unauthorized") ||
    m.includes("forbidden")
  );
}

function isConnectorAuthFailure(
  resp: ConnectorResponse,
  type: "compras" | "vendas" | "ambos",
): boolean {
  const errors: string[] = [];
  if (resp.error) errors.push(resp.error);
  if (type === "compras" || type === "ambos") {
    if (resp.compras?.errorMessage) errors.push(resp.compras.errorMessage);
  }
  if (type === "vendas" || type === "ambos") {
    if (resp.vendas?.errorMessage) errors.push(resp.vendas.errorMessage);
  }
  return errors.some((e) => isLikelyAuthMessage(e));
}

let connectorHttpClientInit = false;
let connectorHttpClient: any | undefined = undefined;

function decodeBase64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function getAtConnectorHttpClient(): any | undefined {
  if (connectorHttpClientInit) return connectorHttpClient;
  connectorHttpClientInit = true;

  const pem = Deno.env.get("AT_CONNECTOR_CA_CERT") ||
    (Deno.env.get("AT_CONNECTOR_CA_CERT_B64")
      ? decodeBase64ToUtf8(Deno.env.get("AT_CONNECTOR_CA_CERT_B64")!)
      : null);

  if (!pem) return undefined;

  try {
    // Trust a private CA for the connector only (useful with Caddy `tls internal`).
    connectorHttpClient = Deno.createHttpClient({ caCerts: [pem] });
    console.log("[sync-efatura] AT connector custom CA enabled");
  } catch (e: any) {
    console.warn(
      "[sync-efatura] Failed to create AT connector HTTP client:",
      e?.message || String(e),
    );
    connectorHttpClient = undefined;
  }

  return connectorHttpClient;
}

async function callAtConnector(params: {
  environment: "test" | "production";
  clientNif: string;
  username: string;
  password: string;
  type: "compras" | "vendas" | "ambos";
  startDate: string;
  endDate: string;
}): Promise<ConnectorResponse> {
  const baseUrl = Deno.env.get("AT_CONNECTOR_URL");
  const token = Deno.env.get("AT_CONNECTOR_TOKEN");

  if (!baseUrl || !token) {
    return { success: false, error: "AT connector not configured" };
  }

  const url = `${baseUrl.replace(/\/$/, "")}/v1/invoices`;
  const init: any = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  };

  const client = getAtConnectorHttpClient();
  if (client) init.client = client;

  const resp = await fetch(url, init);

  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!resp.ok) {
    return {
      success: false,
      error: data?.error || `AT connector HTTP ${resp.status}`,
    };
  }

  if (!data || data.success !== true) {
    return {
      success: false,
      error: data?.error || "AT connector returned failure",
    };
  }

  return data as ConnectorResponse;
}

async function insertPurchaseInvoicesFromAT(
  supabase: any,
  clientId: string,
  clientNif: string,
  invoices: ATInvoice[],
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const inv of invoices) {
    const documentDate = normalizeDate(inv.documentDate);
    const fiscalPeriod = documentDate
      ? getFiscalPeriodYYYYMM(documentDate)
      : null;

    const vatTotals = mergeVatTotals(inv.lineSummary || []);

    const supplierNif = inv.supplierNif || "AT";
    const supplierName = inv.supplierName || null;
    const customerNif = inv.customerNif || clientNif;

    const documentNumber = inv.documentNumber || null;

    if (documentNumber) {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("client_id", clientId)
        .eq("supplier_nif", supplierNif)
        .eq("document_number", documentNumber)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
    }

    const { error } = await supabase
      .from("invoices")
      .insert({
        client_id: clientId,
        supplier_nif: supplierNif,
        supplier_name: supplierName,
        customer_nif: customerNif,
        document_type: inv.documentType || "FT",
        document_date: documentDate,
        document_number: documentNumber,
        atcud: inv.atcud || null,
        fiscal_region: "PT",
        ...vatTotals,
        total_amount: Number(inv.grossTotal) || 0,
        total_vat: Number(inv.taxPayable) || 0,
        image_path: `at-webservice/${clientId}/${documentNumber || Date.now()}`,
        status: "pending",
        fiscal_period: fiscalPeriod,
        efatura_source: "webservice",
        data_authority: "at_certified",
      });

    if (error) {
      errors++;
      console.error("[sync-efatura] Insert error:", error.message);
    } else {
      inserted++;
    }
  }

  return { inserted, skipped, errors };
}

async function insertSalesInvoicesFromAT(
  supabase: any,
  clientId: string,
  clientNif: string,
  invoices: ATInvoice[],
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const inv of invoices) {
    const documentDate = normalizeDate(inv.documentDate);
    const fiscalPeriod = documentDate
      ? getFiscalPeriodYYYYMM(documentDate)
      : null;
    const vatTotals = mergeVatTotals(inv.lineSummary || []);
    const documentNumber = inv.documentNumber || null;
    const customerNif = inv.customerNif || null;
    const customerName = inv.customerName || inv.customerNif || null;

    if (documentNumber) {
      const { data: existing } = await supabase
        .from("sales_invoices")
        .select("id")
        .eq("client_id", clientId)
        .eq("supplier_nif", clientNif)
        .eq("document_number", documentNumber)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
    }

    const { error } = await supabase
      .from("sales_invoices")
      .insert({
        client_id: clientId,
        supplier_nif: clientNif,
        customer_nif: customerNif,
        customer_name: customerName,
        document_type: inv.documentType || "FT",
        document_date: documentDate,
        document_number: documentNumber,
        atcud: inv.atcud || null,
        fiscal_region: "PT",
        ...vatTotals,
        total_amount: Number(inv.grossTotal) || 0,
        total_vat: Number(inv.taxPayable) || 0,
        image_path: `at-webservice-sales/${clientId}/${
          documentNumber || Date.now()
        }`,
        // AT connector data is authoritative for issued invoices.
        status: "validated",
        validated_at: new Date().toISOString(),
        fiscal_period: fiscalPeriod,
      });

    if (error) {
      errors++;
      console.error("[sync-efatura] Sales insert error:", error.message);
    } else {
      inserted++;
    }
  }

  return { inserted, skipped, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Autenticação obrigatória" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Accept internal service-role calls (from process-at-sync-queue) OR valid user JWTs
    const token = authHeader.replace("Bearer ", "").trim();
    let isServiceRole = token === supabaseServiceKey;

    let authUser: { id: string } | null = null;
    if (!isServiceRole) {
      const authSupabase = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: authHeader } },
        },
      );
      const { data: { user }, error: authError } = await authSupabase
        .auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Token inválido ou expirado" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      authUser = user;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      clientId,
      accountantId,
      environment,
      type,
      startDate,
      endDate,
      nif,
    }: SyncRequest = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // IDOR protection: verify authenticated user has access to this clientId
    if (!isServiceRole && authUser) {
      const isOwnAccount = authUser.id === clientId;
      if (!isOwnAccount) {
        const { data: relationship } = await supabase
          .from("client_accountants")
          .select("accountant_id")
          .eq("client_id", clientId)
          .eq("accountant_id", authUser.id)
          .maybeSingle();

        if (!relationship) {
          return new Response(
            JSON.stringify({
              error: "Acesso não autorizado para este cliente",
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("nif, cae, company_name")
      .eq("id", clientId)
      .single();

    const clientNif = (nif || profile?.nif || "").trim();
    if (!clientNif) {
      return new Response(
        JSON.stringify({ error: "Client NIF not found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Default date range: current quarter up to today (never future dates)
    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const quarterStart = new Date(
      now.getFullYear(),
      (currentQuarter - 1) * 3,
      1,
    );
    const todayIso = getTodayISODate();
    const defaultStartDate = quarterStart.toISOString().slice(0, 10);

    const requestedStartDate = startDate || defaultStartDate;
    const requestedEndDate = endDate || todayIso;

    if (!isIsoDate(requestedStartDate) || !isIsoDate(requestedEndDate)) {
      return new Response(
        JSON.stringify({ error: "startDate/endDate must be YYYY-MM-DD" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const effectiveStartDate = requestedStartDate;
    const effectiveEndDate = requestedEndDate > todayIso
      ? todayIso
      : requestedEndDate;
    const fiscalYear = parseFiscalYear(effectiveStartDate);
    const currentYear = Number(todayIso.slice(0, 4));
    const requestMeta = buildRequestMetadata(
      requestedStartDate,
      requestedEndDate,
      effectiveStartDate,
      effectiveEndDate,
      fiscalYear,
    );

    const hasConnector = Boolean(
      Deno.env.get("AT_CONNECTOR_URL") && Deno.env.get("AT_CONNECTOR_TOKEN"),
    );

    if (!hasConnector && environment !== "test") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "AT connector não configurado. Configure AT_CONNECTOR_URL e AT_CONNECTOR_TOKEN.",
          reasonCode: "CONNECTOR_NOT_CONFIGURED",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const intendedMethod = "api";

    const { data: syncEntry } = await supabase
      .from("at_sync_history")
      .insert({
        client_id: clientId,
        sync_type: type,
        sync_method: intendedMethod,
        start_date: effectiveStartDate,
        end_date: effectiveEndDate,
        status: "running",
        metadata: {
          environment,
          nif: clientNif,
          method: intendedMethod,
          request: requestMeta,
        },
      })
      .select("id")
      .single();

    const syncId = syncEntry?.id;

    if (fiscalYear && fiscalYear > currentYear) {
      if (syncId) {
        await supabase.from("at_sync_history").update({
          status: "error",
          reason_code: "YEAR_IN_FUTURE",
          error_message:
            `Ano fiscal futuro não permitido: ${fiscalYear} > ${currentYear}`,
          completed_at: new Date().toISOString(),
          metadata: {
            environment,
            nif: clientNif,
            method: intendedMethod,
            request: requestMeta,
          },
        }).eq("id", syncId);
      }

      await supabase.from("at_credentials").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error:
          `Ano fiscal futuro não permitido: ${fiscalYear} > ${currentYear}`,
      }).eq("client_id", clientId);

      return new Response(
        JSON.stringify({
          success: false,
          reasonCode: "YEAR_IN_FUTURE",
          error:
            `Ano fiscal futuro não permitido: ${fiscalYear} > ${currentYear}`,
          syncId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!isValidPortugueseNif(clientNif)) {
      if (syncId) {
        await supabase.from("at_sync_history").update({
          status: "error",
          reason_code: "INVALID_CLIENT_NIF",
          error_message: `Client NIF inválido: ${clientNif}`,
          completed_at: new Date().toISOString(),
          metadata: {
            environment,
            nif: clientNif,
            method: intendedMethod,
            request: requestMeta,
          },
        }).eq("id", syncId);
      }

      await supabase.from("at_credentials").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error: `Client NIF inválido: ${clientNif}`,
      }).eq("client_id", clientId);

      return new Response(
        JSON.stringify({
          success: false,
          reasonCode: "INVALID_CLIENT_NIF",
          error: `Client NIF inválido: ${clientNif}`,
          syncId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (effectiveStartDate > effectiveEndDate) {
      if (syncId) {
        await supabase.from("at_sync_history").update({
          status: "error",
          reason_code: "AT_STARTDATE_FUTURE",
          error_message:
            `Intervalo inválido: startDate ${effectiveStartDate} > endDate ${effectiveEndDate}`,
          completed_at: new Date().toISOString(),
        }).eq("id", syncId);
      }
      return new Response(
        JSON.stringify({
          success: false,
          reasonCode: "AT_STARTDATE_FUTURE",
          error:
            `Intervalo inválido: startDate ${effectiveStartDate} > endDate ${effectiveEndDate}`,
          syncId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (environment === "test") {
      // Keep existing behaviour: mock-only for test
      if (syncId) {
        await supabase.from("at_sync_history").update({
          status: "success",
          records_imported: 0,
          reason_code: null,
          completed_at: new Date().toISOString(),
          metadata: {
            environment,
            nif: clientNif,
            method: "mock",
            request: requestMeta,
          },
        }).eq("id", syncId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          environment: "test",
          count: 0,
          invoices: [],
          syncId,
          message: "Test environment - no real AT calls performed",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ====================================================================
    // Official SOAP/mTLS via external AT connector (VPS)
    // ====================================================================
    {
      console.log(
        `[sync-efatura] Using AT connector for client ${clientId} (NIF ${clientNif}), type=${type}`,
      );

      const { data: credentials } = await supabase
        .from("at_credentials")
        .select("*")
        .eq("client_id", clientId)
        .limit(1);

      const cred = credentials?.[0];

      if (!cred) {
        const noRowError = `Nenhuma credencial AT encontrada para o cliente ${clientId}`;
        console.warn(`[sync-efatura] ${noRowError}`);
        if (syncId) {
          await supabase.from("at_sync_history").update({
            status: "error",
            sync_method: "api",
            reason_code: "AT_AUTH_FAILED" as SyncReasonCode,
            error_message: noRowError,
            completed_at: new Date().toISOString(),
          }).eq("id", syncId);
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: noRowError,
            reasonCode: "AT_AUTH_FAILED",
            syncId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const explicitKey = Deno.env.get("AT_ENCRYPTION_KEY");
      const encryptionSecret = explicitKey ||
        supabaseServiceKey.substring(0, 32);

      if (!explicitKey) {
        console.warn(
          "[sync-efatura] AT_ENCRYPTION_KEY not available, falling back to service role key prefix. " +
            "This may fail if credentials were encrypted with a different key.",
        );
      }

      let resolvedAccountantId: string | null = accountantId ||
        cred?.accountant_id || null;
      if (!resolvedAccountantId) {
        const { data: associations } = await supabase
          .from("client_accountants")
          .select("accountant_id, is_primary, created_at")
          .eq("client_id", clientId)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1);
        resolvedAccountantId = associations?.[0]?.accountant_id || null;
      }

      const rowUsername =
        (cred?.subuser_id ? String(cred.subuser_id).trim() : "") ||
        (await decodeStoredSecret(
          cred?.encrypted_username,
          encryptionSecret,
          "at_credentials.encrypted_username",
        ))?.trim() ||
        (cred?.portal_nif ? String(cred.portal_nif).trim() : "") ||
        null;

      const rowPassword = (await decodeStoredSecret(
        cred?.encrypted_password,
        encryptionSecret,
        "at_credentials.encrypted_password",
      )) ||
        (await decodeStoredSecret(
          cred?.portal_password_encrypted,
          encryptionSecret,
          "at_credentials.portal_password_encrypted",
        )) ||
        null;

      let cfgUsername: string | null = null;
      let cfgPassword: string | null = null;

      if (resolvedAccountantId) {
        const { data: accountantConfig } = await supabase
          .from("accountant_at_config")
          .select("subuser_id, subuser_password_encrypted")
          .eq("accountant_id", resolvedAccountantId)
          .eq("is_active", true)
          .limit(1);

        const cfg = accountantConfig?.[0];
        cfgUsername = cfg?.subuser_id ? String(cfg.subuser_id).trim() : null;
        if (cfg?.subuser_password_encrypted) {
          cfgPassword = await decodeStoredSecret(
            cfg.subuser_password_encrypted,
            encryptionSecret,
            "accountant_at_config.subuser_password_encrypted",
          );
        }
      }

      const allowAccountantFallback = ["1", "true", "yes"].includes(
        String(Deno.env.get("AT_ALLOW_ACCOUNTANT_FALLBACK") || "")
          .toLowerCase(),
      );

      const attempts: Array<
        {
          source: "client_row" | "accountant_config";
          username: string;
          password: string;
        }
      > = [];

      if (rowUsername && rowPassword) {
        attempts.push({
          source: "client_row",
          username: rowUsername,
          password: rowPassword,
        });
      }

      if (
        allowAccountantFallback &&
        cfgUsername &&
        cfgPassword &&
        !attempts.some((a) =>
          a.username === cfgUsername && a.password === cfgPassword
        )
      ) {
        attempts.push({
          source: "accountant_config",
          username: cfgUsername,
          password: cfgPassword,
        });
      }

      if (attempts.length === 0) {
        console.error(
          `[sync-efatura] No usable credentials for client ${clientId}. ` +
            `has_cred_row=${Boolean(cred)} ` +
            `has_encrypted_username=${Boolean(cred?.encrypted_username)} ` +
            `has_encrypted_password=${Boolean(cred?.encrypted_password)} ` +
            `has_subuser_id=${Boolean(cred?.subuser_id)} ` +
            `has_portal_nif=${Boolean(cred?.portal_nif)} ` +
            `rowUsername=${Boolean(rowUsername)} rowPassword=${Boolean(rowPassword)} ` +
            `AT_ENCRYPTION_KEY_present=${Boolean(Deno.env.get("AT_ENCRYPTION_KEY"))}`,
        );
        const noCredsError =
          "Sem credenciais utilizáveis para connector (client_row/accountant_config)";
        const reasonCode: SyncReasonCode = "AT_AUTH_FAILED";

        if (syncId) {
          await supabase.from("at_sync_history").update({
            status: "error",
            sync_method: "api",
            reason_code: reasonCode,
            error_message: noCredsError,
            completed_at: new Date().toISOString(),
            metadata: {
              environment,
              nif: clientNif,
              method: "api_connector",
              primaryCredentialSource: null,
              primary_credential_source: null,
              credentialSource: null,
              credential_source: null,
              usernameKind: null,
              username_kind: null,
              fallbackAllowed: allowAccountantFallback,
              fallback_allowed: allowAccountantFallback,
              fallbackAttempted: false,
              fallback_attempted: false,
              fallbackResult: "not_attempted",
              fallback_result: "not_attempted",
              request: requestMeta,
            },
          }).eq("id", syncId);
        }

        await supabase.from("at_credentials").update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: "error",
          last_sync_error: noCredsError,
        }).eq("client_id", clientId);

        return new Response(
          JSON.stringify({
            success: false,
            sync_method: "api",
            reasonCode,
            error: noCredsError,
            syncId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      let usedCredentials = attempts[0];
      let fallbackAttempted = false;
      let fallbackResult: "not_attempted" | "success" | "failed" =
        "not_attempted";

      let connectorResp = await callAtConnector({
        environment,
        clientNif,
        username: usedCredentials.username,
        password: usedCredentials.password,
        type,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
      });

      if (attempts.length > 1 && isConnectorAuthFailure(connectorResp, type)) {
        const fallbackAttempt = attempts[1];
        fallbackAttempted = true;
        console.warn(
          `[sync-efatura] Connector auth failed with ${usedCredentials.source}; retrying with ${fallbackAttempt.source}`,
        );
        usedCredentials = fallbackAttempt;
        connectorResp = await callAtConnector({
          environment,
          clientNif,
          username: usedCredentials.username,
          password: usedCredentials.password,
          type,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
        });
        fallbackResult = connectorResp.success ? "success" : "failed";
      }

      if (!connectorResp.success) {
        const overallError = connectorResp.error || "AT connector failed";
        const reasonCode = classifyReasonCode(overallError);

        if (syncId) {
          await supabase.from("at_sync_history").update({
            status: "error",
            sync_method: "api",
            reason_code: reasonCode,
            error_message: overallError,
            completed_at: new Date().toISOString(),
            metadata: {
              environment,
              nif: clientNif,
              method: "api_connector",
              primaryCredentialSource: attempts[0]?.source || null,
              primary_credential_source: attempts[0]?.source || null,
              credentialSource: usedCredentials.source,
              credential_source: usedCredentials.source,
              usernameKind: isLikelyWfaUsername(usedCredentials.username)
                ? "wfa"
                : "nif",
              username_kind: isLikelyWfaUsername(usedCredentials.username)
                ? "wfa"
                : "nif",
              fallbackAllowed: allowAccountantFallback,
              fallback_allowed: allowAccountantFallback,
              fallbackAttempted,
              fallback_attempted: fallbackAttempted,
              fallbackResult,
              fallback_result: fallbackResult,
              timingMs: connectorResp.timingMs,
              request: requestMeta,
            },
          }).eq("id", syncId);
        }

        await supabase.from("at_credentials").update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: "error",
          last_sync_error: overallError,
        }).eq("client_id", clientId);

        return new Response(
          JSON.stringify({
            success: false,
            sync_method: "api",
            reasonCode,
            error: overallError,
            syncId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const wantCompras = type === "compras" || type === "ambos";
      const wantVendas = type === "vendas" || type === "ambos";

      let hasErrors = false;
      let hasSuccesses = false;
      let inserted = 0;
      let skipped = 0;
      let errors = 0;

      const reasonCodes: SyncReasonCode[] = [];
      const errorMessages: string[] = [];
      const directionMetadata: Record<string, unknown> = {};

      if (wantCompras) {
        const q = connectorResp.compras;
        const emptyList = !q?.success && isAtEmptyListMessage(q?.errorMessage);

        if (q?.success || emptyList) {
          const r = q?.success
            ? await insertPurchaseInvoicesFromAT(
              supabase,
              clientId,
              clientNif,
              q.invoices || [],
            )
            : { inserted: 0, skipped: 0, errors: 0 };
          inserted += r.inserted;
          skipped += r.skipped;
          errors += r.errors;
          hasSuccesses = true;
          if (emptyList) reasonCodes.push("AT_EMPTY_LIST");
          directionMetadata.compras = {
            success: true,
            emptyList,
            totalRecords: q?.totalRecords || 0,
            imported: r.inserted,
            skipped: r.skipped,
            errors: r.errors,
            errorMessage: emptyList ? q?.errorMessage || null : null,
          };
        } else {
          hasErrors = true;
          const err = q?.errorMessage || connectorResp.error ||
            "Consulta compras falhou";
          const rc = classifyReasonCode(err);
          reasonCodes.push(rc);
          errorMessages.push(err);
          directionMetadata.compras = {
            success: false,
            totalRecords: q?.totalRecords || 0,
            errorMessage: err,
            reasonCode: rc,
          };
        }
      }

      if (wantVendas) {
        const q = connectorResp.vendas;
        const emptyList = !q?.success && isAtEmptyListMessage(q?.errorMessage);

        if (q?.success || emptyList) {
          const r = q?.success
            ? await insertSalesInvoicesFromAT(
              supabase,
              clientId,
              clientNif,
              q.invoices || [],
            )
            : { inserted: 0, skipped: 0, errors: 0 };
          inserted += r.inserted;
          skipped += r.skipped;
          errors += r.errors;
          hasSuccesses = true;
          if (emptyList) reasonCodes.push("AT_EMPTY_LIST");
          directionMetadata.vendas = {
            success: true,
            emptyList,
            totalRecords: q?.totalRecords || 0,
            imported: r.inserted,
            skipped: r.skipped,
            errors: r.errors,
            errorMessage: emptyList ? q?.errorMessage || null : null,
          };
        } else {
          hasErrors = true;
          const err = q?.errorMessage || connectorResp.error ||
            "Consulta vendas falhou";
          const rc = classifyReasonCode(err);
          reasonCodes.push(rc);
          errorMessages.push(err);
          directionMetadata.vendas = {
            success: false,
            totalRecords: q?.totalRecords || 0,
            errorMessage: err,
            reasonCode: rc,
          };
        }
      }

      let overallStatus: "success" | "partial" | "error" = "success";
      let overallError: string | null = null;
      let reasonCode: SyncReasonCode | null = null;

      if (!hasSuccesses && hasErrors) {
        overallStatus = "error";
        overallError = [...new Set(errorMessages)].join("; ") ||
          "AT connector failed";
        reasonCode = pickReasonCode(reasonCodes, overallError);
      } else if (hasErrors && hasSuccesses) {
        overallStatus = "partial";
        overallError = [...new Set(errorMessages)].join("; ") || null;
        reasonCode = pickReasonCode(reasonCodes, overallError);
      } else if (reasonCodes.length > 0) {
        reasonCode = pickReasonCode(reasonCodes, null);
      }

      if (syncId) {
        await supabase.from("at_sync_history").update({
          status: overallStatus,
          sync_method: "api",
          records_imported: inserted,
          records_skipped: skipped,
          records_errors: errors,
          reason_code: reasonCode,
          error_message: overallError,
          completed_at: new Date().toISOString(),
          metadata: {
            environment,
            nif: clientNif,
            method: "api_connector",
            primaryCredentialSource: attempts[0]?.source || null,
            primary_credential_source: attempts[0]?.source || null,
            credentialSource: usedCredentials.source,
            credential_source: usedCredentials.source,
            usernameKind: isLikelyWfaUsername(usedCredentials.username)
              ? "wfa"
              : "nif",
            username_kind: isLikelyWfaUsername(usedCredentials.username)
              ? "wfa"
              : "nif",
            fallbackAllowed: allowAccountantFallback,
            fallback_allowed: allowAccountantFallback,
            fallbackAttempted,
            fallback_attempted: fallbackAttempted,
            fallbackResult,
            fallback_result: fallbackResult,
            timingMs: connectorResp.timingMs,
            request: requestMeta,
            totals: {
              compras: connectorResp.compras?.totalRecords ?? null,
              vendas: connectorResp.vendas?.totalRecords ?? null,
            },
            directions: directionMetadata,
          },
        }).eq("id", syncId);
      }

      await supabase.from("at_credentials").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: overallStatus,
        last_sync_error: overallError,
      }).eq("client_id", clientId);

      if (overallStatus === "error") {
        return new Response(
          JSON.stringify({
            success: false,
            error: overallError || "API sync failed",
            reasonCode,
            syncId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: overallStatus,
          sync_method: "api",
          inserted,
          skipped,
          errors,
          invoicesProcessed: inserted,
          reasonCode,
          syncId,
          message: inserted > 0
            ? `${inserted} faturas importadas via Webservice AT (proxy)`
            : skipped > 0
            ? `${skipped} faturas já existiam`
            : "Nenhuma fatura encontrada no período selecionado",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error("[sync-efatura] Error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
