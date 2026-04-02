import { describe, expect, it } from 'vitest';
import {
  applyClientInvoiceSearchFallback,
  escapeInvoiceSearchTerm,
} from '@/lib/invoiceSearch';

interface InvoiceLike {
  id: string;
  supplier_name: string | null;
  supplier_nif: string | null;
  document_number: string | null;
}

const rows: InvoiceLike[] = [
  {
    id: '1',
    supplier_name: 'Mário Oficina',
    supplier_nif: '123456789',
    document_number: 'FT 1',
  },
  {
    id: '2',
    supplier_name: 'Zeta Energia',
    supplier_nif: '987654321',
    document_number: 'FT 2',
  },
];

describe('invoiceSearch helpers', () => {
  it('escapes ilike wildcard characters', () => {
    expect(escapeInvoiceSearchTerm('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });

  it('keeps 2+ character searches on the server-side path', () => {
    expect(applyClientInvoiceSearchFallback(rows, 'mario')).toEqual(rows);
  });

  it('keeps 1-character fallback accent-insensitive', () => {
    expect(applyClientInvoiceSearchFallback(rows, 'm')).toEqual([rows[0]]);
  });
});
