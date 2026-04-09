import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Dashboard VAT context guards', () => {
  it('uses the same fiscal-profile source of truth for vat_regime and iva_cadence', () => {
    const dashboardSource = readRepoFile('src/pages/Dashboard.tsx');

    expect(dashboardSource).toContain(".select('vat_regime, iva_cadence')");
    expect(dashboardSource).toContain("? (selectedClientTaxProfile?.iva_cadence ?? null)");
    expect(dashboardSource).not.toContain("? (selectedClient?.iva_cadence ?? null)");
  });
});
