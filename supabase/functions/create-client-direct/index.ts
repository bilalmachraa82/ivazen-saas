import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateClientRequest {
  full_name: string;
  nif: string;
  email?: string | null;
  phone?: string;
  address?: string;
}

function normalizeEmail(rawEmail: unknown): string | null {
  if (!rawEmail || typeof rawEmail !== 'string') return null;
  const candidates = rawEmail.split(/[,;\s\n\t]+/).filter(Boolean);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  for (let candidate of candidates) {
    candidate = candidate.replace(/[.,;:!]+$/, '').trim().toLowerCase();
    if (emailRegex.test(candidate)) return candidate;
  }
  return null;
}

function generatePlaceholderEmail(nif: string): string {
  const uuid = crypto.randomUUID().split('-')[0];
  return `${nif}.${uuid}@cliente.ivazen.pt`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Validate JWT explicitly (required for Lovable Cloud ES256 tokens)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: accountant }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !accountant) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', accountant.id)
      .eq('role', 'accountant')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Apenas contabilistas podem criar clientes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateClientRequest = await req.json();
    const { full_name, nif, phone, address } = body;

    if (!full_name || !nif) {
      return new Response(
        JSON.stringify({ error: 'Nome e NIF são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nifClean = nif.replace(/\s/g, '');
    if (!/^\d{9}$/.test(nifClean)) {
      return new Response(
        JSON.stringify({ error: 'NIF inválido. Deve conter 9 dígitos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let email = normalizeEmail(body.email);
    let isPlaceholderEmail = false;
    
    if (!email) {
      email = generatePlaceholderEmail(nifClean);
      isPlaceholderEmail = true;
    }

    // Check if NIF already exists
    const { data: existingProfileByNIF } = await supabaseAdmin
      .from('profiles')
      .select('id, accountant_id, full_name')
      .eq('nif', nifClean)
      .neq('id', accountant.id)
      .maybeSingle();

    if (existingProfileByNIF) {
      await supabaseAdmin
        .from('client_accountants')
        .upsert({
          client_id: existingProfileByNIF.id,
          accountant_id: accountant.id,
          access_level: 'full',
          is_primary: existingProfileByNIF.accountant_id === null,
          invited_by: accountant.id
        }, { onConflict: 'client_id,accountant_id' });

      if (existingProfileByNIF.accountant_id === null) {
        await supabaseAdmin
          .from('profiles')
          .update({ accountant_id: accountant.id, phone: phone || undefined, address: address || undefined })
          .eq('id', existingProfileByNIF.id);
      }

      return new Response(
        JSON.stringify({ success: true, client_id: existingProfileByNIF.id, action: 'associated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists in profiles (efficient query, no listUsers limit)
    if (!isPlaceholderEmail) {
      const { data: existingProfileByEmail } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', email!)
        .neq('id', accountant.id)
        .maybeSingle();

      if (existingProfileByEmail) {
        await supabaseAdmin
          .from('client_accountants')
          .upsert({
            client_id: existingProfileByEmail.id,
            accountant_id: accountant.id,
            access_level: 'full',
            is_primary: false,
            invited_by: accountant.id
          }, { onConflict: 'client_id,accountant_id' });

        await supabaseAdmin
          .from('profiles')
          .update({ nif: nifClean, company_name: full_name, phone: phone || null, address: address || null })
          .eq('id', existingProfileByEmail.id)
          .is('nif', null);

        return new Response(
          JSON.stringify({ success: true, client_id: existingProfileByEmail.id, action: 'associated_by_email' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create new user
    let usedEmail = email;
    const firstAttempt = await supabaseAdmin.auth.admin.createUser({
      email: usedEmail,
      email_confirm: true,
      user_metadata: { full_name }
    });

    let newUser = firstAttempt.data?.user;
    let createError = firstAttempt.error;

    if (createError) {
      const errorMsg = createError.message?.toLowerCase() || '';
      
      if (errorMsg.includes('already') && errorMsg.includes('registered')) {
        // Find by email in profiles (no listUsers limit)
        const { data: foundProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .ilike('email', usedEmail)
          .maybeSingle();
        
        if (foundProfile) {
          await supabaseAdmin
            .from('client_accountants')
            .upsert({
              client_id: foundProfile.id,
              accountant_id: accountant.id,
              access_level: 'full',
              is_primary: false,
              invited_by: accountant.id
            }, { onConflict: 'client_id,accountant_id' });

          return new Response(
            JSON.stringify({ success: true, client_id: foundProfile.id, action: 'associated_race_condition' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      if (errorMsg.includes('invalid') && errorMsg.includes('format')) {
        usedEmail = generatePlaceholderEmail(nifClean);
        isPlaceholderEmail = true;
        
        const retryAttempt = await supabaseAdmin.auth.admin.createUser({
          email: usedEmail,
          email_confirm: true,
          user_metadata: { full_name }
        });
        
        newUser = retryAttempt.data?.user;
        createError = retryAttempt.error;
      }
    }

    if (createError || !newUser) {
      return new Response(
        JSON.stringify({ success: false, error: createError?.message || 'Erro ao criar utilizador', action: 'failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.id,
        nif: nifClean,
        company_name: full_name,
        accountant_id: accountant.id,
        full_name: full_name,
        email: usedEmail,
        phone: phone || null,
        address: address || null,
      }, { onConflict: 'id' });

    await supabaseAdmin
      .from('client_accountants')
      .upsert({
        client_id: newUser.id,
        accountant_id: accountant.id,
        access_level: 'full',
        is_primary: true,
        invited_by: accountant.id
      }, { onConflict: 'client_id,accountant_id' });

    let magicLink = null;
    if (!isPlaceholderEmail) {
      const siteUrl = Deno.env.get('SITE_URL') || 'https://ivazen.app';
      try {
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: usedEmail,
          options: { redirectTo: siteUrl }
        });
        magicLink = linkData?.properties?.action_link;
      } catch (_) {}
    }

    try {
      await supabaseAdmin
        .from('client_invitations')
        .upsert({
          accountant_id: accountant.id,
          client_id: newUser.id,
          client_email: usedEmail,
          client_nif: nifClean,
          client_name: full_name,
          company_name: full_name
        }, { onConflict: 'accountant_id,client_id' });
    } catch (_) {}

    return new Response(
      JSON.stringify({ success: true, client_id: newUser.id, magic_link: magicLink, action: 'created' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, action: 'failed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
