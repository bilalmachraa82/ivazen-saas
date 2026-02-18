/**
 * sync-efatura Edge Function
 *
 * Robust sync strategy:
 * - Prefer official AT SOAP/mTLS via an external VPS connector (Node/OpenSSL).
 * - Fallback to portal JSON scraping (fetch-efatura-portal) if the connector is not
 *   configured or fails.
 *
 * Why external connector:
 * - Supabase Edge runs on Deno/rustls and may fail AT legacy TLS handshakes.
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SyncRequest {
  clientId: string;
  accountantId?: string;
  environment: 'test' | 'production';
  type: 'compras' | 'vendas' | 'ambos';
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
  NOR: { base: 'base_standard', vat: 'vat_standard' },
  INT: { base: 'base_intermediate', vat: 'vat_intermediate' },
  RED: { base: 'base_reduced', vat: 'vat_reduced' },
  ISE: { base: 'base_exempt', vat: null },
};

function getFiscalPeriodYYYYMM(dateYYYYMMDD: string): string {
  const y = dateYYYYMMDD.slice(0, 4);
  const m = dateYYYYMMDD.slice(5, 7);
  return `${y}${m}`;
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
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

function extractCookies(headers: Headers): string {
  const cookies: string[] = [];
  const setCookieHeaders = (headers as any).getSetCookie?.() || [];
  for (const setCookie of setCookieHeaders) {
    const cookiePart = String(setCookie).split(';')[0];
    if (cookiePart) cookies.push(cookiePart);
  }
  const singleHeader = headers.get('set-cookie');
  if (singleHeader && cookies.length === 0) {
    const parts = singleHeader.split(',');
    for (const part of parts) {
      const cookiePart = part.split(';')[0]?.trim();
      if (cookiePart && cookiePart.includes('=')) cookies.push(cookiePart);
    }
  }
  return cookies.join('; ');
}

async function decryptPassword(encryptedData: string, secret: string): Promise<string> {
  const [saltB64, ivB64, ciphertextB64] = encryptedData.split(':');

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
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

function isEncryptedPayload(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

async function decodeStoredSecret(
  value: unknown,
  secret: string,
  fieldLabel: string,
): Promise<string | null> {
  if (typeof value !== 'string' || !value.trim()) return null;

  if (!isEncryptedPayload(value)) {
    // Backward compatibility for legacy rows written in plain text.
    console.warn(`[sync-efatura] ${fieldLabel} stored in plaintext format (legacy row)`);
    return value;
  }

  try {
    return await decryptPassword(value, secret);
  } catch (error: any) {
    console.warn(`[sync-efatura] Failed to decrypt ${fieldLabel}: ${error?.message || String(error)}`);
    return null;
  }
}

function isLikelyWfaUsername(value: string | null): boolean {
  if (!value) return false;
  return /^\d{9}\/\d+$/.test(value.trim());
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

  const pem =
    Deno.env.get('AT_CONNECTOR_CA_CERT') ||
    (Deno.env.get('AT_CONNECTOR_CA_CERT_B64')
      ? decodeBase64ToUtf8(Deno.env.get('AT_CONNECTOR_CA_CERT_B64')!)
      : null);

  if (!pem) return undefined;

  try {
    // Trust a private CA for the connector only (useful with Caddy `tls internal`).
    connectorHttpClient = Deno.createHttpClient({ caCerts: [pem] });
    console.log('[sync-efatura] AT connector custom CA enabled');
  } catch (e: any) {
    console.warn('[sync-efatura] Failed to create AT connector HTTP client:', e?.message || String(e));
    connectorHttpClient = undefined;
  }

  return connectorHttpClient;
}

async function callAtConnector(params: {
  environment: 'test' | 'production';
  clientNif: string;
  username: string;
  password: string;
  type: 'compras' | 'vendas' | 'ambos';
  startDate: string;
  endDate: string;
}): Promise<ConnectorResponse> {
  const baseUrl = Deno.env.get('AT_CONNECTOR_URL');
  const token = Deno.env.get('AT_CONNECTOR_TOKEN');

  if (!baseUrl || !token) {
    return { success: false, error: 'AT connector not configured' };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/v1/invoices`;
  const init: any = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
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
      error: data?.error || 'AT connector returned failure',
    };
  }

  return data as ConnectorResponse;
}

async function insertInvoicesFromAT(
  supabase: any,
  clientId: string,
  clientNif: string,
  clientCompanyName: string | null,
  direction: 'compras' | 'vendas',
  invoices: ATInvoice[],
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const inv of invoices) {
    const documentDate = normalizeDate(inv.documentDate);
    const fiscalPeriod = documentDate ? getFiscalPeriodYYYYMM(documentDate) : null;

    const vatTotals = mergeVatTotals(inv.lineSummary || []);

    const supplierNif = direction === 'compras' ? (inv.supplierNif || 'AT') : clientNif;
    const supplierName = direction === 'compras' ? (inv.supplierName || null) : (clientCompanyName || null);
    const customerNif = direction === 'compras' ? (inv.customerNif || clientNif) : (inv.customerNif || null);

    const documentNumber = inv.documentNumber || null;

    if (documentNumber) {
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', clientId)
        .eq('supplier_nif', supplierNif)
        .eq('document_number', documentNumber)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
    }

    const { error } = await supabase
      .from('invoices')
      .insert({
        client_id: clientId,
        supplier_nif: supplierNif,
        supplier_name: supplierName,
        customer_nif: customerNif,
        document_type: inv.documentType || 'FT',
        document_date: documentDate,
        document_number: documentNumber,
        atcud: inv.atcud || null,
        fiscal_region: 'PT',
        ...vatTotals,
        total_amount: Number(inv.grossTotal) || 0,
        total_vat: Number(inv.taxPayable) || 0,
        image_path: `at-webservice/${clientId}/${documentNumber || Date.now()}`,
        status: 'pending',
        fiscal_period: fiscalPeriod,
        efatura_source: 'webservice',
        data_authority: 'at_certified',
      });

    if (error) {
      errors++;
      console.error('[sync-efatura] Insert error:', error.message);
    } else {
      inserted++;
    }
  }

  return { inserted, skipped, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação obrigatória' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Accept internal service-role calls (from process-at-sync-queue) OR valid user JWTs
    const token = authHeader.replace('Bearer ', '').trim();
    const isServiceRole = token === supabaseServiceKey;

    if (!isServiceRole) {
      const authSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user: authUser }, error: authError } = await authSupabase.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ error: 'Token inválido ou expirado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, accountantId, environment, type, startDate, endDate, nif }: SyncRequest = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'clientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('nif, cae, company_name')
      .eq('id', clientId)
      .single();

    const clientNif = nif || profile?.nif;
    if (!clientNif) {
      return new Response(
        JSON.stringify({ error: 'Client NIF not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default date range: current quarter
    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const quarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);

    const effectiveStartDate = startDate || quarterStart.toISOString().split('T')[0];
    const effectiveEndDate = endDate || quarterEnd.toISOString().split('T')[0];

    const hasConnector = Boolean(Deno.env.get('AT_CONNECTOR_URL') && Deno.env.get('AT_CONNECTOR_TOKEN'));
    const intendedMethod = environment === 'test' ? 'api' : (hasConnector ? 'api' : 'portal');

    const { data: syncEntry } = await supabase
      .from('at_sync_history')
      .insert({
        client_id: clientId,
        sync_type: type,
        sync_method: intendedMethod,
        start_date: effectiveStartDate,
        end_date: effectiveEndDate,
        status: 'running',
        metadata: { environment, nif: clientNif, method: intendedMethod },
      })
      .select('id')
      .single();

    const syncId = syncEntry?.id;

    if (environment === 'test') {
      // Keep existing behaviour: mock-only for test
      if (syncId) {
        await supabase.from('at_sync_history').update({
          status: 'success',
          records_imported: 0,
          completed_at: new Date().toISOString(),
          metadata: { environment, nif: clientNif, method: 'mock' },
        }).eq('id', syncId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          environment: 'test',
          count: 0,
          invoices: [],
          syncId,
          message: 'Test environment - no real AT calls performed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ====================================================================
    // 1) Try official SOAP/mTLS via external AT connector (VPS)
    // ====================================================================
    if (hasConnector) {
      console.log(`[sync-efatura] Using AT connector for client ${clientId} (NIF ${clientNif}), type=${type}`);

      const { data: credentials } = await supabase
        .from('at_credentials')
        .select('*')
        .eq('client_id', clientId)
        .limit(1);

      const cred = credentials?.[0];
      const encryptionSecret = Deno.env.get('AT_ENCRYPTION_KEY') || supabaseServiceKey.substring(0, 32);

      let resolvedAccountantId: string | null = accountantId || cred?.accountant_id || null;
      if (!resolvedAccountantId) {
        const { data: associations } = await supabase
          .from('client_accountants')
          .select('accountant_id, is_primary, created_at')
          .eq('client_id', clientId)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1);
        resolvedAccountantId = associations?.[0]?.accountant_id || null;
      }

      let username: string | null = null;
      if (cred?.subuser_id) {
        username = String(cred.subuser_id);
      } else {
        // at_credentials.encrypted_username historically held the sub-user id.
        username = await decodeStoredSecret(cred?.encrypted_username, encryptionSecret, 'at_credentials.encrypted_username');
      }

      let plainPassword: string | null = await decodeStoredSecret(
        cred?.encrypted_password,
        encryptionSecret,
        'at_credentials.encrypted_password',
      );

      if ((!isLikelyWfaUsername(username) || !plainPassword) && resolvedAccountantId) {
        const { data: accountantConfig } = await supabase
          .from('accountant_at_config')
          .select('subuser_id, subuser_password_encrypted')
          .eq('accountant_id', resolvedAccountantId)
          .eq('is_active', true)
          .limit(1);

        const cfg = accountantConfig?.[0];
        if (!isLikelyWfaUsername(username) && cfg?.subuser_id) {
          username = String(cfg.subuser_id);
        }
        if (!plainPassword && cfg?.subuser_password_encrypted) {
          plainPassword = await decodeStoredSecret(
            cfg.subuser_password_encrypted,
            encryptionSecret,
            'accountant_at_config.subuser_password_encrypted',
          );
        }
      }

      if (isLikelyWfaUsername(username) && plainPassword) {
        const connectorResp = await callAtConnector({
          environment,
          clientNif,
          username: username as string,
          password: plainPassword,
          type,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
        });

        const wantCompras = type === 'compras' || type === 'ambos';
        const wantVendas = type === 'vendas' || type === 'ambos';

        let hasErrors = false;
        let hasSuccesses = false;

        let inserted = 0;
        let skipped = 0;
        let errors = 0;

        if (connectorResp.success) {
          if (wantCompras) {
            const q = connectorResp.compras;
            if (q?.success) {
              const r = await insertInvoicesFromAT(supabase, clientId, clientNif, profile?.company_name || null, 'compras', q.invoices || []);
              inserted += r.inserted;
              skipped += r.skipped;
              errors += r.errors;
              hasSuccesses = true;
            } else {
              hasErrors = true;
            }
          }

          if (wantVendas) {
            const q = connectorResp.vendas;
            if (q?.success) {
              const r = await insertInvoicesFromAT(supabase, clientId, clientNif, profile?.company_name || null, 'vendas', q.invoices || []);
              inserted += r.inserted;
              skipped += r.skipped;
              errors += r.errors;
              hasSuccesses = true;
            } else {
              hasErrors = true;
            }
          }

          let overallStatus: 'success' | 'partial' | 'error' = 'success';
          let overallError: string | null = null;

          if (!hasSuccesses && hasErrors) {
            overallStatus = 'error';
            overallError = [
              wantCompras ? (connectorResp.compras?.errorMessage || connectorResp.error) : null,
              wantVendas ? (connectorResp.vendas?.errorMessage || connectorResp.error) : null,
            ].filter(Boolean).join('; ') || 'AT connector failed';
          } else if (hasErrors && hasSuccesses) {
            overallStatus = 'partial';
          }

          if (syncId) {
            await supabase.from('at_sync_history').update({
              status: overallStatus,
              sync_method: 'api',
              records_imported: inserted,
              records_skipped: skipped,
              records_errors: errors,
              error_message: overallError,
              completed_at: new Date().toISOString(),
              metadata: {
                environment,
                nif: clientNif,
                method: 'api_connector',
                timingMs: connectorResp.timingMs,
                totals: {
                  compras: connectorResp.compras?.totalRecords,
                  vendas: connectorResp.vendas?.totalRecords,
                },
              },
            }).eq('id', syncId);
          }

          await supabase.from('at_credentials').update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: overallStatus,
            last_sync_error: overallError,
          }).eq('client_id', clientId);

          if (overallStatus === 'error') {
            return new Response(
              JSON.stringify({ success: false, error: overallError || 'API sync failed', syncId }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              status: overallStatus,
              sync_method: 'api',
              inserted,
              skipped,
              errors,
              syncId,
              message: inserted > 0
                ? `${inserted} facturas importadas via Webservice AT (proxy)`
                : skipped > 0
                  ? `${skipped} facturas já existiam`
                  : 'Nenhuma factura encontrada no período seleccionado',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Connector hard failure -> fallback
        console.error(`[sync-efatura] AT connector failed: ${connectorResp.error || 'unknown error'}`);
      } else {
        console.warn('[sync-efatura] Missing WFA credentials for connector (expected username in NIF/num format and password)');
      }
    }

    // ====================================================================
    // 2) Fallback: Portal JSON (fetch-efatura-portal)
    // ====================================================================
    console.log(`[sync-efatura] Falling back to fetch-efatura-portal for client ${clientId}, type=${type}`);

    const portalResponse = await fetch(
      `${supabaseUrl}/functions/v1/fetch-efatura-portal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          clientId,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          type,
        }),
      }
    );

    const portalData = await portalResponse.json();

    if (portalData.success) {
      if (syncId) {
        await supabase.from('at_sync_history').update({
          status: portalData.status || 'success',
          sync_method: 'portal',
          records_imported: portalData.count || 0,
          records_skipped: portalData.skipped || 0,
          completed_at: new Date().toISOString(),
          metadata: {
            environment,
            nif: clientNif,
            method: 'portal_json_fallback',
            invoicesProcessed: portalData.invoicesProcessed || 0,
          },
        }).eq('id', syncId);
      }

      await supabase.from('at_credentials').update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_error: null,
      }).eq('client_id', clientId);

      return new Response(
        JSON.stringify({
          ...portalData,
          sync_method: 'portal',
          syncId,
          environment,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const portalErr = portalData.error || 'Portal sync failed';

    if (syncId) {
      await supabase.from('at_sync_history').update({
        status: 'error',
        sync_method: 'portal',
        error_message: portalErr,
        completed_at: new Date().toISOString(),
      }).eq('id', syncId);
    }

    await supabase.from('at_credentials').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_error: portalErr,
    }).eq('client_id', clientId);

    return new Response(
      JSON.stringify({ success: false, error: portalErr, syncId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error('[sync-efatura] Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
