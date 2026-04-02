/**
 * enrich-supplier-vies Edge Function
 *
 * Enriches supplier_directory entries using the EU VIES REST API.
 * Targets Portuguese business NIFs (5xx, 6xx, 7xx) that either:
 *   - Are missing from supplier_directory (with source vies/nif_pt/manual)
 *   - Have a placeholder name (name === nif)
 *
 * Service-role only. Called by cron or manual script.
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isServiceRoleToken, extractBearerToken } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ------------------------------------------------------------------ */
/*  VIES helpers (ported from src/lib/viesHelpers.ts)                  */
/* ------------------------------------------------------------------ */

function isBusinessNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const prefix = nif[0];
  return ["5", "6", "7"].includes(prefix) && nif !== "999999990";
}

interface ViesApiResponse {
  isValid: boolean;
  name: string;
  address: string;
}

interface ViesResult {
  name: string | null;
  city: string | null;
  valid: boolean;
}

function parseViesResponse(data: ViesApiResponse): ViesResult {
  if (!data.isValid || data.name === "---" || !data.name) {
    return { name: null, city: null, valid: false };
  }

  let city: string | null = null;
  if (data.address) {
    const lines = data.address
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const match = lastLine.match(/\d{4}-\d{3}\s+(.+)/);
      city = match ? match[1].trim() : null;
    }
  }

  return { name: data.name, city, valid: true };
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                       */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth: service-role only
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = extractBearerToken(req.headers.get("Authorization"));
  if (!isServiceRoleToken(token, serviceRoleKey)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: service-role required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Optional: accept limit from body
  let limit = 50;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.limit && typeof body.limit === "number" && body.limit > 0) {
      limit = Math.min(body.limit, 200);
    }
  } catch {
    // No body — use default
  }

  try {
    // Step 1: Find business NIFs from invoices that need enrichment
    // Use RPC or raw query to find NIFs not yet in supplier_directory
    // with a reliable source, or with placeholder names.

    // 1a. Get distinct business NIFs from invoices where supplier_name IS NULL
    // Paginate in steps of 10,000 to avoid the default 1000-row PostgREST cap.
    const allNifs = new Set<string>();
    const PAGE_SIZE = 10000;

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: invoiceNifs, error: invErr } = await supabase
        .from("invoices")
        .select("supplier_nif")
        .is("supplier_name", null)
        .not("supplier_nif", "is", null)
        .range(offset, offset + PAGE_SIZE - 1);
      if (invErr) throw new Error(`invoices query: ${invErr.message}`);
      if (!invoiceNifs || invoiceNifs.length === 0) break;
      for (const row of invoiceNifs) {
        if (row.supplier_nif && isBusinessNif(row.supplier_nif)) allNifs.add(row.supplier_nif);
      }
      if (invoiceNifs.length < PAGE_SIZE) break;
    }

    // 1b. Also get from sales_invoices (no supplier_name column — get all)
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: salesNifs, error: salesErr } = await supabase
        .from("sales_invoices")
        .select("supplier_nif")
        .not("supplier_nif", "is", null)
        .range(offset, offset + PAGE_SIZE - 1);
      if (salesErr) throw new Error(`sales_invoices query: ${salesErr.message}`);
      if (!salesNifs || salesNifs.length === 0) break;
      for (const row of salesNifs) {
        if (row.supplier_nif && isBusinessNif(row.supplier_nif)) allNifs.add(row.supplier_nif);
      }
      if (salesNifs.length < PAGE_SIZE) break;
    }

    const uniqueNifs = Array.from(allNifs);

    // 1c. Check which are already well-enriched in supplier_directory
    const enrichedNifs = new Set<string>();
    for (let i = 0; i < uniqueNifs.length; i += 100) {
      const batch = uniqueNifs.slice(i, i + 100);
      const { data: dirRows } = await supabase
        .from("supplier_directory")
        .select("nif, name, source")
        .in("nif", batch);

      for (const row of dirRows || []) {
        const reliableSource = ["vies", "nif_pt", "manual"].includes(row.source);
        const hasRealName =
          row.name && row.name !== row.nif && !/^\d{9}$/.test(row.name);

        if (reliableSource && hasRealName) {
          enrichedNifs.add(row.nif);
        }
        // Also skip NIFs we already tried via VIES and got nothing
        if (row.source === "vies_not_found") {
          enrichedNifs.add(row.nif);
        }
      }
    }

    const nifsToEnrich = uniqueNifs
      .filter((nif) => !enrichedNifs.has(nif))
      .slice(0, limit);

    if (nifsToEnrich.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          enriched: 0,
          notFound: 0,
          errors: 0,
          total: uniqueNifs.length,
          alreadyEnriched: enrichedNifs.size,
          message: "All business NIFs already enriched",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 2: Call VIES API for each NIF
    let enriched = 0;
    let notFound = 0;
    let errors = 0;
    const details: Array<{ nif: string; status: string; name?: string }> = [];

    for (let i = 0; i < nifsToEnrich.length; i++) {
      const nif = nifsToEnrich[i];

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const viesResp = await fetch(
          `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/PT/vat/${nif}`,
          { signal: controller.signal },
        );
        clearTimeout(timeout);

        if (!viesResp.ok) {
          // VIES returned HTTP error
          errors++;
          details.push({ nif, status: `http_${viesResp.status}` });
          await sleep(1000);
          continue;
        }

        const viesData: ViesApiResponse = await viesResp.json();
        const parsed = parseViesResponse(viesData);

        if (parsed.valid && parsed.name) {
          // Upsert with good data
          const { error: upsertErr } = await supabase
            .from("supplier_directory")
            .upsert(
              {
                nif,
                name: parsed.name,
                city: parsed.city,
                source: "vies",
                confidence: 90,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "nif" },
            );

          if (upsertErr) {
            errors++;
            details.push({ nif, status: `upsert_error: ${upsertErr.message}` });
          } else {
            enriched++;
            details.push({ nif, status: "enriched", name: parsed.name });

            // Propagate to invoices missing supplier_name
            await supabase
              .from("invoices")
              .update({ supplier_name: parsed.name })
              .eq("supplier_nif", nif)
              .or("supplier_name.is.null,supplier_name.eq.");

            // Propagate to sales_invoices missing supplier_name
            await supabase
              .from("sales_invoices")
              .update({ supplier_name: parsed.name })
              .eq("supplier_nif", nif)
              .or("supplier_name.is.null,supplier_name.eq.");
          }
        } else {
          // VIES says invalid or no name — mark so we don't retry
          await supabase.from("supplier_directory").upsert(
            {
              nif,
              name: nif, // placeholder
              source: "vies_not_found",
              confidence: 10,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "nif" },
          );
          notFound++;
          details.push({ nif, status: "not_found" });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors++;
        details.push({ nif, status: `error: ${msg}` });
      }

      // Rate limit: 1 second between calls
      if (i < nifsToEnrich.length - 1) {
        await sleep(1000);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        enriched,
        notFound,
        errors,
        total: uniqueNifs.length,
        processed: nifsToEnrich.length,
        alreadyEnriched: enrichedNifs.size,
        details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
