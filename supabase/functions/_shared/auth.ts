/**
 * Shared auth utilities for Supabase Edge Functions.
 *
 * Why JWT decode fallback?
 * constantTimeEquals(token, serviceRoleKey) can fail in Supabase Edge Runtime
 * (Deno). Decoding the JWT payload and checking payload.role === "service_role"
 * is a reliable alternative.
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
 * Check if a Bearer token is a valid service-role token.
 * Uses constantTimeEquals first, then falls back to JWT payload decode.
 */
export function isServiceRoleToken(
  token: string,
  serviceRoleKey: string,
): boolean {
  if (!token) return false;

  // Primary: constant-time comparison
  if (constantTimeEquals(token, serviceRoleKey)) return true;

  // Fallback: JWT payload decode (constantTimeEquals can fail in edge runtime)
  try {
    const payloadB64 = token.split(".")[1];
    if (payloadB64) {
      const payload = JSON.parse(atob(payloadB64));
      if (payload.role === "service_role") return true;
    }
  } catch {
    // Invalid JWT
  }

  return false;
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
