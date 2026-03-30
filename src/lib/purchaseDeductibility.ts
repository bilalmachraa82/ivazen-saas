export interface PurchaseDeductibilityLike {
  final_deductibility?: number | null;
  ai_deductibility?: number | null;
  total_vat?: number | null;
}

function clampDeductibility(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, value));
}

export function getPurchaseDeductibilityPercent(
  invoice: PurchaseDeductibilityLike,
): number {
  return clampDeductibility(
    Number(invoice.final_deductibility ?? invoice.ai_deductibility ?? 100),
  );
}

export function getPurchaseDeductibilityRate(
  invoice: PurchaseDeductibilityLike,
): number {
  return getPurchaseDeductibilityPercent(invoice) / 100;
}

export function getPurchaseDeductibleVat(
  invoice: PurchaseDeductibilityLike,
): number {
  return Number(invoice.total_vat || 0) * getPurchaseDeductibilityRate(invoice);
}
