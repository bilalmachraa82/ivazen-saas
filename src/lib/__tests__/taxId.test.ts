import { describe, it, expect } from 'vitest';
import { isTemporarySupplierTaxId, normalizeSupplierTaxId, normalizeSupplierVatId } from '../taxId';

describe('normalizeSupplierTaxId', () => {
  it('normalizes PT NIF with PT prefix', () => {
    expect(normalizeSupplierTaxId({ taxId: 'PT 123456789' })).toBe('123456789');
  });

  it('normalizes PT NIF with separators', () => {
    expect(normalizeSupplierTaxId({ taxId: '150 798 369' })).toBe('150798369');
    expect(normalizeSupplierTaxId({ taxId: '150.798.369' })).toBe('150798369');
  });

  it('keeps foreign VAT IDs as-is (uppercased, compacted)', () => {
    expect(normalizeSupplierTaxId({ taxId: 'ie3668997oh' })).toBe('IE3668997OH');
    expect(normalizeSupplierTaxId({ taxId: 'IE 3668997 OH' })).toBe('IE3668997OH');
  });

  it('creates a deterministic temporary id when missing', () => {
    const id = normalizeSupplierTaxId({ taxId: null, supplierName: 'Google Ireland Limited' });
    expect(isTemporarySupplierTaxId(id)).toBe(true);
    expect(id).toMatch(/^SEM-NIF-/);
  });
});

describe('normalizeSupplierVatId', () => {
  it('returns null for PT NIF-like values', () => {
    expect(normalizeSupplierVatId('123456789')).toBeNull();
    expect(normalizeSupplierVatId('PT123456789')).toBeNull();
  });

  it('normalizes foreign VAT IDs', () => {
    expect(normalizeSupplierVatId('ie 3668997 oh')).toBe('IE3668997OH');
    expect(normalizeSupplierVatId('IE-3668997-OH')).toBe('IE3668997OH');
  });

  it('returns null for non-VAT garbage', () => {
    expect(normalizeSupplierVatId('ABC')).toBeNull();
    expect(normalizeSupplierVatId('')).toBeNull();
  });
});

