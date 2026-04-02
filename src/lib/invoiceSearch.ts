interface SearchableInvoiceLike {
  supplier_name?: string | null;
  supplier_nif?: string | null;
  document_number?: string | null;
}

export function escapeInvoiceSearchTerm(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function normalizeInvoiceSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function applyClientInvoiceSearchFallback<T extends SearchableInvoiceLike>(
  invoices: T[],
  rawSearch: string,
): T[] {
  const normalizedSearch = normalizeInvoiceSearchText(rawSearch.trim());
  if (!normalizedSearch || normalizedSearch.length >= 2) {
    return invoices;
  }

  return invoices.filter((invoice) => {
    const supplierName = normalizeInvoiceSearchText(invoice.supplier_name || '');
    const supplierNif = (invoice.supplier_nif || '').toLowerCase();
    const documentNumber = (invoice.document_number || '').toLowerCase();

    return (
      supplierName.includes(normalizedSearch)
      || supplierNif.includes(normalizedSearch)
      || documentNumber.includes(normalizedSearch)
    );
  });
}
