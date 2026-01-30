/**
 * Invoice System Parser
 * Parses invoices from Portuguese billing systems (Moloni, InvoiceXpress, PHC, Primavera, etc.)
 *
 * Supports:
 * - Excel exports from billing systems
 * - CSV exports
 * - Keyword detection for category classification
 * - NIF extraction and validation
 * - Automatic rate detection based on document type
 */

import * as XLSX from 'xlsx';
import { validatePortugueseNIF } from './nifValidator';
import { ATCategoria, TAXAS_RETENCAO } from './atRecibosParser';

// ============ TYPES ============

export interface InvoiceRecord {
  id: string;
  numeroDocumento: string;      // Invoice/document number
  tipoDocumento: string;        // Invoice, Receipt, etc.
  dataEmissao: Date;            // Issue date
  dataVencimento: Date | null;  // Due date
  nifEmitente: string;          // Issuer NIF
  nomeEmitente: string;         // Issuer name
  nifCliente: string;           // Client NIF
  nomeCliente: string;          // Client name
  descricao: string;            // Description
  valorBruto: number;           // Gross amount
  iva: number;                  // VAT amount
  retencao: number;             // Withholding amount
  taxaRetencao: number;         // Withholding rate
  valorLiquido: number;         // Net amount
  categoria: ATCategoria;       // Detected category
  sistemaOrigem: string;        // Source billing system
  keywords: string[];           // Detected keywords
  confianca: number;            // Detection confidence (0-100)
  linha: number;                // Original row number
  ficheiro: string;             // Source filename
  warnings: string[];           // Parsing warnings
}

export interface InvoiceParseResult {
  success: boolean;
  records: InvoiceRecord[];
  errors: string[];
  warnings: string[];
  summary: InvoiceSummary;
  sistemaDetectado: string;
}

export interface InvoiceSummary {
  totalRecords: number;
  totalBruto: number;
  totalIVA: number;
  totalRetencao: number;
  totalLiquido: number;
  byNIF: Map<string, InvoiceNIFSummary>;
  byCategoria: Map<ATCategoria, number>;
  bySistema: Map<string, number>;
}

export interface InvoiceNIFSummary {
  nif: string;
  nome: string;
  categoria: ATCategoria;
  totalBruto: number;
  totalRetencao: number;
  totalLiquido: number;
  numDocumentos: number;
  records: InvoiceRecord[];
}

// ============ KEYWORD DETECTION ============

/**
 * Keywords for detecting Category B (Trabalho Independente)
 */
const KEYWORDS_CATEGORIA_B: string[] = [
  // Services
  'serviços', 'servicos', 'prestação de serviços', 'prestacao de servicos',
  'consultoria', 'consulting', 'assessoria', 'apoio técnico',
  'honorários', 'honorarios', 'avença', 'trabalho independente',
  // Professions
  'advogado', 'médico', 'medico', 'engenheiro', 'arquiteto', 'contabilista',
  'designer', 'programador', 'desenvolvedor', 'consultor', 'formador',
  'técnico', 'tecnico', 'especialista', 'freelancer', 'freelance',
  // Documents
  'recibo verde', 'recibo de prestação', 'fatura-recibo', 'fatura recibo',
  'nota de honorários', 'nota de honorarios',
  // Actions
  'formação', 'formacao', 'projeto', 'desenvolvimento', 'implementação',
  'análise', 'analise', 'auditoria', 'parecer', 'relatório', 'relatorio',
];

/**
 * Keywords for detecting Category F (Rendimentos Prediais)
 */
const KEYWORDS_CATEGORIA_F: string[] = [
  // Rental
  'renda', 'rendas', 'arrendamento', 'aluguer', 'locação', 'locacao',
  'aluguel', 'inquilino', 'senhorio', 'locador', 'locatário', 'locatario',
  // Property
  'imóvel', 'imovel', 'apartamento', 'moradia', 'fração', 'fracao',
  'habitação', 'habitacao', 'loja', 'escritório', 'escritorio', 'armazém',
  // Documents
  'recibo de renda', 'recibo de arrendamento', 'contrato de arrendamento',
  // Property types
  'predial', 'prédio', 'predio', 'propriedade', 'imobiliário', 'imobiliario',
];

/**
 * Keywords for detecting Category E (Rendimentos de Capitais)
 */
