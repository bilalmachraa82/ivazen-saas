/**
 * Import Client Credentials Edge Function
 * Bulk import of Portal das Finanças credentials for multiple clients
 * 
 * Features:
 * - Auto-creates auth users + profiles when NIF doesn't exist
 * - Auto-associates profiles to accountant
 * - Handles self-NIF (accountant's own credentials)
 * - Encrypts passwords using AES-256-GCM before storage
 * - Validates NIF format
 * - Uses retry loop for profile creation (trigger latency)
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ClientCredential {
  nif: string;
  portal_password: string;
  full_name?: string;
}

interface ImportRequest {
  credentials: ClientCredential[];
}

interface ImportResult {
  nif: string;
  status: 'imported' | 'updated' | 'created' | 'associated' | 'self' | 'error';
  clientId?: string;
  clientName?: string;
  error?: string;
}

// Validate Portuguese NIF
function isValidNIF(nif: string): boolean {
  if (!nif || nif.length !== 9) return false;
  if (!/^\d{9}$/.test(nif)) return false;
  
  const firstDigit = parseInt(nif[0]);
  if (![1, 2, 3, 5, 6, 7, 8, 9].includes(firstDigit)) return false;
  
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i]) * (9 - i);
  }
  
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;
  
  return checkDigit === parseInt(nif[8]);
}

// Simple encryption using Web Crypto API
async function encryptPassword(password: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Generate salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Derive key from secret
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
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(password)
  );
  
  // Pack as salt:iv:ciphertext (all base64)
  const toBase64 = (arr: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  };
  
  return `${toBase64(salt)}:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

// Generate placeholder email for new clients
function generatePlaceholderEmail(nif: string): string {
  const uuid = crypto.randomUUID().split('-')[0];
  return `${nif}.${uuid}@cliente.ivazen.pt`;
}

// Wait for profile to be created by trigger (retry loop)
async function waitForProfile(
  supabaseAdmin: any,
  userId: string,
  maxAttempts = 3,
  delayMs = 500
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, delayMs));
    const { data: checkProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (checkProfile) return true;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Service client for admin operations
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
        JSON.stringify({ error: 'Only accountants can import client credentials' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get accountant's own profile (to detect self-NIF)
    const { data: accountantProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, nif, full_name, company_name')
      .eq('id', user.id)
      .single();

    const accountantNif = accountantProfile?.nif?.replace(/\D/g, '') || '';

    // Parse request body
    const { credentials }: ImportRequest = await req.json();

    if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No credentials provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get accountant's existing clients
    const { data: clientAssociations } = await supabaseAdmin
      .from('client_accountants')
      .select('client_id')
      .eq('accountant_id', user.id);

    const existingClientIds = new Set(clientAssociations?.map(ca => ca.client_id) || []);

    // Get profiles for these clients (to match NIFs)
    const { data: clientProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, nif, full_name, company_name')
      .in('id', Array.from(existingClientIds));

    // Create NIF to client ID mapping for existing associated clients
    const nifToClient = new Map<string, { id: string; name: string }>();
    for (const profile of clientProfiles || []) {
      if (profile.nif) {
        nifToClient.set(profile.nif, {
          id: profile.id,
          name: profile.company_name || profile.full_name || profile.nif,
        });
      }
    }

    // Encryption secret: prefer dedicated env var, fallback to service role key for backwards compatibility
    const encryptionSecret = Deno.env.get('AT_ENCRYPTION_KEY') || supabaseServiceKey.substring(0, 32);

    // Process each credential
    const results: ImportResult[] = [];

    for (const cred of credentials) {
      const cleanNif = cred.nif.replace(/\D/g, '');
      
      // Validate NIF
      if (!isValidNIF(cleanNif)) {
        results.push({
          nif: cred.nif,
          status: 'error',
          error: 'NIF inválido',
        });
        continue;
      }

      try {
        let clientId: string;
        let clientName: string;
        let status: ImportResult['status'];

        // Case 1: Self-NIF (accountant's own credentials)
        if (cleanNif === accountantNif) {
          clientId = user.id;
          clientName = accountantProfile?.company_name || accountantProfile?.full_name || 'Próprio';
          status = 'self';
          console.log(`[import-credentials] Self-NIF detected: ${cleanNif}`);
        }
        // Case 2: Already associated to this accountant
        else if (nifToClient.has(cleanNif)) {
          const existingClient = nifToClient.get(cleanNif)!;
          clientId = existingClient.id;
          clientName = existingClient.name;
          status = 'imported'; // Will be updated to 'updated' if credentials exist
        }
        // Case 3: Profile exists but not associated
        else {
          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, company_name')
            .eq('nif', cleanNif)
            .neq('id', user.id) // Exclude accountant's own profile
            .maybeSingle();

          if (existingProfile) {
            // Profile exists, associate to this accountant (upsert to avoid duplicates)
            clientId = existingProfile.id;
            clientName = existingProfile.company_name || existingProfile.full_name || cleanNif;
            
            await supabaseAdmin
              .from('client_accountants')
              .upsert({
                client_id: existingProfile.id,
                accountant_id: user.id,
                access_level: 'full',
                is_primary: false,
                invited_by: user.id,
              }, { onConflict: 'client_id,accountant_id' });
            
            status = 'associated';
            console.log(`[import-credentials] Associated existing profile ${cleanNif} to accountant`);
          } else {
            // Case 4: Create new auth user + profile
            const profileName = cred.full_name?.trim() || `Cliente ${cleanNif}`;
            const placeholderEmail = generatePlaceholderEmail(cleanNif);

            // Create auth user first (this is the key fix!)
            const { data: newAuthUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
              email: placeholderEmail,
              email_confirm: true,
              user_metadata: { full_name: profileName }
            });

            if (createUserError || !newAuthUser?.user) {
              console.error(`[import-credentials] Failed to create auth user for ${cleanNif}:`, createUserError);
              results.push({
                nif: cleanNif,
                status: 'error',
                error: `Erro ao criar utilizador: ${createUserError?.message || 'Erro desconhecido'}`,
              });
              continue;
            }

            const newUserId = newAuthUser.user.id;

            // Wait for trigger to create profile (retry loop for robustness)
            await waitForProfile(supabaseAdmin, newUserId, 3, 500);

            // Upsert profile with NIF and name
            const { error: upsertError } = await supabaseAdmin
              .from('profiles')
              .upsert({
                id: newUserId,
                nif: cleanNif,
                full_name: profileName,
                company_name: profileName,
                email: placeholderEmail,
                accountant_id: user.id, // retrocompatibility
              }, { onConflict: 'id' });

            if (upsertError) {
              console.error(`[import-credentials] Failed to upsert profile for ${cleanNif}:`, upsertError);
              results.push({
                nif: cleanNif,
                status: 'error',
                error: `Erro ao criar perfil: ${upsertError.message}`,
              });
              continue;
            }

            // Associate to accountant (upsert)
            await supabaseAdmin
              .from('client_accountants')
              .upsert({
                client_id: newUserId,
                accountant_id: user.id,
                access_level: 'full',
                is_primary: true,
                invited_by: user.id,
              }, { onConflict: 'client_id,accountant_id' });

            clientId = newUserId;
            clientName = profileName;
            status = 'created';
            console.log(`[import-credentials] Created new auth user + profile for ${cleanNif}: ${profileName}`);
          }

          // Add to map for future lookups in this batch
          nifToClient.set(cleanNif, { id: clientId, name: clientName });
          existingClientIds.add(clientId);
        }

        // Encrypt password
        const encryptedPassword = await encryptPassword(cred.portal_password, encryptionSecret);

        // Upsert credentials (avoids duplicates on reimport)
        const { error: credError } = await supabaseAdmin
          .from('at_credentials')
          .upsert({
            client_id: clientId,
            accountant_id: user.id,
            portal_nif: cleanNif,
            portal_password_encrypted: encryptedPassword,
            encrypted_username: cleanNif,
            encrypted_password: encryptedPassword,
            environment: 'production',
            last_sync_status: 'never',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'client_id' });

        if (credError) {
          console.error(`[import-credentials] Failed to upsert credentials for ${cleanNif}:`, credError);
          // Don't fail completely, just log
        }

        // Override status if already had credentials
        if (status === 'imported') {
          const { data: existingCreds } = await supabaseAdmin
            .from('at_credentials')
            .select('id, updated_at')
            .eq('client_id', clientId)
            .maybeSingle();
          
          if (existingCreds) {
            status = 'updated';
          }
        }

        results.push({
          nif: cleanNif,
          status,
          clientId,
          clientName,
        });

      } catch (error: any) {
        console.error(`[import-credentials] Error processing NIF ${cleanNif}:`, error);
        results.push({
          nif: cleanNif,
          status: 'error',
          error: error.message || 'Erro desconhecido',
        });
      }
    }

    // Summary
    const created = results.filter(r => r.status === 'created').length;
    const associated = results.filter(r => r.status === 'associated').length;
    const imported = results.filter(r => r.status === 'imported').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const self = results.filter(r => r.status === 'self').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`[import-credentials] Summary: ${created} created, ${associated} associated, ${imported} imported, ${updated} updated, ${self} self, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: credentials.length,
          created,
          associated,
          imported,
          updated,
          self,
          notFound: 0, // We now create profiles, so no "not found"
          errors,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[import-client-credentials] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
