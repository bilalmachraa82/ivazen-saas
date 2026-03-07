type PurchaseInvoiceStatusLike = {
  status: string | null;
  requires_accountant_validation?: boolean | null;
};

type OrFilterable = {
  or(filters: string): unknown;
};

const FISCALLY_EFFECTIVE_PURCHASE_FILTER =
  'status.eq.validated,and(status.eq.classified,requires_accountant_validation.eq.false)';

export function isFiscallyEffectivePurchase(
  invoice: PurchaseInvoiceStatusLike,
): boolean {
  return invoice.status === 'validated' ||
    (invoice.status === 'classified' &&
      invoice.requires_accountant_validation === false);
}

export function isPurchasePendingReview(
  invoice: PurchaseInvoiceStatusLike,
): boolean {
  return invoice.status === 'pending' ||
    (invoice.status === 'classified' &&
      invoice.requires_accountant_validation !== false);
}

export function getFiscallyEffectivePurchaseFilter(): string {
  return FISCALLY_EFFECTIVE_PURCHASE_FILTER;
}

export function applyFiscallyEffectivePurchaseFilter<T extends OrFilterable>(
  query: T,
): T {
  return query.or(FISCALLY_EFFECTIVE_PURCHASE_FILTER) as T;
}
