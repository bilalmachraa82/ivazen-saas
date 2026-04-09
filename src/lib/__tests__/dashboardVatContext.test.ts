import { describe, expect, it } from 'vitest';

import { resolveDashboardVatContext } from '@/lib/dashboardVatContext';

describe('resolveDashboardVatContext', () => {
  it('prefers the selected client fiscal profile for accountants', () => {
    const result = resolveDashboardVatContext({
      isAccountant: true,
      ownProfile: {
        vat_regime: 'normal_quarterly',
        iva_cadence: 'quarterly',
      },
      selectedClientTaxProfile: {
        vat_regime: 'normal_monthly',
        iva_cadence: 'monthly',
      },
    });

    expect(result.rawVatRegime).toBe('normal_monthly');
    expect(result.rawCadence).toBe('monthly');
    expect(result.ivaCadence).toBe('monthly');
  });

  it('falls back to cadence inferred from vat regime when cadence is missing', () => {
    const result = resolveDashboardVatContext({
      isAccountant: false,
      ownProfile: {
        vat_regime: 'normal_monthly',
        iva_cadence: null,
      },
    });

    expect(result.rawVatRegime).toBe('normal_monthly');
    expect(result.rawCadence).toBeNull();
    expect(result.ivaCadence).toBe('monthly');
  });
});
