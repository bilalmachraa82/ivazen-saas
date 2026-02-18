import { describe, expect, it } from 'vitest';
import { deriveFiscalPeriodFromDocumentDate, normalizeDocumentDate } from '../fiscalPeriod';

describe('fiscalPeriod', () => {
  it('normalizes supported date formats', () => {
    expect(normalizeDocumentDate('2025-09-30')).toBe('2025-09-30');
    expect(normalizeDocumentDate('30/09/2025')).toBe('2025-09-30');
    expect(normalizeDocumentDate('2025/09/30')).toBe('2025-09-30');
    expect(normalizeDocumentDate('20250930')).toBe('2025-09-30');
  });

  it('rejects invalid dates', () => {
    expect(normalizeDocumentDate('2025-13-01')).toBeNull();
    expect(normalizeDocumentDate('31/02/2025')).toBeNull();
    expect(normalizeDocumentDate('')).toBeNull();
  });

  it('derives YYYYMM fiscal period from document date', () => {
    expect(deriveFiscalPeriodFromDocumentDate('2025-07-31')).toBe('202507');
    expect(deriveFiscalPeriodFromDocumentDate('31/07/2025')).toBe('202507');
    expect(deriveFiscalPeriodFromDocumentDate('20250731')).toBe('202507');
    expect(deriveFiscalPeriodFromDocumentDate('')).toBeNull();
  });
});

