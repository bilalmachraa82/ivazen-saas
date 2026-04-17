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
 * Check if a Bearer token is the configured service-role key.
 *
 * Security: constant-time comparison only. Never decode the JWT payload to
 * infer role — an attacker can trivially forge a JWT whose payload contains
 * role="service_role" and whose length matches the real key (by padding an
 * arbitrary claim). Only a byte-for-byte match against the server-held key
 * proves the caller has the secret.
 */
export function isServiceRoleToken(
  token: string,
  serviceRoleKey: string,
): boolean {
  if (!token || !serviceRoleKey) return false;
  return constantTimeEquals(token, serviceRoleKey);
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
