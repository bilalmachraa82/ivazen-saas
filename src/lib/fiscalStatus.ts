type PurchaseInvoiceStatusLike = {
  accounting_excluded?: boolean | null;
  status: string | null;
  requires_accountant_validation?: boolean | null;
};

type EqOrFilterable = {
  eq(column: string, value: unknown): unknown;
  or(filters: string): unknown;
};

const FISCALLY_EFFECTIVE_PURCHASE_OR_FILTER =
  'status.eq.validated,and(status.eq.classified,requires_accountant_validation.eq.false)';

export function isFiscallyEffectivePurchase(
  invoice: PurchaseInvoiceStatusLike,
): boolean {
  return !invoice.accounting_excluded && (
    invoice.status === 'validated' ||
    (invoice.status === 'classified' &&
      invoice.requires_accountant_validation === false)
  );
}

export function isPurchasePendingReview(
  invoice: PurchaseInvoiceStatusLike,
): boolean {
  return !invoice.accounting_excluded && (
    invoice.status === 'pending' ||
    (invoice.status === 'classified' &&
      invoice.requires_accountant_validation !== false)
  );
}

export function getFiscallyEffectivePurchaseFilter(): string {
  return `and(accounting_excluded.eq.false,or(${FISCALLY_EFFECTIVE_PURCHASE_OR_FILTER}))`;
}

export function applyFiscallyEffectivePurchaseFilter<T extends EqOrFilterable>(
  query: T,
): T {
  return query
    .eq('accounting_excluded', false)
    .or(FISCALLY_EFFECTIVE_PURCHASE_OR_FILTER) as T;
}
