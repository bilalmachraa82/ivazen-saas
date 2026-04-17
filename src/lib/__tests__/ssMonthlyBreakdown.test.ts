import { describe, it, expect } from 'vitest';
import {
  buildMonthlyBreakdown,
  buildManualMonthlyBreakdown,
  getEffectiveManualCategoryTotals,
  getQuarterMonthKeys,
  getMonthLabel,
  type ManualEntryLike,
} from '@/lib/ssMonthlyBreakdown';
import type { SocialSecuritySalesInvoiceLike } from '@/lib/socialSecurityRevenue';

type SalesInvoice = SocialSecuritySalesInvoiceLike & { document_date?: string | null };

function sumBreakdown(breakdown: Record<string, Record<string, number>>): number {
  let total = 0;
  for (const monthMap of Object.values(breakdown)) {
    for (const amount of Object.values(monthMap)) {
      total += amount;
    }
  }
  return total;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

describe('buildMonthlyBreakdown', () => {
  it('groups sales invoices by month and category correctly', () => {
    const salesInvoices = [
      {
        document_date: '2026-01-15',
        base_standard: 1000,
        revenue_category: 'prestacao_servicos',
      },
      {
        document_date: '2026-01-20',
        base_standard: 500,
        revenue_category: 'prestacao_servicos',
      },
      {
        document_date: '2026-02-10',
        base_standard: 2000,
        revenue_category: 'vendas',
      },
      {
        document_date: '2026-03-05',
        base_standard: 300,
        revenue_category: 'prestacao_servicos',
      },
    ];

    const result = buildMonthlyBreakdown(salesInvoices, [], '2026-Q1');

    expect(result['2026-01']['prestacao_servicos']).toBeCloseTo(1500);
    expect(result['2026-02']['vendas']).toBeCloseTo(2000);
    expect(result['2026-03']['prestacao_servicos']).toBeCloseTo(300);
  });

  it('returns 3 month keys even with no invoices (Q4 → 2025-10, 2025-11, 2025-12)', () => {
    const result = buildMonthlyBreakdown([], [], '2025-Q4');

    const keys = Object.keys(result);
    expect(keys).toHaveLength(3);
    expect(keys).toContain('2025-10');
    expect(keys).toContain('2025-11');
    expect(keys).toContain('2025-12');
  });

  it('distributes manual entries evenly across the 3 months', () => {
    const manualEntries = [
      { category: 'prestacao_servicos', amount: 900 },
      { category: 'vendas', amount: 300 },
    ];

    const result = buildMonthlyBreakdown([], manualEntries, '2026-Q2');

    const months = ['2026-04', '2026-05', '2026-06'];
    for (const month of months) {
      expect(result[month]['prestacao_servicos']).toBeCloseTo(300);
      expect(result[month]['vendas']).toBeCloseTo(100);
    }
  });

  it('places monthly manual entries in their exact month without distributing them', () => {
    const manualEntries = [
      { category: 'prestacao_servicos', amount: 450, entry_month: '2026-01' },
      { category: 'prestacao_servicos', amount: 150, entry_month: '2026-03' },
    ];

    const result = buildMonthlyBreakdown([], manualEntries, '2026-Q1');

    expect(result['2026-01']['prestacao_servicos']).toBeCloseTo(450);
    expect(result['2026-02']['prestacao_servicos'] ?? 0).toBeCloseTo(0);
    expect(result['2026-03']['prestacao_servicos']).toBeCloseTo(150);
  });

  it('prefers monthly manual entries over legacy quarterly fallback for the same category', () => {
    const manualEntries = [
      { category: 'prestacao_servicos', amount: 900 },
      { category: 'prestacao_servicos', amount: 500, entry_month: '2026-01' },
      { category: 'prestacao_servicos', amount: 250, entry_month: '2026-02' },
      { category: 'prestacao_servicos', amount: 150, entry_month: '2026-03' },
    ];

    const result = buildMonthlyBreakdown([], manualEntries, '2026-Q1');

    expect(result['2026-01']['prestacao_servicos']).toBeCloseTo(500);
    expect(result['2026-02']['prestacao_servicos']).toBeCloseTo(250);
    expect(result['2026-03']['prestacao_servicos']).toBeCloseTo(150);
  });
});

describe('getMonthLabel', () => {
  it('returns Portuguese month names', () => {
    expect(getMonthLabel('2026-01')).toBe('Janeiro');
    expect(getMonthLabel('2026-06')).toBe('Junho');
    expect(getMonthLabel('2026-12')).toBe('Dezembro');
  });
});

/**
 * Task 5 (spec 2026-04-07-ss-declaration-redesign):
 * Monthly breakdown totals MUST reconcile with the quarter totals used by
 * the SS contribution calculation. A drift between the UI breakdown and the
 * calculated base is exactly the kind of silent regression this suite guards.
 */
describe('getQuarterMonthKeys', () => {
  it('returns the three calendar months of a quarter in order', () => {
    expect(getQuarterMonthKeys('2026-Q1')).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(getQuarterMonthKeys('2025-Q4')).toEqual(['2025-10', '2025-11', '2025-12']);
  });
});

describe('buildManualMonthlyBreakdown — edge cases', () => {
  const quarter = '2026-Q1';

  it('ignores entries with entry_month outside the quarter', () => {
    const entries: ManualEntryLike[] = [
      { category: 'vendas', amount: 999, entry_month: '2025-12' },
    ];
    const breakdown = buildManualMonthlyBreakdown(entries, quarter);
    expect(sumBreakdown(breakdown)).toBe(0);
  });

  it('does NOT re-distribute an untagged entry when another entry for the SAME category is month-tagged', () => {
    const entries: ManualEntryLike[] = [
      { category: 'vendas', amount: 300, entry_month: '2026-01' },
      { category: 'vendas', amount: 600 /* no entry_month — must be dropped */ },
    ];
    const breakdown = buildManualMonthlyBreakdown(entries, quarter);
    expect(sumBreakdown(breakdown)).toBe(300);
  });

  it('still spreads untagged entries for categories that have NO month-tagged sibling', () => {
    const entries: ManualEntryLike[] = [
      { category: 'vendas', amount: 300, entry_month: '2026-01' },
      { category: 'prestacao_servicos', amount: 900 /* spread across 3 months */ },
    ];
    const breakdown = buildManualMonthlyBreakdown(entries, quarter);
    expect(breakdown['2026-01']?.prestacao_servicos).toBeCloseTo(300);
    expect(breakdown['2026-02']?.prestacao_servicos).toBeCloseTo(300);
    expect(breakdown['2026-03']?.prestacao_servicos).toBeCloseTo(300);
    expect(breakdown['2026-01']?.vendas).toBeCloseTo(300);
  });
});

describe('getEffectiveManualCategoryTotals', () => {
  it('reconciles the per-category total to the input sum', () => {
    const entries: ManualEntryLike[] = [
      { category: 'prestacao_servicos', amount: 300 },
      { category: 'vendas', amount: 500, entry_month: '2026-02' },
    ];
    const totals = getEffectiveManualCategoryTotals(entries, '2026-Q1');
    expect(roundCents(totals.prestacao_servicos)).toBe(300);
    expect(roundCents(totals.vendas)).toBe(500);
  });
});

describe('buildMonthlyBreakdown — quarter reconciliation (Task 5)', () => {
  const quarter = '2026-Q1';

  it('sum of monthly breakdown equals sum of sales bases + manual entries', () => {
    const salesInvoices: SalesInvoice[] = [
      {
        document_date: '2026-01-15',
        base_standard: 1000,
        revenue_category: 'prestacao_servicos',
      },
      {
        document_date: '2026-02-10',
        base_standard: 500,
        revenue_category: 'vendas',
      },
      {
        document_date: '2026-03-20',
        base_standard: 250.5,
        revenue_category: 'prestacao_servicos',
      },
    ];
    const manualEntries: ManualEntryLike[] = [
      { category: 'prestacao_servicos', amount: 300 },
      { category: 'vendas', amount: 600, entry_month: '2026-02' },
    ];

    const breakdown = buildMonthlyBreakdown(salesInvoices, manualEntries, quarter);
    const expected = 1000 + 500 + 250.5 + 300 + 600;
    expect(roundCents(sumBreakdown(breakdown))).toBe(roundCents(expected));
  });

  it('drops sales invoices outside the quarter', () => {
    const salesInvoices: SalesInvoice[] = [
      { document_date: '2025-12-31', base_standard: 9999, revenue_category: 'vendas' },
      { document_date: '2026-01-01', base_standard: 100, revenue_category: 'vendas' },
      { document_date: '2026-04-02', base_standard: 123, revenue_category: 'vendas' },
    ];

    const breakdown = buildMonthlyBreakdown(salesInvoices, [], quarter);
    expect(roundCents(sumBreakdown(breakdown))).toBe(100);
    expect(breakdown['2026-01']?.vendas).toBeCloseTo(100);
  });

  it('skips invoices with null document_date without crashing', () => {
    const salesInvoices: SalesInvoice[] = [
      { document_date: null, base_standard: 500, revenue_category: 'vendas' },
      { document_date: '2026-01-15', base_standard: 200, revenue_category: 'vendas' },
    ];

    const breakdown = buildMonthlyBreakdown(salesInvoices, [], quarter);
    expect(roundCents(sumBreakdown(breakdown))).toBe(200);
  });

  it('falls back to total_amount - total_vat when no base_* is set', () => {
    const salesInvoices: SalesInvoice[] = [
      {
        document_date: '2026-01-15',
        total_amount: 123,
        total_vat: 23,
        revenue_category: 'vendas',
      },
    ];

    const breakdown = buildMonthlyBreakdown(salesInvoices, [], quarter);
    expect(breakdown['2026-01']?.vendas).toBeCloseTo(100);
  });

  it('infers category "prestacao_servicos" for FR documents without an explicit category', () => {
    const salesInvoices: SalesInvoice[] = [
      {
        document_date: '2026-02-15',
        base_standard: 400,
        document_type: 'FR',
      },
    ];

    const breakdown = buildMonthlyBreakdown(salesInvoices, [], quarter);
    expect(breakdown['2026-02']?.prestacao_servicos).toBeCloseTo(400);
  });
});
