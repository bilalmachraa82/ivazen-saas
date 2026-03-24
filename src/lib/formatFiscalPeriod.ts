const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function formatFiscalPeriod(period: string): string {
  if (/^\d{6}$/.test(period)) {
    const monthIndex = Number.parseInt(period.slice(4), 10) - 1;
    return `${MONTHS_PT[monthIndex] ?? period.slice(4)} ${period.slice(0, 4)}`;
  }

  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-');
    const monthIndex = Number.parseInt(month, 10) - 1;
    return `${MONTHS_PT[monthIndex] ?? month} ${year}`;
  }

  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const quarter = period.slice(-1);
    const year = period.slice(0, 4);
    return `${quarter}º Trimestre de ${year}`;
  }

  return period;
}

/**
 * Groups an array of monthly fiscal periods (YYYY-MM or YYYYMM) into quarters (YYYY-Q#).
 * Quarterly periods (YYYY-Q#) are passed through as-is.
 * Returns deduplicated quarters sorted newest-first.
 */
export function groupPeriodsToQuarters(periods: string[]): string[] {
  const quarters = new Set<string>();
  for (const period of periods) {
    // Already a quarter
    if (/^\d{4}-Q[1-4]$/.test(period)) {
      quarters.add(period);
      continue;
    }
    // YYYY-MM
    const hyphen = period.match(/^(\d{4})-(\d{2})$/);
    if (hyphen) {
      const q = Math.ceil(parseInt(hyphen[2], 10) / 3);
      quarters.add(`${hyphen[1]}-Q${q}`);
      continue;
    }
    // YYYYMM
    const compact = period.match(/^(\d{4})(\d{2})$/);
    if (compact) {
      const q = Math.ceil(parseInt(compact[2], 10) / 3);
      quarters.add(`${compact[1]}-Q${q}`);
    }
  }
  return Array.from(quarters).sort((a, b) => b.localeCompare(a));
}

/**
 * Expands a quarter period (YYYY-Q#) into all matching fiscal_period strings
 * stored in the database (supports YYYY-MM, YYYYMM, and YYYY-Q# formats).
 */
export function expandQuarterToPeriods(quarter: string): string[] {
  const m = quarter.match(/^(\d{4})-Q(\d)$/);
  if (!m) return [quarter];
  const year = m[1];
  const q = parseInt(m[2], 10);
  const startMonth = (q - 1) * 3 + 1;
  const periods: string[] = [quarter]; // include stored-as-quarter format
  for (let i = 0; i < 3; i++) {
    const mm = String(startMonth + i).padStart(2, '0');
    periods.push(`${year}-${mm}`, `${year}${mm}`);
  }
  return periods;
}
