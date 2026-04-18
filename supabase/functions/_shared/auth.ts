/**
 * Shared auth utilities for Supabase Edge Functions.
 *
 * Usage:
 *   import { isServiceRoleToken, verifyWebhookToken, constantTimeEquals } from "../_shared/auth.ts";
 */

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    const av = i < aa.length ? aa[i] : 0;
    const bv = i < bb.length ? bb[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

/**
 * Check if a Bearer token matches any of the configured service-role keys.
 *
 * Security: constant-time comparison only. Never decode the JWT payload to
 * infer role — an attacker can trivially forge a JWT whose payload contains
 * role="service_role" and whose length matches the real key (by padding an
 * arbitrary claim). Only a byte-for-byte match against a server-held key
 * proves the caller has the secret.
 *
 * Accepts a variadic list of allowed keys so a project can carry both its
 * primary key (Supabase's auto-injected `SUPABASE_SERVICE_ROLE_KEY`, which
 * may be the new `sb_secret_...` format) and a legacy fallback
 * (`SERVICE_ROLE_KEY_LEGACY`, typically the legacy JWT) during a transition.
 * A caller is accepted if its token equals ANY configured key byte-for-byte.
 */
export function isServiceRoleToken(
  token: string,
  ...allowedKeys: (string | null | undefined)[]
): boolean {
  if (!token) return false;
  return allowedKeys.some(
    (key) => typeof key === "string" && key.length > 0 && constantTimeEquals(token, key),
  );
}

/**
 * Convenience: checks a Bearer token against the conventional pair of env
 * vars this project uses — `SUPABASE_SERVICE_ROLE_KEY` (primary) and an
 * optional `SERVICE_ROLE_KEY_LEGACY` (transition fallback). Reads the env
 * directly so edge-function callers only need to pass the token.
 */
export function isConfiguredServiceRoleToken(token: string): boolean {
  const primary = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } })
    .Deno?.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const legacy = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } })
    .Deno?.env.get("SERVICE_ROLE_KEY_LEGACY");
  return isServiceRoleToken(token, primary, legacy);
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(authHeader: string | null): string {
  return (authHeader || "").replace(/^Bearer\s+/i, "").trim();
}

/**
 * Verify an internal webhook token against the stored value in DB.
 * Returns true if the token matches.
 */
export async function verifyWebhookToken(
  supabase: any,
  webhookToken: string,
  keyName: string,
): Promise<boolean> {
  if (!webhookToken) return false;

  const { data: row, error } = await supabase
    .from("internal_webhook_keys")
    .select("token")
    .eq("name", keyName)
    .limit(1)
    .maybeSingle();

  if (error || !row?.token) return false;
  return constantTimeEquals(webhookToken, row.token);
}
