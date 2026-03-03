import { describe, it, expect } from 'vitest';
import {
  generateSaftXml,
  dbInvoiceToSaft,
  dbSalesInvoiceToSaft,
  SaftCompanyInfo,
  SaftInvoice,
  SaftSalesInvoice,
  DbInvoiceRow,
  DbSalesInvoiceRow,
} from '../saftExporter';

const mockCompany: SaftCompanyInfo = {
  taxRegistrationNumber: '123456789',
  companyName: 'Empresa Teste Lda',
  addressDetail: 'Rua do Teste 123',
  city: 'Lisboa',
  postalCode: '1000-001',
  country: 'PT',
  fiscalYear: 2026,
  startDate: '2026-01-01',
  endDate: '2026-03-31',
};

const mockPurchaseInvoice: SaftInvoice = {
  invoiceNo: 'FT 001/2026',
  invoiceDate: '2026-01-15',
  invoiceType: 'FT',
  supplierNif: '987654321',
  supplierName: 'Fornecedor ABC',
  grossTotal: 123.00,
  netTotal: 100.00,
  taxPayable: 23.00,
  lines: [
    {
      lineNumber: 1,
      description: 'Material escritório',
      quantity: 1,
      unitPrice: 100.00,
      debitAmount: 100.00,
      taxType: 'IVA',
      taxPercentage: 23,
      taxAmount: 23.00,
    },
  ],
};

const mockSalesInvoice: SaftSalesInvoice = {
  invoiceNo: 'FT A/001',
  invoiceDate: '2026-02-10',
  invoiceType: 'FT',
  customerNif: '111222333',
  customerName: 'Cliente XYZ',
  grossTotal: 246.00,
  netTotal: 200.00,
  taxPayable: 46.00,
  lines: [
    {
      lineNumber: 1,
      description: 'Serviço consultoria',
      quantity: 1,
      unitPrice: 200.00,
      creditAmount: 200.00,
      taxType: 'IVA',
      taxPercentage: 23,
      taxAmount: 46.00,
    },
  ],
};

