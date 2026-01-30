/**
 * Recibo Verde Parser
 * Parses Recibos Verdes (Green Receipts) from AT Portal das Finanças
 *
 * AT Export Format:
 * - First line: Header with column names
 * - Penultimate line: Totals row (important for validation)
 * - Last line: May be empty or contain footer
 *
 * Columns typically include:
 * - NIF Emitente, Nome Emitente
 * - NIF Adquirente, Nome Adquirente
 * - Nº Recibo, Data
 * - Valor Bruto, Retenção, Valor Líquido
 * - Descrição dos Serviços
 */

import * as XLSX from 'xlsx';
import { validatePortugueseNIF } from './nifValidator';
import { ATCategoria, TAXAS_RETENCAO } from './atRecibosParser';

// ============ TYPES ============

export interface ReciboVerdeRecord {
  id: string;
  numeroRecibo: string;
  dataEmissao: Date;
  nifEmitente: string;
  nomeEmitente: string;
  nifAdquirente: string;
  nomeAdquirente: string;
  descricao: string;
  valorBruto: number;
  retencao: number;
  taxaRetencao: number;
  valorLiquido: number;
  iva: number;
  taxaIVA: number;
  atividadeProfissional: string;
  categoria: ATCategoria;
  linha: number;
  ficheiro: string;
  warnings: string[];
}

export interface ReciboVerdeParseResult {
  success: boolean;
  records: ReciboVerdeRecord[];
  totals: ReciboVerdeTotals;
  errors: string[];
  warnings: string[];
  metadata: {
    primeiraLinha: string[];
    penultimaLinha: string[];
    totalLinhas: number;
  };
}

export interface ReciboVerdeTotals {
  totalRecibos: number;
  totalBruto: number;
  totalRetencao: number;
  totalLiquido: number;
  totalIVA: number;
  validado: boolean;
  diferencaBruto: number;
  diferencaRetencao: number;
}

// ============ COLUMN MAPPINGS ============

const COLUMN_MAPPINGS = {
  numeroRecibo: [
    'Nº Recibo', 'N.º Recibo', 'Número Recibo', 'Numero Recibo',
    'Recibo', 'Nº', 'N.º', 'Número', 'Numero',
  ],
  dataEmissao: [
    'Data', 'Data Emissão', 'Data de Emissão', 'Dt. Emissão',
    'Data Recibo', 'Data do Recibo',
  ],
  nifEmitente: [
    'NIF Emitente', 'NIF Prestador', 'NIF', 'Contribuinte Emitente',
  ],
  nomeEmitente: [
    'Nome Emitente', 'Emitente', 'Prestador', 'Nome Prestador',
  ],
  nifAdquirente: [
    'NIF Adquirente', 'NIF Cliente', 'NIF Destinatário', 'Contribuinte Adquirente',
  ],
  nomeAdquirente: [
    'Nome Adquirente', 'Adquirente', 'Cliente', 'Destinatário', 'Nome Cliente',
  ],
  descricao: [
    'Descrição', 'Descricao', 'Descrição dos Serviços', 'Serviços',
    'Descrição Serviço', 'Obs', 'Observações',
  ],
  valorBruto: [
    'Valor Bruto', 'Importância', 'Valor', 'Montante', 'Total Bruto',
    'Valor Base', 'Base Tributável',
  ],
  retencao: [
    'Retenção', 'Retencao', 'Retenção IRS', 'IRS', 'Valor Retido',
    'Retenção na Fonte', 'Ret. Fonte',
  ],
  valorLiquido: [
    'Valor Líquido', 'Liquido', 'Líquido', 'A Receber', 'Total Líquido',
  ],
  iva: [
    'IVA', 'Imposto', 'Valor IVA', 'IVA Liquidado',
  ],
  taxaIVA: [
    'Taxa IVA', '% IVA', 'Taxa', 'Percentagem IVA',
  ],
  atividade: [
    'Actividade', 'Atividade', 'Act. Prof.', 'Actividade Profissional',
    'CAE', 'Código Actividade',
  ],
};

