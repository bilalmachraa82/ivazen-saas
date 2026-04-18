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
import {
  extractBearerToken,
  isConfiguredServiceRoleToken,
} from "../_shared/auth.ts";
import { isWithinATWindow } from "../_shared/atWindow.ts";
import {
  isAtEmptyListMessage,
  isConnectorAuthFailure,
  isConnectorSuccessfulEmptyResponse,
  isLikelyWfaUsername,
  shouldPreferFallbackResponse,
  shouldRetryWithCredentialFallback,
} from "../_shared/connectorFallback.ts";
import { resolveActiveAccountantConfig } from "../_shared/resolveAccountantConfig.ts";
import { validateSyncEfaturaRequest } from "../_shared/syncEfaturaRequest.ts";
import { getPreviousQuarterStart } from "./dateRange.ts";
import { decideSyncStatus } from "./syncStatus.ts";

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
  /** 'queue' = called by process-at-sync-queue (scheduler already checks window).
   *  'manual' = called by frontend/user (subject to time window guard).
   *  Default: 'manual' */
  source?: "queue" | "manual";
  /** Force sync even outside time window. Only accepted with service-role auth. */
  force?: boolean;
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
  /** Supplier CAE from AT EACCode field */
  supplierCae?: string;
  /** AT sector classification */
  sector?: string;
}

type SyncReasonCode =
  | "AT_YEAR_UNAVAILABLE"
  | "AT_STARTDATE_FUTURE"
  | "AT_EMPTY_LIST"
  | "AT_AUTH_FAILED"
  | "AT_TIME_WINDOW"
  | "AT_SCHEMA_RESPONSE_ERROR"
  | "AT_ZERO_RESULTS_SUSPICIOUS"
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

type RecibosFallbackResponse = {
  success?: boolean;
  reasonCode?: string;
  message?: string;
  error?: string;
  inserted?: number;
  skipped?: number;
  errors?: number;
  totalRecords?: number;
};

const CONNECTOR_REQUEST_TIMEOUT_MS = Math.max(
  5000,
  Number(Deno.env.get("AT_CONNECTOR_TIMEOUT_MS") || 25000),
);
const CONNECTOR_MAX_RETRIES = Math.min(
  4,
  Math.max(0, Number(Deno.env.get("AT_CONNECTOR_MAX_RETRIES") || 2)),
);
const CONNECTOR_RETRY_BASE_DELAY_MS = Math.max(
  200,
  Number(Deno.env.get("AT_CONNECTOR_RETRY_BASE_MS") || 800),
);
const RETRYABLE_CONNECTOR_STATUS = new Set([408, 429, 500, 502, 503, 504]);

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true when the client has at least one row in `sales_invoices`
 * with document_date within the past 180 days. Used by decideSyncStatus
 * to tell a legitimate first-timer ("no data, nothing to fetch") apart
 * from a suspicious silent miss ("has data, AT returned zero").
 */
async function clientHasPriorSales(
  supabase: any,
  clientId: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { count } = await supabase
    .from("sales_invoices")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("document_date", cutoff);
  return (count ?? 0) > 0;
}

/**
 * Returns true when the client has at least one row in `invoices`
 * (purchases) with document_date within the past 180 days.
 */
async function clientHasPriorPurchases(
  supabase: any,
  clientId: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("document_date", cutoff);
  return (count ?? 0) > 0;
}

function isRetryableConnectorError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; message?: string };
  const msg = String(e.message || "").toLowerCase();
  return e.name === "AbortError" || msg.includes("timeout") ||
    msg.includes("connection reset") || msg.includes("network");
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

/**
 * Split a date range into per-calendar-month sub-ranges.
 * E.g. ("2025-01-15", "2025-03-20") → [{start:"2025-01-15",end:"2025-01-31"}, {start:"2025-02-01",end:"2025-02-28"}, {start:"2025-03-01",end:"2025-03-20"}]
 */
