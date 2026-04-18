/**
 * Returns the first day of the quarter immediately preceding the quarter
 * that `now` falls in. Used by sync-efatura to build a default date window
 * that always includes the tail of the previous quarter, preventing
 * documents emitted near the quarter boundary from silently dropping out
 * of scope once the calendar rolls into a new quarter.
 */
export function getPreviousQuarterStart(now: Date): Date {
  const month = now.getUTCMonth(); // 0..11
  const currentQuarter = Math.ceil((month + 1) / 3); // 1..4
  if (currentQuarter === 1) {
    // Q1: previous quarter is Q4 of last year (Oct = month 9)
    return new Date(now.getUTCFullYear() - 1, 9, 1);
  }
  const prevQuarterStartMonth = (currentQuarter - 2) * 3;
  return new Date(now.getUTCFullYear(), prevQuarterStartMonth, 1);
}