// ============ MAIN PARSER ============

/**
 * Parse Recibos Verdes Excel file from AT
 * Uses the 1st line (header) and penultimate line (totals) for validation
 */
export async function parseRecibosVerdesExcel(
  file: File,
  options: {
    ano?: number;
    validarTotais?: boolean;
  } = {}
): Promise<ReciboVerdeParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const records: ReciboVerdeRecord[] = [];

  try {
    // Read file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return createEmptyResult('Ficheiro Excel vazio ou sem folhas');
    }

    const sheet = workbook.Sheets[sheetName];

    // Get raw data as 2D array to access first and penultimate lines
    const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    if (rawData.length < 2) {
      return createEmptyResult('Ficheiro Excel sem dados suficientes');
    }

    // Get first line (headers)
    const headerRow = rawData[0] as string[];
    const primeiraLinha = headerRow;

    // Get penultimate line (totals) - skip last line which may be empty
    let penultimaIndex = rawData.length - 2;
    while (penultimaIndex > 0 && isEmptyRow(rawData[penultimaIndex])) {
      penultimaIndex--;
    }
    const penultimaLinha = rawData[penultimaIndex] as string[];

    // Map columns
    const columnMap = mapColumns(headerRow);

    // Parse data rows (skip header, skip totals row at end)
    const dataEndIndex = penultimaIndex;
    for (let i = 1; i < dataEndIndex; i++) {
      const row = rawData[i] as any[];
      if (isEmptyRow(row)) continue;

      try {
        const record = parseRow(row, i + 1, headerRow, columnMap, file.name, options.ano);
        if (record) {
          records.push(record);
          if (record.warnings.length > 0) {
            warnings.push(...record.warnings.map(w => `Linha ${i + 1}: ${w}`));
          }
        }
      } catch (err: any) {
        errors.push(`Linha ${i + 1}: ${err.message}`);
      }
    }

    // Calculate totals from records
    const calculatedTotals = calculateTotals(records);

    // Extract totals from penultimate line
    const fileTotals = extractTotals(penultimaLinha, headerRow, columnMap);

    // Validate totals match (if validation enabled)
    const totalsValidation = options.validarTotais !== false
      ? validateTotals(calculatedTotals, fileTotals)
      : { validado: true, diferencaBruto: 0, diferencaRetencao: 0 };

    if (!totalsValidation.validado) {
      warnings.push(`Totais não coincidem: Bruto (diff: €${totalsValidation.diferencaBruto.toFixed(2)}), Retenção (diff: €${totalsValidation.diferencaRetencao.toFixed(2)})`);
    }

    return {
      success: records.length > 0,
      records,
      totals: {
        totalRecibos: records.length,
        totalBruto: calculatedTotals.bruto,
        totalRetencao: calculatedTotals.retencao,
        totalLiquido: calculatedTotals.liquido,
        totalIVA: calculatedTotals.iva,
        ...totalsValidation,
      },
      errors,
      warnings,
      metadata: {
        primeiraLinha,
        penultimaLinha,
        totalLinhas: rawData.length,
      },
    };

  } catch (err: any) {
    return createEmptyResult(`Erro ao processar ficheiro: ${err.message}`);
  }
}

/**
 * Parse Recibos Verdes from text content (email body, plain text)
 * Extracts data from first line and penultimate line
 */
