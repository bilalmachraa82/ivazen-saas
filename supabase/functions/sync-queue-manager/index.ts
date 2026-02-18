/**
 * Sync Queue Manager
 * Creates background jobs for mass AT synchronization
 * 
 * VERSION: sync-queue-manager@20260208-0200
 */

const VERSION = "sync-queue-manager@20260208-0200";

import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create clients
    const supabaseUser = createClient(SUPABASE_URL, authHeader.replace("Bearer ", ""), {
      auth: { persistSession: false },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body (can only read once)
    const body = await req.json();
    const { clientIds, fiscalYear, action, batchId } = body;

    // Handle different actions
    if (action === "status") {
      if (!batchId) {
        return new Response(
          JSON.stringify({ error: "batchId required for status action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: progress } = await supabaseAdmin.rpc("get_sync_batch_progress", {
        p_batch_id: batchId,
      });
      
      return new Response(
        JSON.stringify({ success: true, progress: progress?.[0] || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: Create sync jobs
    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "clientIds array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const year = fiscalYear || new Date().getFullYear();
    const newBatchId = crypto.randomUUID();

    console.log(`Creating sync batch ${newBatchId} for ${clientIds.length} clients, year ${year}`);

    // Verify user is accountant with access to these clients
    const { data: validClients } = await supabaseAdmin
      .from("client_accountants")
      .select("client_id")
      .eq("accountant_id", user.id)
      .in("client_id", clientIds);

    const validClientIds = validClients?.map(c => c.client_id) || [];
    
    if (validClientIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid clients found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert jobs
    const jobs = validClientIds.map(clientId => ({
      accountant_id: user.id,
      client_id: clientId,
      fiscal_year: year,
      status: "pending",
      job_batch_id: newBatchId,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("at_sync_jobs")
      .insert(jobs);

    if (insertError) {
      console.error("Failed to insert jobs:", insertError);
      throw insertError;
    }

    console.log(`Created ${jobs.length} sync jobs in batch ${newBatchId}`);

    // Start background processing using EdgeRuntime.waitUntil
    const processUrl = `${SUPABASE_URL}/functions/v1/process-at-sync-queue`;
    
    // Fire and forget - don't await
    EdgeRuntime.waitUntil(
      fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ batchId: newBatchId }),
      }).catch(err => console.error("Failed to trigger processor:", err))
    );

    return new Response(
      JSON.stringify({
        success: true,
        batchId: newBatchId,
        totalJobs: jobs.length,
        fiscalYear: year,
        message: `Sincronização iniciada para ${jobs.length} clientes`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("sync-queue-manager error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