const KEYWORDS_CATEGORIA_E: string[] = [
  'dividendo', 'dividendos', 'juros', 'lucros', 'capital', 'ações', 'acoes',
  'participações', 'participacoes', 'rendimento de capitais', 'distribuição de lucros',
  'suprimentos', 'mútuos', 'mutuos', 'empréstimo', 'emprestimo',
];

/**
 * Keywords for detecting Category H (Pensões)
 */
const KEYWORDS_CATEGORIA_H: string[] = [
  'pensão', 'pensao', 'pensões', 'pensoes', 'reforma', 'aposentação',
  'aposentadoria', 'invalidez', 'sobrevivência', 'alimentos',
];

// ============ BILLING SYSTEM DETECTION ============

interface BillingSystemSignature {
  name: string;
  keywords: string[];
  columnPatterns: string[];
}

const BILLING_SYSTEMS: BillingSystemSignature[] = [
  {
    name: 'Moloni',
    keywords: ['moloni', 'moloniinvoice'],
    columnPatterns: ['Número', 'Cliente', 'NIF Cliente', 'Total', 'Estado'],
  },
  {
    name: 'InvoiceXpress',
    keywords: ['invoicexpress', 'invoice xpress'],
    columnPatterns: ['Document Number', 'Client', 'Total', 'Status'],
  },
  {
    name: 'PHC',
    keywords: ['phc', 'phc software'],
    columnPatterns: ['Nº Doc', 'Entidade', 'Contribuinte', 'Valor'],
  },
  {
    name: 'Primavera',
    keywords: ['primavera', 'primavera bss'],
    columnPatterns: ['Documento', 'Terceiro', 'NIF', 'Total Documento'],
  },
  {
    name: 'Sage',
    keywords: ['sage', 'sage 50'],
    columnPatterns: ['Invoice No', 'Customer', 'VAT No', 'Gross'],
  },
  {
    name: 'Cegid',
    keywords: ['cegid', 'cegid erp'],
    columnPatterns: ['Factura', 'Cliente', 'NIF', 'Montante'],
  },
  {
    name: 'Eticadata',
    keywords: ['eticadata', 'etica'],
    columnPatterns: ['Nº Documento', 'Nome', 'Contribuinte', 'Total'],
  },
  {
    name: 'Artsoft',
    keywords: ['artsoft'],
    columnPatterns: ['Nr. Doc', 'Entidade', 'Cont.', 'Valor Total'],
  },
  {
    name: 'Wintouch',
    keywords: ['wintouch'],
    columnPatterns: ['Nº Factura', 'Cliente', 'NIF', 'Total'],
  },
  {
    name: 'Generic',
    keywords: [],
    columnPatterns: ['Fatura', 'Factura', 'Invoice', 'Documento', 'NIF', 'Total'],
  },
];

// ============ COLUMN MAPPINGS ============

const INVOICE_COLUMN_MAPPINGS = {
  numeroDocumento: [
    'Número', 'Numero', 'Nº', 'N.º', 'Nr.', 'Nº Doc', 'N.º Doc',
    'Document Number', 'Invoice No', 'Nº Documento', 'Nº Factura',
    'Documento', 'Fatura', 'Factura', 'Recibo', 'Doc',
  ],
  tipoDocumento: [
    'Tipo', 'Type', 'Tipo Doc', 'Tipo Documento', 'Document Type',
  ],
  dataEmissao: [
    'Data', 'Data Emissão', 'Data Emissao', 'Date', 'Issue Date',
    'Data Documento', 'Data Doc', 'Dt. Emissão', 'Dt Emissao',
  ],
  dataVencimento: [
    'Vencimento', 'Data Vencimento', 'Due Date', 'Dt. Vencimento',
  ],
  nifEmitente: [
    'NIF Emitente', 'Contribuinte Emitente', 'Issuer NIF', 'Issuer VAT',
  ],
  nomeEmitente: [
    'Emitente', 'Nome Emitente', 'Issuer', 'Issuer Name', 'Fornecedor',
  ],
  nifCliente: [
    'NIF', 'NIF Cliente', 'Contribuinte', 'Cont.', 'VAT No', 'VAT Number',
    'Customer VAT', 'Client NIF', 'NIF/NIPC', 'NIPC', 'NIF Adquirente',
  ],
  nomeCliente: [
    'Cliente', 'Nome', 'Nome Cliente', 'Customer', 'Client', 'Entidade',
    'Terceiro', 'Adquirente', 'Destinatário', 'Destinatario',
  ],
  descricao: [
    'Descrição', 'Descricao', 'Description', 'Obs', 'Observações',
    'Notas', 'Resumo', 'Artigos', 'Produtos', 'Serviços', 'Servicos',
  ],
  valorBruto: [
    'Total', 'Valor Total', 'Total Bruto', 'Gross', 'Gross Amount',
    'Montante', 'Valor', 'Subtotal', 'Base Tributável', 'Base',
    'Valor Bruto', 'Total Documento', 'Total Doc',
  ],
  iva: [
    'IVA', 'VAT', 'Imposto', 'Tax', 'Total IVA', 'Valor IVA',
  ],
  retencao: [
    'Retenção', 'Retencao', 'Retenção IRS', 'Retenção na Fonte',
    'Withholding', 'IRS', 'Valor Retido', 'Retenção IRC',
  ],
  valorLiquido: [
    'Líquido', 'Liquido', 'Valor Líquido', 'Net', 'Net Amount',
    'Total Líquido', 'A Pagar', 'A Receber', 'Total a Pagar',
  ],
  estado: [
    'Estado', 'Status', 'Situação', 'Situacao', 'State',
  ],
};

