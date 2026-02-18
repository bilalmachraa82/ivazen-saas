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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface FetchRequest {
  clientId: string;
  startDate?: string;
  endDate?: string;
  type?: 'compras' | 'vendas' | 'ambos';
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
}

// Extract cookies from Set-Cookie headers
function extractCookies(headers: Headers): string {
  const cookies: string[] = [];
  // Deno handles multiple Set-Cookie headers via getSetCookie
  const setCookieHeaders = headers.getSetCookie?.() || [];
  for (const setCookie of setCookieHeaders) {
    const cookiePart = setCookie.split(';')[0];
    if (cookiePart) cookies.push(cookiePart);
  }
  // Also try the standard way
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

// Merge cookie strings
function mergeCookies(...cookieStrings: string[]): string {
  const cookieMap = new Map<string, string>();
  for (const cs of cookieStrings) {
    if (!cs) continue;
    for (const pair of cs.split('; ')) {
      const [name] = pair.split('=');
      if (name) cookieMap.set(name.trim(), pair);
    }
  }
  return Array.from(cookieMap.values()).join('; ');
}

function extractCsrfFromCookies(cookieString: string): string | null {
  const csrfNames = ['XSRF-TOKEN', 'CSRF-TOKEN', '_csrf', 'csrfToken'];
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

function extractCsrfFromHtml(html: string): { token: string; header: string } | null {
  const tokenMatch = html.match(/name=["']_csrf["']\s+content=["']([^"']+)["']/i);
  const headerMatch = html.match(/name=["']_csrf_header["']\s+content=["']([^"']+)["']/i);
  if (!tokenMatch?.[1]) return null;
  return {
    token: tokenMatch[1],
    header: headerMatch?.[1] || 'X-CSRF-TOKEN',
  };
}

// Decrypt password using AES-256-GCM (same as sync-efatura)
async function decryptPassword(encryptedData: string, secret: string): Promise<string> {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Password vazia');
  }

  // Backward compatibility: some legacy rows were stored as plaintext.
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    return encryptedData;
  }

  const [saltB64, ivB64, ciphertextB64] = encryptedData.split(':');

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
      salt: salt.buffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer },
    key,
    ciphertext.buffer
  );

  return new TextDecoder().decode(decrypted);
}

// Step 1: Login to Portal das Financas
async function loginToPortal(nif: string, password: string): Promise<{ success: boolean; cookies: string; error?: string }> {
  try {
    console.log(`[fetch-efatura-portal] Login attempt: NIF=${nif}, password length=${password.length}`);

    const loginSubmitUrl = 'https://www.acesso.gov.pt/v2/submitNifForm';
    const loginPageUrl = 'https://www.acesso.gov.pt/v2/loginForm?partID=EFPF&path=painelAdquirente.action';

    let sessionCookies = '';

    // Retry once if CSRF token is stale/missing.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const loginPageResp = await fetch(loginPageUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      console.log(`[fetch-efatura-portal] Login page attempt ${attempt}: status=${loginPageResp.status}, finalUrl=${loginPageResp.url}`);

      const pageCookies = extractCookies(loginPageResp.headers);
      sessionCookies = mergeCookies(sessionCookies, pageCookies);
      const loginPageHtml = await loginPageResp.text();

      const allHiddenFields: Record<string, string> = {};
      const hiddenMatches = loginPageHtml.matchAll(/<input[^>]*type=["']hidden["'][^>]*>/gi);
      for (const m of hiddenMatches) {
        const nameMatch = m[0].match(/name=["']([^"']+)["']/);
        const valueMatch = m[0].match(/value=["']([^"']*)["']/);
        if (nameMatch) {
          allHiddenFields[nameMatch[1]] = valueMatch ? valueMatch[1] : '';
        }
      }

      const csrfFromCookies = extractCsrfFromCookies(sessionCookies);
      const csrfFromMeta = extractCsrfFromHtml(loginPageHtml);
      const csrfToken = csrfFromMeta?.token || csrfFromCookies;

      console.log(`[fetch-efatura-portal] Hidden fields found: ${JSON.stringify(Object.keys(allHiddenFields))}`);
      console.log(`[fetch-efatura-portal] CSRF from cookies: ${csrfFromCookies ? 'yes' : 'no'}, from meta: ${csrfFromMeta ? 'yes' : 'no'}`);

      // Submit login form — include all hidden fields plus auth data and CSRF if available.
      const formData = new URLSearchParams();

      for (const [key, value] of Object.entries(allHiddenFields)) {
        formData.append(key, value);
      }

      formData.set('partID', 'EFPF');
      formData.set('authVersion', '1');
      formData.set('selectedAuthMethod', 'N');
      formData.set('username', nif);
      formData.set('password', password);
      formData.set('path', allHiddenFields.path || 'painelAdquirente.action');

      if (csrfToken) {
        formData.set('_csrf', csrfToken);
      }

      const loginHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': sessionCookies,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': loginPageUrl,
      };

      if (csrfToken) {
        loginHeaders['X-XSRF-TOKEN'] = csrfToken;
        loginHeaders['X-CSRF-TOKEN'] = csrfToken;
        if (csrfFromMeta?.header) {
          loginHeaders[csrfFromMeta.header] = csrfToken;
        }
      }

      const loginResp = await fetch(loginSubmitUrl, {
        method: 'POST',
        headers: loginHeaders,
        body: formData.toString(),
        redirect: 'manual',
      });

      const loginCookies = extractCookies(loginResp.headers);
      sessionCookies = mergeCookies(sessionCookies, loginCookies);

      // Check for redirect to e-Fatura portal
      const location = loginResp.headers.get('location');
      const loginBody = await loginResp.text();

      console.log(`[fetch-efatura-portal] Login submit attempt ${attempt}: status=${loginResp.status}, location=${location || 'none'}, bodyLength=${loginBody.length}, bodyPreview=${loginBody.substring(0, 500).replace(/\n/g, ' ')}`);

      if (loginBody.length > 500) {
        console.log(`[fetch-efatura-portal] Login body mid: ${loginBody.substring(500, 1500).replace(/\n/g, ' ')}`);
      }

      const csrfBlocked = loginResp.status === 403 || loginBody.includes('invalidCsrfToken');
      if (csrfBlocked && attempt === 1) {
        console.log(`[fetch-efatura-portal] CSRF rejection on attempt 1. Retrying once with fresh token.`);
        continue;
      }
      if (csrfBlocked) {
        console.log(`[fetch-efatura-portal] Login blocked: CSRF token required/invalid after retry (status=${loginResp.status})`);
        return { success: false, cookies: '', error: 'Portal AT requer token CSRF válido. Tente novamente.' };
      }

      // NEW SPA detection: check for successful login via data attributes
      if (loginResp.status === 200 && loginBody.includes('data-session-user-nif') && !loginBody.includes('data-submit-nif-form-username')) {
        console.log(`[fetch-efatura-portal] SPA login success detected via data attributes`);
        return { success: true, cookies: sessionCookies };
      }

      // NEW SPA detection: if the login form was re-rendered with our NIF, credentials are wrong
      if (loginBody.includes(`data-submit-nif-form-username="${nif}"`)) {
        console.log(`[fetch-efatura-portal] SPA login FAILED: login form re-rendered with submitted NIF`);
        return { success: false, cookies: '', error: 'Credenciais inválidas. Verifique NIF e password.' };
      }

      // If we got a redirect, follow it to get the e-Fatura session
      if (location && (location.includes('faturas.portaldasfinancas') || location.includes('efatura'))) {
        console.log(`[fetch-efatura-portal] Following redirect to: ${location}`);
        const redirectResp = await fetch(location, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': sessionCookies,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'manual',
        });

        const redirectCookies = extractCookies(redirectResp.headers);
        sessionCookies = mergeCookies(sessionCookies, redirectCookies);
        console.log(`[fetch-efatura-portal] Redirect 1: status=${redirectResp.status}`);

        // May have further redirects
        const location2 = redirectResp.headers.get('location');
        if (location2) {
          console.log(`[fetch-efatura-portal] Following redirect 2 to: ${location2}`);
          const redirect2Resp = await fetch(location2, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Cookie': sessionCookies,
            },
            redirect: 'manual',
          });
          const redirect2Cookies = extractCookies(redirect2Resp.headers);
          sessionCookies = mergeCookies(sessionCookies, redirect2Cookies);
          console.log(`[fetch-efatura-portal] Redirect 2: status=${redirect2Resp.status}`);
        }

        return { success: true, cookies: sessionCookies };
      }

      // Try to extract redirect form from HTML body (some login flows use form-based redirect)
      if (loginBody.includes('loginRedirectForm') || loginBody.includes('redirectForm')) {
        console.log(`[fetch-efatura-portal] Found redirect form in HTML body`);
        // Extract form action and hidden fields
        const actionMatch = loginBody.match(/action="([^"]+)"/);
        const formAction = actionMatch ? actionMatch[1] : '';

        if (formAction && formAction.includes('faturas.portaldasfinancas')) {
          // Extract all hidden inputs
          const hiddenFields = new URLSearchParams();
          const inputMatches = loginBody.matchAll(/name="([^"]+)"[^>]*value="([^"]*)"/g);
          for (const match of inputMatches) {
            hiddenFields.append(match[1], match[2]);
          }

          const formResp = await fetch(formAction, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Cookie': sessionCookies,
            },
            body: hiddenFields.toString(),
            redirect: 'manual',
          });

          const formCookies = extractCookies(formResp.headers);
          sessionCookies = mergeCookies(sessionCookies, formCookies);
          console.log(`[fetch-efatura-portal] Form redirect: status=${formResp.status}`);
          return { success: true, cookies: sessionCookies };
        }
      }

      // Check if login actually failed - use SPECIFIC Portuguese AT portal error messages only
      if (loginBody.includes('dados de autenticação inválidos') || loginBody.includes('Credenciais inválidas') || loginBody.includes('autenticação falhou')) {
        console.log(`[fetch-efatura-portal] Login FAILED: specific auth error found in response`);
        return { success: false, cookies: '', error: 'Credenciais inválidas. Verifique NIF e password.' };
      }

      // Check for 2FA requirement — use specific patterns to avoid false positives
      // Generic words like 'SMS' appear in portal menus/footers even without 2FA
      const has2FA = (
        (loginBody.includes('código de segurança') && loginBody.includes('confirmar')) ||
        loginBody.includes('introduza o código') ||
        loginBody.includes('código enviado por SMS') ||
        loginBody.includes('segundo fator de autenticação') ||
        (loginBody.includes('2FA') && loginBody.includes('verificação'))
      );
      if (has2FA) {
        console.log(`[fetch-efatura-portal] Login blocked by 2FA requirement. Body preview: ${loginBody.substring(0, 500)}`);
        return { success: false, cookies: '', error: 'Portal AT exige autenticação de dois factores (2FA/SMS). Sincronização automática não disponível.' };
      }

      // If we got this far without a clear redirect or error, try anyway with current cookies
      console.log(`[fetch-efatura-portal] No clear redirect or error detected. Proceeding with current cookies.`);
      return { success: true, cookies: sessionCookies };
    }

    return { success: false, cookies: '', error: 'Falha inesperada no fluxo de login.' };

  } catch (error: any) {
    console.error('[fetch-efatura-portal] Login error:', error);
    return { success: false, cookies: '', error: `Login failed: ${error.message}` };
  }
}

