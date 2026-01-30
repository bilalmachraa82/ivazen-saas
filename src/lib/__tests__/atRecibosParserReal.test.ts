/**
 * Tests for AT Recibos Parser with REAL data files from Adélia
 *
 * Test files used:
 * - ListaRecibos.xls - Rental receipts (Recibos Locatario) - 2025
 * - ListaRecibos-Renda.xls - Rental receipts - 2024
 * - ListaRecibos_1.xls - Rental receipts
 *
 * These are REAL files from AT Portal das Finanças in "Recibos locatario" format:
 * Columns: Referência, Nº de Contrato, Nº de Recibo, Locador, Locatário,
 *          Data de Início, Data de Fim, Data de Rec., Valor (€),
 *          Retenção IRS (€), Importância recebida (€), Imóvel, Estado
 */

import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the test file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to test files in project root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const LISTA_RECIBOS_PATH = path.join(PROJECT_ROOT, 'ListaRecibos.xls');
const LISTA_RENDA_PATH = path.join(PROJECT_ROOT, 'ListaRecibos-Renda.xls');
const LISTA_1_PATH = path.join(PROJECT_ROOT, 'ListaRecibos_1.xls');

/**
 * Helper to check if test files exist
 */
function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse an Excel file
 */
function readExcelFile(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return {
    workbook,
    sheet,
    sheetName,
    data: XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, defval: '' }),
  };
}

describe('Real AT Files Analysis', () => {
  const hasTestFiles = fileExists(LISTA_RECIBOS_PATH);

  it.skipIf(!hasTestFiles)('should read ListaRecibos.xls structure correctly', () => {
    const { data, sheetName } = readExcelFile(LISTA_RECIBOS_PATH);

    // Verify sheet name
    expect(sheetName).toBe('Recibos locatario');

    // Verify we have data
    expect(data.length).toBeGreaterThan(0);

    // Verify expected columns exist
    const firstRow = data[0];
    const headers = Object.keys(firstRow);

    expect(headers).toContain('Referência');
    expect(headers).toContain('Nº de Contrato');
    expect(headers).toContain('Nº de Recibo');
    expect(headers).toContain('Locador');
    expect(headers).toContain('Locatário');
    expect(headers).toContain('Valor (€)');
    expect(headers).toContain('Retenção IRS (€)');
    expect(headers).toContain('Importância recebida (€)');
  });

  it.skipIf(!hasTestFiles)('should parse monetary values correctly from ListaRecibos.xls', () => {
    const { data } = readExcelFile(LISTA_RECIBOS_PATH);

    // Check first record
    const firstRecord = data[0];

    // Valor should be numeric
    const valor = parseFloat(firstRecord['Valor (€)']);
    expect(valor).toBeGreaterThan(0);
    expect(valor).toBeCloseTo(1030.60, 2);

    // Retenção should be numeric
    const retencao = parseFloat(firstRecord['Retenção IRS (€)']);
    expect(retencao).toBeGreaterThan(0);
    expect(retencao).toBeCloseTo(257.65, 2);

    // Importância recebida (net)
    const liquido = parseFloat(firstRecord['Importância recebida (€)']);
    expect(liquido).toBeGreaterThan(0);
    expect(liquido).toBeCloseTo(772.95, 2);

    // Verify calculation: bruto - retenção = líquido
    expect(valor - retencao).toBeCloseTo(liquido, 2);
  });

  it.skipIf(!hasTestFiles)('should calculate effective retention rate', () => {
    const { data } = readExcelFile(LISTA_RECIBOS_PATH);

    // Calculate effective rate from first record
    const firstRecord = data[0];
    const valor = parseFloat(firstRecord['Valor (€)']);
    const retencao = parseFloat(firstRecord['Retenção IRS (€)']);

    const effectiveRate = retencao / valor;

    // Rentals should be at 25% (not 28% as we initially thought)
    // 257.65 / 1030.60 = 0.25 (25%)
    expect(effectiveRate).toBeCloseTo(0.25, 2);
  });

  it.skipIf(!hasTestFiles)('should aggregate totals from all records', () => {
    const { data } = readExcelFile(LISTA_RECIBOS_PATH);

    let totalBruto = 0;
    let totalRetencao = 0;
    let totalLiquido = 0;

    for (const record of data) {
      totalBruto += parseFloat(record['Valor (€)']) || 0;
      totalRetencao += parseFloat(record['Retenção IRS (€)']) || 0;
      totalLiquido += parseFloat(record['Importância recebida (€)']) || 0;
    }

    // Verify totals are consistent
    expect(totalBruto - totalRetencao).toBeCloseTo(totalLiquido, 0);

    // Log totals for reference
    console.log('ListaRecibos.xls totals:');
    console.log(`  Records: ${data.length}`);
    console.log(`  Total Bruto: ${totalBruto.toFixed(2)} EUR`);
    console.log(`  Total Retenção: ${totalRetencao.toFixed(2)} EUR`);
    console.log(`  Total Líquido: ${totalLiquido.toFixed(2)} EUR`);
  });

  it.skipIf(!hasTestFiles)('should detect Locador name for Modelo 10', () => {
    const { data } = readExcelFile(LISTA_RECIBOS_PATH);

    // Get unique Locador names
    const locadores = new Set<string>();
    for (const record of data) {
      const locador = (record['Locador'] || '').trim();
      if (locador) {
        locadores.add(locador);
      }
    }

    expect(locadores.size).toBeGreaterThan(0);

    // Log for reference
    console.log(`Unique Locadores: ${locadores.size}`);
    for (const loc of locadores) {
      console.log(`  - ${loc.substring(0, 60)}...`);
    }
  });
});