// ============ MAIN PARSER ============

/**
 * Parse an invoice file from a billing system
 */
export async function parseInvoiceFile(
  file: File,
  options: {
    categoria?: ATCategoria;
    taxaRetencao?: number;
    ano?: number;
    forceSystem?: string;
  } = {}
): Promise<InvoiceParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const records: InvoiceRecord[] = [];

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
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      raw: false,
      defval: '',
    });

    if (jsonData.length === 0) {
      return createEmptyResult('Ficheiro Excel sem dados');
    }

    // Detect billing system
    const headers = Object.keys(jsonData[0] || {});
    const sistemaDetectado = options.forceSystem || detectBillingSystem(headers, file.name);

    // Map columns
    const columnMap = mapInvoiceColumns(headers);

    // Parse each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // Excel rows start at 1, plus header row

      try {
        const record = parseInvoiceRow(
          row,
          rowNum,
          columnMap,
          file.name,
          sistemaDetectado,
          options
        );
        if (record) {
          records.push(record);
          if (record.warnings.length > 0) {
            warnings.push(...record.warnings.map(w => `Linha ${rowNum}: ${w}`));
          }
        }
      } catch (err: any) {
        errors.push(`Linha ${rowNum}: ${err.message}`);
      }
    }

    // Generate summary
    const summary = generateInvoiceSummary(records);

    return {
      success: records.length > 0,
      records,
      errors,
      warnings,
      summary,
      sistemaDetectado,
    };

  } catch (err: any) {
    return createEmptyResult(`Erro ao processar ficheiro: ${err.message}`);
  }
}

/**
 * Parse a CSV file from a billing system
 */
