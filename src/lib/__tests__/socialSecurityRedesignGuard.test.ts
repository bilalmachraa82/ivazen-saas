import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Social Security redesign guards', () => {
  it('passes the detected category into the monthly breakdown so the accountant can see the expected zero row', () => {
    const pageSource = readRepoFile('src/pages/SocialSecurity.tsx');
    const breakdownSource = readRepoFile('src/components/social-security/SSRevenueBreakdown.tsx');

    expect(pageSource).toContain('detectedCategory={detectedCategory?.category ?? null}');
    expect(breakdownSource).toContain('detectedCategory?: string | null;');
    expect(breakdownSource).toContain('cat.value === detectedCategory');
  });

  it('removes the dead legacy declaration state now superseded by SSCalculationSummary', () => {
    const pageSource = readRepoFile('src/pages/SocialSecurity.tsx');

    expect(pageSource).not.toContain('const [declarationNotes, setDeclarationNotes]');
    expect(pageSource).not.toContain('const copyToClipboard = () => {');
  });

  it('wires the monthly breakdown table for inline cell editing with the auto-sales baseline', () => {
    const pageSource = readRepoFile('src/pages/SocialSecurity.tsx');
    const breakdownSource = readRepoFile('src/components/social-security/SSRevenueBreakdown.tsx');

    expect(pageSource).toContain('autoMonthlyBreakdown={totals.salesMonthlyBreakdown}');
    expect(pageSource).toContain('onCellSave={handleMonthlyBreakdownSave}');
    expect(breakdownSource).toContain('onCellSave?: (category: string, monthKey: string, value: number) => void | Promise<void>;');
    expect(breakdownSource).toContain('autoMonthlyBreakdown?: MonthlyBreakdown;');
    expect(breakdownSource).toContain('type="number"');
  });

  it('uses the quarter lock state in the deadline alert instead of referencing an undeclared declaration variable', () => {
    const pageSource = readRepoFile('src/pages/SocialSecurity.tsx');

    expect(pageSource).toContain('{isDeadlineMonth && !isSubmittedQuarterLocked && (');
    expect(pageSource).not.toContain('!declaration?.status?.includes(\'submitted\')');
  });
});
