export interface QuarterDateRange {
  start: string;
  end: string;
}

function toIsoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentQuarter(date = new Date()): number {
  return Math.ceil((date.getMonth() + 1) / 3);
}

export function getQuarterDateRange(year: number, quarter: number): QuarterDateRange {
  const safeQuarter = Math.min(4, Math.max(1, quarter));
  const startMonth = (safeQuarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0);

  return {
    start: toIsoDateLocal(startDate),
    end: toIsoDateLocal(endDate),
  };
}

export function getQuarterLabel(year: number, quarter: number): string {
  return `T${Math.min(4, Math.max(1, quarter))} ${year}`;
}
