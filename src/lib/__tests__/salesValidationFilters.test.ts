import { describe, expect, it } from 'vitest';

import {
  buildSalesValidationSearchParams,
  parseSalesValidationSearchParams,
} from '@/lib/salesValidationFilters';

describe('salesValidationFilters', () => {
  it('reads the default filters when no params are present', () => {
    const result = parseSalesValidationSearchParams(new URLSearchParams());

    expect(result).toEqual({
      status: 'all',
      recentWindow: 'all',
    });
  });

  it('builds status-only params when switching back from recent imports to pending', () => {
    const params = buildSalesValidationSearchParams({
      status: 'pending',
      recentWindow: 'all',
    });

    expect(params.toString()).toBe('status=pending');
  });

  it('builds recent-only params when opening the imported-in-24h card', () => {
    const params = buildSalesValidationSearchParams({
      status: 'all',
      recentWindow: '24h',
    });

    expect(params.toString()).toBe('recent=24h');
  });
});
