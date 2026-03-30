/**
 * Process AT Sync Queue
 * Background processor for mass AT synchronization
 * Processes jobs in batches, can be called multiple times
 *
 * VERSION: process-at-sync-queue@20260225-1315
 */

const VERSION = "process-at-sync-queue@20260225-1315";

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import {
  isServiceRoleToken,
  extractBearerToken,
  verifyWebhookToken,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE = 5; // Process 5 clients at a time
const MAX_RUNTIME_MS = 50000; // 50 seconds max per invocation (leave margin for 60s limit)
const SYNC_REQUEST_TIMEOUT_MS = Math.max(
  5000,
  Number(Deno.env.get("AT_SYNC_REQUEST_TIMEOUT_MS") || 35000),
);

declare const EdgeRuntime:
  | {
    waitUntil: (promise: Promise<unknown>) => void;
  }
  | undefined;

function toISODateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// NOTE: Automatic withholding sync via portal scraping has been removed.
// fetch-efatura-portal now returns 410 Gone. Withholdings must be
// handled through the official AT SOAP webservice or manual upload.

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
    const token = extractBearerToken(req.headers.get("Authorization"));
    const webhookToken = (req.headers.get("x-internal-webhook-token") || "").trim();

    let isAuthorized = isServiceRoleToken(token, SUPABASE_SERVICE_ROLE_KEY);

    if (!isAuthorized && webhookToken) {
      isAuthorized = await verifyWebhookToken(supabase, webhookToken, "process_at_sync_queue");
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

    // Get pending jobs (includes retryable error jobs whose retry time has passed)
    const { data: jobs, error: jobsError } = await supabase
      .from("at_sync_jobs")
      .select("*")
      .eq("job_batch_id", batchId)
      .or(
        "status.eq.pending," +
        "and(status.eq.error,next_retry_at.not.is.null,next_retry_at.lte." + new Date().toISOString() + ")"
      )
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

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

        const environment = credentials?.environment === "test"
          ? "test"
          : "production";

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
        const syncResponse = await fetchWithTimeout(
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
              environment,
              type: "ambos",
              startDate,
              endDate,
              source: "queue",
            }),
          },
          SYNC_REQUEST_TIMEOUT_MS,
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

        processed++;
        console.log(
          `[${VERSION}] Job ${job.id} completed: ${
            syncResult.invoicesProcessed || syncResult.inserted || 0
          } invoices`,
        );
      } catch (error: any) {
        const errorMsg = error.message || "Unknown error";
        console.error(`[${VERSION}] Job ${job.id} failed:`, errorMsg);

        // Classify error: transient (retryable) vs permanent (dead letter)
        const msg = errorMsg.toLowerCase();
        const isPermanent =
          msg.includes("auth_failed") ||
          msg.includes("autentic") ||
          msg.includes("credencia") ||
          msg.includes("no credentials") ||
          msg.includes("unauthorized") ||
          msg.includes("forbidden") ||
          msg.includes("nif inv") ||
          msg.includes("year_in_future");

        const currentRetry = job.retry_count || 0;
        const maxRetries = job.max_retries || 3;

        let nextRetryAt: string | null = null;
        if (!isPermanent && currentRetry < maxRetries) {
          // Exponential backoff: (retry+1) * 2 hours
          const delayHours = (currentRetry + 1) * 2;
          const retryDate = new Date(Date.now() + delayHours * 60 * 60 * 1000);
          nextRetryAt = retryDate.toISOString();
          console.log(
            `[${VERSION}] Job ${job.id} scheduled for retry ${currentRetry + 1}/${maxRetries} at ${nextRetryAt}`,
          );
        } else if (isPermanent) {
          console.log(
            `[${VERSION}] Job ${job.id} moved to dead letter (permanent error)`,
          );
        } else {
          console.log(
            `[${VERSION}] Job ${job.id} moved to dead letter (max retries exceeded)`,
          );
        }

        await supabase
          .from("at_sync_jobs")
          .update({
            status: "error",
            error_message: errorMsg,
            completed_at: new Date().toISOString(),
            retry_count: currentRetry + (isPermanent ? 0 : 1),
            next_retry_at: nextRetryAt,
          })
          .eq("id", job.id);

        errors++;
      }
    }

    // Check if there are more pending jobs (including retryable ones)
    const { count: remainingCount } = await supabase
      .from("at_sync_jobs")
      .select("*", { count: "exact", head: true })
      .eq("job_batch_id", batchId)
      .eq("status", "pending");

    const hasMore = (remainingCount || 0) > 0;

    // If there are more jobs, trigger another round.
    if (hasMore) {
      const nextBatchPayload = { batchId };
      const triggerNextBatch = () =>
        fetchWithTimeout(`${SUPABASE_URL}/functions/v1/process-at-sync-queue`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify(nextBatchPayload),
        }, 10000);

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