export function parseRecibosVerdesText(
  text: string,
  options: { ano?: number } = {}
): ReciboVerdeParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const records: ReciboVerdeRecord[] = [];

  try {
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      return createEmptyResult('Texto sem linhas suficientes');
    }

    // First line
    const primeiraLinha = lines[0].split(/\t|;|,/).map(s => s.trim());

    // Penultimate line
    const penultimaLinha = lines[lines.length - 2]?.split(/\t|;|,/).map(s => s.trim()) || [];

    // Try to parse each line as a record
    const columnMap = mapColumns(primeiraLinha);

    for (let i = 1; i < lines.length - 1; i++) {
      const row = lines[i].split(/\t|;|,/).map(s => s.trim());
      if (row.length < 3) continue;

      try {
        const record = parseRow(row, i + 1, primeiraLinha, columnMap, 'text', options.ano);
        if (record) {
          records.push(record);
        }
      } catch (err: any) {
        errors.push(`Linha ${i + 1}: ${err.message}`);
      }
    }

    const calculatedTotals = calculateTotals(records);

    return {
      success: records.length > 0,
      records,
      totals: {
        totalRecibos: records.length,
        totalBruto: calculatedTotals.bruto,
        totalRetencao: calculatedTotals.retencao,
        totalLiquido: calculatedTotals.liquido,
        totalIVA: calculatedTotals.iva,
        validado: true,
        diferencaBruto: 0,
        diferencaRetencao: 0,
      },
      errors,
      warnings,
      metadata: {
        primeiraLinha,
        penultimaLinha,
        totalLinhas: lines.length,
      },
    };

  } catch (err: any) {
    return createEmptyResult(`Erro ao processar texto: ${err.message}`);
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Map column headers to standard names
 */
function mapColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};

  for (const [key, variations] of Object.entries(COLUMN_MAPPINGS)) {
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || '').toLowerCase().trim();
      for (const variation of variations) {
        if (header === variation.toLowerCase() || header.includes(variation.toLowerCase())) {
          map[key] = i;
          break;
        }
      }
      if (map[key] !== undefined) break;
    }
  }

  return map;
}

/**
 * Parse a single row
 */
function parseRow(
  row: any[],
  rowNum: number,
  headers: string[],
  columnMap: Record<string, number>,
  filename: string,
  ano?: number
): ReciboVerdeRecord | null {
  const warnings: string[] = [];

  const getValue = (key: string): string => {
    const idx = columnMap[key];
    if (idx === undefined || idx >= row.length) return '';
    return String(row[idx] || '').trim();
  };

  // Get basic fields
  const numeroRecibo = getValue('numeroRecibo');
  const nifEmitente = extractNIF(getValue('nifEmitente'));
  const nomeEmitente = getValue('nomeEmitente');
  const nifAdquirente = extractNIF(getValue('nifAdquirente'));
  const nomeAdquirente = getValue('nomeAdquirente');
  const descricao = getValue('descricao');
  const atividade = getValue('atividade');

  // Skip rows without essential data
  if (!numeroRecibo && !nifEmitente && !nomeEmitente) {
    return null;
  }

  // Parse date
  const dataEmissao = parseDate(getValue('dataEmissao'));
  if (!dataEmissao) {
    warnings.push('Data de emissão inválida ou não encontrada');
  }

  // Filter by year if specified
  if (ano && dataEmissao && dataEmissao.getFullYear() !== ano) {
    return null;
  }

  // Validate NIFs
  if (nifEmitente && !validatePortugueseNIF(nifEmitente).valid) {
    warnings.push(`NIF emitente inválido: ${nifEmitente}`);
  }
  if (nifAdquirente && !validatePortugueseNIF(nifAdquirente).valid) {
    warnings.push(`NIF adquirente inválido: ${nifAdquirente}`);
  }

  // Parse amounts
  const valorBruto = parseAmount(getValue('valorBruto'));
  let retencao = parseAmount(getValue('retencao'));
  let valorLiquido = parseAmount(getValue('valorLiquido'));
  const iva = parseAmount(getValue('iva'));
  const taxaIVA = parseAmount(getValue('taxaIVA'));

  // Calculate missing values
  if (valorBruto > 0 && retencao === 0 && valorLiquido > 0) {
    retencao = valorBruto - valorLiquido;
  }
  if (valorBruto > 0 && valorLiquido === 0) {
    valorLiquido = valorBruto - retencao;
  }

  // Calculate tax rate
  const taxaRetencao = valorBruto > 0 ? retencao / valorBruto : TAXAS_RETENCAO.B_INDEPENDENTES;

  // Validate rate is reasonable (should be around 23% for 2026)
  if (valorBruto > 0 && (taxaRetencao < 0.10 || taxaRetencao > 0.30)) {
    warnings.push(`Taxa de retenção fora do normal: ${(taxaRetencao * 100).toFixed(1)}%`);
  }

  return {
    id: `${filename}-${rowNum}`,
    numeroRecibo,
    dataEmissao: dataEmissao || new Date(),
    nifEmitente,
    nomeEmitente,
    nifAdquirente,
    nomeAdquirente,
    descricao: descricao.substring(0, 500),
    valorBruto,
    retencao,
    taxaRetencao,
    valorLiquido,
    iva,
    taxaIVA: taxaIVA || (iva > 0 && valorBruto > 0 ? iva / valorBruto : 0),
    atividadeProfissional: atividade,
    categoria: 'B_INDEPENDENTES',
    linha: rowNum,
    ficheiro: filename,
    warnings,
  };
}

