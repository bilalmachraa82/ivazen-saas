import { describe, expect, it } from 'vitest';

import {
  getRecentImportCutoff,
  matchesRecentImportWindow,
} from '../recentImports';

describe('recentImports', () => {
  const now = new Date('2026-03-20T12:00:00.000Z');

  it('returns null for the all window', () => {
    expect(getRecentImportCutoff('all', now)).toBeNull();
  });

  it('computes ISO cutoffs for supported windows', () => {
    expect(getRecentImportCutoff('24h', now)).toBe('2026-03-19T12:00:00.000Z');
    expect(getRecentImportCutoff('7d', now)).toBe('2026-03-13T12:00:00.000Z');
  });

  it('matches timestamps inside the selected recent window', () => {
    expect(matchesRecentImportWindow('2026-03-20T09:00:00.000Z', '24h', now)).toBe(true);
    expect(matchesRecentImportWindow('2026-03-18T11:59:59.000Z', '24h', now)).toBe(false);
    expect(matchesRecentImportWindow('2026-03-15T12:00:00.000Z', '7d', now)).toBe(true);
    expect(matchesRecentImportWindow('2026-03-01T12:00:00.000Z', '7d', now)).toBe(false);
  });

  it('rejects invalid timestamps when filtering recent imports', () => {
    expect(matchesRecentImportWindow(null, '24h', now)).toBe(false);
    expect(matchesRecentImportWindow('invalid-date', '24h', now)).toBe(false);
  });
});
