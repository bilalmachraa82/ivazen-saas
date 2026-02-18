/**
 * AT Invoice Mapper
 * Converts AT webservice invoice data to IVAzen table format
 * 
 * Maps LineSummary TaxCodes to IVA fields:
 * - NOR (Normal) → base_standard, vat_standard (23%)
 * - INT (Intermedia) → base_intermediate, vat_intermediate (13%)
 * - RED (Reduzida) → base_reduced, vat_reduced (6%)
 * - ISE (Isento) → base_exempt (0%)
 */

import type { ATInvoice, ATLineSummary } from './wsSecurityUtils';

// Tax code mapping to IVAzen fields
export const TAX_CODE_MAPPING = {
  'NOR': { base: 'base_standard', vat: 'vat_standard', rate: 23 },
  'INT': { base: 'base_intermediate', vat: 'vat_intermediate', rate: 13 },
  'RED': { base: 'base_reduced', vat: 'vat_reduced', rate: 6 },
  'ISE': { base: 'base_exempt', vat: null, rate: 0 },
} as const;

// Fiscal region mapping for autonomous regions VAT rates
export const FISCAL_REGION_RATES = {
  'PT': { NOR: 23, INT: 13, RED: 6 },
  'PT-AC': { NOR: 16, INT: 9, RED: 4 },  // Açores
  'PT-MA': { NOR: 22, INT: 12, RED: 5 }, // Madeira
} as const;

// Revenue categories for Social Security calculation
export const REVENUE_CATEGORIES = {
  'prestacao_servicos': { code: 'B', coefficient: 0.70, label: 'Prestação de Serviços' },
  'vendas': { code: 'B', coefficient: 0.20, label: 'Vendas' },
  'hotelaria': { code: 'B', coefficient: 0.15, label: 'Hotelaria e Restauração' },
  'producao_agricola': { code: 'B', coefficient: 0.20, label: 'Produção Agrícola' },
  'outras': { code: 'B', coefficient: 0.70, label: 'Outras' },
} as const;

export type RevenueCategory = keyof typeof REVENUE_CATEGORIES;

export interface MappedPurchaseInvoice {
  client_id: string;
  supplier_nif: string;
  supplier_name: string | null;
  customer_nif: string | null;
  document_date: string;
  document_number: string | null;
  document_type: string | null;
  atcud: string | null;
  total_amount: number;
  total_vat: number;
  base_exempt: number;
  base_reduced: number;
  base_intermediate: number;
  base_standard: number;
  vat_reduced: number;
  vat_intermediate: number;
  vat_standard: number;
  fiscal_region: string;
  fiscal_period: string;
  image_path: string;
  efatura_source: string;
  data_authority: string;
  status: string;
}

export interface MappedSalesInvoice {
  client_id: string;
  supplier_nif: string;
  customer_nif: string | null;
  customer_name: string | null;
  document_date: string;
  document_number: string | null;
  document_type: string | null;
  atcud: string | null;
  total_amount: number;
  total_vat: number;
  base_exempt: number;
  base_reduced: number;
  base_intermediate: number;
  base_standard: number;
  vat_reduced: number;
  vat_intermediate: number;
  vat_standard: number;
  fiscal_region: string;
  fiscal_period: string;
  image_path: string;
  status: string;
  revenue_category: RevenueCategory;
}

/**
 * Calculate fiscal period (quarter) from date
 */
