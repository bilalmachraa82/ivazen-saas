import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateClientRequest {
  full_name: string;
  nif: string;
  email: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Client for checking user auth
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    // Admin client for creating users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the authenticated user (accountant)
    const { data: { user: accountant }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !accountant) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Accountant ID:', accountant.id);

    // Check if user is an accountant
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', accountant.id)
      .eq('role', 'accountant')
      .single();

    if (roleError || !roleData) {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Apenas contabilistas podem criar clientes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateClientRequest = await req.json();
    const { full_name, nif, email } = body;

    // SECURITY: Don't log sensitive data (NIF, email)
    console.log('Creating new client');

    // Validate required fields
    if (!full_name || !nif || !email) {
      return new Response(
        JSON.stringify({ error: 'Nome, NIF e email são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate NIF format (Portuguese NIF - 9 digits)
    const nifClean = nif.replace(/\s/g, '');
    if (!/^\d{9}$/.test(nifClean)) {
      return new Response(
        JSON.stringify({ error: 'NIF inválido. Deve conter 9 dígitos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUser?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'Já existe um utilizador com este email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if NIF already exists in profiles (excluding the accountant's own profile)
    const { data: existingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('nif', nifClean)
      .neq('id', accountant.id);

    if (existingProfiles && existingProfiles.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Já existe um cliente com este NIF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: full_name,
      }
    });

    if (createError || !newUser?.user) {
      console.error('Create user error:', createError);
      return new Response(
        JSON.stringify({ error: createError?.message || 'Erro ao criar utilizador' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created:', newUser.user.id);

    // Wait a bit for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update or insert the profile with NIF, company name and accountant_id
    // The profile should be created automatically by the database trigger
    // but we'll do an upsert to be safe
    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        nif: nifClean,
        company_name: full_name, // Use full_name as company_name for Modelo 10
        accountant_id: accountant.id,
        full_name: full_name,
        email: email
      }, {
        onConflict: 'id'
      });

    if (upsertError) {
      console.error('Upsert profile error:', upsertError);
      // Try a simple update as fallback
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          nif: nifClean,
          company_name: full_name,
          accountant_id: accountant.id,
          full_name: full_name,
          email: email
        })
        .eq('id', newUser.user.id);
      
      if (updateError) {
        console.error('Update profile fallback error:', updateError);
      }
    }

    // Generate magic link for the client
    const siteUrl = Deno.env.get('SITE_URL') || `${supabaseUrl.replace('.supabase.co', '')}.lovable.dev`;
    const redirectUrl = siteUrl.includes('localhost') ? 'http://localhost:5173/' : `https://${siteUrl}/`;
    
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (linkError) {
      console.error('Generate link error:', linkError);
      return new Response(
        JSON.stringify({ 
          error: 'Cliente criado mas erro ao gerar link. O cliente pode usar "Esqueci a password" para aceder.',
          client_id: newUser.user.id
        }),
        { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the full magic link URL
    const magicLink = linkData.properties?.action_link;

    console.log('Magic link generated successfully');

    // CRITICAL: Insert into client_accountants table for proper association
    const { error: clientAccountantError } = await supabaseAdmin
      .from('client_accountants')
      .insert({
        client_id: newUser.user.id,
        accountant_id: accountant.id,
        access_level: 'full',
        is_primary: true,
        invited_by: accountant.id
      });

    if (clientAccountantError) {
      console.error('Error inserting client_accountants:', clientAccountantError);
      // Don't fail the request, the profile.accountant_id is already set as fallback
    } else {
      console.log('Client-accountant association created successfully');
    }

    // Record the invitation
    await supabaseAdmin
      .from('client_invitations')
      .insert({
        accountant_id: accountant.id,
        client_id: newUser.user.id,
        client_email: email,
        client_nif: nifClean,
        client_name: full_name,
        company_name: full_name
      });

    return new Response(
      JSON.stringify({
        success: true,
        client_id: newUser.user.id,
        magic_link: magicLink,
        message: 'Cliente criado com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
