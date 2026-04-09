interface DashboardVatContextProfile {
  vat_regime: string | null;
  iva_cadence: string | null;
}

interface ResolveDashboardVatContextArgs {
  isAccountant: boolean;
  ownProfile?: DashboardVatContextProfile | null;
  selectedClientTaxProfile?: DashboardVatContextProfile | null;
}

export function resolveDashboardVatContext({
  isAccountant,
  ownProfile = null,
  selectedClientTaxProfile = null,
}: ResolveDashboardVatContextArgs) {
  const activeProfile = isAccountant ? selectedClientTaxProfile : ownProfile;
  const rawVatRegime = activeProfile?.vat_regime ?? null;
  const rawCadence = activeProfile?.iva_cadence ?? null;
  const ivaCadence: 'monthly' | 'quarterly' | 'both' = rawCadence === 'monthly'
    || rawCadence === 'quarterly'
    || rawCadence === 'both'
    ? rawCadence
    : rawVatRegime === 'normal_monthly'
      ? 'monthly'
      : 'quarterly';

  return {
    rawVatRegime,
    vatRegime: rawVatRegime,
    rawCadence,
    ivaCadence,
  };
}
