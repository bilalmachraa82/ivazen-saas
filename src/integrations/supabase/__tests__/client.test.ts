import { describe, expect, it } from 'vitest';

import { resolveSupabaseRuntimeConfig } from '../client';

describe('resolveSupabaseRuntimeConfig', () => {
  it('falls back to dummy credentials in test mode when env vars are missing', () => {
    const result = resolveSupabaseRuntimeConfig({
      isTestEnv: true,
    });

    expect(result.url).toBe('https://example.supabase.co');
    expect(result.publishableKey).toBe('sb_publishable_test_key');
  });

  it('preserves real credentials in test mode when explicitly provided', () => {
    const result = resolveSupabaseRuntimeConfig({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_real',
      isTestEnv: true,
    });

    expect(result.url).toBe('https://project.supabase.co');
    expect(result.publishableKey).toBe('sb_publishable_real');
  });

  it('does not override runtime credentials outside test mode', () => {
    const result = resolveSupabaseRuntimeConfig({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_real',
      isTestEnv: false,
    });

    expect(result.url).toBe('https://project.supabase.co');
    expect(result.publishableKey).toBe('sb_publishable_real');
  });
});
