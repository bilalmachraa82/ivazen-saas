/**
 * SAF-T PT v1.04 XML Generator
 *
 * Generates SAF-T (Standard Audit File for Tax purposes) XML
 * compliant with Portuguese regulation (Portaria 321-A/2007).
 *
 * NOTE: This is a non-certified auxiliary tool for accountant reference.
 * softwareCertificateNumber is "0" (standard practice for non-certified software).
 * For official submission, use AT-certified software.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface SaftCompanyInfo {
  taxRegistrationNumber: string; // NIF
  companyName: string;
  addressDetail?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  fiscalYear: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface SaftInvoice {
  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  invoiceType: 'FT' | 'FS' | 'FR' | 'ND' | 'NC';
  supplierNif: string;
  supplierName: string;
  grossTotal: number;
  netTotal: number;
  taxPayable: number;
  lines: SaftInvoiceLine[];
}

export interface SaftInvoiceLine {
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  creditAmount?: number;
  debitAmount?: number;
  taxType: 'IVA';
  taxPercentage: number;
  taxAmount: number;
}

export interface SaftSalesInvoice {
  invoiceNo: string;
  invoiceDate: string;
  invoiceType: 'FT' | 'FS' | 'FR' | 'ND' | 'NC';
  customerNif: string;
  customerName: string;
  grossTotal: number;
  netTotal: number;
  taxPayable: number;
  lines: SaftInvoiceLine[];
}

// ── XML Helpers ──────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name: string, value: string | number, indent: number = 0): string {
  const pad = '\t'.repeat(indent);
  return `${pad}<${name}>${typeof value === 'string' ? escapeXml(value) : value}</${name}>`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 19);
}

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

// ── Generator ────────────────────────────────────────────────────────

export function generateSaftXml(
  company: SaftCompanyInfo,
  purchaseInvoices: SaftInvoice[],
  salesInvoices: SaftSalesInvoice[],
): string {
  const now = new Date();
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">');

  // ── Header ──
  lines.push('\t<Header>');
  lines.push(tag('AuditFileVersion', '1.04_01', 2));
  lines.push(tag('CompanyID', company.taxRegistrationNumber, 2));
  lines.push(tag('TaxRegistrationNumber', company.taxRegistrationNumber, 2));
  lines.push(tag('TaxAccountingBasis', 'F', 2)); // F = Facturação
  lines.push(tag('CompanyName', company.companyName, 2));

  // Company Address
  lines.push('\t\t<CompanyAddress>');
  lines.push(tag('AddressDetail', company.addressDetail || 'Desconhecido', 3));
  lines.push(tag('City', company.city || 'Desconhecido', 3));
  lines.push(tag('PostalCode', company.postalCode || '0000-000', 3));
  lines.push(tag('Country', company.country || 'PT', 3));
  lines.push('\t\t</CompanyAddress>');

  lines.push(tag('FiscalYear', company.fiscalYear, 2));
  lines.push(tag('DateCreated', now.toISOString().slice(0, 10), 2));
  lines.push(tag('TaxEntity', 'Global', 2));
  lines.push(tag('ProductCompanyTaxID', '999999990', 2)); // Non-certified
  lines.push(tag('SoftwareCertificateNumber', '0', 2));
  lines.push(tag('ProductID', 'IVAzen/1.0', 2));
  lines.push(tag('ProductVersion', '1.0', 2));
  lines.push(tag('StartDate', company.startDate, 2));
  lines.push(tag('EndDate', company.endDate, 2));
  lines.push(tag('CurrencyCode', 'EUR', 2));
  lines.push('\t</Header>');

  // ── MasterFiles ──
  lines.push('\t<MasterFiles>');

  // Collect unique suppliers and customers
  const suppliers = new Map<string, string>();
  purchaseInvoices.forEach(inv => {
    if (!suppliers.has(inv.supplierNif)) {
      suppliers.set(inv.supplierNif, inv.supplierName);
    }
  });

  const customers = new Map<string, string>();
  salesInvoices.forEach(inv => {
    if (!customers.has(inv.customerNif)) {
      customers.set(inv.customerNif, inv.customerName);
    }
  });

  // Supplier entries
  suppliers.forEach((name, nif) => {
    lines.push('\t\t<Supplier>');
    lines.push(tag('SupplierID', nif, 3));
    lines.push(tag('AccountID', 'Desconhecido', 3));
    lines.push(tag('SupplierTaxID', nif, 3));
    lines.push(tag('CompanyName', name, 3));
    lines.push('\t\t\t<BillingAddress>');
    lines.push(tag('AddressDetail', 'Desconhecido', 4));
    lines.push(tag('City', 'Desconhecido', 4));
    lines.push(tag('PostalCode', '0000-000', 4));
    lines.push(tag('Country', 'PT', 4));
    lines.push('\t\t\t</BillingAddress>');
    lines.push('\t\t</Supplier>');
  });

  // Customer entries
  customers.forEach((name, nif) => {
    lines.push('\t\t<Customer>');
    lines.push(tag('CustomerID', nif, 3));
    lines.push(tag('AccountID', 'Desconhecido', 3));
    lines.push(tag('CustomerTaxID', nif, 3));
    lines.push(tag('CompanyName', name, 3));
    lines.push('\t\t\t<BillingAddress>');
    lines.push(tag('AddressDetail', 'Desconhecido', 4));
    lines.push(tag('City', 'Desconhecido', 4));
    lines.push(tag('PostalCode', '0000-000', 4));
    lines.push(tag('Country', 'PT', 4));
    lines.push('\t\t\t</BillingAddress>');
    lines.push('\t\t</Customer>');
  });

  // Tax table entry
  lines.push('\t\t<TaxTable>');
  const taxRates = [6, 13, 23, 0];
  taxRates.forEach(rate => {
    lines.push('\t\t\t<TaxTableEntry>');
    lines.push(tag('TaxType', 'IVA', 4));
    lines.push(tag('TaxCountryRegion', 'PT', 4));
    lines.push(tag('Description', rate === 0 ? 'ISE' : `IVA ${rate}%`, 4));
    lines.push(tag('TaxPercentage', rate, 4));
    lines.push('\t\t\t</TaxTableEntry>');
  });
  lines.push('\t\t</TaxTable>');

  lines.push('\t</MasterFiles>');

  // ── SourceDocuments ──
  lines.push('\t<SourceDocuments>');

  // Sales Invoices section (output)
  if (salesInvoices.length > 0) {
    const salesTotalDebit = 0;
    const salesTotalCredit = salesInvoices.reduce((sum, inv) => sum + inv.grossTotal, 0);

    lines.push('\t\t<SalesInvoices>');
    lines.push(tag('NumberOfEntries', salesInvoices.length, 3));
    lines.push(tag('TotalDebit', formatMoney(salesTotalDebit), 3));
    lines.push(tag('TotalCredit', formatMoney(salesTotalCredit), 3));

    salesInvoices.forEach(inv => {
      lines.push('\t\t\t<Invoice>');
      lines.push(tag('InvoiceNo', inv.invoiceNo, 4));
      lines.push('\t\t\t\t<DocumentStatus>');
      lines.push(tag('InvoiceStatus', 'N', 5)); // N = Normal
      lines.push(tag('InvoiceStatusDate', formatDate(now), 5));
      lines.push(tag('SourceID', company.taxRegistrationNumber, 5));
      lines.push(tag('SourceBilling', 'P', 5)); // P = Produced
      lines.push('\t\t\t\t</DocumentStatus>');
      lines.push(tag('Hash', '0', 4));
      lines.push(tag('InvoiceDate', inv.invoiceDate, 4));
      lines.push(tag('InvoiceType', inv.invoiceType, 4));
      lines.push(tag('SourceID', company.taxRegistrationNumber, 4));
      lines.push(tag('SystemEntryDate', formatDate(now), 4));
      lines.push(tag('CustomerID', inv.customerNif, 4));

      // Lines
      inv.lines.forEach(line => {
        lines.push('\t\t\t\t<Line>');
        lines.push(tag('LineNumber', line.lineNumber, 5));
        lines.push(tag('Description', line.description, 5));
        lines.push(tag('Quantity', line.quantity, 5));
        lines.push(tag('UnitPrice', formatMoney(line.unitPrice), 5));
        lines.push(tag('CreditAmount', formatMoney(line.creditAmount || line.unitPrice * line.quantity), 5));
        lines.push('\t\t\t\t\t<Tax>');
        lines.push(tag('TaxType', line.taxType, 6));
        lines.push(tag('TaxCountryRegion', 'PT', 6));
        lines.push(tag('TaxPercentage', line.taxPercentage, 6));
        lines.push(tag('TaxAmount', formatMoney(line.taxAmount), 6));
        lines.push('\t\t\t\t\t</Tax>');
        lines.push('\t\t\t\t</Line>');
      });

      // Document Totals
      lines.push('\t\t\t\t<DocumentTotals>');
      lines.push(tag('TaxPayable', formatMoney(inv.taxPayable), 5));
      lines.push(tag('NetTotal', formatMoney(inv.netTotal), 5));
      lines.push(tag('GrossTotal', formatMoney(inv.grossTotal), 5));
      lines.push('\t\t\t\t</DocumentTotals>');

      lines.push('\t\t\t</Invoice>');
    });

    lines.push('\t\t</SalesInvoices>');
  }

  lines.push('\t</SourceDocuments>');
  lines.push('</AuditFile>');

  return lines.join('\n');
}

// ── Convenience: build SaftInvoice from DB row ───────────────────────

export interface DbInvoiceRow {
  id: string;
  document_number?: string | null;
  document_date: string;
  document_type?: string | null;
  supplier_nif: string;
  supplier_name?: string | null;
  total_amount: number;
  total_vat?: number | null;
  base_standard?: number | null;
  base_intermediate?: number | null;
  base_reduced?: number | null;
  base_exempt?: number | null;
  vat_standard?: number | null;
  vat_intermediate?: number | null;
  vat_reduced?: number | null;
}

export function dbInvoiceToSaft(row: DbInvoiceRow, index: number): SaftInvoice {
  const lines: SaftInvoiceLine[] = [];
  let lineNum = 1;

  const addLine = (base: number, vatPct: number, vatAmount: number) => {
    if (base > 0) {
      lines.push({
        lineNumber: lineNum++,
        description: `Compra (${vatPct}% IVA)`,
        quantity: 1,
        unitPrice: base,
        debitAmount: base,
        taxType: 'IVA',
        taxPercentage: vatPct,
        taxAmount: vatAmount,
      });
    }
  };

  addLine(row.base_standard || 0, 23, row.vat_standard || 0);
  addLine(row.base_intermediate || 0, 13, row.vat_intermediate || 0);
  addLine(row.base_reduced || 0, 6, row.vat_reduced || 0);

  const exemptBase = row.base_exempt || 0;
  if (exemptBase > 0) {
    lines.push({
      lineNumber: lineNum++,
      description: 'Compra (Isento)',
      quantity: 1,
      unitPrice: exemptBase,
      debitAmount: exemptBase,
      taxType: 'IVA',
      taxPercentage: 0,
      taxAmount: 0,
    });
  }

  // If no line breakdown, create a single summary line
  if (lines.length === 0) {
    const netTotal = row.total_amount - (row.total_vat || 0);
    lines.push({
      lineNumber: 1,
      description: 'Compra',
      quantity: 1,
      unitPrice: netTotal,
      debitAmount: netTotal,
      taxType: 'IVA',
      taxPercentage: 23,
      taxAmount: row.total_vat || 0,
    });
  }

  const docType = (row.document_type || 'FT').toUpperCase();
  const invoiceType = (['FT', 'FS', 'FR', 'ND', 'NC'].includes(docType) ? docType : 'FT') as SaftInvoice['invoiceType'];

  return {
    invoiceNo: row.document_number || `DOC-${index + 1}`,
    invoiceDate: row.document_date,
    invoiceType,
    supplierNif: row.supplier_nif,
    supplierName: row.supplier_name || 'Desconhecido',
    grossTotal: row.total_amount,
    netTotal: row.total_amount - (row.total_vat || 0),
    taxPayable: row.total_vat || 0,
    lines,
  };
}

export interface DbSalesInvoiceRow {
  id: string;
  document_number?: string | null;
  document_date: string;
  document_type?: string | null;
  customer_nif?: string | null;
  customer_name?: string | null;
  total_amount: number;
  total_vat?: number | null;
  base_standard?: number | null;
  base_intermediate?: number | null;
  base_reduced?: number | null;
  base_exempt?: number | null;
  vat_standard?: number | null;
  vat_intermediate?: number | null;
  vat_reduced?: number | null;
}

export function dbSalesInvoiceToSaft(row: DbSalesInvoiceRow, index: number): SaftSalesInvoice {
  const lines: SaftInvoiceLine[] = [];
  let lineNum = 1;

  const addLine = (base: number, vatPct: number, vatAmount: number) => {
    if (base > 0) {
      lines.push({
        lineNumber: lineNum++,
        description: `Venda (${vatPct}% IVA)`,
        quantity: 1,
        unitPrice: base,
        creditAmount: base,
        taxType: 'IVA',
        taxPercentage: vatPct,
        taxAmount: vatAmount,
      });
    }
  };

  addLine(row.base_standard || 0, 23, row.vat_standard || 0);
  addLine(row.base_intermediate || 0, 13, row.vat_intermediate || 0);
  addLine(row.base_reduced || 0, 6, row.vat_reduced || 0);

  const exemptBase = row.base_exempt || 0;
  if (exemptBase > 0) {
    lines.push({
      lineNumber: lineNum++,
      description: 'Venda (Isento)',
      quantity: 1,
      unitPrice: exemptBase,
      creditAmount: exemptBase,
      taxType: 'IVA',
      taxPercentage: 0,
      taxAmount: 0,
    });
  }

  if (lines.length === 0) {
    const netTotal = row.total_amount - (row.total_vat || 0);
    lines.push({
      lineNumber: 1,
      description: 'Venda',
      quantity: 1,
      unitPrice: netTotal,
      creditAmount: netTotal,
      taxType: 'IVA',
      taxPercentage: 23,
      taxAmount: row.total_vat || 0,
    });
  }

  const docType = (row.document_type || 'FT').toUpperCase();
  const invoiceType = (['FT', 'FS', 'FR', 'ND', 'NC'].includes(docType) ? docType : 'FT') as SaftSalesInvoice['invoiceType'];

  return {
    invoiceNo: row.document_number || `VND-${index + 1}`,
    invoiceDate: row.document_date,
    invoiceType,
    customerNif: row.customer_nif || '999999990',
    customerName: row.customer_name || 'Consumidor Final',
    grossTotal: row.total_amount,
    netTotal: row.total_amount - (row.total_vat || 0),
    taxPayable: row.total_vat || 0,
    lines,
  };
}

// ── Download helper ──────────────────────────────────────────────────

export function downloadSaftXml(xml: string, filename?: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `SAF-T_PT_${new Date().toISOString().slice(0, 10)}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
