// @ts-nocheck
/**
 * Upload AT Certificate Edge Function
 * Handles PFX certificate upload and ChaveCifraPublicaAT configuration
 * 
 * Security:
 * - Validates certificate format
 * - Encrypts PFX password before storage
 * - Only accessible by accountants
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import forge from "npm:node-forge@1.3.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface UploadCertRequest {
  pfxBase64: string;
  pfxPassword: string;
  atPublicKeyBase64: string;
  subuserId: string;          // Format: NIF/ID (e.g., "232945993/1")
  subuserPassword: string;
  environment: 'test' | 'production';
  certificateCN?: string;     // Common Name from certificate
  validFrom?: string;         // ISO date
  validTo?: string;           // ISO date
  caCertBase64?: string;      // Base64 of .p7b (DER), .cer, .crt, or .pem CA chain file
}

// Simple encryption using Web Crypto API
async function encryptSecret(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
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
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  const toBase64 = (arr: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  };
  
  return `${toBase64(salt)}:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

// Validate PFX format (basic check)
function isValidPFXBase64(base64: string): boolean {
  try {
    // Try to decode and check for PKCS#12 magic bytes
    const binary = atob(base64);
    // PKCS#12 files start with specific ASN.1 sequence
    return binary.length > 20 && binary.charCodeAt(0) === 0x30;
  } catch {
    return false;
  }
}

// Validate subuser ID format
function isValidSubuserId(subuserId: string): boolean {
  // Format: NIF/number (e.g., "232945993/1")
  const match = subuserId.match(/^(\d{9})\/(\d+)$/);
  if (!match) return false;
  
  const nif = match[1];
  const firstDigit = parseInt(nif[0]);
  return [1, 2, 3, 5, 6, 7, 8, 9].includes(firstDigit);
}

/**
 * Parse a CA certificate file (PEM, DER, or PKCS#7 .p7b) and return PEM chain.
 * Handles: .pem (pass-through), .cer/.crt (DER single cert), .p7b (PKCS#7 bundle).
 */
function parseCACertToChainPem(base64Data: string): string | null {
  try {
    const decoded = atob(base64Data);

    // Case 1: Already PEM text
    if (decoded.includes('-----BEGIN CERTIFICATE-----')) {
      return decoded;
    }

    // Binary data — try parsing as DER
    const derBytes = forge.util.decode64(base64Data);

    // Case 2: Try PKCS#7 (.p7b) — contains certificate bundle
    try {
      const asn1 = forge.asn1.fromDer(derBytes);
      const msg = forge.pkcs7.messageFromAsn1(asn1);
      if (msg.certificates && msg.certificates.length > 0) {
        const pems = msg.certificates.map(
          (cert: forge.pki.Certificate) => forge.pki.certificateToPem(cert)
        );
        console.log(`[upload-at-certificate] Extracted ${pems.length} cert(s) from PKCS#7`);
        return pems.join('\n');
      }
    } catch {
      // Not PKCS#7, try single DER certificate
    }

    // Case 3: Single DER-encoded certificate
    try {
      const asn1 = forge.asn1.fromDer(derBytes);
      const cert = forge.pki.certificateFromAsn1(asn1);
      console.log('[upload-at-certificate] Parsed single DER certificate');
      return forge.pki.certificateToPem(cert);
    } catch {
      // Not a valid certificate
    }

    console.error('[upload-at-certificate] Could not parse CA certificate in any known format');
    return null;
  } catch (err) {
    console.error('[upload-at-certificate] CA cert parsing failed:', err);
    return null;
  }
}

/**
 * Parse a PKCS#12 (PFX) and verify it contains a private key that matches a certificate.
 * Returns the matching certificate info (CN + validity) so we can store consistent metadata.
 *
 * This prevents a common real-world failure mode: generating a PFX with the wrong private key,
 * which makes mTLS impossible and wastes days waiting for AT certificate re-issues.
 */
