import { describe, expect, it } from 'vitest';
import { getCurrentQuarter, getQuarterDateRange, getQuarterLabel } from '../fiscalQuarter';

describe('fiscalQuarter', () => {
  it('returns the current quarter from a given date', () => {
    expect(getCurrentQuarter(new Date('2026-01-15'))).toBe(1);
    expect(getCurrentQuarter(new Date('2026-04-01'))).toBe(2);
    expect(getCurrentQuarter(new Date('2026-07-31'))).toBe(3);
    expect(getCurrentQuarter(new Date('2026-12-20'))).toBe(4);
  });

  it('returns inclusive date ranges for a fiscal quarter', () => {
    expect(getQuarterDateRange(2026, 1)).toEqual({
      start: '2026-01-01',
      end: '2026-03-31',
    });
    expect(getQuarterDateRange(2026, 4)).toEqual({
      start: '2026-10-01',
      end: '2026-12-31',
    });
  });

  it('clamps quarter labels and ranges to valid values', () => {
    expect(getQuarterLabel(2026, 0)).toBe('T1 2026');
    expect(getQuarterLabel(2026, 99)).toBe('T4 2026');
    expect(getQuarterDateRange(2026, 0)).toEqual({
      start: '2026-01-01',
      end: '2026-03-31',
    });
  });
});
