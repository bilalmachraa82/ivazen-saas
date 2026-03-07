/**
 * sync-recibos-verdes Edge Function
 *
 * Syncs recibos verdes (green receipts) from Portal das Finanças via the AT
 * connector's portal scraper. Recibos verdes are NOT available via the SOAP
 * API (fatshareFaturas), so this uses authenticated HTTP scraping.
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
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) },
    key,
    ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength),
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
      return new Response(
        JSON.stringify({
          success: false,
          reasonCode: "AT_AUTH_FAILED",
          error: "No AT credentials found for this client",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const primaryKey = Deno.env.get("AT_ENCRYPTION_KEY") || "";
    const fallbackKey = Deno.env.get("AT_ENCRYPTION_KEY_FALLBACK") || "";
    const encryptionSecrets = [primaryKey, fallbackKey].filter(Boolean);

    // For portal scraping we need the portal NIF and portal password
    const portalNif = cred.portal_nif
      ? String(cred.portal_nif).trim()
      : null;

    // Try to get portal password (portal_password_encrypted is set by import-client-credentials)
    const portalPassword = (await decodeStoredSecret(
      cred.portal_password_encrypted,
      encryptionSecrets,
      "portal_password_encrypted",
    )) || (await decodeStoredSecret(
      cred.encrypted_password,
      encryptionSecrets,
      "encrypted_password",
    ));

    if (!portalNif || !portalPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          reasonCode: "AT_AUTH_FAILED",
          error: "Missing portal NIF or password for recibos verdes sync",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get client NIF for verification
    const { data: profile } = await supabase
      .from("profiles")
      .select("nif")
      .eq("id", clientId)
      .maybeSingle();

    const clientNif = profile?.nif || portalNif;

    // Call AT connector's recibos-verdes endpoint (portal scraper on VPS)
    // Use separate portal URL if available, fallback to standard connector URL
    const connectorUrl = Deno.env.get("AT_PORTAL_CONNECTOR_URL") || Deno.env.get("AT_CONNECTOR_URL");
    const connectorToken = Deno.env.get("AT_PORTAL_CONNECTOR_TOKEN") || Deno.env.get("AT_CONNECTOR_TOKEN");

    if (!connectorUrl || !connectorToken) {
      return new Response(
        JSON.stringify({ success: false, error: "AT connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = `${connectorUrl.replace(/\/$/, "")}/v1/recibos-verdes`;

    // Reuse custom CA if configured (same as sync-efatura)
    const connFetchInit: RequestInit & { client?: unknown } = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${connectorToken}`,
      },
      body: JSON.stringify({
        nif: portalNif,
        password: portalPassword,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        debug: false,
      }),
    };

    // Trust private CA for connector (Caddy tls internal)
    const caCertPem = Deno.env.get("AT_CONNECTOR_CA_CERT") ||
      (Deno.env.get("AT_CONNECTOR_CA_CERT_B64")
        ? (() => {
            const b64 = Deno.env.get("AT_CONNECTOR_CA_CERT_B64")!;
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return new TextDecoder().decode(bytes);
          })()
        : null);

    if (caCertPem) {
      try {
        const httpClient = Deno.createHttpClient({ caCerts: [caCertPem] });
        (connFetchInit as any).client = httpClient;
        console.log("[sync-recibos] Using custom CA for connector");
      } catch (e: any) {
        console.warn("[sync-recibos] Failed to create custom HTTP client:", e?.message);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    connFetchInit.signal = controller.signal;

    console.log("[sync-recibos] Calling connector:", url);

    try {
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
