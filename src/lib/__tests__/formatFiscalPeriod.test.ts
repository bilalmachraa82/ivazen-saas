import { describe, expect, it } from 'vitest';

import { formatFiscalPeriod } from '../formatFiscalPeriod';

describe('formatFiscalPeriod()', () => {
  it('formats YYYYMM periods', () => {
    expect(formatFiscalPeriod('202602')).toBe('Fevereiro 2026');
  });

  it('formats YYYY-MM periods', () => {
    expect(formatFiscalPeriod('2026-02')).toBe('Fevereiro 2026');
  });

  it('formats YYYY-Qn periods', () => {
    expect(formatFiscalPeriod('2026-Q3')).toBe('T3 2026');
  });

  it('falls back to original value for unknown formats', () => {
    expect(formatFiscalPeriod('periodo-livre')).toBe('periodo-livre');
  });
});