describe('generateSaftXml', () => {
  it('generates valid XML with correct header', () => {
    const xml = generateSaftXml(mockCompany, [], []);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('urn:OECD:StandardAuditFile-Tax:PT_1.04_01');
    expect(xml).toContain('<AuditFileVersion>1.04_01</AuditFileVersion>');
    expect(xml).toContain('<CompanyID>123456789</CompanyID>');
    expect(xml).toContain('<TaxRegistrationNumber>123456789</TaxRegistrationNumber>');
    expect(xml).toContain('<CompanyName>Empresa Teste Lda</CompanyName>');
    expect(xml).toContain('<FiscalYear>2026</FiscalYear>');
    expect(xml).toContain('<SoftwareCertificateNumber>0</SoftwareCertificateNumber>');
    expect(xml).toContain('<ProductID>IVAzen/1.0</ProductID>');
    expect(xml).toContain('<CurrencyCode>EUR</CurrencyCode>');
    expect(xml).toContain('<StartDate>2026-01-01</StartDate>');
    expect(xml).toContain('<EndDate>2026-03-31</EndDate>');
  });

  it('generates company address', () => {
    const xml = generateSaftXml(mockCompany, [], []);

    expect(xml).toContain('<AddressDetail>Rua do Teste 123</AddressDetail>');
    expect(xml).toContain('<City>Lisboa</City>');
    expect(xml).toContain('<PostalCode>1000-001</PostalCode>');
    expect(xml).toContain('<Country>PT</Country>');
  });

  it('uses defaults when address is missing', () => {
    const companyNoAddr = { ...mockCompany, addressDetail: undefined, city: undefined, postalCode: undefined };
    const xml = generateSaftXml(companyNoAddr, [], []);

    expect(xml).toContain('<AddressDetail>Desconhecido</AddressDetail>');
    expect(xml).toContain('<City>Desconhecido</City>');
    expect(xml).toContain('<PostalCode>0000-000</PostalCode>');
  });

  it('includes MasterFiles with tax table', () => {
    const xml = generateSaftXml(mockCompany, [], []);

    expect(xml).toContain('<MasterFiles>');
    expect(xml).toContain('<TaxTable>');
    expect(xml).toContain('<Description>IVA 6%</Description>');
    expect(xml).toContain('<Description>IVA 13%</Description>');
    expect(xml).toContain('<Description>IVA 23%</Description>');
    expect(xml).toContain('<Description>ISE</Description>');
  });

  it('includes supplier in MasterFiles', () => {
    const xml = generateSaftXml(mockCompany, [mockPurchaseInvoice], []);

    expect(xml).toContain('<SupplierID>987654321</SupplierID>');
    expect(xml).toContain('<SupplierTaxID>987654321</SupplierTaxID>');
    expect(xml).toContain('<CompanyName>Fornecedor ABC</CompanyName>');
  });

  it('includes customer in MasterFiles', () => {
    const xml = generateSaftXml(mockCompany, [], [mockSalesInvoice]);

    expect(xml).toContain('<CustomerID>111222333</CustomerID>');
    expect(xml).toContain('<CustomerTaxID>111222333</CustomerTaxID>');
    expect(xml).toContain('<CompanyName>Cliente XYZ</CompanyName>');
  });

  it('deduplicates suppliers with same NIF', () => {
    const dup: SaftInvoice = { ...mockPurchaseInvoice, invoiceNo: 'FT 002/2026' };
    const xml = generateSaftXml(mockCompany, [mockPurchaseInvoice, dup], []);

    // Should only have one Supplier element
    const supplierCount = (xml.match(/<SupplierID>987654321<\/SupplierID>/g) || []).length;
    expect(supplierCount).toBe(1);
  });

  it('generates SalesInvoices section', () => {
    const xml = generateSaftXml(mockCompany, [], [mockSalesInvoice]);

    expect(xml).toContain('<SalesInvoices>');
    expect(xml).toContain('<NumberOfEntries>1</NumberOfEntries>');
    expect(xml).toContain('<TotalCredit>246.00</TotalCredit>');
    expect(xml).toContain('<InvoiceNo>FT A/001</InvoiceNo>');
    expect(xml).toContain('<InvoiceDate>2026-02-10</InvoiceDate>');
    expect(xml).toContain('<InvoiceType>FT</InvoiceType>');
    expect(xml).toContain('<InvoiceStatus>N</InvoiceStatus>');
    expect(xml).toContain('<CustomerID>111222333</CustomerID>');
  });

  it('generates invoice line details', () => {
    const xml = generateSaftXml(mockCompany, [], [mockSalesInvoice]);

    expect(xml).toContain('<LineNumber>1</LineNumber>');
    expect(xml).toContain('<Description>Serviço consultoria</Description>');
    expect(xml).toContain('<UnitPrice>200.00</UnitPrice>');
    expect(xml).toContain('<CreditAmount>200.00</CreditAmount>');
    expect(xml).toContain('<TaxPercentage>23</TaxPercentage>');
    expect(xml).toContain('<TaxAmount>46.00</TaxAmount>');
  });

  it('generates document totals', () => {
    const xml = generateSaftXml(mockCompany, [], [mockSalesInvoice]);

    expect(xml).toContain('<DocumentTotals>');
    expect(xml).toContain('<TaxPayable>46.00</TaxPayable>');
    expect(xml).toContain('<NetTotal>200.00</NetTotal>');
    expect(xml).toContain('<GrossTotal>246.00</GrossTotal>');
  });

  it('escapes XML special characters', () => {
    const company = { ...mockCompany, companyName: 'Test & <Company> "Lda"' };
    const xml = generateSaftXml(company, [], []);

    expect(xml).toContain('Test &amp; &lt;Company&gt; &quot;Lda&quot;');
    expect(xml).not.toContain('Test & <Company>');
  });

  it('closes all XML tags properly', () => {
    const xml = generateSaftXml(mockCompany, [mockPurchaseInvoice], [mockSalesInvoice]);

    expect(xml).toContain('</Header>');
    expect(xml).toContain('</MasterFiles>');
    expect(xml).toContain('</SourceDocuments>');
    expect(xml).toContain('</AuditFile>');
  });

  it('omits SalesInvoices section when no sales', () => {
    const xml = generateSaftXml(mockCompany, [mockPurchaseInvoice], []);

    expect(xml).not.toContain('<SalesInvoices>');
    expect(xml).toContain('<SourceDocuments>');
    expect(xml).toContain('</SourceDocuments>');
  });

  it('handles multiple sales invoices', () => {
    const inv2: SaftSalesInvoice = {
      ...mockSalesInvoice,
      invoiceNo: 'FT A/002',
      customerNif: '444555666',
      customerName: 'Outro Cliente',
    };
    const xml = generateSaftXml(mockCompany, [], [mockSalesInvoice, inv2]);

    expect(xml).toContain('<NumberOfEntries>2</NumberOfEntries>');
    expect(xml).toContain('<InvoiceNo>FT A/001</InvoiceNo>');
    expect(xml).toContain('<InvoiceNo>FT A/002</InvoiceNo>');
  });
});

