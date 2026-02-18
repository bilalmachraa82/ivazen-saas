import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildDPExportData, generateDPExcel, type InvoiceRecord, type SalesInvoiceRecord } from '../dpExcelGenerator';

function sheetToRows(ws: XLSX.WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
}

function findRow(rows: any[][], firstCell: string): any[] | undefined {
  return rows.find(r => r && r.length > 0 && r[0] === firstCell);
}

function findRowIndex(rows: any[][], firstCell: string): number {
  return rows.findIndex(r => r && r.length > 0 && r[0] === firstCell);
}

describe('dpExcelGenerator Detalhe sheet', () => {
  it('writes regularizacoes totals (instead of hardcoded zeros)', () => {
    const meses = ['2025-07', '2025-08', '2025-09'];
    const compras: InvoiceRecord[] = [];

    const data = buildDPExportData(
      'Cliente X',
      '3º trimestre 2025',
      meses,
      compras,
      [],
      0,
      0.27, // regFavorEstado
      0, // regSujeitoPassivo
    );

    const wb = generateDPExcel(data);
    const ws = wb.Sheets['Detalhe'];
    expect(ws).toBeTruthy();

    const rows = sheetToRows(ws!);

    const regFavor = findRow(rows, 'Regulariz favor estado');
    expect(regFavor).toBeTruthy();
    expect(regFavor![regFavor!.length - 1]).toBe(0.27);

    const regSuj = findRow(rows, 'Regulariz Sujeito Passivo');
    expect(regSuj).toBeTruthy();
    expect(regSuj![regSuj!.length - 1]).toBe(0);
  });

  it('writes aquis intracom IVA by month + total', () => {
    const meses = ['2025-07', '2025-08', '2025-09'];
    const compras: InvoiceRecord[] = [
      {
        supplier_nif: 'IE3668997OH',
        supplier_name: 'Google Ireland',
        document_date: '2025-07-02',
        fiscal_period: '202507',
        base_standard: 0,
        base_intermediate: 0,
        base_reduced: 0,
        base_exempt: 0,
        vat_standard: 0,
        vat_intermediate: 0,
        vat_reduced: 0,
        total_vat: 1.0,
        total_amount: 10.0,
        final_dp_field: 10,
        final_deductibility: 100,
        ai_dp_field: 10,
        ai_deductibility: 100,
      },
      {
        supplier_nif: 'IE3668997OH',
        supplier_name: 'Google Ireland',
        document_date: '2025-08-02',
        fiscal_period: '202508',
        base_standard: 0,
        base_intermediate: 0,
        base_reduced: 0,
        base_exempt: 0,
        vat_standard: 0,
        vat_intermediate: 0,
        vat_reduced: 0,
        total_vat: 2.5,
        total_amount: 20.0,
        final_dp_field: 10,
        final_deductibility: 100,
        ai_dp_field: 10,
        ai_deductibility: 100,
      },
    ];

    const data = buildDPExportData(
      'Cliente X',
      '3º trimestre 2025',
      meses,
      compras,
      [],
      0,
      0,
      0,
    );

    const wb = generateDPExcel(data);
    const ws = wb.Sheets['Detalhe'];
    expect(ws).toBeTruthy();

    const rows = sheetToRows(ws!);
    const intracom = findRow(rows, 'Aquis Intracomun');
    expect(intracom).toBeTruthy();

    // Format: [label, Jul, Ago, Set, Total]
    expect(intracom![1]).toBe(1.0);
    expect(intracom![2]).toBe(2.5);
    expect(intracom![3]).toBe(0);
    expect(intracom![4]).toBe(3.5);
  });

  it('writes VENDAS monthly grid with bases/IVA by rate + isentas', () => {
    const meses = ['2025-07', '2025-08', '2025-09'];
    const compras: InvoiceRecord[] = [];
    const vendas: SalesInvoiceRecord[] = [
      {
        document_date: '2025-07-10',
        fiscal_period: '202507',
        document_number: 'FT 1',
        document_type: 'FT',
        customer_nif: '123456789',
        customer_name: 'Cliente A',
        base_standard: 100,
        base_intermediate: 0,
        base_reduced: 0,
        base_exempt: 0,
        vat_standard: 23,
        vat_intermediate: 0,
        vat_reduced: 0,
        total_vat: 23,
        total_amount: 123,
      },
      {
        document_date: '2025-08-05',
        fiscal_period: '202508',
        document_number: 'FT 2',
        document_type: 'FT',
        customer_nif: '987654321',
        customer_name: 'Cliente B',
        base_standard: 0,
        base_intermediate: 0,
        base_reduced: 0,
        base_exempt: 50,
        vat_standard: 0,
        vat_intermediate: 0,
        vat_reduced: 0,
        total_vat: 0,
        total_amount: 50,
      },
    ];

    const data = buildDPExportData('Cliente X', '3º trimestre 2025', meses, compras, vendas);
    const wb = generateDPExcel(data);
    const ws = wb.Sheets['Detalhe'];
    expect(ws).toBeTruthy();

    const rows = sheetToRows(ws!);
    const vendasIdx = findRowIndex(rows, 'VENDAS');
    expect(vendasIdx).toBeGreaterThan(-1);

    const header = rows[vendasIdx + 1];
    expect(header.slice(0, 5)).toEqual(['', 'Base 6%', 'IVA 6%', 'Base 13%', 'IVA 13%']);

    const julRow = rows[vendasIdx + 2];
    expect(julRow[0]).toBe('Jul');
    expect(julRow[5]).toBe(100);
    expect(julRow[6]).toBe(23);
    expect(julRow[7]).toBe(0);

    const agoRow = rows[vendasIdx + 3];
    expect(agoRow[0]).toBe('Ago');
    expect(agoRow[7]).toBe(50);
  });
});

describe('dpExcelGenerator workbook sheets', () => {
  it('includes Lista Vendas sheet with customer/document columns', () => {
    const meses = ['2025-07'];
    const compras: InvoiceRecord[] = [];
    const vendas: SalesInvoiceRecord[] = [
      {
        document_date: '2025-07-10',
        fiscal_period: '202507',
        document_number: 'FT 1',
        document_type: 'FT',
        customer_nif: '123456789',
        customer_name: 'Cliente A',
        base_standard: 100,
        base_intermediate: 0,
        base_reduced: 0,
        base_exempt: 0,
        vat_standard: 23,
        vat_intermediate: 0,
        vat_reduced: 0,
        total_vat: 23,
        total_amount: 123,
      },
    ];

    const data = buildDPExportData('Cliente X', 'Julho 2025', meses, compras, vendas);
    const wb = generateDPExcel(data);
    const ws = wb.Sheets['Lista Vendas'];
    expect(ws).toBeTruthy();

    const rows = sheetToRows(ws!);
    expect(rows[0].slice(0, 6)).toEqual(['Data', 'NIF Cliente', 'Nome Cliente', 'Nº Documento', 'Tipo', 'Base 23%']);
    expect(rows[1][1]).toBe('123456789');
    expect(rows[1][2]).toBe('Cliente A');
    expect(rows[1][3]).toBe('FT 1');
  });
});