// Step 1b: Bootstrap session on e-Fatura domain after successful login
// Follows redirects up to 5 times and merges cookies from each response
// Returns success only if final page is NOT a login form
async function bootstrapPortalSession(
  cookies: string,
  maxRedirects: number = 5
): Promise<{ success: boolean; cookies: string; error?: string }> {
  try {
    console.log(`[fetch-efatura-portal] Bootstrapping session on faturas.portaldasfinancas.gov.pt`);
    
    const bootstrapUrl = 'https://faturas.portaldasfinancas.gov.pt/painelAdquirente.action';
    let currentUrl = bootstrapUrl;
    let currentCookies = cookies;
    let redirectCount = 0;

    // Follow redirects up to maxRedirects times
    while (redirectCount < maxRedirects) {
      console.log(`[fetch-efatura-portal] Bootstrap request ${redirectCount + 1}: ${currentUrl}`);
      
      const resp = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': currentCookies,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'manual',
      });

      console.log(`[fetch-efatura-portal] Bootstrap response: status=${resp.status}`);

      // Merge cookies from this response
      const newCookies = extractCookies(resp.headers);
      currentCookies = mergeCookies(currentCookies, newCookies);

      // Check for redirect
      const location = resp.headers.get('location');
      if (location && (redirectCount < maxRedirects - 1)) {
        currentUrl = location;
        redirectCount++;
        console.log(`[fetch-efatura-portal] Following redirect to: ${location}`);
        continue;
      }

      // Final response reached - check if it's a login page
      const bodyText = await resp.text();
      
      // Check for login form indicators
      const hasLoginForm = /name=["']username["']|name=["']nif["']|action=["'].*login/i.test(bodyText);
      
      if (hasLoginForm) {
        console.log(`[fetch-efatura-portal] Bootstrap FAILED: Final page contains login form`);
        return { success: false, cookies: '', error: 'Session not established - login form still present' };
      }

      console.log(`[fetch-efatura-portal] Bootstrap SUCCESS: Session established, no login form detected`);
      return { success: true, cookies: currentCookies };
    }

    console.log(`[fetch-efatura-portal] Bootstrap exceeded max redirects (${maxRedirects})`);
    return { success: false, cookies: '', error: 'Too many redirects during bootstrap' };

  } catch (error: any) {
    console.error('[fetch-efatura-portal] Bootstrap error:', error);
    return { success: false, cookies: '', error: `Bootstrap failed: ${error.message}` };
  }
}

