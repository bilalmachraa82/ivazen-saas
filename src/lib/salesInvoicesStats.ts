import { expandQuarterToPeriods } from '@/lib/formatFiscalPeriod';

interface BuildSalesInvoicesTotalAmountParamsArgs {
  effectiveClientId?: string | null;
  fiscalPeriod: string;
  year: string;
}

export function buildSalesInvoicesTotalAmountParams({
  effectiveClientId,
  fiscalPeriod,
  year,
}: BuildSalesInvoicesTotalAmountParamsArgs) {
  const parsedYear = year && year !== 'all' ? Number(year) : null;

  return {
    p_client_id: effectiveClientId && effectiveClientId !== 'all' ? effectiveClientId : null,
    p_fiscal_periods:
      fiscalPeriod !== 'all' ? expandQuarterToPeriods(fiscalPeriod) : null,
    p_year: Number.isInteger(parsedYear) ? parsedYear : null,
  };
}
