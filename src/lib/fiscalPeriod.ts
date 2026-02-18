export function normalizeDocumentDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return isValidDateParts(y, m, d) ? `${y}-${m}-${d}` : null;
  }

  // DD/MM/YYYY
  const ptMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ptMatch) {
    const [, d, m, y] = ptMatch;
    return isValidDateParts(y, m, d) ? `${y}-${m}-${d}` : null;
  }

  // YYYY/MM/DD
  const slashIsoMatch = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (slashIsoMatch) {
    const [, y, m, d] = slashIsoMatch;
    return isValidDateParts(y, m, d) ? `${y}-${m}-${d}` : null;
  }

  // YYYYMMDD
  const compactMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, y, m, d] = compactMatch;
    return isValidDateParts(y, m, d) ? `${y}-${m}-${d}` : null;
  }

  return null;
}

export function deriveFiscalPeriodFromDocumentDate(documentDate: string | null | undefined): string | null {
  const normalized = normalizeDocumentDate(documentDate);
  if (!normalized) return null;
  return normalized.slice(0, 7).replace('-', '');
}

function isValidDateParts(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;

  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

