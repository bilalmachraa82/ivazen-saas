import {
  getSalesInvoiceRevenueAmount,
  getSalesInvoiceRevenueCategory,
  SocialSecuritySalesInvoiceLike,
} from '@/lib/socialSecurityRevenue';

export type MonthlyBreakdown = Record<string, Record<string, number>>;

interface ManualEntryLike {
  category: string;
  amount: number;
}

const PORTUGUESE_MONTH_NAMES: Record<number, string> = {
  1: 'Janeiro',
  2: 'Fevereiro',
  3: 'Março',
  4: 'Abril',
  5: 'Maio',
  6: 'Junho',
  7: 'Julho',
  8: 'Agosto',
  9: 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro',
};

/**
 * Returns the 3 month keys for a given quarter string (e.g. "2026-Q1" → ["2026-01", "2026-02", "2026-03"]).
 */
function getQuarterMonthKeys(quarter: string): string[] {
  const [yearStr, qStr] = quarter.split('-Q');
  const year = parseInt(yearStr, 10);
  const q = parseInt(qStr, 10);
  const startMonth = (q - 1) * 3 + 1;
  return [startMonth, startMonth + 1, startMonth + 2].map(
    m => `${year}-${String(m).padStart(2, '0')}`,
  );
}

/**
 * Returns the "YYYY-MM" month key for a date string like "2026-01-15".
 */
function toMonthKey(documentDate: string): string {
  return documentDate.slice(0, 7);
}

/**
 * Builds a monthly breakdown of revenue by category for a given quarter.
 *
 * - Sales invoices are grouped by their document_date month and revenue category.
 * - Manual entries (revenueEntries from the DB) are distributed evenly across the 3 months.
 *
 * @param salesInvoices  Array of sales_invoices rows.
 * @param manualEntries  Array of revenue_entries rows (or any { category, amount } objects).
 * @param quarter        Quarter string in "YYYY-Qn" format (e.g. "2026-Q1").
 * @returns              Record<monthKey, Record<categoryKey, amount>>
 */
export function buildMonthlyBreakdown(
  salesInvoices: (SocialSecuritySalesInvoiceLike & { document_date?: string | null })[],
  manualEntries: ManualEntryLike[],
  quarter: string,
): MonthlyBreakdown {
  const monthKeys = getQuarterMonthKeys(quarter);

  // Initialise the result with empty category maps for each month
  const breakdown: MonthlyBreakdown = {};
  for (const mk of monthKeys) {
    breakdown[mk] = {};
  }

  // Group sales invoices into the matching month bucket
  const validMonthSet = new Set(monthKeys);
  for (const inv of salesInvoices) {
    if (!inv.document_date) continue;
    const monthKey = toMonthKey(inv.document_date);
    if (!validMonthSet.has(monthKey)) continue;

    const amount = getSalesInvoiceRevenueAmount(inv);
    if (amount === 0) continue;

    const category = getSalesInvoiceRevenueCategory(inv);
    breakdown[monthKey][category] = (breakdown[monthKey][category] || 0) + amount;
  }

  // Distribute manual entries evenly across the 3 months
  for (const entry of manualEntries) {
    const share = Number(entry.amount) / 3;
    if (share === 0) continue;
    for (const mk of monthKeys) {
      breakdown[mk][entry.category] = (breakdown[mk][entry.category] || 0) + share;
    }
  }

  return breakdown;
}

/**
 * Returns the Portuguese name for a month key ("YYYY-MM").
 */
export function getMonthLabel(monthKey: string): string {
  const month = parseInt(monthKey.slice(5, 7), 10);
  return PORTUGUESE_MONTH_NAMES[month] || monthKey;
}