function validateAndExtractPfxInfo(
  pfxBase64: string,
  pfxPassword: string,
  expectedCN: string
): { cn: string | null; validFrom: string | null; validTo: string | null; error?: string } {
  try {
    const derBytes = forge.util.decode64(pfxBase64);
    const asn1 = forge.asn1.fromDer(derBytes);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, pfxPassword);

    // Private key
    const keyBagTypes = [forge.pkcs12.oids.pkcs8ShroudedKeyBag, forge.pkcs12.oids.keyBag];
    let privateKey: any = null;
    for (const bagType of keyBagTypes) {
      const bags = (p12.getBags({ bagType }) as any)?.[bagType] as any[] | undefined;
      if (bags && bags.length > 0 && bags[0]?.key) {
        privateKey = bags[0].key;
        break;
      }
    }

    if (!privateKey) {
      return { cn: null, validFrom: null, validTo: null, error: 'O PFX não contém chave privada.' };
    }

    const keyModulus = (privateKey as any)?.n?.toString(16);
    if (!keyModulus) {
      return { cn: null, validFrom: null, validTo: null, error: 'Formato de chave privada inválido (esperado RSA).' };
    }

    // Certificates: pick the one whose public key matches the private key modulus.
    const certBags = (p12.getBags({ bagType: forge.pkcs12.oids.certBag }) as any)?.[
      forge.pkcs12.oids.certBag
    ] as any[] | undefined;
    const certBag = certBags?.find((b) => {
      const cert = b?.cert as forge.pki.Certificate | undefined;
      const certModulus = (cert?.publicKey as any)?.n?.toString(16);
      return !!certModulus && certModulus === keyModulus;
    });

    if (!certBag?.cert) {
      return {
        cn: null,
        validFrom: null,
        validTo: null,
        error: 'O PFX é inválido: a chave privada não corresponde a nenhum certificado.',
      };
    }

    const cert = certBag.cert as forge.pki.Certificate;
    const cn = cert.subject.getField('CN')?.value || null;

    if (expectedCN && cn && cn !== expectedCN) {
      return {
        cn,
        validFrom: null,
        validTo: null,
        error: `O PFX contém um certificado com CN diferente. Esperado: ${expectedCN}. Encontrado: ${cn}.`,
      };
    }

    return {
      cn,
      validFrom: cert.validity?.notBefore ? cert.validity.notBefore.toISOString() : null,
      validTo: cert.validity?.notAfter ? cert.validity.notAfter.toISOString() : null,
    };
  } catch (err: any) {
    return { cn: null, validFrom: null, validTo: null, error: 'PFX inválido ou password incorreta.' };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is accountant
    const { data: isAccountant } = await supabaseUser.rpc('has_role', {
      _user_id: user.id,
      _role: 'accountant',
    });

    if (!isAccountant) {
      return new Response(
        JSON.stringify({ error: 'Only accountants can upload certificates' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const {
      pfxBase64,
      pfxPassword,
      atPublicKeyBase64,
      subuserId,
      subuserPassword,
      environment,
      certificateCN,
      validFrom,
      validTo,
      caCertBase64,
    }: UploadCertRequest = await req.json();

    // Validate inputs
    if (!pfxBase64) {
      return new Response(
        JSON.stringify({ error: 'PFX certificate is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidPFXBase64(pfxBase64)) {
      return new Response(
        JSON.stringify({ error: 'Invalid PFX format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pfxPassword || pfxPassword.length < 4) {
      return new Response(
        JSON.stringify({ error: 'PFX password is required (min 4 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!atPublicKeyBase64) {
      return new Response(
        JSON.stringify({ error: 'AT public key (ChaveCifraPublicaAT) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subuserId || !isValidSubuserId(subuserId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid subuser ID format. Expected: NIF/number (e.g., 232945993/1)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subuserPassword) {
      return new Response(
        JSON.stringify({ error: 'Subuser password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate PFX contents early (cert/key match + expected CN).
    const expectedCN = subuserId.split('/')[0];
    const pfxInfo = validateAndExtractPfxInfo(pfxBase64, pfxPassword, expectedCN);
    if (pfxInfo.error) {
      return new Response(
        JSON.stringify({ error: pfxInfo.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encrypt sensitive data: prefer dedicated env var, fallback to service role key
    const encryptionSecret = Deno.env.get('AT_ENCRYPTION_KEY') || supabaseServiceKey.substring(0, 32);
    const encryptedPfxPassword = await encryptSecret(pfxPassword, encryptionSecret);
    const encryptedSubuserPassword = await encryptSecret(subuserPassword, encryptionSecret);

    // Parse CA certificate if provided (.p7b, .cer, .pem)
    let caChainPem: string | null = null;
    if (caCertBase64) {
      caChainPem = parseCACertToChainPem(caCertBase64);
      if (!caChainPem) {
        return new Response(
          JSON.stringify({ error: 'Formato de certificado CA inválido. Aceite: .p7b, .cer, .crt, .pem' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if config already exists
    const { data: existing } = await supabaseAdmin
      .from('accountant_at_config')
      .select('id')
      .eq('accountant_id', user.id)
      .limit(1);

    const configData = {
      accountant_id: user.id,
      certificate_pfx_base64: pfxBase64,
      certificate_password_encrypted: encryptedPfxPassword,
      certificate_cn: pfxInfo.cn || certificateCN || expectedCN,
      certificate_valid_from: pfxInfo.validFrom || validFrom || null,
      certificate_valid_to: pfxInfo.validTo || validTo || null,
      at_public_key_base64: atPublicKeyBase64,
      subuser_id: subuserId,
      subuser_password_encrypted: encryptedSubuserPassword,
      environment,
      is_active: true,
      updated_at: new Date().toISOString(),
      ...(caCertBase64 !== undefined && { ca_chain_pem: caChainPem }),
    };

    let result;
    if (existing && existing.length > 0) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('accountant_at_config')
        .update(configData)
        .eq('id', existing[0].id)
        .select()
        .single();

      if (error) throw error;
      result = { ...data, action: 'updated' };
    } else {
      // Insert new
      const { data, error } = await supabaseAdmin
        .from('accountant_at_config')
        .insert(configData)
        .select()
        .single();

      if (error) throw error;
      result = { ...data, action: 'created' };
    }

    // Don't return sensitive data
    return new Response(
      JSON.stringify({
        success: true,
        action: result.action,
        config: {
          id: result.id,
          certificate_cn: result.certificate_cn,
          certificate_valid_from: result.certificate_valid_from,
          certificate_valid_to: result.certificate_valid_to,
          subuser_id: result.subuser_id,
          environment: result.environment,
          is_active: result.is_active,
          updated_at: result.updated_at,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[upload-at-certificate] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
