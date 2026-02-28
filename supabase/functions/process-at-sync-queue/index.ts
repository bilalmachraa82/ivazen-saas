/**
 * Process AT Sync Queue
 * Background processor for mass AT synchronization
 * Processes jobs in batches, can be called multiple times
 *
 * VERSION: process-at-sync-queue@20260225-1315
 */

const VERSION = "process-at-sync-queue@20260225-1315";

import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENABLE_AUTO_WITHHOLDINGS_SYNC = Deno.env.get(
  "AT_AUTO_WITHHOLDINGS_SYNC",
) === "1";

const BATCH_SIZE = 5; // Process 5 clients at a time
const MAX_RUNTIME_MS = 50000; // 50 seconds max per invocation (leave margin for 60s limit)

declare const EdgeRuntime:
  | {
    waitUntil: (promise: Promise<unknown>) => void;
  }
  | undefined;

function toISODateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function triggerAutomaticWithholdingSync(
  clientId: string,
  accountantId: string | null,
  startDate: string,
  endDate: string,
): Promise<void> {
  return fetch(`${SUPABASE_URL}/functions/v1/fetch-efatura-portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      clientId,
      accountantId,
      startDate,
      endDate,
      type: "vendas",
      syncWithholdings: true,
    }),
  }).then(async (resp) => {
    const body = await resp.text();
    if (!resp.ok) {
      console.error(
        `[${VERSION}] Withholding auto-sync failed HTTP ${resp.status}: ${
          body.substring(0, 200)
        }`,
      );
      return;
    }
    try {
      const parsed = JSON.parse(body);
      const withholdings = parsed?.withholdings || {};
      console.log(
        `[${VERSION}] Withholding auto-sync ok for client ${clientId}: inserted=${
          withholdings.inserted ?? 0
        }, promoted=${withholdings.promoted ?? 0}, pendingReview=${
          withholdings.pendingReview ?? 0
        }, skipped=${withholdings.skipped ?? 0}, errors=${
          withholdings.errors ?? 0
        }, mode=${withholdings.mode ?? "n/a"}`,
      );
    } catch {
      console.log(
        `[${VERSION}] Withholding auto-sync response (client ${clientId}) received`,
      );
    }
  }).catch((err) => {
    console.error(
      `[${VERSION}] Withholding auto-sync error for client ${clientId}:`,
      err,
    );
  });
}

Deno.serve(async (req) => {
  console.log(`[${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Security: internal-only endpoint.
    // Accept either service-role bearer token or an internal webhook token used by DB scheduler.
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || "";
    const webhookToken = (req.headers.get("x-internal-webhook-token") || "")
      .trim();

    let isAuthorized = token === SUPABASE_SERVICE_ROLE_KEY;
    if (!isAuthorized && webhookToken) {
      const { data: webhookRow, error: webhookError } = await supabase
        .from("internal_webhook_keys")
        .select("token")
        .eq("name", "process_at_sync_queue")
        .limit(1)
        .maybeSingle();

      if (!webhookError && webhookRow?.token) {
        isAuthorized = webhookToken === webhookRow.token;
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let batchId = "";
    try {
      const body = await req.json();
      batchId = String(body?.batchId || "").trim();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON body",
          code: "INVALID_PAYLOAD",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!batchId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "batchId is required",
          code: "BATCH_ID_REQUIRED",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get pending jobs
    let query = supabase
      .from("at_sync_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    query = query.eq("job_batch_id", batchId);

    const { data: jobs, error: jobsError } = await query;

    if (jobsError) {
      console.error(`[${VERSION}] Failed to fetch jobs:`, jobsError);
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      console.log(`[${VERSION}] No pending jobs found`);
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: "No pending jobs",
          _version: VERSION,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[${VERSION}] Processing ${jobs.length} jobs from batch ${
        batchId || "any"
      }`,
    );

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
          .update({
            status: "processing",
            started_at: new Date().toISOString(),
          })
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

        // Build fiscal year date range (avoid future dates for current year).
        const fy = job.fiscal_year;
        const today = toISODateUTC(new Date());
        const currentYear = Number(today.slice(0, 4));
        if (Number(fy) > currentYear) {
          throw new Error(
            `YEAR_IN_FUTURE: fiscal_year=${fy} is greater than current_year=${currentYear}`,
          );
        }
        const startDate = `${fy}-01-01`;
        const endDate = Number(fy) === currentYear ? today : `${fy}-12-31`;

        // Call sync-efatura
        const syncResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/sync-efatura`,
          {
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
              startDate,
              endDate,
            }),
          },
        );

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text();
          throw new Error(
            `HTTP ${syncResponse.status}: ${errorText.substring(0, 200)}`,
          );
        }

        const syncResult = await syncResponse.json();

        // CRITICAL: Validate the body - sync-efatura returns 200 even for config errors
        if (syncResult.success !== true) {
          const reasonPrefix = syncResult.reasonCode
            ? `[${syncResult.reasonCode}] `
            : "";
          throw new Error(
            `${reasonPrefix}${
              syncResult.error || syncResult.message ||
              "Sync returned success=false"
            }`,
          );
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
            invoices_synced: syncResult.invoicesProcessed ||
              syncResult.inserted || syncResult.count || 0,
          })
          .eq("id", job.id);

        // Non-blocking: trigger automatic AT withholdings sync from portal JSON.
        // This does not affect the main purchases/sales sync status.
        if (ENABLE_AUTO_WITHHOLDINGS_SYNC && Number(fy) === currentYear) {
          const autoSyncPromise = triggerAutomaticWithholdingSync(
            job.client_id,
            job.accountant_id || null,
            startDate,
            endDate,
          );
          if (EdgeRuntime?.waitUntil) {
            EdgeRuntime.waitUntil(autoSyncPromise);
          } else {
            void autoSyncPromise;
          }
        }

        processed++;
        console.log(
          `[${VERSION}] Job ${job.id} completed: ${
            syncResult.invoicesProcessed || syncResult.inserted || 0
          } invoices`,
        );
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
      .eq("job_batch_id", batchId);

    const hasMore = (remainingCount || 0) > 0;

    // If there are more jobs, trigger another round.
    if (hasMore) {
      const nextBatchPayload = { batchId };
      const triggerNextBatch = () =>
        fetch(`${SUPABASE_URL}/functions/v1/process-at-sync-queue`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify(nextBatchPayload),
        });

      console.log(
        `${remainingCount} jobs remaining, triggering next batch...`,
      );

      if (EdgeRuntime?.waitUntil) {
        EdgeRuntime.waitUntil(
          triggerNextBatch().catch((err) =>
            console.error("Failed to trigger next batch:", err)
          ),
        );
      } else {
        // Fallback path for environments where EdgeRuntime is unavailable.
        try {
          const nextResp = await triggerNextBatch();
          if (!nextResp.ok) {
            const body = await nextResp.text();
            console.error(
              `[${VERSION}] Fallback trigger failed HTTP ${nextResp.status}: ${
                body.substring(0, 200)
              }`,
            );
          }
        } catch (err) {
          console.error(`[${VERSION}] Fallback trigger error:`, err);
        }
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `Batch complete: ${processed} processed, ${errors} errors, ${elapsed}ms elapsed`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        remaining: remainingCount || 0,
        hasMore,
        elapsedMs: elapsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("process-at-sync-queue error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Processing failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
