/**
 * Re-encrypt AT Credentials — One-time migration function
 *
 * After migrating to a new Supabase instance, credentials encrypted with
 * the old service key can no longer be decrypted. This function takes
 * plaintext NIF+password pairs and re-encrypts them with the current key.
 *
 * Auth: service-role only (admin operation)
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isServiceRoleToken, extractBearerToken } from "../_shared/auth.ts";
import { encryptSecret } from "../_shared/encrypt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Main handler ──────────────────────────────────────────────────────────

interface CredentialInput {
  nif: string;
  password: string;
  name?: string;
}

interface ResultEntry {
  nif: string;
  status: "ok" | "not_found" | "error";
  clientId?: string;
  clientName?: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: require service-role key ────────────────────────────────
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing service key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify service-role token (with JWT decode fallback)
    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!isServiceRoleToken(token, supabaseServiceKey)) {
      return new Response(
        JSON.stringify({ error: "Acesso restrito a service-role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Parse body ───────────────────────────────────────────────────
    const body = await req.json();
    const credentials: CredentialInput[] = body.credentials;
    const accountantId: string | undefined = body.accountant_id;

    if (!Array.isArray(credentials) || credentials.length === 0) {
      return new Response(
        JSON.stringify({ error: "credentials array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Admin client ─────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      supabaseServiceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Security hardening: dedicated key is mandatory (no service-role fallback).
    const encryptionSecret = Deno.env.get("AT_ENCRYPTION_KEY")?.trim() || "";
    if (!encryptionSecret) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing AT_ENCRYPTION_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Build NIF → profile lookup ───────────────────────────────────
    const allNifs = credentials.map((c) => c.nif.replace(/\D/g, ""));
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, nif, full_name, company_name")
      .in("nif", allNifs);

    if (profileErr) {
      return new Response(
        JSON.stringify({ error: "Failed to query profiles", detail: profileErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nifToProfile = new Map<string, { id: string; name: string }>();
    for (const p of profiles ?? []) {
      if (p.nif) {
        nifToProfile.set(p.nif, {
          id: p.id,
          name: p.company_name || p.full_name || p.nif,
        });
      }
    }

    // ── Process each credential ──────────────────────────────────────
    const results: ResultEntry[] = [];
    let okCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const cred of credentials) {
      const cleanNif = cred.nif.replace(/\D/g, "");
      const profile = nifToProfile.get(cleanNif);

      if (!profile) {
        results.push({ nif: cleanNif, status: "not_found" });
        notFoundCount++;
        continue;
      }

      try {
        const encryptedPassword = await encryptSecret(cred.password, encryptionSecret);

        const upsertData: Record<string, unknown> = {
          client_id: profile.id,
          portal_nif: cleanNif,
          portal_password_encrypted: encryptedPassword,
          encrypted_username: cleanNif,
          encrypted_password: encryptedPassword,
          environment: "production",
          last_sync_status: "never",
          updated_at: new Date().toISOString(),
        };

        // Set accountant_id if provided
        if (accountantId) {
          upsertData.accountant_id = accountantId;
        }

        const { error: upsertErr } = await supabaseAdmin
          .from("at_credentials")
          .upsert(upsertData, { onConflict: "client_id" });

        if (upsertErr) {
          results.push({
            nif: cleanNif,
            status: "error",
            clientId: profile.id,
            clientName: profile.name,
            error: upsertErr.message,
          });
          errorCount++;
        } else {
          results.push({
            nif: cleanNif,
            status: "ok",
            clientId: profile.id,
            clientName: profile.name,
          });
          okCount++;
        }
      } catch (e) {
        results.push({
          nif: cleanNif,
          status: "error",
          clientId: profile.id,
          clientName: profile.name,
          error: e instanceof Error ? e.message : String(e),
        });
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: credentials.length,
          ok: okCount,
          not_found: notFoundCount,
          errors: errorCount,
        },
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
