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

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "https://ivazen-saas.vercel.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Encryption (same algorithm as import-client-credentials) ──────────────

async function encryptPassword(
  password: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(password),
  );

  const toBase64 = (arr: Uint8Array) => {
    let binary = "";
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  };

  return `${toBase64(salt)}:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

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

    // Verify the caller is using the exact service-role secret.
    // Never trust unsigned/decoded JWT payload claims.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isServiceRole = token === supabaseServiceKey;

    if (!isServiceRole) {
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

    // ── Encryption secret (same logic as import-client-credentials) ──
    const encryptionSecret =
      Deno.env.get("AT_ENCRYPTION_KEY") || supabaseServiceKey.substring(0, 32);

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
        const encryptedPassword = await encryptPassword(cred.password, encryptionSecret);

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
