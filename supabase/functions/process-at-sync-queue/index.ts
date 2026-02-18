/**
 * Process AT Sync Queue
 * Background processor for mass AT synchronization
 * Processes jobs in batches, can be called multiple times
 * 
 * VERSION: process-at-sync-queue@20260208-0200
 */

const VERSION = "process-at-sync-queue@20260208-0200";

import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 5; // Process 5 clients at a time
const MAX_RUNTIME_MS = 50000; // 50 seconds max per invocation (leave margin for 60s limit)

Deno.serve(async (req) => {
  console.log(`[${VERSION}] Request received`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { batchId } = await req.json();
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get pending jobs
    let query = supabase
      .from("at_sync_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (batchId) {
      query = query.eq("job_batch_id", batchId);
    }

    const { data: jobs, error: jobsError } = await query;

    if (jobsError) {
      console.error(`[${VERSION}] Failed to fetch jobs:`, jobsError);
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      console.log(`[${VERSION}] No pending jobs found`);
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending jobs", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${VERSION}] Processing ${jobs.length} jobs from batch ${batchId || "any"}`);

    let processed = 0;
    let errors = 0;

    for (const job of jobs) {
      // Check if we're running out of time
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log("Approaching time limit, stopping batch");
        break;
      }

      try {
        // Mark as processing
        await supabase
          .from("at_sync_jobs")
          .update({ status: "processing", started_at: new Date().toISOString() })
          .eq("id", job.id);

        // Get client credentials
        const { data: credentials } = await supabase
          .from("at_credentials")
          .select("*")
          .eq("client_id", job.client_id)
          .maybeSingle();

        if (!credentials) {
          throw new Error("No credentials configured for client");
        }

        // Call sync-efatura
        const syncResponse = await fetch(`${SUPABASE_URL}/functions/v1/sync-efatura`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            clientId: job.client_id,
            accountantId: job.accountant_id,
            environment: credentials.environment || "production",
            type: "ambos",
            fiscalYear: job.fiscal_year,
          }),
        });

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text();
          throw new Error(`HTTP ${syncResponse.status}: ${errorText.substring(0, 200)}`);
        }

        const syncResult = await syncResponse.json();

        // CRITICAL: Validate the body - sync-efatura returns 200 even for config errors
        if (syncResult.success !== true) {
          throw new Error(syncResult.error || syncResult.message || "Sync returned success=false");
        }
        
        if (syncResult.missingConfig) {
          const missing = Object.entries(syncResult.missingConfig)
            .filter(([_, v]) => v)
            .map(([k]) => k)
            .join(", ");
          throw new Error(`Falta configuração: ${missing}`);
        }

        // Mark as completed
        await supabase
          .from("at_sync_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            invoices_synced: syncResult.invoicesProcessed || syncResult.count || 0,
          })
          .eq("id", job.id);

        processed++;
        console.log(`[${VERSION}] Job ${job.id} completed: ${syncResult.invoicesProcessed || 0} invoices`);

      } catch (error: any) {
        console.error(`[${VERSION}] Job ${job.id} failed:`, error.message);
        
        // Mark as error
        await supabase
          .from("at_sync_jobs")
          .update({
            status: "error",
            error_message: error.message || "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        errors++;
      }
    }

    // Check if there are more pending jobs
    const { count: remainingCount } = await supabase
      .from("at_sync_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("job_batch_id", batchId || jobs[0]?.job_batch_id);

    const hasMore = (remainingCount || 0) > 0;

    // If there are more jobs and we have time, trigger another round
    if (hasMore && Date.now() - startTime < MAX_RUNTIME_MS - 5000) {
      console.log(`${remainingCount} jobs remaining, triggering next batch...`);
      
      EdgeRuntime.waitUntil(
        fetch(`${SUPABASE_URL}/functions/v1/process-at-sync-queue`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ batchId: batchId || jobs[0]?.job_batch_id }),
        }).catch(err => console.error("Failed to trigger next batch:", err))
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(`Batch complete: ${processed} processed, ${errors} errors, ${elapsed}ms elapsed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        remaining: remainingCount || 0,
        hasMore,
        elapsedMs: elapsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("process-at-sync-queue error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
