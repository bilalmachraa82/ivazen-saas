import { describe, expect, it } from 'vitest';

import {
  ELECTRONIC_IMPORT_PREFIXES,
  getImportSourceLabel,
  isElectronicImport,
} from '../imagePathUtils';

describe('imagePathUtils', () => {
  it('recognizes all electronic import prefixes', () => {
    for (const prefix of ELECTRONIC_IMPORT_PREFIXES) {
      expect(isElectronicImport(`${prefix}documento`)).toBe(true);
    }
  });

  it('does not flag uploaded invoice paths as placeholders', () => {
    expect(isElectronicImport('550e8400-e29b-41d4-a716-446655440000/1710930000_fatura.pdf')).toBe(false);
    expect(isElectronicImport('550e8400-e29b-41d4-a716-446655440000/sales/1710930000_recibo.pdf')).toBe(false);
  });

  it('returns source labels for the AT paths that were failing', () => {
    expect(getImportSourceLabel('at-webservice-sales/doc')).toBe('AT Vendas (sync automático)');
    expect(getImportSourceLabel('at-portal-recibos/doc')).toBe('AT Recibos Verdes (portal)');
  });
});