describe('ListaRecibos-Renda.xls Analysis', () => {
  const hasTestFiles = fileExists(LISTA_RENDA_PATH);

  it.skipIf(!hasTestFiles)('should read ListaRecibos-Renda.xls with same structure', () => {
    const { data, sheetName } = readExcelFile(LISTA_RENDA_PATH);

    // Same sheet name
    expect(sheetName).toBe('Recibos locatario');

    // Should have data
    expect(data.length).toBeGreaterThan(0);

    // Same columns
    const headers = Object.keys(data[0]);
    expect(headers).toContain('Valor (€)');
    expect(headers).toContain('Retenção IRS (€)');
  });

  it.skipIf(!hasTestFiles)('should have different dates (2024 data)', () => {
    const { data } = readExcelFile(LISTA_RENDA_PATH);

    // Check dates are from 2024
    const firstRecord = data[0];
    const dataInicio = firstRecord['Data de Início'] || '';

    // Should be 2024 or early 2025
    expect(dataInicio).toMatch(/202[45]/);
  });
});

describe('Parser Column Mapping', () => {
  it('should map new AT column names correctly', async () => {
    // Simulated headers from real AT file
    const realHeaders = [
      'Referência',
      'Nº de Contrato',
      'Nº de Recibo',
      'Locador',
      'Locatário',
      'Data de Início',
      'Data de Fim',
      'Data de Rec.',
      'Valor (€)',
      'Retenção IRS (€)',
      'Importância recebida (€)',
      'Imóvel',
      'Estado',
    ];

    // Import the parser's column mapping logic
    const { parseATExcel } = await import('../atRecibosParser');

    // Create a mock file with real structure
    const mockData = [
      {
        'Referência': '1633-B',
        'Nº de Contrato': '448126',
        'Nº de Recibo': '137',
        'Locador': 'RITA ANGELICA TEST',
        'Locatário': 'RBGRGS LDA',
        'Data de Início': '2026-01-01',
        'Data de Fim': '2026-01-31',
        'Data de Rec.': '2025-12-05',
        'Valor (€)': 1030.6,
        'Retenção IRS (€)': 257.65,
        'Importância recebida (€)': 772.95,
        'Imóvel': '110655-U-1633-B',
        'Estado': 'Emitido',
      },
    ];

    // Create worksheet from mock data
    const ws = XLSX.utils.json_to_sheet(mockData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recibos locatario');

    // Write to buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Create File object
    const file = new File([buffer], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Parse
    const result = await parseATExcel(file, { categoria: 'F_PREDIAIS' });

    expect(result.success).toBe(true);
    expect(result.records.length).toBe(1);

    const record = result.records[0];
    expect(record.valorBruto).toBeCloseTo(1030.6, 2);
    expect(record.retencao).toBeCloseTo(257.65, 2);
    expect(record.valorLiquido).toBeCloseTo(772.95, 2);
    expect(record.nomeEmitente).toBe('RITA ANGELICA TEST');
  });
});