export async function parseInvoiceCSV(
  file: File,
  options: {
    delimiter?: string;
    categoria?: ATCategoria;
    taxaRetencao?: number;
    ano?: number;
  } = {}
): Promise<InvoiceParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const records: InvoiceRecord[] = [];

  try {
    const text = await file.text();
    const delimiter = options.delimiter || detectDelimiter(text);

    // Parse CSV
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      return createEmptyResult('Ficheiro CSV vazio ou sem dados');
    }

    // Parse header
    const headers = parseCSVLine(lines[0], delimiter);
    const columnMap = mapInvoiceColumns(headers);
    const sistemaDetectado = detectBillingSystem(headers, file.name);

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter);
      if (values.length === 0 || values.every(v => !v.trim())) continue;

      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      try {
        const record = parseInvoiceRow(
          row,
          i + 1,
          columnMap,
          file.name,
          sistemaDetectado,
          options
        );
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

    const summary = generateInvoiceSummary(records);

    return {
      success: records.length > 0,
      records,
      errors,
      warnings,
      summary,
      sistemaDetectado,
    };

  } catch (err: any) {
    return createEmptyResult(`Erro ao processar ficheiro CSV: ${err.message}`);
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Detect which billing system exported the file
 */
function detectBillingSystem(headers: string[], filename: string): string {
  const lowerFilename = filename.toLowerCase();
  const lowerHeaders = headers.map(h => h.toLowerCase());
  const headerStr = lowerHeaders.join(' ');

  // Check filename first
  for (const system of BILLING_SYSTEMS) {
    for (const keyword of system.keywords) {
      if (lowerFilename.includes(keyword)) {
        return system.name;
      }
    }
  }

  // Check column patterns
  for (const system of BILLING_SYSTEMS) {
    let matchCount = 0;
    for (const pattern of system.columnPatterns) {
      if (headerStr.includes(pattern.toLowerCase())) {
        matchCount++;
      }
    }
    // Require at least 3 matches for non-generic systems
    if (system.name !== 'Generic' && matchCount >= 3) {
      return system.name;
    }
  }

  return 'Generic';
}

/**
 * Map column headers to standard names
 */
function mapInvoiceColumns(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (const [key, variations] of Object.entries(INVOICE_COLUMN_MAPPINGS)) {
    for (const variation of variations) {
      const found = headers.find(h =>
        h.toLowerCase().trim() === variation.toLowerCase().trim() ||
        h.toLowerCase().includes(variation.toLowerCase())
      );
      if (found) {
        map[key] = found;
        break;
      }
    }
  }

  return map;
}

/**
 * Parse a single invoice row
 */
function parseInvoiceRow(
  row: Record<string, any>,
  rowNum: number,
  columnMap: Record<string, string>,
  filename: string,
  sistema: string,
  options: {
    categoria?: ATCategoria;
    taxaRetencao?: number;
    ano?: number;
  }
): InvoiceRecord | null {
  const warnings: string[] = [];

  // Get document number
  const numeroDocumento = getColumnValue(row, columnMap, 'numeroDocumento');
  if (!numeroDocumento) {
    return null; // Skip rows without document number
  }

  // Get type
  const tipoDocumento = getColumnValue(row, columnMap, 'tipoDocumento') || 'Fatura';

  // Get dates
  const dataEmissao = parseDate(getColumnValue(row, columnMap, 'dataEmissao'));
  const dataVencimento = parseDate(getColumnValue(row, columnMap, 'dataVencimento'));

  if (!dataEmissao) {
    warnings.push('Data de emissão não encontrada');
  }

  // Filter by year if specified
  if (options.ano && dataEmissao) {
    if (dataEmissao.getFullYear() !== options.ano) {
      return null; // Skip records from other years
    }
  }

  // Get NIFs
  const nifEmitente = extractNIF(getColumnValue(row, columnMap, 'nifEmitente')) || '';
  const nifCliente = extractNIF(getColumnValue(row, columnMap, 'nifCliente')) || '';

  // Validate NIFs
  if (nifCliente && !validatePortugueseNIF(nifCliente).valid) {
    warnings.push(`NIF cliente inválido: ${nifCliente}`);
  }

  // Get names
  const nomeEmitente = getColumnValue(row, columnMap, 'nomeEmitente');
  const nomeCliente = getColumnValue(row, columnMap, 'nomeCliente');

  // Get description for keyword detection
  const descricao = getColumnValue(row, columnMap, 'descricao') ||
    Object.values(row).join(' '); // Fallback: use all values

  // Detect category from keywords
  const { categoria, keywords, confianca } = detectCategoria(
    descricao,
    tipoDocumento,
    options.categoria
  );

  // Get amounts
  let valorBruto = parseAmount(getColumnValue(row, columnMap, 'valorBruto'));
  const iva = parseAmount(getColumnValue(row, columnMap, 'iva'));
  let retencao = parseAmount(getColumnValue(row, columnMap, 'retencao'));
  let valorLiquido = parseAmount(getColumnValue(row, columnMap, 'valorLiquido'));

  // Calculate missing values
  const taxaRetencao = options.taxaRetencao || TAXAS_RETENCAO[categoria];

  if (valorBruto === 0 && valorLiquido > 0 && retencao > 0) {
    valorBruto = valorLiquido + retencao;
  }

  if (retencao === 0 && valorBruto > 0 && taxaRetencao > 0) {
    // Only calculate retention if we detect it should have retention
    if (shouldHaveRetention(descricao, categoria)) {
      retencao = valorBruto * taxaRetencao;
    }
  }

  if (valorLiquido === 0 && valorBruto > 0) {
    valorLiquido = valorBruto - retencao;
  }

  // Skip if no meaningful data
  if (valorBruto === 0 && valorLiquido === 0) {
    return null;
  }

  return {
    id: `${filename}-${rowNum}`,
    numeroDocumento,
    tipoDocumento,
    dataEmissao: dataEmissao || new Date(),
    dataVencimento,
    nifEmitente,
    nomeEmitente,
    nifCliente,
    nomeCliente,
    descricao: descricao.substring(0, 500), // Limit description length
    valorBruto,
    iva,
    retencao,
    taxaRetencao,
    valorLiquido,
    categoria,
    sistemaOrigem: sistema,
    keywords,
    confianca,
    linha: rowNum,
    ficheiro: filename,
    warnings,
  };
}

/**
 * Detect category based on keywords in description
 */
function detectCategoria(
  descricao: string,
  tipoDocumento: string,
  forceCategoria?: ATCategoria
): { categoria: ATCategoria; keywords: string[]; confianca: number } {
  if (forceCategoria) {
    return { categoria: forceCategoria, keywords: [], confianca: 100 };
  }

  const text = `${descricao} ${tipoDocumento}`.toLowerCase();
  const foundKeywords: string[] = [];
  let categoria: ATCategoria = 'B_INDEPENDENTES';
  let maxScore = 0;

  // Check each category
  const categoryScores: { cat: ATCategoria; score: number; keywords: string[] }[] = [
    { cat: 'F_PREDIAIS', score: 0, keywords: [] },
    { cat: 'B_INDEPENDENTES', score: 0, keywords: [] },
    { cat: 'E_CAPITAIS', score: 0, keywords: [] },
    { cat: 'H_PENSOES', score: 0, keywords: [] },
  ];

  // Score Category F (Prediais)
  for (const keyword of KEYWORDS_CATEGORIA_F) {
    if (text.includes(keyword.toLowerCase())) {
      categoryScores[0].score += keyword.length; // Longer matches = higher score
      categoryScores[0].keywords.push(keyword);
    }
  }

  // Score Category B (Independentes)
  for (const keyword of KEYWORDS_CATEGORIA_B) {
    if (text.includes(keyword.toLowerCase())) {
      categoryScores[1].score += keyword.length;
      categoryScores[1].keywords.push(keyword);
    }
  }

  // Score Category E (Capitais)
  for (const keyword of KEYWORDS_CATEGORIA_E) {
    if (text.includes(keyword.toLowerCase())) {
      categoryScores[2].score += keyword.length;
      categoryScores[2].keywords.push(keyword);
    }
  }

  // Score Category H (Pensões)
  for (const keyword of KEYWORDS_CATEGORIA_H) {
    if (text.includes(keyword.toLowerCase())) {
      categoryScores[3].score += keyword.length;
      categoryScores[3].keywords.push(keyword);
    }
  }

  // Find highest scoring category
  for (const cs of categoryScores) {
    if (cs.score > maxScore) {
      maxScore = cs.score;
      categoria = cs.cat;
      foundKeywords.push(...cs.keywords);
    }
  }

  // Calculate confidence (0-100)
  // Higher score = higher confidence, max at ~50 points
  const confianca = Math.min(100, Math.round((maxScore / 50) * 100));

  return {
    categoria,
    keywords: [...new Set(foundKeywords)], // Remove duplicates
    confianca: confianca || 30, // Minimum 30% if no keywords found
  };
}

/**
 * Check if document should have withholding based on keywords
 */
function shouldHaveRetention(descricao: string, categoria: ATCategoria): boolean {
  const text = descricao.toLowerCase();

  // Rental income should always have retention
  if (categoria === 'F_PREDIAIS') {
    return true;
  }

  // Check for retention-related keywords
  const retentionKeywords = [
    'retenção', 'retencao', 'irs', 'trabalho independente',
    'serviços', 'servicos', 'honorários', 'honorarios',
    'prestação de serviços', 'recibo verde',
  ];

  return retentionKeywords.some(k => text.includes(k));
}

/**
 * Get value from a column using the mapping
 */
function getColumnValue(row: Record<string, any>, columnMap: Record<string, string>, key: string): string {
  const columnName = columnMap[key];
  if (!columnName) return '';

  const value = row[columnName];
  if (value === undefined || value === null) return '';

  return String(value).trim();
}

/**
 * Extract 9-digit NIF from text
 */
function extractNIF(value: string): string | null {
  if (!value) return null;

  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // If exactly 9 digits, return as-is
  if (digits.length === 9) {
    return digits;
  }

  // If more than 9 digits, try to find a valid NIF
  if (digits.length > 9) {
    // Try each 9-digit sequence
    for (let i = 0; i <= digits.length - 9; i++) {
      const potential = digits.substring(i, i + 9);
      if (validatePortugueseNIF(potential).valid) {
        return potential;
      }
    }
    // Return first 9 if no valid found
    return digits.substring(0, 9);
  }

  // If less than 9 digits, pad with zeros
  if (digits.length > 0 && digits.length < 9) {
    return digits.padStart(9, '0');
  }

  return null;
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

  // Try Excel serial date
  const serial = parseFloat(str);
  if (!isNaN(serial) && serial > 30000 && serial < 60000) {
    const date = new Date((serial - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Parse amount from various formats
 */
function parseAmount(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;

  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  const str = String(value).trim();
  if (!str) return 0;

  // Remove currency symbols and spaces
  let cleaned = str.replace(/[€$\s]/g, '');

  // Handle Portuguese number format (1.234,56 → 1234.56)
  if (cleaned.includes(',')) {
    if (/\d+,\d{1,2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : Math.abs(amount);
}

/**
 * Detect CSV delimiter
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';

  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

/**
 * Parse a CSV line respecting quotes
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Generate summary from invoice records
 */
function generateInvoiceSummary(records: InvoiceRecord[]): InvoiceSummary {
  const byNIF = new Map<string, InvoiceNIFSummary>();
  const byCategoria = new Map<ATCategoria, number>();
  const bySistema = new Map<string, number>();

  let totalBruto = 0;
  let totalIVA = 0;
  let totalRetencao = 0;
  let totalLiquido = 0;

  for (const record of records) {
    totalBruto += record.valorBruto;
    totalIVA += record.iva;
    totalRetencao += record.retencao;
    totalLiquido += record.valorLiquido;

    // By NIF (client NIF for withholding purposes)
    const key = record.nifCliente || 'SEM_NIF';
    if (!byNIF.has(key)) {
      byNIF.set(key, {
        nif: record.nifCliente,
        nome: record.nomeCliente,
        categoria: record.categoria,
        totalBruto: 0,
        totalRetencao: 0,
        totalLiquido: 0,
        numDocumentos: 0,
        records: [],
      });
    }
    const nifSummary = byNIF.get(key)!;
    nifSummary.totalBruto += record.valorBruto;
    nifSummary.totalRetencao += record.retencao;
    nifSummary.totalLiquido += record.valorLiquido;
    nifSummary.numDocumentos += 1;
    nifSummary.records.push(record);

    // By category
    const catTotal = byCategoria.get(record.categoria) || 0;
    byCategoria.set(record.categoria, catTotal + record.valorBruto);

    // By system
    const sysTotal = bySistema.get(record.sistemaOrigem) || 0;
    bySistema.set(record.sistemaOrigem, sysTotal + 1);
  }

  return {
    totalRecords: records.length,
    totalBruto,
    totalIVA,
    totalRetencao,
    totalLiquido,
    byNIF,
    byCategoria,
    bySistema,
  };
}

/**
 * Create empty result with error
 */
function createEmptyResult(error: string): InvoiceParseResult {
  return {
    success: false,
    records: [],
    errors: [error],
    warnings: [],
    summary: {
      totalRecords: 0,
      totalBruto: 0,
      totalIVA: 0,
      totalRetencao: 0,
      totalLiquido: 0,
      byNIF: new Map(),
      byCategoria: new Map(),
      bySistema: new Map(),
    },
    sistemaDetectado: 'Unknown',
  };
}

// ============ EXPORTS ============

/**
 * Get all supported billing systems
 */
export function getSupportedBillingSystems(): string[] {
  return BILLING_SYSTEMS.map(s => s.name);
}

/**
 * Get all category keywords for reference
 */
export function getCategoryKeywords(): {
  B: string[];
  F: string[];
  E: string[];
  H: string[];
} {
  return {
    B: KEYWORDS_CATEGORIA_B,
    F: KEYWORDS_CATEGORIA_F,
    E: KEYWORDS_CATEGORIA_E,
    H: KEYWORDS_CATEGORIA_H,
  };
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