export function calculateFiscalPeriod(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

/**
 * Aggregate VAT values by tax code from LineSummary
 */
function aggregateVATByCode(lineSummary: ATLineSummary[]): {
  base_exempt: number;
  base_reduced: number;
  base_intermediate: number;
  base_standard: number;
  vat_reduced: number;
  vat_intermediate: number;
  vat_standard: number;
} {
  const result = {
    base_exempt: 0,
    base_reduced: 0,
    base_intermediate: 0,
    base_standard: 0,
    vat_reduced: 0,
    vat_intermediate: 0,
    vat_standard: 0,
  };
  
  for (const line of lineSummary) {
    switch (line.taxCode) {
      case 'NOR':
        result.base_standard += line.amount;
        result.vat_standard += line.taxAmount;
        break;
      case 'INT':
        result.base_intermediate += line.amount;
        result.vat_intermediate += line.taxAmount;
        break;
      case 'RED':
        result.base_reduced += line.amount;
        result.vat_reduced += line.taxAmount;
        break;
      case 'ISE':
        result.base_exempt += line.amount;
        break;
    }
  }
  
  return result;
}

/**
 * Detect fiscal region from LineSummary tax rates
 */
function detectFiscalRegion(lineSummary: ATLineSummary[]): string {
  // Check if any line has explicit region
  for (const line of lineSummary) {
    if (line.taxCountryRegion && line.taxCountryRegion !== 'PT') {
      return line.taxCountryRegion;
    }
    
    // Detect by rate (if normal rate is 16%, it's Azores)
    if (line.taxCode === 'NOR') {
      if (line.taxPercentage === 16) return 'PT-AC';
      if (line.taxPercentage === 22) return 'PT-MA';
    }
  }
  
  return 'PT';
}

/**
 * Infer revenue category from document type and CAE (if available)
 */
export function inferRevenueCategory(
  documentType: string,
  cae?: string
): RevenueCategory {
  // Default to services
  let category: RevenueCategory = 'prestacao_servicos';
  
  // Check CAE prefix for category hints
  if (cae) {
    const caePrefix = cae.substring(0, 2);
    
    // Agriculture: 01xxx-03xxx
    if (['01', '02', '03'].includes(caePrefix)) {
      category = 'producao_agricola';
    }
    // Hotels/Restaurants: 55xxx-56xxx
    else if (['55', '56'].includes(caePrefix)) {
      category = 'hotelaria';
    }
    // Retail/Wholesale: 45xxx-47xxx
    else if (['45', '46', '47'].includes(caePrefix)) {
      category = 'vendas';
    }
  }
  
  // Check document type for hints
  if (documentType === 'VD' || documentType === 'GT') {
    category = 'vendas';
  }
  
  return category;
}

/**
 * Map AT invoice to IVAzen purchase invoice (compras)
 */
export function mapATPurchaseToInvoice(
  atInvoice: ATInvoice,
  clientId: string
): MappedPurchaseInvoice {
  const vatTotals = aggregateVATByCode(atInvoice.lineSummary);
  const fiscalRegion = detectFiscalRegion(atInvoice.lineSummary);
  const fiscalPeriod = calculateFiscalPeriod(atInvoice.documentDate);
  
  return {
    client_id: clientId,
    supplier_nif: atInvoice.supplierNif,
    supplier_name: atInvoice.supplierName || null,
    customer_nif: atInvoice.customerNif || null,
    document_date: atInvoice.documentDate,
    document_number: atInvoice.documentNumber || null,
    document_type: atInvoice.documentType || 'FT',
    atcud: atInvoice.atcud || null,
    total_amount: atInvoice.grossTotal,
    total_vat: atInvoice.taxPayable,
    ...vatTotals,
    fiscal_region: fiscalRegion,
    fiscal_period: fiscalPeriod,
    image_path: `at-sync/${clientId}/${atInvoice.documentNumber || 'unknown'}`,
    efatura_source: 'webservice',
    data_authority: 'at_certified',
    status: 'pending', // Needs classification
  };
}

/**
 * Map AT invoice to IVAzen sales invoice (vendas)
 */
export function mapATSaleToSalesInvoice(
  atInvoice: ATInvoice,
  clientId: string,
  clientCae?: string
): MappedSalesInvoice {
  const vatTotals = aggregateVATByCode(atInvoice.lineSummary);
  const fiscalRegion = detectFiscalRegion(atInvoice.lineSummary);
  const fiscalPeriod = calculateFiscalPeriod(atInvoice.documentDate);
  const revenueCategory = inferRevenueCategory(atInvoice.documentType, clientCae);
  
  return {
    client_id: clientId,
    supplier_nif: clientId, // For sales, supplier is the client
    customer_nif: atInvoice.customerNif || null,
    customer_name: atInvoice.customerName || atInvoice.supplierName || null,
    document_date: atInvoice.documentDate,
    document_number: atInvoice.documentNumber || null,
    document_type: atInvoice.documentType || 'FT',
    atcud: atInvoice.atcud || null,
    total_amount: atInvoice.grossTotal,
    total_vat: atInvoice.taxPayable,
    ...vatTotals,
    fiscal_region: fiscalRegion,
    fiscal_period: fiscalPeriod,
    image_path: `at-sync/${clientId}/${atInvoice.documentNumber || 'unknown'}`,
    status: 'pending',
    revenue_category: revenueCategory,
  };
}

/**
 * Check if invoice already exists (for deduplication)
 */
export interface DuplicateCheckParams {
  clientId: string;
  supplierNif: string;
  documentNumber: string | null;
  documentDate: string;
}

export function buildDuplicateCheckQuery(params: DuplicateCheckParams): {
  table: string;
  match: Record<string, unknown>;
} {
  return {
    table: 'invoices',
    match: {
      client_id: params.clientId,
      supplier_nif: params.supplierNif,
      document_number: params.documentNumber,
      document_date: params.documentDate,
    },
  };
}

/**
 * Calculate Social Security contribution from sales
 */
export function calculateSSContributionFromSales(
  sales: MappedSalesInvoice[],
  contributionRate: number = 21.4
): {
  totalRevenue: number;
  revenueByCategory: Record<RevenueCategory, number>;
  relevantIncome: number;
  contributionBase: number;
  contributionAmount: number;
} {
  const revenueByCategory: Record<RevenueCategory, number> = {
    prestacao_servicos: 0,
    vendas: 0,
    hotelaria: 0,
    producao_agricola: 0,
    outras: 0,
  };
  
  // Sum net revenue (without VAT) by category
  for (const sale of sales) {
    const netAmount = sale.total_amount - sale.total_vat;
    revenueByCategory[sale.revenue_category] += netAmount;
  }
  
  // Calculate relevant income applying coefficients
  let relevantIncome = 0;
  for (const [category, amount] of Object.entries(revenueByCategory) as [RevenueCategory, number][]) {
    const coefficient = REVENUE_CATEGORIES[category].coefficient;
    relevantIncome += amount * coefficient;
  }
  
  // Total revenue
  const totalRevenue = Object.values(revenueByCategory).reduce((a, b) => a + b, 0);
  
  // Contribution base = relevant income / 3 (for quarterly)
  const contributionBase = relevantIncome / 3;
  
  // Contribution amount
  const contributionAmount = contributionBase * (contributionRate / 100);
  
  return {
    totalRevenue,
    revenueByCategory,
    relevantIncome,
    contributionBase,
    contributionAmount,
  };
}

/**
 * Batch process AT invoices and return mapped data
 */
export function batchMapATInvoices(
  invoices: ATInvoice[],
  clientId: string,
  type: 'compras' | 'vendas',
  clientCae?: string
): (MappedPurchaseInvoice | MappedSalesInvoice)[] {
  return invoices.map((invoice) => {
    if (type === 'compras') {
      return mapATPurchaseToInvoice(invoice, clientId);
    } else {
      return mapATSaleToSalesInvoice(invoice, clientId, clientCae);
    }
  });
}
