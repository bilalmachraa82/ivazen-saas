/**
 * e-Fatura CSV Parser
 * Parses CSV exports from Portal das Finanças (e-Fatura)
 * Supports the real portal format with specific column structure
 */

import { validatePortugueseNIF } from './nifValidator';

const validateNIF = (nif: string): boolean => validatePortugueseNIF(nif).valid;

export type EFaturaType = 'compras' | 'vendas';

export interface EFaturaRecord {
  nif: string;
  nome: string;
  data: Date;
  numeroDocumento: string;
  atcud: string;
  tipoDocumento: string;
  valorTotal: number;
  valorIva: number;
  baseTributavel: number;
  sector?: string;
  situacao?: string;
  rawLine?: string;
}

export interface EFaturaParseResult {
  success: boolean;
  type: EFaturaType;
  records: EFaturaRecord[];
  totals: {
    count: number;
    valorTotal: number;
    valorIva: number;
    baseTributavel: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * e-Fatura Portal format headers (exact match)
 * Setor;Emitente;Nº Fatura / ATCUD;Tipo;Data Emissão;Total;IVA;Base Tributável;Situação;...
 */
const EFATURA_PORTAL_HEADERS = [
  'setor', 'sector',
  'emitente',
  'nº fatura', 'n fatura', 'no fatura',
  'tipo',
  'data emissão', 'data emissao', 'data',
  'total',
  'iva',
  'base tributável', 'base tributavel'
];

/**
 * Detect if CSV is in e-Fatura Portal format
 */
function isEFaturaPortalFormat(headers: string[]): boolean {
  const headerLower = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
  const hasSetor = headerLower.some(h => h.includes('setor') || h.includes('sector'));
  const hasEmitente = headerLower.some(h => h.includes('emitente'));
  const hasTotal = headerLower.some(h => h === 'total');
  return hasSetor && hasEmitente && hasTotal;
}

/**
 * Extract NIF and name from "508332273 - M C D Garcia Lda" format
 */
function extractNifFromEmitente(emitente: string): { nif: string; nome: string } {
  if (!emitente) return { nif: '', nome: '' };
  
  const match = emitente.match(/^(\d{9})\s*-\s*(.+)$/);
  if (match) {
    return { nif: match[1], nome: match[2].trim() };
  }
  
  // Try to find NIF anywhere in string
  const nifMatch = emitente.match(/(\d{9})/);
  if (nifMatch) {
    const nif = nifMatch[1];
    const nome = emitente.replace(nif, '').replace(/^[\s\-]+|[\s\-]+$/g, '').trim();
    return { nif, nome };
  }
  
  return { nif: '', nome: emitente };
}

/**
 * Split document number and ATCUD from "FR 2.2025/20748 / JJ3JF3MS-20748" format
 */
function splitDocumentoATCUD(value: string): { documento: string; atcud: string } {
  if (!value) return { documento: '', atcud: '' };
  
  // Split by " / " (with spaces around slash)
  const parts = value.split(/\s+\/\s+/);
  return {
    documento: parts[0]?.trim() || '',
    atcud: parts[1]?.trim() || ''
  };
}

/**
 * Normalize date from Portuguese format DD/MM/YYYY
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const cleaned = dateStr.trim();
  
  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // YYYY-MM-DD (ISO)
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(cleaned);
  }
  
  return null;
}

/**
 * Parse currency value from Portuguese format "225,98 €"
 */
function parseValue(valueStr: string): number {
  if (!valueStr) return 0;
  
  const cleaned = valueStr
    .replace(/[€\s]/g, '')      // Remove € and spaces
    .replace(/\./g, '')          // Remove thousand separators (dots)
    .replace(',', '.');          // Convert decimal separator (comma to dot)
    
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : Math.abs(value);
}

/**
 * Find column index by possible header names (normalized)
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const headerNormalized = headers.map(h => 
    h.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Remove accents
      .trim()
  );
  
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const idx = headerNormalized.findIndex(h => h.includes(normalizedName));
    if (idx !== -1) return idx;
  }
  
  return -1;
}

/**
 * Parse e-Fatura CSV in Portal format
 */
function parseEFaturaPortalCSV(lines: string[], delimiter: string): EFaturaParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const records: EFaturaRecord[] = [];
  
  const headers = lines[0].split(delimiter).map(h => h.replace(/"/g, '').trim());
  
  // Column indices for Portal format
  const sectorCol = findColumnIndex(headers, ['setor', 'sector']);
  const emitenteCol = findColumnIndex(headers, ['emitente']);
  const faturaCol = findColumnIndex(headers, ['fatura', 'nº fatura', 'n fatura']);
  const tipoCol = findColumnIndex(headers, ['tipo']);
  const dataCol = findColumnIndex(headers, ['data emissão', 'data emissao', 'data']);
  const totalCol = findColumnIndex(headers, ['total']);
  const ivaCol = findColumnIndex(headers, ['iva']);
  const baseCol = findColumnIndex(headers, ['base tributável', 'base tributavel', 'base']);
  const situacaoCol = findColumnIndex(headers, ['situação', 'situacao']);
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const cols = line.split(delimiter).map(c => c.replace(/"/g, '').trim());
    
    // Extract NIF and name from Emitente column
    const emitenteValue = emitenteCol !== -1 ? cols[emitenteCol] : '';
    const { nif, nome } = extractNifFromEmitente(emitenteValue);
    
    // Extract documento and ATCUD
    const faturaValue = faturaCol !== -1 ? cols[faturaCol] : '';
    const { documento, atcud } = splitDocumentoATCUD(faturaValue);
    
    // Parse values
    const dataStr = dataCol !== -1 ? cols[dataCol] : '';
    const totalStr = totalCol !== -1 ? cols[totalCol] : '0';
    const ivaStr = ivaCol !== -1 ? cols[ivaCol] : '0';
    const baseStr = baseCol !== -1 ? cols[baseCol] : '0';
    
    // Skip empty rows
    if (!nif && !nome && !dataStr) continue;
    
    // Validate NIF
    if (nif && !validateNIF(nif)) {
      warnings.push(`Linha ${i + 1}: NIF inválido ${nif}`);
    }
    
    const data = parseDate(dataStr);
    if (!data && dataStr) {
      warnings.push(`Linha ${i + 1}: Data inválida ${dataStr}`);
    }
    
    const record: EFaturaRecord = {
      nif: nif || '',
      nome: nome || '',
      data: data || new Date(),
      numeroDocumento: documento,
      atcud: atcud,
      tipoDocumento: tipoCol !== -1 ? cols[tipoCol] || 'FT' : 'FT',
      valorTotal: parseValue(totalStr),
      valorIva: parseValue(ivaStr),
      baseTributavel: parseValue(baseStr),
      sector: sectorCol !== -1 ? cols[sectorCol] : undefined,
      situacao: situacaoCol !== -1 ? cols[situacaoCol] : undefined,
      rawLine: line
    };
    
    records.push(record);
  }
  
  // Calculate totals
  const totals = {
    count: records.length,
    valorTotal: records.reduce((sum, r) => sum + r.valorTotal, 0),
    valorIva: records.reduce((sum, r) => sum + r.valorIva, 0),
    baseTributavel: records.reduce((sum, r) => sum + r.baseTributavel, 0),
  };
  
  return {
    success: true,
    type: 'compras',
    records,
    totals,
    errors,
    warnings
  };
}

/**
 * Parse e-Fatura CSV content (auto-detect format)
 */
export function parseEFaturaCSV(content: string): EFaturaParseResult {
  const errors: string[] = [];
  
  // Split into lines and filter empty ones
  const lines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
    
  if (lines.length < 2) {
    return {
      success: false,
      type: 'compras',
      records: [],
      totals: { count: 0, valorTotal: 0, valorIva: 0, baseTributavel: 0 },
      errors: ['Ficheiro CSV vazio ou sem dados'],
      warnings: []
    };
  }
  
  // Detect delimiter (try ; then , then \t)
  let delimiter = ';';
  const headerLine = lines[0];
  if (headerLine.split(';').length < 3) {
    if (headerLine.split(',').length >= 3) {
      delimiter = ',';
    } else if (headerLine.split('\t').length >= 3) {
      delimiter = '\t';
    }
  }
  
  // Parse headers
  const headers = headerLine.split(delimiter).map(h => h.replace(/"/g, '').trim());
  
  // Check if it's the Portal format
  if (isEFaturaPortalFormat(headers)) {
    return parseEFaturaPortalCSV(lines, delimiter);
  }
  
  // Fallback to generic parsing (legacy support)
  return parseGenericCSV(lines, delimiter, headers);
}

/**
 * Generic CSV parser (fallback for other formats)
 */
function parseGenericCSV(lines: string[], delimiter: string, headers: string[]): EFaturaParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const records: EFaturaRecord[] = [];
  
  // Find column indices
  const nifCol = findColumnIndex(headers, ['nif emitente', 'nif do emitente', 'contribuinte', 'nif']);
  const nomeCol = findColumnIndex(headers, ['nome emitente', 'nome do emitente', 'designação', 'nome']);
  const dataCol = findColumnIndex(headers, ['data', 'data documento', 'data emissão']);
  const valorCol = findColumnIndex(headers, ['valor total', 'valor', 'total', 'montante']);
  const ivaCol = findColumnIndex(headers, ['iva', 'valor iva', 'imposto']);
  const docCol = findColumnIndex(headers, ['nº documento', 'número', 'documento']);
  const tipoCol = findColumnIndex(headers, ['tipo', 'tipo documento']);
  
  if (nifCol === -1 && valorCol === -1) {
    errors.push('Formato de ficheiro não reconhecido. Por favor use o export do Portal e-Fatura.');
    return {
      success: false,
      type: 'compras',
      records: [],
      totals: { count: 0, valorTotal: 0, valorIva: 0, baseTributavel: 0 },
      errors,
      warnings
    };
  }
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(delimiter).map(c => c.replace(/"/g, '').trim());
    
    const nif = nifCol !== -1 ? cols[nifCol]?.replace(/\s/g, '') : '';
    const nome = nomeCol !== -1 ? cols[nomeCol] : '';
    const dataStr = dataCol !== -1 ? cols[dataCol] : '';
    const valorStr = valorCol !== -1 ? cols[valorCol] : '0';
    const ivaStr = ivaCol !== -1 ? cols[ivaCol] : '0';
    
    if (!nif && !nome && !dataStr) continue;
    
    if (nif && !validateNIF(nif)) {
      warnings.push(`Linha ${i + 1}: NIF inválido ${nif}`);
    }
    
    const data = parseDate(dataStr);
    
    const valorTotal = parseValue(valorStr);
    const valorIva = parseValue(ivaStr);
    
    records.push({
      nif: nif || '',
      nome: nome || '',
      data: data || new Date(),
      numeroDocumento: docCol !== -1 ? cols[docCol] || '' : '',
      atcud: '',
      tipoDocumento: tipoCol !== -1 ? cols[tipoCol] || 'FT' : 'FT',
      valorTotal,
      valorIva,
      baseTributavel: valorTotal - valorIva,
      rawLine: line
    });
  }
  
  return {
    success: true,
    type: 'compras',
    records,
    totals: {
      count: records.length,
      valorTotal: records.reduce((sum, r) => sum + r.valorTotal, 0),
      valorIva: records.reduce((sum, r) => sum + r.valorIva, 0),
      baseTributavel: records.reduce((sum, r) => sum + r.baseTributavel, 0),
    },
    errors,
    warnings
  };
}

/**
 * Read file and parse e-Fatura CSV
 */
export async function parseEFaturaFile(file: File): Promise<EFaturaParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(parseEFaturaCSV(content));
    };
    
    reader.onerror = () => {
      resolve({
        success: false,
        type: 'compras',
        records: [],
        totals: { count: 0, valorTotal: 0, valorIva: 0, baseTributavel: 0 },
        errors: ['Erro ao ler ficheiro'],
        warnings: []
      });
    };
    
    // Try UTF-8 first, then Latin-1 for Portuguese encoding
    reader.readAsText(file, 'UTF-8');
  });
}
