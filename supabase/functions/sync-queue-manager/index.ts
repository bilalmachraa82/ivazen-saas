/**
 * Sync Queue Manager
 * Creates background jobs for mass AT synchronization
 *
 * VERSION: sync-queue-manager@20260224-1900
 */

const VERSION = "sync-queue-manager@20260224-1900";

import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

declare const EdgeRuntime:
  | {
    waitUntil: (promise: Promise<unknown>) => void;
  }
  | undefined;

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
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate caller JWT directly with service role (more robust than anon-key path)
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth
      .getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Ensure caller is accountant
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "accountant")
      .limit(1);

    if (roleError || !roleRows || roleRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Forbidden: accountant role required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const { data: progress } = await supabaseAdmin.rpc(
        "get_sync_batch_progress",
        {
          p_batch_id: batchId,
        },
      );

      return new Response(
        JSON.stringify({ success: true, progress: progress?.[0] || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Default: Create sync jobs
    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "clientIds array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const currentYear = new Date().getFullYear();
    const year = fiscalYear || currentYear;
    const minAllowedYear = currentYear - 1;
    const maxAllowedYear = currentYear;
    let overrideUsed = false;
    let overrideId: string | null = null;

    if (year < minAllowedYear || year > maxAllowedYear) {
      // Optional audited override for exceptional runs (configured by admin via SQL).
      const { data: overrideRow, error: overrideError } = await supabaseAdmin
        .from("at_sync_year_overrides")
        .select("id, expires_at")
        .eq("accountant_id", user.id)
        .eq("fiscal_year", year)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (overrideError) {
        console.warn(
          `[${VERSION}] override lookup failed for year ${year}:`,
          overrideError.message,
        );
      }

      const overrideIsActive = Boolean(
        overrideRow &&
          (!overrideRow.expires_at ||
            new Date(overrideRow.expires_at) > new Date()),
      );

      if (!overrideIsActive) {
        return new Response(
          JSON.stringify({
            error:
              `Ano fiscal inválido. Permitidos: ${maxAllowedYear} e ${minAllowedYear}.`,
            code: "FISCAL_YEAR_NOT_ALLOWED",
            allowedYears: [maxAllowedYear, minAllowedYear],
            receivedYear: year,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      overrideUsed = true;
      overrideId = overrideRow!.id;
    }
    const newBatchId = crypto.randomUUID();

    console.log(
      `Creating sync batch ${newBatchId} for ${clientIds.length} clients, year ${year}`,
    );

    // Verify user is accountant with access to these clients
    const { data: validClients } = await supabaseAdmin
      .from("client_accountants")
      .select("client_id")
      .eq("accountant_id", user.id)
      .in("client_id", clientIds);

    const validClientIds = validClients?.map((c) => c.client_id) || [];

    if (validClientIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid clients found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert jobs
    const jobs = validClientIds.map((clientId) => ({
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

    // Start background processing using EdgeRuntime.waitUntil when available
    const processUrl = `${SUPABASE_URL}/functions/v1/process-at-sync-queue`;

    // Fire and forget - don't await
    const triggerProcessor = () =>
      fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ batchId: newBatchId }),
      });

    if (EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(
        triggerProcessor().catch((err) =>
          console.error("Failed to trigger processor:", err)
        ),
      );
    } else {
      // Fallback path when EdgeRuntime is unavailable.
      try {
        const processorResp = await triggerProcessor();
        if (!processorResp.ok) {
          const body = await processorResp.text();
          console.error(
            `[${VERSION}] Fallback processor trigger failed HTTP ${processorResp.status}: ${
              body.substring(0, 200)
            }`,
          );
        }
      } catch (err) {
        console.error(`[${VERSION}] Fallback processor trigger error:`, err);
      }
    }

    if (overrideUsed) {
      const { error: auditError } = await supabaseAdmin
        .from("at_sync_override_audit")
        .insert({
          override_id: overrideId,
          accountant_id: user.id,
          requested_by: user.id,
          fiscal_year: year,
          batch_id: newBatchId,
          source: "sync-queue-manager",
        });
      if (auditError) {
        console.warn(
          `[${VERSION}] override audit insert failed:`,
          auditError.message,
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        batchId: newBatchId,
        totalJobs: jobs.length,
        fiscalYear: year,
        overrideUsed,
        message: `Sincronização iniciada para ${jobs.length} clientes`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("sync-queue-manager error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
