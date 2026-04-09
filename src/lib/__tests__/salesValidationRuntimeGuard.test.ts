import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('SalesValidation runtime guards', () => {
  it('derives KPI cards from aggregated stats instead of the current page only', () => {
    const salesValidationSource = readRepoFile('src/pages/SalesValidation.tsx');

    expect(salesValidationSource).toContain('statsSummary.pendingCount');
    expect(salesValidationSource).toContain('statsSummary.validatedCount');
    expect(salesValidationSource).toContain('statsSummary.totalAmount');
    expect(salesValidationSource).toContain('statsSummary.recentImportsCount');

    expect(salesValidationSource).not.toContain("const pendingCount = invoices.filter((inv) => inv.status === 'pending').length;");
    expect(salesValidationSource).not.toContain("const validatedCount = invoices.filter((inv) => inv.status === 'validated').length;");
    expect(salesValidationSource).not.toContain("const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);");
    expect(salesValidationSource).not.toContain("const recentImportsCount = invoices.filter((invoice) =>");
  });

  it('clears the recent-import lock when switching back to normal status cards', () => {
    const salesValidationSource = readRepoFile('src/pages/SalesValidation.tsx');

    expect(salesValidationSource).not.toContain("filters.recentWindow && filters.recentWindow !== 'all'");
    expect(salesValidationSource).toContain("setSearchParams({ status: 'pending' });");
    expect(salesValidationSource).toContain("setSearchParams({ status: 'validated' });");
  });

  it('keeps the main sales invoices query filtered by status when the user selects pending or validated', () => {
    const hookSource = readRepoFile('src/hooks/useSalesInvoices.tsx');

    expect(hookSource).toContain("if (filters.status !== 'all') {");
    expect(hookSource).toContain("query = query.eq('status', filters.status);");
    expect(hookSource).toContain('filters.status');
  });
});
