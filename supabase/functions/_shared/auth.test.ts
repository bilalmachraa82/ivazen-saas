import { describe, it, expect } from 'vitest';
import {
  constantTimeEquals,
  isServiceRoleToken,
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