describe('dbInvoiceToSaft', () => {
  it('converts DB row to SAF-T invoice', () => {
    const row: DbInvoiceRow = {
      id: 'abc-123',
      document_number: 'FT 100/2026',
      document_date: '2026-02-15',
      document_type: 'FT',
      supplier_nif: '123456789',
      supplier_name: 'Fornecedor X',
      total_amount: 123.00,
      total_vat: 23.00,
      base_standard: 100.00,
      vat_standard: 23.00,
    };

    const result = dbInvoiceToSaft(row, 0);

    expect(result.invoiceNo).toBe('FT 100/2026');
    expect(result.invoiceDate).toBe('2026-02-15');
    expect(result.invoiceType).toBe('FT');
    expect(result.supplierNif).toBe('123456789');
    expect(result.grossTotal).toBe(123.00);
    expect(result.netTotal).toBe(100.00);
    expect(result.taxPayable).toBe(23.00);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].taxPercentage).toBe(23);
  });

  it('creates multiple lines for multiple VAT rates', () => {
    const row: DbInvoiceRow = {
      id: 'abc-456',
      document_date: '2026-02-15',
      supplier_nif: '123456789',
      total_amount: 150.00,
      total_vat: 30.00,
      base_standard: 80.00,
      vat_standard: 18.40,
      base_reduced: 50.00,
      vat_reduced: 3.00,
      base_exempt: 20.00,
    };

    const result = dbInvoiceToSaft(row, 0);

    expect(result.lines).toHaveLength(3); // standard + reduced + exempt
    expect(result.lines[0].taxPercentage).toBe(23);
    expect(result.lines[1].taxPercentage).toBe(6);
    expect(result.lines[2].taxPercentage).toBe(0);
  });

  it('creates fallback line when no breakdown available', () => {
    const row: DbInvoiceRow = {
      id: 'abc-789',
      document_date: '2026-03-01',
      supplier_nif: '999888777',
      total_amount: 100.00,
      total_vat: 23.00,
    };

    const result = dbInvoiceToSaft(row, 0);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].unitPrice).toBe(77.00); // 100 - 23
    expect(result.lines[0].taxAmount).toBe(23.00);
  });

  it('generates document number when missing', () => {
    const row: DbInvoiceRow = {
      id: 'abc-000',
      document_date: '2026-01-01',
      supplier_nif: '111111111',
      total_amount: 50.00,
    };

    const result = dbInvoiceToSaft(row, 4);
    expect(result.invoiceNo).toBe('DOC-5');
  });

  it('defaults invoice type to FT for unknown types', () => {
    const row: DbInvoiceRow = {
      id: 'abc-000',
      document_date: '2026-01-01',
      document_type: 'UNKNOWN',
      supplier_nif: '111111111',
      total_amount: 50.00,
    };

    const result = dbInvoiceToSaft(row, 0);
    expect(result.invoiceType).toBe('FT');
  });

  it('accepts valid document types', () => {
    const types = ['FT', 'FS', 'FR', 'ND', 'NC'];
    types.forEach(type => {
      const row: DbInvoiceRow = {
        id: 'abc',
        document_date: '2026-01-01',
        document_type: type,
        supplier_nif: '111111111',
        total_amount: 50.00,
      };
      expect(dbInvoiceToSaft(row, 0).invoiceType).toBe(type);
    });
  });
});

describe('dbSalesInvoiceToSaft', () => {
  it('converts DB sales row to SAF-T sales invoice', () => {
    const row: DbSalesInvoiceRow = {
      id: 'sale-123',
      document_number: 'FT A/100',
      document_date: '2026-03-01',
      customer_nif: '555666777',
      customer_name: 'Cliente Teste',
      total_amount: 246.00,
      total_vat: 46.00,
      base_standard: 200.00,
      vat_standard: 46.00,
    };

    const result = dbSalesInvoiceToSaft(row, 0);

    expect(result.invoiceNo).toBe('FT A/100');
    expect(result.customerNif).toBe('555666777');
    expect(result.customerName).toBe('Cliente Teste');
    expect(result.grossTotal).toBe(246.00);
    expect(result.netTotal).toBe(200.00);
    expect(result.taxPayable).toBe(46.00);
    expect(result.lines).toHaveLength(1);
  });

  it('defaults customer to Consumidor Final when NIF missing', () => {
    const row: DbSalesInvoiceRow = {
      id: 'sale-456',
      document_date: '2026-01-01',
      total_amount: 100.00,
    };

    const result = dbSalesInvoiceToSaft(row, 0);

    expect(result.customerNif).toBe('999999990');
    expect(result.customerName).toBe('Consumidor Final');
  });

  it('generates document number when missing', () => {
    const row: DbSalesInvoiceRow = {
      id: 'sale-789',
      document_date: '2026-01-01',
      total_amount: 100.00,
    };

    const result = dbSalesInvoiceToSaft(row, 2);
    expect(result.invoiceNo).toBe('VND-3');
  });
});