/**
 * Extract NIF from value
 */
function extractNIF(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 9) {
    return digits;
  }
  if (digits.length > 9) {
    return digits.substring(0, 9);
  }
  return digits;
}

/**
 * Parse date from various formats
 */
function parseDate(value: string | Date | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date;
  }

  // Try Portuguese format (DD-MM-YYYY or DD/MM/YYYY)
  const ptMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (ptMatch) {
    const [, day, month, year] = ptMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Parse amount from Portuguese format
 */
function parseAmount(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;

  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  let str = String(value).trim();
  if (!str) return 0;

  // Remove currency symbols
  str = str.replace(/[€$\s]/g, '');

  // Handle Portuguese format
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }

  const amount = parseFloat(str);
  return isNaN(amount) ? 0 : Math.abs(amount);
}

/**
 * Check if row is empty
 */
function isEmptyRow(row: any[]): boolean {
  if (!row || !Array.isArray(row)) return true;
  return row.every(cell => !cell || String(cell).trim() === '');
}

/**
 * Calculate totals from records
 */
function calculateTotals(records: ReciboVerdeRecord[]): {
  bruto: number;
  retencao: number;
  liquido: number;
  iva: number;
} {
  let bruto = 0;
  let retencao = 0;
  let liquido = 0;
  let iva = 0;

  for (const record of records) {
    bruto += record.valorBruto;
    retencao += record.retencao;
    liquido += record.valorLiquido;
    iva += record.iva;
  }

  return { bruto, retencao, liquido, iva };
}

/**
 * Extract totals from penultimate line
 */
function extractTotals(
  row: string[],
  headers: string[],
  columnMap: Record<string, number>
): { bruto: number; retencao: number; liquido: number; iva: number } {
  const getValue = (key: string): number => {
    const idx = columnMap[key];
    if (idx === undefined || idx >= row.length) return 0;
    return parseAmount(row[idx]);
  };

  return {
    bruto: getValue('valorBruto'),
    retencao: getValue('retencao'),
    liquido: getValue('valorLiquido'),
    iva: getValue('iva'),
  };
}

/**
 * Validate calculated totals match file totals
 */
function validateTotals(
  calculated: { bruto: number; retencao: number; liquido: number; iva: number },
  fileTotals: { bruto: number; retencao: number; liquido: number; iva: number }
): { validado: boolean; diferencaBruto: number; diferencaRetencao: number } {
  const tolerance = 0.01; // Allow 1 cent difference

  const diferencaBruto = Math.abs(calculated.bruto - fileTotals.bruto);
  const diferencaRetencao = Math.abs(calculated.retencao - fileTotals.retencao);

  const validado = diferencaBruto <= tolerance && diferencaRetencao <= tolerance;

  return { validado, diferencaBruto, diferencaRetencao };
}

