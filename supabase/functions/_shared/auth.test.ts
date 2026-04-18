import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  constantTimeEquals,
  isServiceRoleToken,
  isConfiguredServiceRoleToken,
  extractBearerToken,
} from './auth.ts';

describe('constantTimeEquals', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
  });

  it('returns false for different strings of equal length', () => {
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
  });

  it('returns false for strings of different length', () => {
    expect(constantTimeEquals('abc', 'abcd')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(constantTimeEquals('', '')).toBe(true);
  });
});

describe('isServiceRoleToken', () => {
  const realKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.real_signature_here';

  it('returns false for empty token', () => {
    expect(isServiceRoleToken('', realKey)).toBe(false);
  });

  it('returns false when service-role key is not configured', () => {
    expect(isServiceRoleToken(realKey, '')).toBe(false);
  });

  it('returns true for byte-for-byte match', () => {
    expect(isServiceRoleToken(realKey, realKey)).toBe(true);
  });

  it('rejects a forged JWT with role="service_role" (same length, different bytes)', () => {
    // Attacker crafts a minimal JWT with payload {"role":"service_role"} and
    // pads the signature so the total byte length matches realKey. Without the
    // signing secret the bytes cannot match — and a byte-for-byte compare is
    // the only thing we trust.
    const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const forgedPayloadB64 = btoa(JSON.stringify({ role: 'service_role' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const sigLen =
      realKey.length - header.length - forgedPayloadB64.length - 2;
    expect(sigLen).toBeGreaterThanOrEqual(0);
    const sig = 'a'.repeat(sigLen);
    const forged = `${header}.${forgedPayloadB64}.${sig}`;

    // Sanity: the forged token is the same length as the real key.
    expect(forged.length).toBe(realKey.length);
    // And yet — because its bytes differ — it MUST be rejected.
    expect(isServiceRoleToken(forged, realKey)).toBe(false);
  });

  it('rejects a short random token', () => {
    expect(isServiceRoleToken('not-a-jwt', realKey)).toBe(false);
  });

  // Variadic: accept multiple configured keys (primary + legacy).
  it('accepts a match against a secondary allowed key', () => {
    const primary = 'primary-key-aaaaaaaaaaaaaaa';
    const legacy = realKey;
    expect(isServiceRoleToken(legacy, primary, legacy)).toBe(true);
  });

  it('accepts a match against the primary when legacy is unset', () => {
    const primary = 'primary-key-bbbbbbbbbbbbbbb';
    expect(isServiceRoleToken(primary, primary, undefined)).toBe(true);
  });

  it('rejects when neither key matches', () => {
    const primary = 'primary-key-ccccccccccccccc';
    const legacy = 'legacy-key-dddddddddddddddd';
    expect(isServiceRoleToken('different-token', primary, legacy)).toBe(false);
  });

  it('ignores empty or null keys in the allowed list', () => {
    expect(isServiceRoleToken(realKey, '', null, realKey)).toBe(true);
    expect(isServiceRoleToken(realKey, '', null, undefined)).toBe(false);
  });
});

describe('isConfiguredServiceRoleToken', () => {
  const originalDeno = (globalThis as Record<string, unknown>).Deno;

  beforeEach(() => {
    (globalThis as Record<string, unknown>).Deno = {
      env: {
        get: (k: string) => {
          if (k === 'SUPABASE_SERVICE_ROLE_KEY') return 'primary-xyz-1234567890';
          if (k === 'SERVICE_ROLE_KEY_LEGACY') return 'legacy-jwt-abcdefghij';
          return undefined;
        },
      },
    };
  });

  afterEach(() => {
    if (originalDeno === undefined) {
      delete (globalThis as Record<string, unknown>).Deno;
    } else {
      (globalThis as Record<string, unknown>).Deno = originalDeno;
    }
    vi.restoreAllMocks();
  });

  it('accepts the primary SUPABASE_SERVICE_ROLE_KEY', () => {
    expect(isConfiguredServiceRoleToken('primary-xyz-1234567890')).toBe(true);
  });

  it('accepts the legacy SERVICE_ROLE_KEY_LEGACY fallback', () => {
    expect(isConfiguredServiceRoleToken('legacy-jwt-abcdefghij')).toBe(true);
  });

  it('rejects any other token', () => {
    expect(isConfiguredServiceRoleToken('some-other-token')).toBe(false);
  });

  it('returns false for empty token even with env configured', () => {
    expect(isConfiguredServiceRoleToken('')).toBe(false);
  });
});

describe('extractBearerToken', () => {
  it('strips "Bearer " prefix (case-insensitive)', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
    expect(extractBearerToken('bearer abc123')).toBe('abc123');
    expect(extractBearerToken('BEARER  abc123')).toBe('abc123');
  });

  it('returns empty string for null header', () => {
    expect(extractBearerToken(null)).toBe('');
  });

  it('returns trimmed token when no prefix present', () => {
    expect(extractBearerToken('  abc123  ')).toBe('abc123');
  });
});