function splitIntoMonths(
  startDate: string,
  endDate: string,
): Array<{ start: string; end: string }> {
  const result: Array<{ start: string; end: string }> = [];
  const end = new Date(endDate + "T00:00:00Z");

  let cursor = new Date(startDate + "T00:00:00Z");

  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    // Last day of this calendar month
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    const monthEnd = lastDayOfMonth < end ? lastDayOfMonth : end;

    const fmt = (d: Date) =>
      d.toISOString().slice(0, 10);

    result.push({ start: fmt(cursor), end: fmt(monthEnd) });

    // Move cursor to 1st of next month
    cursor = new Date(Date.UTC(year, month + 1, 1));
  }

  return result;
}

/**
 * Retry an AT connector call month-by-month when the full range fails with
 * AT_SCHEMA_RESPONSE_ERROR.  Returns aggregated invoices from successful months.
 */
async function retryConnectorMonthByMonth(params: {
  environment: "test" | "production";
  clientNif: string;
  username: string;
  password: string;
  direction: "compras" | "vendas";
  startDate: string;
  endDate: string;
}): Promise<{
  invoices: ATInvoice[];
  totalRecords: number;
  monthsSucceeded: number;
  monthsFailed: number;
  monthErrors: string[];
}> {
  const months = splitIntoMonths(params.startDate, params.endDate);
  const allInvoices: ATInvoice[] = [];
  let totalRecords = 0;
  let monthsSucceeded = 0;
  let monthsFailed = 0;
  const monthErrors: string[] = [];

  console.log(
    `[sync-efatura] Schema error retry: splitting ${params.startDate}→${params.endDate} into ${months.length} month(s) for ${params.direction}`,
  );

  for (const { start, end } of months) {
    const monthResp = await callAtConnector({
      environment: params.environment,
      clientNif: params.clientNif,
      username: params.username,
      password: params.password,
      type: params.direction,
      startDate: start,
      endDate: end,
    });

    const query = params.direction === "compras"
      ? monthResp.compras
      : monthResp.vendas;

    const emptyList = !query?.success &&
      isAtEmptyListMessage(query?.errorMessage);

    if (query?.success) {
      const inv = query.invoices || [];
      allInvoices.push(...inv);
      totalRecords += query.totalRecords || inv.length;
      monthsSucceeded++;
      console.log(
        `[sync-efatura] Month ${start}→${end} OK: ${inv.length} invoices`,
      );
    } else if (emptyList) {
      // Empty list counts as success (no data for that month)
      monthsSucceeded++;
      console.log(
        `[sync-efatura] Month ${start}→${end}: empty list (ok)`,
      );
    } else {
      monthsFailed++;
      const err = query?.errorMessage || monthResp.error || "unknown";
      monthErrors.push(`${start}: ${err}`);
      console.warn(
        `[sync-efatura] Month ${start}→${end} FAILED: ${err}`,
      );
    }
  }

  return { invoices: allInvoices, totalRecords, monthsSucceeded, monthsFailed, monthErrors };
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
    m.includes("taxpayable") ||
    m.includes("taxsummary") ||
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
  secrets: string[],
  fieldLabel: string,
): Promise<string | null> {
  if (typeof value !== "string" || !value.trim()) return null;

  if (!isEncryptedPayload(value)) {
    // Security hardening: legacy plaintext is no longer accepted.
    console.error(
      `[sync-efatura] ${fieldLabel} is not encrypted (legacy plaintext unsupported)`,
    );
    return null;
  }

  for (const secret of secrets) {
    try {
      return await decryptPassword(value, secret);
    } catch {
      // Try next key
    }
  }

  console.error(
    `[sync-efatura] Failed to decrypt ${fieldLabel} with available keys. payload length=${value.length}`,
  );
  return null;
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
  const init: RequestInit & { client?: unknown } = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  };

  const client = getAtConnectorHttpClient();
  if (client) init.client = client;

  for (let attempt = 0; attempt <= CONNECTOR_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort("AT connector timeout"),
      CONNECTOR_REQUEST_TIMEOUT_MS,
    );

    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });
      const text = await resp.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // ignore
      }

      if (!resp.ok) {
        const retryable = RETRYABLE_CONNECTOR_STATUS.has(resp.status);
        if (retryable && attempt < CONNECTOR_MAX_RETRIES) {
          await sleep(CONNECTOR_RETRY_BASE_DELAY_MS * (attempt + 1));
          continue;
        }
        return {
          success: false,
          error: data?.error || `AT connector HTTP ${resp.status}`,
        };
      }

      if (!data || data.success !== true) {
        if (attempt < CONNECTOR_MAX_RETRIES) {
          await sleep(CONNECTOR_RETRY_BASE_DELAY_MS * (attempt + 1));
          continue;
        }
        return {
          success: false,
          error: data?.error || "AT connector returned failure",
        };
      }

      return data as ConnectorResponse;
    } catch (error) {
      if (attempt < CONNECTOR_MAX_RETRIES && isRetryableConnectorError(error)) {
        await sleep(CONNECTOR_RETRY_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "AT connector request failed",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { success: false, error: "AT connector retries exhausted" };
}

async function callRecibosVerdesFallback(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  clientId: string;
  startDate: string;
  endDate: string;
  source: "queue" | "manual";
  force: boolean;
}): Promise<RecibosFallbackResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort("sync-recibos-verdes timeout"),
    CONNECTOR_REQUEST_TIMEOUT_MS + 15000,
  );

  try {
    const response = await fetch(
      `${params.supabaseUrl}/functions/v1/sync-recibos-verdes`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${params.serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: params.clientId,
          startDate: params.startDate,
          endDate: params.endDate,
          source: params.source,
          force: params.force,
        }),
        signal: controller.signal,
      },
    );

    const responseText = await response.text();
    try {
      return JSON.parse(responseText) as RecibosFallbackResponse;
    } catch {
      return {
        success: false,
        error: `sync-recibos-verdes returned non-JSON: ${responseText.slice(0, 200)}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || String(error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function insertPurchaseInvoicesFromAT(
  supabase: any,
  clientId: string,
  clientNif: string,
  invoices: ATInvoice[],
): Promise<{ inserted: number; skipped: number; errors: number; redirectedToSales: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let redirectedToSales = 0;

  for (const inv of invoices) {
    const documentDate = normalizeDate(inv.documentDate);
    const fiscalPeriod = documentDate
      ? getFiscalPeriodYYYYMM(documentDate)
      : null;

    const vatTotals = mergeVatTotals(inv.lineSummary || []);

    const supplierNif = inv.supplierNif || "AT";
    let supplierName = inv.supplierName || null;
    let supplierCae = inv.supplierCae || inv.sector || null;
    const customerNif = inv.customerNif || clientNif;
    const isSuspiciousPurchaseSupplier =
      supplierNif === "999999990" || supplierNif === clientNif;

    if (isSuspiciousPurchaseSupplier) {
      // This is a sale that AT returned in the compras response.
      // Redirect it to sales_invoices instead of discarding.
      const docNum = inv.documentNumber || null;
      let alreadyInSales = false;
      if (docNum) {
        const { data: existing } = await supabase
          .from("sales_invoices")
          .select("id")
          .eq("client_id", clientId)
          .eq("supplier_nif", clientNif)
          .eq("document_number", docNum)
          .limit(1);
        alreadyInSales = !!(existing && existing.length > 0);
      }

      if (alreadyInSales) {
        skipped++;
      } else {
        const docType = inv.documentType || "FS";
        const revCat = (docType === "FR" || docType === "FS" || docType === "FS/FR")
          ? "prestacao_servicos" : "vendas";
        const { error: saleErr } = await supabase
          .from("sales_invoices")
          .insert({
            client_id: clientId,
            supplier_nif: clientNif,
            customer_nif: customerNif !== clientNif ? customerNif : supplierNif,
            customer_name: supplierName || customerNif || "Cliente",
            document_type: docType,
            document_date: documentDate,
            document_number: docNum,
            atcud: inv.atcud || null,
            fiscal_region: "PT",
            ...vatTotals,
            total_amount: Number(inv.grossTotal) || 0,
            total_vat: Number(inv.taxPayable) || 0,
            image_path: `at-webservice-sales/${clientId}/${docNum || Date.now()}`,
            import_source: "api_redirected_from_compras",
            status: "validated",
            validated_at: new Date().toISOString(),
            fiscal_period: fiscalPeriod,
            revenue_category: revCat,
          });

        if (saleErr) {
          errors++;
          console.error(
            `[sync-efatura] Failed to redirect self-purchase to sales for ${clientId}: ${saleErr.message}`,
          );
        } else {
          redirectedToSales++;
        }
      }

      console.log(
        `[sync-efatura] Self-purchase redirected to sales for client ${clientId}: supplier_nif=${supplierNif}, document=${docNum || "unknown"}, alreadyExists=${alreadyInSales}`,
      );
      continue;
    }

    // If AT returned name/CAE, upsert into supplier_directory
    if (supplierNif !== "AT" && /^\d{9}$/.test(supplierNif)) {
      if (supplierName || supplierCae) {
        await supabase
          .from("supplier_directory")
          .upsert({
            nif: supplierNif,
            name: supplierName || supplierNif,
            cae: supplierCae,
            source: "at",
            confidence: 70,
            updated_at: new Date().toISOString(),
          }, { onConflict: "nif", ignoreDuplicates: true });
      }

      // If AT didn't return a name, look it up from supplier_directory
      if (!supplierName) {
        const { data: dirEntry } = await supabase
          .from("supplier_directory")
          .select("name, cae")
          .eq("nif", supplierNif)
          .maybeSingle();
        if (dirEntry?.name && dirEntry.name !== supplierNif) {
          supplierName = dirEntry.name;
        }
        if (!supplierCae && dirEntry?.cae) {
          supplierCae = dirEntry.cae;
        }
      }

      if (!supplierName) {
        const { data: previousInvoice } = await supabase
          .from("invoices")
          .select("supplier_name")
          .eq("supplier_nif", supplierNif)
          .not("supplier_name", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (previousInvoice?.supplier_name && previousInvoice.supplier_name !== supplierNif) {
          supplierName = previousInvoice.supplier_name;

          await supabase
            .from("supplier_directory")
            .upsert({
              nif: supplierNif,
              name: supplierName,
              cae: supplierCae,
              source: "historical_invoice",
              confidence: 60,
              updated_at: new Date().toISOString(),
            }, { onConflict: "nif", ignoreDuplicates: true });
        }
      }
    }

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
        supplier_cae: inv.supplierCae || inv.sector || null,
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

  return { inserted, skipped, errors, redirectedToSales };
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
        supplier_cae: inv.supplierCae || inv.sector || null,
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
        import_source: "api",
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

    // Accept internal service-role calls (from process-at-sync-queue) OR valid user JWTs.
    // The configured check reads SUPABASE_SERVICE_ROLE_KEY (primary) + optional
    // SERVICE_ROLE_KEY_LEGACY from the environment so a project mid-transition
    // between the legacy JWT and the new `sb_secret_...` format can accept either.
    const token = extractBearerToken(authHeader);
    const isServiceRole = isConfiguredServiceRoleToken(token);

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

    const body: SyncRequest = await req.json();
    const {
      clientId,
      accountantId,
      environment,
      type,
      startDate,
      endDate,
      nif,
    } = body;

    const source = body.source || "manual";
    const forceSync = body.force === true;
    const windowCheck = isWithinATWindow();
    const preconditionFailure = validateSyncEfaturaRequest({
      clientId,
      environment,
      source,
      forceSync,
      isServiceRole,
      windowCheck,
    });
    if (preconditionFailure) {
      if (preconditionFailure.body.reasonCode === "AT_TIME_WINDOW") {
        console.log(`[sync-efatura] Blocked: outside AT time window. ${windowCheck.message}`);
      }
      return new Response(
        JSON.stringify(preconditionFailure.body),
        {
          status: preconditionFailure.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (forceSync && isServiceRole && !windowCheck.isWithin) {
      console.log("[sync-efatura] Time window bypassed via force+service-role");
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

    // Default date range: previous quarter start up to today. Re-fetches the
    // tail of the previous quarter every run so documents emitted near the
    // boundary never fall out of scope. Dedup in the insertion helpers
    // makes the overlap idempotent.
    const now = new Date();
    const todayIso = getTodayISODate();
    const defaultStartDate = getPreviousQuarterStart(now)
      .toISOString()
      .slice(0, 10);

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

      const cred = credentials?.[0] || null;
      if (!cred) {
        console.warn(
          `[sync-efatura] No at_credentials row for client ${clientId}; trying accountant fallback if available.`,
        );
      }

      const primaryKey = Deno.env.get("AT_ENCRYPTION_KEY")?.trim() || "";
      const fallbackKey = Deno.env.get("AT_ENCRYPTION_KEY_FALLBACK")?.trim() ||
        "";
      if (!primaryKey) {
        const configError = "AT_ENCRYPTION_KEY ausente no ambiente";
        if (syncId) {
          await supabase.from("at_sync_history").update({
            status: "error",
            sync_method: "api",
            reason_code: "AT_AUTH_FAILED" as SyncReasonCode,
            error_message: configError,
            completed_at: new Date().toISOString(),
          }).eq("id", syncId);
        }
        await supabase.from("at_credentials").update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: "error",
          last_sync_error: configError,
        }).eq("client_id", clientId);

        return new Response(
          JSON.stringify({
            success: false,
            sync_method: "api",
            reasonCode: "AT_AUTH_FAILED",
            error: configError,
            syncId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const encryptionSecrets = [primaryKey, fallbackKey].filter((v) =>
        Boolean(v)
      );

      const resolvedAccountant = await resolveActiveAccountantConfig(
        supabase,
        clientId,
        [accountantId, cred?.accountant_id],
      );
      const resolvedAccountantId = resolvedAccountant.accountantId;

      const rowUsername =
        (cred?.subuser_id ? String(cred.subuser_id).trim() : "") ||
        (await decodeStoredSecret(
          cred?.encrypted_username,
          encryptionSecrets,
          "at_credentials.encrypted_username",
        ))?.trim() ||
        (cred?.portal_nif ? String(cred.portal_nif).trim() : "") ||
        clientNif ||
        null;

      const rowPassword = (await decodeStoredSecret(
        cred?.encrypted_password,
        encryptionSecrets,
        "at_credentials.encrypted_password",
      )) ||
        (await decodeStoredSecret(
          cred?.portal_password_encrypted,
          encryptionSecrets,
          "at_credentials.portal_password_encrypted",
        )) ||
        null;

      let cfgUsername: string | null = null;
      let cfgPassword: string | null = null;

      if (resolvedAccountantId && resolvedAccountant.config) {
        const cfg = resolvedAccountant.config;
        cfgUsername = cfg?.subuser_id ? String(cfg.subuser_id).trim() : null;
        if (cfg?.subuser_password_encrypted) {
          cfgPassword = await decodeStoredSecret(
            cfg.subuser_password_encrypted,
            encryptionSecrets,
            "accountant_at_config.subuser_password_encrypted",
          );
        }
      }

      const accountantFallbackFlag = Deno.env.get("AT_ALLOW_ACCOUNTANT_FALLBACK");
      const allowAccountantFallback = accountantFallbackFlag == null
        ? true
        : ["1", "true", "yes"].includes(
          String(accountantFallbackFlag).toLowerCase(),
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
              resolvedAccountantId,
              resolved_accountant_id: resolvedAccountantId,
              accountantConfigCandidates: resolvedAccountant.candidateIds,
              accountant_config_candidates: resolvedAccountant.candidateIds,
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

      const primaryCredentials = usedCredentials;
      let connectorResp = await callAtConnector({
        environment,
        clientNif,
        username: usedCredentials.username,
        password: usedCredentials.password,
        type,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
      });

      const fallbackAttempt = attempts[1];
      const primaryConnectorResp = connectorResp;
      const retryWithFallback = fallbackAttempt &&
        (
          isConnectorAuthFailure(primaryConnectorResp, type) ||
          shouldRetryWithCredentialFallback(
            primaryConnectorResp,
            type,
            usedCredentials.username,
            fallbackAttempt.username,
          )
        );

      if (retryWithFallback) {
        fallbackAttempted = true;
        console.warn(
          `[sync-efatura] Retrying connector with ${fallbackAttempt.source} ` +
            `(previous source=${usedCredentials.source}, type=${type})`,
        );
        const fallbackConnectorResp = await callAtConnector({
          environment,
          clientNif,
          username: fallbackAttempt.username,
          password: fallbackAttempt.password,
          type,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
        });
        fallbackResult = fallbackConnectorResp.success ? "success" : "failed";

        if (
          shouldPreferFallbackResponse(
            primaryConnectorResp,
            fallbackConnectorResp,
            type,
          )
        ) {
          usedCredentials = fallbackAttempt;
          connectorResp = fallbackConnectorResp;
        } else {
          usedCredentials = primaryCredentials;
          connectorResp = primaryConnectorResp;
          console.warn(
            `[sync-efatura] Preserving ${primaryCredentials.source} response ` +
              `because fallback ${fallbackAttempt.source} returned no additional vendas`,
          );
        }
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
              resolvedAccountantId,
              resolved_accountant_id: resolvedAccountantId,
              accountantConfigCandidates: resolvedAccountant.candidateIds,
              accountant_config_candidates: resolvedAccountant.candidateIds,
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

      // Raw counts of invoices returned by AT SOAP before dedup, per direction.
      // Used by decideSyncStatus to flag a suspicious empty response when the
      // client is known to have historical activity.
      let comprasReturnedCount = 0;
      let vendasReturnedCount = 0;

      const reasonCodes: SyncReasonCode[] = [];
      const errorMessages: string[] = [];
      const directionMetadata: Record<string, unknown> = {};

      if (wantCompras) {
        const q = connectorResp.compras;
        comprasReturnedCount = q?.invoices?.length ?? 0;
        const emptyList = !q?.success && isAtEmptyListMessage(q?.errorMessage);

        if (q?.success || emptyList) {
          const r = q?.success
            ? await insertPurchaseInvoicesFromAT(
              supabase,
              clientId,
              clientNif,
              q.invoices || [],
            )
            : { inserted: 0, skipped: 0, errors: 0, redirectedToSales: 0 };
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
            redirectedToSales: r.redirectedToSales,
            errorMessage: emptyList ? q?.errorMessage || null : null,
          };
        } else {
          const err = q?.errorMessage || connectorResp.error ||
            "Consulta compras falhou";
          const rc = classifyReasonCode(err);

          // Month-by-month retry for AT schema errors
          if (rc === "AT_SCHEMA_RESPONSE_ERROR") {
            console.warn(
              `[sync-efatura] Compras schema error for client ${clientId}, retrying month-by-month`,
            );
            const monthRetry = await retryConnectorMonthByMonth({
              environment,
              clientNif,
              username: usedCredentials.username,
              password: usedCredentials.password,
              direction: "compras",
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
            });

            if (monthRetry.monthsSucceeded > 0) {
              const r = await insertPurchaseInvoicesFromAT(
                supabase,
                clientId,
                clientNif,
                monthRetry.invoices,
              );
              inserted += r.inserted;
              skipped += r.skipped;
              errors += r.errors;
              hasSuccesses = true;
              if (monthRetry.monthsFailed > 0) {
                hasErrors = true;
                const partialErr = `Schema error: ${monthRetry.monthsSucceeded}/${monthRetry.monthsSucceeded + monthRetry.monthsFailed} months OK`;
                reasonCodes.push("AT_SCHEMA_RESPONSE_ERROR");
                errorMessages.push(partialErr);
              }
              directionMetadata.compras = {
                success: true,
                totalRecords: monthRetry.totalRecords,
                imported: r.inserted,
                skipped: r.skipped,
                errors: r.errors,
                redirectedToSales: r.redirectedToSales,
                monthByMonthRetry: {
                  monthsSucceeded: monthRetry.monthsSucceeded,
                  monthsFailed: monthRetry.monthsFailed,
                  monthErrors: monthRetry.monthErrors,
                  originalError: err,
                },
              };
            } else {
              // All months failed too — treat as normal error
              hasErrors = true;
              reasonCodes.push(rc);
              errorMessages.push(err);
              directionMetadata.compras = {
                success: false,
                totalRecords: q?.totalRecords || 0,
                errorMessage: err,
                reasonCode: rc,
                monthByMonthRetry: {
                  monthsSucceeded: 0,
                  monthsFailed: monthRetry.monthsFailed,
                  monthErrors: monthRetry.monthErrors,
                },
              };
            }
          } else {
            hasErrors = true;
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
      }

      if (wantVendas) {
        const q = connectorResp.vendas;
        vendasReturnedCount = q?.invoices?.length ?? 0;
        const emptyList = !q?.success && isAtEmptyListMessage(q?.errorMessage);
        const vendasError = q?.errorMessage || connectorResp.error ||
          "Consulta vendas falhou";
        const vendasReasonCode = classifyReasonCode(vendasError);
        const shouldTryRecibosFallback =
          emptyList ||
          (q?.success && (q.totalRecords || 0) === 0) ||
          vendasReasonCode === "AT_SCHEMA_RESPONSE_ERROR";
        const recibosFallback = shouldTryRecibosFallback
          ? await callRecibosVerdesFallback({
            supabaseUrl,
            serviceRoleKey: supabaseServiceKey,
            clientId,
            startDate: effectiveStartDate,
            endDate: effectiveEndDate,
            source,
            force: forceSync && isServiceRole,
          })
          : null;
        const fallbackInserted = recibosFallback?.success
          ? (recibosFallback.inserted || 0)
          : 0;
        const fallbackSkipped = recibosFallback?.success
          ? (recibosFallback.skipped || 0)
          : 0;
        const fallbackErrors = recibosFallback?.success
          ? (recibosFallback.errors || 0)
          : 0;
        const recoveredViaRecibos = fallbackInserted > 0 || fallbackSkipped > 0;

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
          inserted += fallbackInserted;
          skipped += fallbackSkipped;
          errors += fallbackErrors;
          vendasReturnedCount += fallbackInserted + fallbackSkipped;
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
            recibosFallback: recibosFallback
              ? {
                success: Boolean(recibosFallback.success),
                reasonCode: recibosFallback.reasonCode || null,
                inserted: fallbackInserted,
                skipped: fallbackSkipped,
                errors: fallbackErrors,
                message: recibosFallback.message || recibosFallback.error || null,
              }
              : null,
          };
        } else {
          // Month-by-month retry for AT schema errors on vendas
          let recoveredViaMonthRetry = false;
          let monthRetryMeta: Record<string, unknown> | null = null;

          if (vendasReasonCode === "AT_SCHEMA_RESPONSE_ERROR") {
            console.warn(
              `[sync-efatura] Vendas schema error for client ${clientId}, retrying month-by-month`,
            );
            const monthRetry = await retryConnectorMonthByMonth({
              environment,
              clientNif,
              username: usedCredentials.username,
              password: usedCredentials.password,
              direction: "vendas",
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
            });

            monthRetryMeta = {
              monthsSucceeded: monthRetry.monthsSucceeded,
              monthsFailed: monthRetry.monthsFailed,
              monthErrors: monthRetry.monthErrors,
              originalError: vendasError,
            };

            if (monthRetry.monthsSucceeded > 0) {
              const r = await insertSalesInvoicesFromAT(
                supabase,
                clientId,
                clientNif,
                monthRetry.invoices,
              );
              inserted += r.inserted;
              skipped += r.skipped;
              errors += r.errors;
              inserted += fallbackInserted;
              skipped += fallbackSkipped;
              errors += fallbackErrors;
              vendasReturnedCount += monthRetry.invoices?.length ?? 0;
              hasSuccesses = true;
              recoveredViaMonthRetry = true;

              if (monthRetry.monthsFailed > 0) {
                hasErrors = true;
                const partialErr = `Schema error: ${monthRetry.monthsSucceeded}/${monthRetry.monthsSucceeded + monthRetry.monthsFailed} months OK`;
                reasonCodes.push("AT_SCHEMA_RESPONSE_ERROR");
                errorMessages.push(partialErr);
              }

              directionMetadata.vendas = {
                success: true,
                totalRecords: monthRetry.totalRecords,
                imported: r.inserted,
                skipped: r.skipped,
                errors: r.errors,
                monthByMonthRetry: monthRetryMeta,
                recibosFallback: recibosFallback
                  ? {
                    success: Boolean(recibosFallback.success),
                    reasonCode: recibosFallback.reasonCode || null,
                    inserted: fallbackInserted,
                    skipped: fallbackSkipped,
                    errors: fallbackErrors,
                    message: recibosFallback.message || recibosFallback.error || null,
                  }
                  : null,
              };
            }
          }

          if (!recoveredViaMonthRetry) {
            if (recoveredViaRecibos) {
              inserted += fallbackInserted;
              skipped += fallbackSkipped;
              errors += fallbackErrors;
              vendasReturnedCount += fallbackInserted + fallbackSkipped;
              hasSuccesses = true;
              directionMetadata.vendas = {
                success: true,
                totalRecords: q?.totalRecords || 0,
                errorMessage: vendasError,
                reasonCode: vendasReasonCode,
                recoveredViaRecibos: true,
                monthByMonthRetry: monthRetryMeta,
                recibosFallback: {
                  success: true,
                  reasonCode: recibosFallback?.reasonCode || null,
                  inserted: fallbackInserted,
                  skipped: fallbackSkipped,
                  errors: fallbackErrors,
                  message: recibosFallback?.message || null,
                },
              };
            } else {
              hasErrors = true;
              reasonCodes.push(vendasReasonCode);
              errorMessages.push(vendasError);
              directionMetadata.vendas = {
                success: false,
                totalRecords: q?.totalRecords || 0,
                errorMessage: vendasError,
                reasonCode: vendasReasonCode,
                monthByMonthRetry: monthRetryMeta,
                recibosFallback: recibosFallback
                  ? {
                    success: Boolean(recibosFallback.success),
                    reasonCode: recibosFallback.reasonCode || null,
                    inserted: fallbackInserted,
                    skipped: fallbackSkipped,
                    errors: fallbackErrors,
                    message: recibosFallback.message || recibosFallback.error || null,
                  }
                  : null,
              };
            }
          }
        }
      }

      // Silent-success kill: check whether an empty SOAP response for either
      // direction is suspicious, i.e. the client has prior activity but AT
      // returned zero records. Direction-specific so a compras-only or
      // vendas-only client is not falsely flagged on the unused direction.
      const [hasPriorCompras, hasPriorVendas] = await Promise.all([
        wantCompras ? clientHasPriorPurchases(supabase, clientId) : Promise.resolve(false),
        wantVendas ? clientHasPriorSales(supabase, clientId) : Promise.resolve(false),
      ]);
      const comprasDecision = wantCompras
        ? decideSyncStatus({ atReturnedCount: comprasReturnedCount, hasPriorData: hasPriorCompras })
        : { status: "success" as const, reasonCode: null };
      const vendasDecision = wantVendas
        ? decideSyncStatus({ atReturnedCount: vendasReturnedCount, hasPriorData: hasPriorVendas })
        : { status: "success" as const, reasonCode: null };
      const hasSuspiciousEmpty =
        comprasDecision.status === "partial" || vendasDecision.status === "partial";

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
      } else if (hasSuspiciousEmpty) {
        // No SOAP errors, but AT returned zero for a direction that normally
        // has activity — surface as partial so the dashboard flags the client.
        overallStatus = "partial";
        reasonCode = (comprasDecision.reasonCode ||
          vendasDecision.reasonCode) as SyncReasonCode | null;
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
          invoices_returned_by_at: comprasReturnedCount + vendasReturnedCount,
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
            resolvedAccountantId,
            resolved_accountant_id: resolvedAccountantId,
            accountantConfigCandidates: resolvedAccountant.candidateIds,
            accountant_config_candidates: resolvedAccountant.candidateIds,
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

      // Adaptive backoff: reset consecutive_failures on success, increment on error
      if (overallStatus === "success" || overallStatus === "partial") {
        await supabase.from("at_credentials").update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: overallStatus,
          last_sync_error: overallError,
          consecutive_failures: 0,
        }).eq("client_id", clientId);
      } else {
        await supabase.from("at_credentials").update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: overallStatus,
          last_sync_error: overallError,
        }).eq("client_id", clientId);
        // Atomic increment via RPC
        const { error: incrementError } = await supabase.rpc("increment_consecutive_failures", {
          p_client_id: clientId,
        });
        if (incrementError) {
          console.warn(
            "[sync-efatura] increment_consecutive_failures RPC unavailable:",
            incrementError.message,
          );
        }
      }

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