/**
 * Create empty result with error
 */
function createEmptyResult(error: string): ReciboVerdeParseResult {
  return {
    success: false,
    records: [],
    totals: {
      totalRecibos: 0,
      totalBruto: 0,
      totalRetencao: 0,
      totalLiquido: 0,
      totalIVA: 0,
      validado: false,
      diferencaBruto: 0,
      diferencaRetencao: 0,
    },
    errors: [error],
    warnings: [],
    metadata: {
      primeiraLinha: [],
      penultimaLinha: [],
      totalLinhas: 0,
    },
  };
}

// ============ CONVERSION FUNCTIONS ============

/**
 * Convert Recibos Verdes to Modelo 10 format
 */
export function convertToModelo10(
  records: ReciboVerdeRecord[],
  regiaoFiscal: string = 'C'
): Array<{
  beneficiary_nif: string;
  beneficiary_name: string;
  income_category: string;
  gross_amount: number;
  withholding_amount: number;
  withholding_rate: number;
  fiscal_region: string;
}> {
  // Group by adquirente NIF
  const byNIF = new Map<string, {
    nif: string;
    nome: string;
    totalBruto: number;
    totalRetencao: number;
    count: number;
  }>();

  for (const record of records) {
    const key = record.nifAdquirente || record.nifEmitente;
    if (!key) continue;

    if (!byNIF.has(key)) {
      byNIF.set(key, {
        nif: key,
        nome: record.nomeAdquirente || record.nomeEmitente,
        totalBruto: 0,
        totalRetencao: 0,
        count: 0,
      });
    }

    const entry = byNIF.get(key)!;
    entry.totalBruto += record.valorBruto;
    entry.totalRetencao += record.retencao;
    entry.count += 1;
  }

  // Convert to Modelo 10 format
  const results: Array<{
    beneficiary_nif: string;
    beneficiary_name: string;
    income_category: string;
    gross_amount: number;
    withholding_amount: number;
    withholding_rate: number;
    fiscal_region: string;
  }> = [];

  for (const [, data] of byNIF) {
    if (!validatePortugueseNIF(data.nif).valid) continue;

    results.push({
      beneficiary_nif: data.nif,
      beneficiary_name: data.nome,
      income_category: 'B',
      gross_amount: Math.round(data.totalBruto * 100) / 100,
      withholding_amount: Math.round(data.totalRetencao * 100) / 100,
      withholding_rate: data.totalBruto > 0
        ? Math.round((data.totalRetencao / data.totalBruto) * 10000) / 100
        : 23,
      fiscal_region: regiaoFiscal,
    });
  }

  return results.sort((a, b) => a.beneficiary_nif.localeCompare(b.beneficiary_nif));
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

/**
 * Generate summary report
 */
export function generateRecibosSummary(result: ReciboVerdeParseResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('RESUMO RECIBOS VERDES');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Total de Recibos: ${result.totals.totalRecibos}`);
  lines.push(`Valor Bruto Total: ${formatCurrency(result.totals.totalBruto)}`);
  lines.push(`Retenção Total: ${formatCurrency(result.totals.totalRetencao)}`);
  lines.push(`Valor Líquido Total: ${formatCurrency(result.totals.totalLiquido)}`);

  if (result.totals.totalIVA > 0) {
    lines.push(`IVA Total: ${formatCurrency(result.totals.totalIVA)}`);
  }

  lines.push('');
  lines.push(`Validação de Totais: ${result.totals.validado ? '✓ OK' : '✗ DIFERENÇAS'}`);

  if (!result.totals.validado) {
    lines.push(`  Diferença Bruto: ${formatCurrency(result.totals.diferencaBruto)}`);
    lines.push(`  Diferença Retenção: ${formatCurrency(result.totals.diferencaRetencao)}`);
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('AVISOS:');
    for (const warning of result.warnings.slice(0, 10)) {
      lines.push(`  • ${warning}`);
    }
  }

  return lines.join('\n');
}
