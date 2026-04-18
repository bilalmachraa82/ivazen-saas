/**
 * sync-recibos-verdes Edge Function
 *
 * Syncs recibos verdes from AT using the official invoices connector first,
 * and falls back to portal scraping only when the official query does not
 * return FR/FS documents for the requested period.
 *
 * Flow:
 * 1. Authenticate caller (service-role or user JWT)
 * 2. Resolve AT credentials (portal_nif + password)
 * 3. Call AT connector /v1/recibos-verdes endpoint
 * 4. Insert records into sales_invoices with document_type 'FR'
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isServiceRoleToken, extractBearerToken } from "../_shared/auth.ts";
import { isWithinATWindow } from "../_shared/atWindow.ts";
import { resolveActiveAccountantConfig } from "../_shared/resolveAccountantConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function isEncryptedPayload(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => p.length > 0);
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

async function decodeStoredSecret(
  value: unknown,
  secrets: string[],
  fieldLabel: string,
): Promise<string | null> {
  if (typeof value !== "string" || !value.trim()) return null;
  if (!isEncryptedPayload(value)) {
    console.error(`[sync-recibos] ${fieldLabel} is not encrypted`);
    return null;
  }
  for (const secret of secrets) {
    try {
      return await decryptPassword(value, secret);
    } catch {
      // try next key
    }
  }
  console.error(`[sync-recibos] Failed to decrypt ${fieldLabel}`);
  return null;
}

interface RecibosRecord {
  documentNumber: string;
  documentType: string;
  documentDate: string;
  customerNif: string;
  customerName: string;
  grossTotal: number;
  taxPayable: number;
  netTotal: number;
  status: string;
  atcud: string;
}

interface ATLineSummary {
  taxCode: string;
  taxPercentage: number;
  taxCountryRegion: string;
  amount: number;
  taxAmount: number;
}

interface ATInvoice {
  customerNif: string;
  customerName?: string;
  documentNumber: string;
  documentDate: string;
  documentType: string;
  atcud?: string;
  grossTotal: number;
  taxPayable: number;
  lineSummary: ATLineSummary[];
}

type ConnectorQuery = {
  success: boolean;
  totalRecords: number;
  invoices: ATInvoice[];
  errorMessage?: string;
};

type ConnectorResponse = {
  success: boolean;
  vendas?: ConnectorQuery;
  error?: string;
};

type ConnectorFetchInit = RequestInit & { client?: unknown };

const TAX_CODE_MAPPING: Record<string, { base: string; vat: string | null }> = {
  NOR: { base: "base_standard", vat: "vat_standard" },
  INT: { base: "base_intermediate", vat: "vat_intermediate" },
  RED: { base: "base_reduced", vat: "vat_reduced" },
  ISE: { base: "base_exempt", vat: null },
};

function isLikelyWfaUsername(value: string | null): boolean {
  if (!value) return false;
  return /^\d{9}\/\d+$/.test(value.trim());
}

function isLikelyAuthMessage(message: string | null | undefined): boolean {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('autentic') ||
    normalized.includes('credencia') ||
    normalized.includes('não autorizado') ||
    normalized.includes('nao autorizado') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden');
}

function isReciboVerdeDocumentType(documentType: string | null | undefined): boolean {
  const normalized = String(documentType || '').trim().toUpperCase();
  return normalized === 'FR' || normalized === 'FS' || normalized === 'FS/FR';
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const dmy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return dateStr;
}

function getFiscalPeriodYYYYMM(dateYYYYMMDD: string): string {
  const y = dateYYYYMMDD.slice(0, 4);
  const m = dateYYYYMMDD.slice(5, 7);
  return `${y}${m}`;
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

function buildConnectorFetchInit(
  connectorToken: string,
  body: unknown,
): ConnectorFetchInit {
  const fetchInit: ConnectorFetchInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${connectorToken}`,
    },
    body: JSON.stringify(body),
  };

  const caCertPem = Deno.env.get('AT_CONNECTOR_CA_CERT') ||
    (Deno.env.get('AT_CONNECTOR_CA_CERT_B64')
      ? (() => {
          const b64 = Deno.env.get('AT_CONNECTOR_CA_CERT_B64')!;
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return new TextDecoder().decode(bytes);
        })()
      : null);

  if (caCertPem) {
    try {
      const httpClient = Deno.createHttpClient({ caCerts: [caCertPem] });
      fetchInit.client = httpClient;
      console.log('[sync-recibos] Using custom CA for connector');
    } catch (error: any) {
      console.warn('[sync-recibos] Failed to create custom HTTP client:', error?.message);
    }
  }

  return fetchInit;
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
    const fiscalPeriod = documentDate ? getFiscalPeriodYYYYMM(documentDate) : null;
    const documentNumber = inv.documentNumber || null;
    const customerNif = inv.customerNif || null;
    const customerName = inv.customerName || inv.customerNif || null;
    const vatTotals = mergeVatTotals(inv.lineSummary || []);

    if (documentNumber) {
      const { data: existing } = await supabase
        .from('sales_invoices')
        .select('id')
        .eq('client_id', clientId)
        .eq('supplier_nif', clientNif)
        .eq('document_number', documentNumber)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
    }

    const { error } = await supabase
      .from('sales_invoices')
      .insert({
        client_id: clientId,
        supplier_nif: clientNif,
        customer_nif: customerNif,
        customer_name: customerName,
        document_type: inv.documentType || 'FR',
        document_date: documentDate,
        document_number: documentNumber,
        atcud: inv.atcud || null,
        fiscal_region: 'PT',
        ...vatTotals,
        total_amount: Number(inv.grossTotal) || 0,
        total_vat: Number(inv.taxPayable) || 0,
        image_path: `at-webservice-sales/${clientId}/${documentNumber || Date.now()}`,
        status: 'validated',
        validated_at: new Date().toISOString(),
        fiscal_period: fiscalPeriod,
      });

    if (error) {
      errors++;
      console.error('[sync-recibos] Official insert error:', error.message);
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
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = extractBearerToken(authHeader);
    const isServiceRole = isServiceRoleToken(token, supabaseServiceKey);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Auth: service-role or valid user
    let userId: string | null = null;
    if (!isServiceRole) {
      const authSupabase = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authError } = await authSupabase.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = user.id;
    }

    const body = await req.json();
    const {
      clientId,
      startDate,
      endDate,
      source = "manual",
      force = false,
    } = body;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Time window guard (same as sync-efatura)
    if (source === "manual" && !(force && isServiceRole)) {
      if (!isWithinATWindow()) {
        return new Response(
          JSON.stringify({
            success: false,
            reasonCode: "AT_TIME_WINDOW",
            message: "Fora da janela horária AT (19:00-06:00). Tente mais tarde.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // IDOR protection: non-service-role users can only sync their own data or their clients'
    if (!isServiceRole && userId) {
      const isOwner = clientId === userId;
      if (!isOwner) {
        const { data: link } = await supabase
          .from("client_accountants")
          .select("client_id")
          .eq("client_id", clientId)
          .eq("accountant_id", userId)
          .limit(1)
          .maybeSingle();
        if (!link) {
          return new Response(
            JSON.stringify({ error: "Forbidden: no access to this client" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Resolve credentials
    const { data: cred } = await supabase
      .from("at_credentials")
      .select("*")
      .eq("client_id", clientId)
      .limit(1)
      .maybeSingle();
    if (!cred) {
      console.warn(
        `[sync-recibos] No at_credentials row for client ${clientId}; trying accountant fallback if available.`,
      );
    }

    const primaryKey = Deno.env.get("AT_ENCRYPTION_KEY") || "";
    const fallbackKey = Deno.env.get("AT_ENCRYPTION_KEY_FALLBACK") || "";
    const encryptionSecrets = [primaryKey, fallbackKey].filter(Boolean);

    // For portal scraping we need the portal NIF and portal password
    const { data: profile } = await supabase
      .from("profiles")
      .select("nif")
      .eq("id", clientId)
      .maybeSingle();

    const portalNif = cred?.portal_nif
      ? String(cred.portal_nif).trim()
      : (profile?.nif ? String(profile.nif).trim() : null);

    // Try to get portal password (portal_password_encrypted is set by import-client-credentials)
    const portalPassword = (await decodeStoredSecret(
      cred?.portal_password_encrypted,
      encryptionSecrets,
      "portal_password_encrypted",
    )) || (await decodeStoredSecret(
      cred?.encrypted_password,
      encryptionSecrets,
      "encrypted_password",
    ));

    const clientNif = profile?.nif || portalNif;
    if (!clientNif) {
      return new Response(
        JSON.stringify({
          success: false,
          reasonCode: "AT_AUTH_FAILED",
          error: "Missing client NIF for recibos verdes sync",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const portalConnectorUrl = Deno.env.get("AT_PORTAL_CONNECTOR_URL") ||
      Deno.env.get("AT_CONNECTOR_URL");
    const portalConnectorToken = Deno.env.get("AT_PORTAL_CONNECTOR_TOKEN") ||
      Deno.env.get("AT_CONNECTOR_TOKEN");
    const officialConnectorUrl = Deno.env.get("AT_CONNECTOR_URL") ||
      portalConnectorUrl;
    const officialConnectorToken = Deno.env.get("AT_CONNECTOR_TOKEN") ||
      portalConnectorToken;

    if (
      (!officialConnectorUrl || !officialConnectorToken) &&
      (!portalConnectorUrl || !portalConnectorToken)
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "AT connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rowUsername =
      (cred?.subuser_id ? String(cred.subuser_id).trim() : "") ||
      (await decodeStoredSecret(
        cred?.encrypted_username,
        encryptionSecrets,
        "encrypted_username",
      ))?.trim() ||
      portalNif;
    const rowPassword = (await decodeStoredSecret(
      cred?.encrypted_password,
      encryptionSecrets,
      "encrypted_password",
    )) || portalPassword;

    const resolvedAccountant = await resolveActiveAccountantConfig(
      supabase,
      clientId,
      [cred?.accountant_id],
    );
    const resolvedAccountantId = resolvedAccountant.accountantId;

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

    const officialAttempts: Array<{ source: string; username: string; password: string }> = [];
    if (rowUsername && rowPassword) {
      officialAttempts.push({
        source: "client_row",
        username: rowUsername,
        password: rowPassword,
      });
    }
    if (
      cfgUsername &&
      cfgPassword &&
      !officialAttempts.some((attempt) =>
        attempt.username === cfgUsername && attempt.password === cfgPassword
      )
    ) {
      officialAttempts.push({
        source: "accountant_config",
        username: cfgUsername,
        password: cfgPassword,
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    const environment = cred?.environment === "test" ? "test" : "production";
    let attemptedOfficialConnector = false;
    let officialReturnedEmpty = false;
    let lastOfficialError: string | null = null;

    try {
      if (officialConnectorUrl && officialConnectorToken && officialAttempts.length > 0) {
        const officialUrl = `${officialConnectorUrl.replace(/\/$/, "")}/v1/invoices`;

        for (let index = 0; index < officialAttempts.length; index++) {
          attemptedOfficialConnector = true;
          const attempt = officialAttempts[index];
          const officialFetchInit = buildConnectorFetchInit(officialConnectorToken, {
            environment,
            clientNif,
            username: attempt.username,
            password: attempt.password,
            type: "vendas",
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          });
          officialFetchInit.signal = controller.signal;

          console.log(
            "[sync-recibos] Calling official vendas connector:",
            officialUrl,
            `source=${attempt.source}`,
            `username_kind=${isLikelyWfaUsername(attempt.username) ? "wfa" : "nif"}`,
          );

          const officialResp = await fetch(officialUrl, officialFetchInit);
          const officialText = await officialResp.text();
          console.log(
            "[sync-recibos] Official connector response:",
            officialResp.status,
            officialText.slice(0, 500),
          );

          let officialData: ConnectorResponse;
          try {
            officialData = JSON.parse(officialText);
          } catch {
            officialData = {
              success: false,
              error: `Connector returned non-JSON: ${officialText.slice(0, 200)}`,
            };
          }

          if (officialData.success && officialData.vendas?.success) {
            const recibos = (officialData.vendas.invoices || []).filter((invoice) =>
              isReciboVerdeDocumentType(invoice.documentType)
            );

            if (recibos.length > 0) {
              lastOfficialError = null;
              officialReturnedEmpty = false;
              const result = await insertSalesInvoicesFromAT(
                supabase,
                clientId,
                clientNif,
                recibos,
              );

              await supabase
                .from("at_credentials")
                .update({
                  last_sync_status: "success",
                  last_sync_error: null,
                  last_sync_at: new Date().toISOString(),
                })
                .eq("client_id", clientId);

              return new Response(
                JSON.stringify({
                  success: true,
                  source: "official_webservice",
                  totalRecords: recibos.length,
                  inserted: result.inserted,
                  skipped: result.skipped,
                  errors: result.errors,
                  message: `Imported ${result.inserted} recibos verdes via webservice oficial`,
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
              );
            }

            officialReturnedEmpty = true;
            lastOfficialError = null;

            const shouldRetryWithFallback = index === 0 &&
              officialAttempts.length > 1 &&
              !isLikelyWfaUsername(attempt.username) &&
              isLikelyWfaUsername(officialAttempts[1].username) &&
              (officialData.vendas.totalRecords || 0) === 0;

            if (shouldRetryWithFallback) {
              console.warn(
                "[sync-recibos] Official vendas query returned empty with client_row; retrying with accountant_config",
              );
              continue;
            }
          } else {
            const vendasError = officialData.vendas?.errorMessage || officialData.error;
            lastOfficialError = vendasError || "Official vendas query failed";
            officialReturnedEmpty = false;
            const shouldRetryWithFallback = index === 0 &&
              officialAttempts.length > 1 &&
              !isLikelyWfaUsername(attempt.username) &&
              isLikelyWfaUsername(officialAttempts[1].username) &&
              isLikelyAuthMessage(vendasError);

            if (shouldRetryWithFallback) {
              console.warn(
                "[sync-recibos] Official vendas auth/context issue with client_row; retrying with accountant_config",
              );
              continue;
            }
          }

          break;
        }
      }

      if (!portalConnectorUrl || !portalConnectorToken || !portalNif || !portalPassword) {
        if (attemptedOfficialConnector && officialReturnedEmpty && !lastOfficialError) {
          await supabase
            .from("at_credentials")
            .update({
              last_sync_status: "success",
              last_sync_error: null,
              last_sync_at: new Date().toISOString(),
            })
            .eq("client_id", clientId);

          return new Response(
            JSON.stringify({
              success: true,
              reasonCode: "AT_EMPTY_LIST",
              message: "No recibos verdes found in this period",
              totalRecords: 0,
              inserted: 0,
              skipped: 0,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const missingCredentialError = lastOfficialError ||
          "No usable AT credentials found for this client";
        await supabase
          .from("at_credentials")
          .update({
            last_sync_status: "error",
            last_sync_error: missingCredentialError,
            last_sync_at: new Date().toISOString(),
          })
          .eq("client_id", clientId);

        return new Response(
          JSON.stringify({
            success: false,
            reasonCode: "AT_AUTH_FAILED",
            error: missingCredentialError,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const url = `${portalConnectorUrl.replace(/\/$/, "")}/v1/recibos-verdes`;
      const connFetchInit = buildConnectorFetchInit(portalConnectorToken, {
        nif: portalNif,
        password: portalPassword,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        // Ask the connector for its debug breadcrumbs so a zero-records
        // response surfaces the raw URL hit, response length, and auth
        // state in the edge function's return payload.
        debug: true,
      });
      connFetchInit.signal = controller.signal;

      console.log("[sync-recibos] Calling portal fallback connector:", url);

      const connResp = await fetch(url, connFetchInit);

      const connText = await connResp.text();
      console.log("[sync-recibos] Connector response:", connResp.status, connText.slice(0, 500));

      let connData: any;
      try {
        connData = JSON.parse(connText);
      } catch {
        connData = { success: false, error: `Connector returned non-JSON: ${connText.slice(0, 200)}` };
      }

      if (!connData.success) {
        // Update credentials status
        await supabase
          .from("at_credentials")
          .update({
            last_sync_status: "error",
            last_sync_error: connData.error || "Portal scraping failed",
            last_sync_at: new Date().toISOString(),
          })
          .eq("client_id", clientId);

        return new Response(
          JSON.stringify({
            success: false,
            reasonCode: connData.error?.includes("invalid") ? "AT_AUTH_FAILED" : "UNKNOWN_AT_ERROR",
            error: connData.error || "Portal scraping failed",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const records: RecibosRecord[] = connData.records || [];

      if (records.length === 0) {
        await supabase
          .from("at_credentials")
          .update({
            last_sync_status: "success",
            last_sync_error: null,
            last_sync_at: new Date().toISOString(),
          })
          .eq("client_id", clientId);

        // Surface the connector's diagnostic breadcrumbs so downstream
        // consumers (sync-efatura writes this to at_sync_history.metadata)
        // can see whether the portal returned an empty JSON list, failed
        // to authenticate, or parsed HTML into zero rows.
        const connectorDebug = {
          method: connData.method ?? null,
          authenticated: connData.authenticated ?? null,
          rawLength: connData.rawLength ?? null,
          httpStatus: connData.httpStatus ?? null,
          jsonShape: connData.jsonShape ?? null,
          endpointHit: connData.endpointHit ?? null,
          notes: connData.notes ?? null,
        };

        return new Response(
          JSON.stringify({
            success: true,
            reasonCode: "AT_EMPTY_LIST",
            message: "No recibos verdes found in this period",
            totalRecords: 0,
            inserted: 0,
            skipped: 0,
            connectorDebug,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Insert records into sales_invoices
      let inserted = 0;
      let skipped = 0;
      let errors = 0;

      for (const rec of records) {
        const documentDate = rec.documentDate || null;
        const documentNumber = rec.documentNumber || null;
        const fiscalPeriod = documentDate
          ? `${documentDate.slice(0, 4)}${documentDate.slice(5, 7)}`
          : null;

        // Dedup check
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

        const { error: insertError } = await supabase
          .from("sales_invoices")
          .insert({
            client_id: clientId,
            supplier_nif: clientNif,
            customer_nif: rec.customerNif || null,
            customer_name: rec.customerName || null,
            document_type: rec.documentType || "FR",
            document_date: documentDate,
            document_number: documentNumber,
            atcud: rec.atcud || null,
            fiscal_region: "PT",
            total_amount: Number(rec.grossTotal) || 0,
            total_vat: Number(rec.taxPayable) || 0,
            image_path: `at-portal-recibos/${clientId}/${documentNumber || Date.now()}`,
            status: "validated",
            validated_at: new Date().toISOString(),
            fiscal_period: fiscalPeriod,
            revenue_category: "prestacao_servicos",
          });

        if (insertError) {
          errors++;
          console.error("[sync-recibos] Insert error:", insertError.message);
        } else {
          inserted++;
        }
      }

      // Update credential sync status
      await supabase
        .from("at_credentials")
        .update({
          last_sync_status: "success",
          last_sync_error: null,
          last_sync_at: new Date().toISOString(),
        })
        .eq("client_id", clientId);

      return new Response(
        JSON.stringify({
          success: true,
          totalRecords: records.length,
          inserted,
          skipped,
          errors,
          message: `Imported ${inserted} recibos verdes (${skipped} duplicates skipped)`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error: unknown) {
    console.error("[sync-recibos] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
