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
    return `T${period.slice(-1)} ${period.slice(0, 4)}`;
  }

  return period;
}
