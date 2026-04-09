import { describe, expect, it } from 'vitest';

import { expandQuarterToPeriods } from '@/lib/formatFiscalPeriod';
import { buildSalesInvoicesTotalAmountParams } from '@/lib/salesInvoicesStats';

describe('buildSalesInvoicesTotalAmountParams', () => {
  it('expands quarter filters into monthly fiscal periods for the aggregate RPC', () => {
    const result = buildSalesInvoicesTotalAmountParams({
      effectiveClientId: 'client-123',
      fiscalPeriod: '2026-Q1',
      year: '2026',
    });

    expect(result).toEqual({
      p_client_id: 'client-123',
      p_fiscal_periods: expandQuarterToPeriods('2026-Q1'),
      p_year: 2026,
    });
  });

  it('drops unset filters instead of sending broad no-op values', () => {
    const result = buildSalesInvoicesTotalAmountParams({
      effectiveClientId: null,
      fiscalPeriod: 'all',
      year: 'all',
    });

    expect(result).toEqual({
      p_client_id: null,
      p_fiscal_periods: null,
      p_year: null,
    });
  });
});