// Step 2: Fetch invoices from the portal JSON endpoint
async function fetchInvoicesFromPortal(
  cookies: string,
  nif: string,
  startDate: string,
  endDate: string,
  type: 'compras' | 'vendas'
): Promise<{ success: boolean; invoices: PortalInvoice[]; totalRecords: number; error?: string }> {
  try {
    const endpoint = type === 'compras'
      ? 'https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosAdquirente.action'
      : 'https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosEmitente.action';

    const params = new URLSearchParams({
      dataInicioFilter: startDate,
      dataFimFilter: endDate,
      ambitoAquisicaoFilter: 'TODOS',
      _: Date.now().toString(),
    });

    const resp = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookies,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://faturas.portaldasfinancas.gov.pt/consultarDocumentosAdquirente.action',
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (text.includes('login') || text.includes('autenticacao') || resp.status === 302) {
        return { success: false, invoices: [], totalRecords: 0, error: 'Sessão expirada. Tente novamente.' };
      }
      return { success: false, invoices: [], totalRecords: 0, error: `Portal returned ${resp.status}` };
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      // Probably got redirected to login page
      return { success: false, invoices: [], totalRecords: 0, error: 'Sessão expirada ou credenciais inválidas.' };
    }

    const data = await resp.json();

    // The portal returns an object with "linhas" array
    const linhas = data.linhas || data.lines || data.documentos || [];
    const totalRecords = data.totalElementos || data.totalRecords || linhas.length;

    const invoices: PortalInvoice[] = linhas.map((l: any) => ({
      nifEmitente: l.nifEmitente || l.nif || '',
      nomeEmitente: l.nomeEmitente || l.nome || '',
      numerodocumento: l.numerodocumento || l.numDocumento || l.documentNumber || '',
      dataEmissao: l.dataEmissao || l.data || '',
      tipoDocumento: l.tipoDocumento || l.tipo || 'FT',
      atcud: l.atcud || '',
      valorTotal: parseFloat(l.valorTotal || l.total || 0),
      valorIVA: parseFloat(l.valorIVA || l.iva || 0),
      baseTributavel: parseFloat(l.baseTributavel || l.baseIncidencia || 0),
      actividadeEmitente: l.actividadeEmitente || l.actividade || undefined,
      situacao: l.situacao || l.estado || undefined,
    }));

    return { success: true, invoices, totalRecords };

  } catch (error: any) {
    console.error('[fetch-efatura-portal] Fetch error:', error);
    return { success: false, invoices: [], totalRecords: 0, error: error.message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, startDate, endDate, type = 'compras' }: FetchRequest = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'clientId is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client credentials (portal NIF + password)
    const { data: credentials } = await supabase
      .from('at_credentials')
      .select('*')
      .eq('client_id', clientId)
      .limit(1);

    const cred = credentials?.[0];
    if (!cred) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciais AT não configuradas para este cliente.',
          missingConfig: { credentials: true },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client NIF from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('nif')
      .eq('id', clientId)
      .single();

    const clientNif = cred.portal_nif || profile?.nif;
    if (!clientNif) {
      return new Response(
        JSON.stringify({ success: false, error: 'NIF do cliente não encontrado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt portal password
    const encryptionSecret = Deno.env.get('AT_ENCRYPTION_KEY') || supabaseServiceKey.substring(0, 32);
    let portalPassword: string;

    const passwordField = cred.portal_password_encrypted || cred.encrypted_password;
    if (!passwordField) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Password do Portal das Finanças não configurada.',
          missingConfig: { portal_password: true },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      portalPassword = await decryptPassword(passwordField, encryptionSecret);
      console.log(`[fetch-efatura-portal] Decrypted password length=${portalPassword.length}`);
    } catch (err) {
      console.error('[fetch-efatura-portal] Decrypt error:', err);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao desencriptar credenciais.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range (default: current quarter)
    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const quarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);

    const effectiveStartDate = startDate || quarterStart.toISOString().split('T')[0];
    const effectiveEndDate = endDate || quarterEnd.toISOString().split('T')[0];

    // Create sync history entry
    const { data: syncEntry } = await supabase
      .from('at_sync_history')
      .insert({
        client_id: clientId,
        sync_type: type,
        sync_method: 'portal',
        start_date: effectiveStartDate,
        end_date: effectiveEndDate,
        status: 'running',
        metadata: { method: 'portal_json', nif: clientNif },
      })
      .select('id')
      .single();

    const syncId = syncEntry?.id;

    console.log(`[fetch-efatura-portal] Logging in for NIF ${clientNif}...`);

    // Step 1: Login
    const loginResult = await loginToPortal(clientNif, portalPassword);

    if (!loginResult.success) {
      if (syncId) {
        await supabase.from('at_sync_history').update({
          status: 'error',
          error_message: loginResult.error,
          completed_at: new Date().toISOString(),
        }).eq('id', syncId);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: loginResult.error || 'Login falhou',
          syncId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-efatura-portal] Login OK. Bootstrapping session on e-Fatura domain...`);

    // Step 1b: Bootstrap session on e-Fatura domain
    const bootstrapResult = await bootstrapPortalSession(loginResult.cookies);
    
    if (!bootstrapResult.success) {
      if (syncId) {
        await supabase.from('at_sync_history').update({
          status: 'error',
          error_message: bootstrapResult.error || 'Session bootstrap failed',
          completed_at: new Date().toISOString(),
        }).eq('id', syncId);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: bootstrapResult.error || 'Session bootstrap falhou',
          syncId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-efatura-portal] Session bootstrap OK. Fetching invoices...`);

     // Step 2: Fetch invoices
    const allInvoices: PortalInvoice[] = [];
    const queries: Array<'compras' | 'vendas'> = [];
    const queryResults: Map<string, { success: boolean; count: number; error?: string }> = new Map();
    let hasErrors = false;
    let hasSuccesses = false;

    if (type === 'compras' || type === 'ambos') queries.push('compras');
    if (type === 'vendas' || type === 'ambos') queries.push('vendas');

    for (const queryType of queries) {
      const result = await fetchInvoicesFromPortal(
        bootstrapResult.cookies,
        clientNif,
        effectiveStartDate,
        effectiveEndDate,
        queryType
      );

      if (result.success) {
        allInvoices.push(...result.invoices);
        queryResults.set(queryType, { success: true, count: result.invoices.length });
        hasSuccesses = true;
        console.log(`[fetch-efatura-portal] ${queryType}: ${result.invoices.length} invoices`);
      } else {
        queryResults.set(queryType, { success: false, count: 0, error: result.error });
        hasErrors = true;
        console.error(`[fetch-efatura-portal] ${queryType} error: ${result.error}`);
      }
    }

    // BUG 4 FIX: Determine overall status based on query results
    let overallStatus = 'success';
    let overallError: string | null = null;
    
    if (!hasSuccesses && hasErrors) {
      // All queries failed
      overallStatus = 'error';
      overallError = Array.from(queryResults.values())
        .filter(r => r.error)
        .map(r => r.error)
        .join('; ');
    } else if (hasErrors && hasSuccesses) {
      // Some queries succeeded, some failed
      overallStatus = 'partial';
    }
    
    console.log(`[fetch-efatura-portal] Query status: ${overallStatus}, hasSuccesses=${hasSuccesses}, hasErrors=${hasErrors}`);

    // Step 3: Map to invoices table format and insert
    let insertedCount = 0;
    let skippedCount = 0;

    for (const inv of allInvoices) {
      // Check for duplicates
      if (inv.numerodocumento) {
        const { data: existing } = await supabase
          .from('invoices')
          .select('id')
          .eq('client_id', clientId)
          .eq('supplier_nif', inv.nifEmitente)
          .eq('document_number', inv.numerodocumento)
          .limit(1);

        if (existing && existing.length > 0) {
          skippedCount++;
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
        base_standard: null, vat_standard: null,
        base_intermediate: null, vat_intermediate: null,
        base_reduced: null, vat_reduced: null,
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
      const fiscalPeriod = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      const { error } = await supabase
        .from('invoices')
        .insert({
          client_id: clientId,
          supplier_nif: inv.nifEmitente || 'PORTAL',
          supplier_name: inv.nomeEmitente || null,
          document_date: docDate,
          document_number: inv.numerodocumento || null,
          document_type: inv.tipoDocumento || 'FT',
          atcud: inv.atcud || null,
          total_amount: inv.valorTotal,
          total_vat: inv.valorIVA,
          ...vatFields,
          fiscal_period: fiscalPeriod,
          fiscal_region: 'PT',
          image_path: `efatura-portal/${clientId}/${inv.numerodocumento || Date.now()}`,
          status: 'pending',
          efatura_source: 'portal_json',
          data_authority: 'at_portal',
        });

      if (!error) {
        insertedCount++;
      } else {
        console.error('[fetch-efatura-portal] Insert error:', error.message);
      }
    }

    // Update sync history
    if (syncId) {
      await supabase.from('at_sync_history').update({
        status: overallStatus,
        error_message: overallError,
        records_imported: insertedCount,
        completed_at: new Date().toISOString(),
        metadata: {
          method: 'portal_json',
          nif: clientNif,
          total_found: allInvoices.length,
          inserted: insertedCount,
          skipped: skippedCount,
          queryDetails: Object.fromEntries(queryResults),
        },
      }).eq('id', syncId);
    }

    // Update credentials last sync
    await supabase.from('at_credentials').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: overallStatus,
      last_sync_error: overallError,
    }).eq('client_id', clientId);

    console.log(`[fetch-efatura-portal] Done: status=${overallStatus}, ${insertedCount} inserted, ${skippedCount} skipped`);

    // BUG 4 FIX: Return appropriate success/error based on overall status
    if (overallStatus === 'error') {
      return new Response(
        JSON.stringify({
          success: false,
          error: overallError || 'Sync queries failed',
          syncId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: overallStatus,
        count: insertedCount,
        invoicesProcessed: allInvoices.length,
        invoices: allInvoices,
        syncId,
        skipped: skippedCount,
        message: insertedCount > 0
          ? `${insertedCount} facturas importadas do portal e-Fatura`
          : allInvoices.length > 0
            ? `${skippedCount} facturas já existem na base de dados`
            : 'Nenhuma factura encontrada no período seleccionado',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fetch-efatura-portal] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
