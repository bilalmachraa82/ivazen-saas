import { describe, it, expect } from 'vitest';
import { buildMonthlyBreakdown, getMonthLabel } from '@/lib/ssMonthlyBreakdown';

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
