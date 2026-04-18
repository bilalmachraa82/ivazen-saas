import { describe, expect, it } from 'vitest';
import { getPreviousQuarterStart } from './dateRange';

describe('getPreviousQuarterStart', () => {
  it('returns Q1 start when in Q2 (April)', () => {
    // 2026-04-18 → Q2 → previous quarter Q1 starts 2026-01-01
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 3, 18))))
      .toEqual(new Date(2026, 0, 1));
  });

  it('returns Q2 start when in Q3 (July)', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 6, 5))))
      .toEqual(new Date(2026, 3, 1));
  });

  it('returns Q3 start when in Q4 (November)', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 10, 30))))
      .toEqual(new Date(2026, 6, 1));
  });

  it('rolls over to previous year Q4 when in Q1 (January)', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 0, 15))))
      .toEqual(new Date(2025, 9, 1));
  });

  it('rolls over to previous year Q4 on Jan 1', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 0, 1))))
      .toEqual(new Date(2025, 9, 1));
  });

  it('handles leap-year Feb 29', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2024, 1, 29))))
      .toEqual(new Date(2023, 9, 1));
  });

  it('returns a Date object (not a string)', () => {
    const result = getPreviousQuarterStart(new Date(Date.UTC(2026, 3, 18)));
    expect(result).toBeInstanceOf(Date);
  });
});
