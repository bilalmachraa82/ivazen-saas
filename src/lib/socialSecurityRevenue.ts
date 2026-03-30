import { normalizeSSCategory } from '@/lib/ssCoefficients';

export interface SocialSecuritySalesInvoiceLike {
  base_reduced?: number | null;
  base_intermediate?: number | null;
  base_standard?: number | null;
  base_exempt?: number | null;
  total_amount?: number | null;
  total_vat?: number | null;
  document_type?: string | null;
  revenue_category?: string | null;
}

export function getSalesInvoiceRevenueCategory(
  invoice: SocialSecuritySalesInvoiceLike,
): string {
  const docType = (invoice.document_type || '').toUpperCase();
  const inferredCategory = invoice.revenue_category
    || ((docType === 'FR' || docType === 'FS/FR') ? 'prestacao_servicos' : 'vendas');

  return normalizeSSCategory(inferredCategory);
}

export function getSalesInvoiceRevenueAmount(
  invoice: SocialSecuritySalesInvoiceLike,
): number {
  const lineBases = [
    Number(invoice.base_reduced || 0),
    Number(invoice.base_intermediate || 0),
    Number(invoice.base_standard || 0),
    Number(invoice.base_exempt || 0),
  ];
  const summedBases = lineBases.reduce((sum, value) => sum + value, 0);

  if (summedBases > 0) {
    return summedBases;
  }

  const totalAmount = Number(invoice.total_amount || 0);
  const totalVat = Number(invoice.total_vat || 0);

  if (totalAmount > 0) {
    return Math.max(totalAmount - totalVat, 0);
  }

  return 0;
}
