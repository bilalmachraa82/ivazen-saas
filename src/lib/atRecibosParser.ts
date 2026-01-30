/**
 * AT Recibos Parser
 * Parses Excel files exported from Portal das Finanças (AT)
 * Supports: ListaRecibos.xls (Recibos Verdes) and ListaRecibos-Renda.xls (Rendas)
 *
 * Format AT columns:
 * - Referência: NIF reference (e.g., "1633-8")
 * - Nº de Contrato: Contract ID
 * - Nº do Recibo: Receipt number
 * - Locador/Emitente: Issuer name
 * - Locatário/Adquirente: Client name
 * - Data de Início: Start date
 * - Data de Fim: End date
 * - Valor/Importância: Amount (may be in different columns)
 */

import * as XLSX from 'xlsx';
import { validatePortugueseNIF } from './nifValidator';

// ============ TYPES ============

export interface ATReciboRecord {
  id: string;
  referencia: string;        // Original reference from AT
  nif: string;               // Extracted/validated NIF (9 digits)
  numContrato: string;       // Contract number
  numRecibo: string;         // Receipt number
  nomeEmitente: string;      // Issuer name (Locador/Emitente)
  nomeCliente: string;       // Client name (Locatário/Adquirente)
  dataInicio: Date;          // Start date
  dataFim: Date;             // End date
  valorBruto: number;        // Gross amount
  retencao: number;          // Withholding amount (calculated)
  taxaRetencao: number;      // Withholding rate (0.25 for 25%, etc.)
  valorLiquido: number;      // Net amount
  categoria: ATCategoria;    // Income category
  linha: number;             // Original row number for reference
  ficheiro: string;          // Source filename
  warnings: string[];        // Any parsing warnings
}

export type ATCategoria =
  | 'B_INDEPENDENTES'    // Recibos Verdes (Categoria B)
  | 'F_PREDIAIS'         // Rendas (Categoria F)
  | 'E_CAPITAIS'         // Capital income
  | 'H_PENSOES'          // Pensions
  | 'OUTRO';             // Other

export interface ATParseResult {
  success: boolean;
  records: ATReciboRecord[];
  errors: string[];
  warnings: string[];
  summary: ATSummary;
  fileType: 'recibos_verdes' | 'rendas' | 'unknown';
}

export interface ATSummary {
  totalRecords: number;
  totalBruto: number;
  totalRetencao: number;
  totalLiquido: number;
  byNIF: Map<string, ATNIFSummary>;
  byCategoria: Map<ATCategoria, number>;
}

export interface ATNIFSummary {
  nif: string;
  nome: string;
  categoria: ATCategoria;
  totalBruto: number;
  totalRetencao: number;
  totalLiquido: number;
  numRecibos: number;
  records: ATReciboRecord[];
}

// ============ CONFIGURATION ============

// Default withholding rates by category (Portuguese law 2025/2026)
// Reference: OE2025/2026, Código do IRS (Art. 71º, 101º, 101º-B)
// UPDATED: Categoria B reduced from 25% to 23% as per OE2025
// Categoria F: 25% habitacional, 28% não-habitacional (commercial)
export const TAXAS_RETENCAO: Record<ATCategoria, number> = {
  'B_INDEPENDENTES': 0.23,  // 23% for independent workers (reduced from 25% in 2025)
  'F_PREDIAIS': 0.25,       // 25% for residential rental income (habitacional)
  'E_CAPITAIS': 0.28,       // 28% for capital income (juros, dividendos - Art. 71º CIRS)
  'H_PENSOES': 0.25,        // Variable based on IRS tables, using median
  'OUTRO': 0.23,
};

// Specific rates for Categoria B (Trabalho Independente)
// Reference: Art. 101º CIRS, Portaria n.º 1011/2001
export const TAXAS_RETENCAO_CATEGORIA_B = {
  GERAL: 0.23,              // 23% - Profissões listadas no Art. 151º CIRS (2025)
  GERAL_2024: 0.25,         // 25% - Taxa geral até 2024
  NAO_LISTADAS: 0.115,      // 11.5% - Atividades NÃO listadas na Portaria 1011/2001
  PROPRIEDADE_INTELECTUAL: 0.165,  // 16.5% - Rendimentos de propriedade intelectual/industrial
  NAO_RESIDENTES_HABITUAIS: 0.20,  // 20% - Profissionais não residentes habituais
};

// Specific rates for Categoria F (Rendimentos Prediais)
// Reference: Art. 101º CIRS
export const TAXAS_RETENCAO_PREDIAIS = {
  HABITACIONAL: 0.25,       // 25% for residential rentals
  NAO_HABITACIONAL: 0.28,   // 28% for commercial/rural rentals
};

// Specific rates for Categoria E (Capitais) - Taxas Liberatórias
// Reference: Art. 71º CIRS
export const TAXAS_LIBERATORIAS_CAPITAIS = {
  GERAL: 0.28,              // 28% - Juros, dividendos, mais-valias
  RESIDENTES_NAO_HABITUAIS: 0.10,  // 10% - RNH pensões de fonte estrangeira
};

// Retention exemption thresholds (Artigo 101.º-B CIRS)
export const LIMITES_DISPENSA_RETENCAO = {
  CATEGORIA_F_ANUAL: 10000,  // €10,000/year for Categoria F
  VALOR_MINIMO: 25,          // €25 minimum for any retention
};

// IVA exemption thresholds (Artigo 53.º CIVA)
export const LIMITES_IVA = {
  ISENCAO: 15000,            // €15,000/year for VAT exemption
  ALERTA_25_PERCENT: 18750,  // €18,750 (25% above threshold - must change to normal regime)
};

// Column name variations in AT Excel files
// IMPORTANT: These keywords are based on:
// 1. Feedback from accountant Adélia Gaspar (recibos verdes, rendas, faturas de prestadores)
// 2. Official AT/SAF-T terminology (Portaria n.º 321-A/2007)
// 3. Common variations in Portuguese accounting software
const COLUMN_MAPPINGS = {
  referencia: ['Referência', 'Referencia', 'NIF', 'Ref.', 'Ref', 'N.º Fiscal', 'Nº Contribuinte'],
  numContrato: ['Nº de Contrato', 'Nº Contrato', 'Num Contrato', 'Contrato', 'N.º Contrato'],
  numRecibo: ['Nº do Recibo', 'Nº Recibo', 'Num Recibo', 'Recibo', 'N.º Recibo', 'Nº de Recibo',
    'Nº Documento', 'N.º Documento', 'Documento', 'Fatura', 'Nº Fatura'],
  nomeEmitente: ['Locador', 'Emitente', 'Prestador', 'Nome Emitente', 'Senhorio',
    'Transmitente', 'Fornecedor', 'Beneficiário', 'Nome Beneficiário'],
  nomeCliente: ['Locatário', 'Adquirente', 'Cliente', 'Nome Cliente', 'Inquilino',
    'Destinatário', 'Pagador', 'Entidade Pagadora'],
  dataInicio: ['Data de Início', 'Data Inicio', 'Data Início', 'Início', 'Data', 'Data Emissão'],
  dataFim: ['Data de Fim', 'Data Fim', 'Fim', 'Data Final', 'Data Vencimento'],
  dataRecibo: ['Data de Rec.', 'Data Recibo', 'Data Rec', 'Data do Recibo', 'Data Pagamento',
    'Data de Pagamento', 'Data Liquidação'],
  // ============ VALOR BRUTO/ILÍQUIDO ============
  // Palavras-chave para identificar o rendimento faturado (ANTES de descontar retenção)
  // Recibos verdes: "valor dos trabalhos" (1ª linha)
  // Rendas: "valor", "renda"
  // Faturas de prestadores: "Renda", "Serviços", "Base", "Trabalhos", "Total"
  // SAF-T/Oficial: "Base Tributável", "Valor Tributável", "Base de Incidência"
  valor: [
    // Termos gerais (NOTA: "Importância" removido pois é ambíguo - pode ser bruto ou líquido)
    'Valor (€)', 'Valor', 'Montante', 'Total', 'Valor Bruto',
    // Específicos recibos verdes
    'Valor dos trabalhos', 'Valor dos Trabalhos',
    // Específicos rendas
    'Renda', 'Renda Mensal', 'Valor da Renda',
    // Específicos faturas/serviços
    'Serviços', 'Base', 'Trabalhos', 'Honorários', 'Prestação de Serviços',
    // Termos oficiais AT/SAF-T
    'Base de Incidência', 'Base Incidência', 'Base Tributável', 'Valor Tributável',
    'Base de Incidência em IRS', 'Base IRS',
    // Termos ilíquidos
    'Total Ilíquido', 'Valor Ilíquido', 'Importância Ilíquida', 'Bruto',
    'Valor Faturado', 'Total Faturado', 'Valor dos Serviços',
    // Preços unitários (para faturas detalhadas)
    'Preço Unitário', 'Preço', 'Subtotal', 'Total s/IVA',
  ],
  // ============ RETENÇÃO NA FONTE ============
  // Palavras-chave para identificar o valor retido na fonte
  // Recibos verdes: "Retenção na fonte IRS" (penúltima linha)
  // Rendas: "retenção de IRS"
  // Faturas: "IRS", "Retenção", "Ret.", "Ret.Fonte", "Prediais", "Pred."
  retencao: [
    // Termos gerais
    'Retenção IRS (€)', 'Retenção (€)', 'Retenção', 'Retencao', 'Valor Retido',
    // Específicos IRS
    'IRS', 'Retenção IRS', 'IRS Retido', 'Imposto Retido', 'Retenção de IRS',
    // Retenção na fonte (formato longo)
    'Retenção na fonte', 'Retenção na fonte IRS', 'Ret. na fonte', 'Retenção na Fonte de IRS',
    // Abreviaturas comuns
    'Ret.', 'Ret.Fonte', 'Ret. Fonte', 'Ret Fonte', 'Ret. IRS', 'Ret IRS',
    // Específicos rendimentos prediais
    'Prediais', 'Pred.', 'Ret. Prediais', 'IRS Prediais',
    // Específicos IRC (para empresas)
    'IRC', 'Retenção IRC', 'IRC Retido', 'Ret. IRC',
    // Taxa liberatória (Cat. E)
    'Taxa Liberatória', 'Liberatória', 'Ret. Liberatória',
    // Outros
    'Imposto', 'Desconto IRS', 'Dedução IRS',
  ],
  // ============ VALOR LÍQUIDO ============
  // Valor após dedução da retenção (o que o prestador recebe)
  valorLiquido: [
    // Termos oficiais AT
    'Importância recebida (€)', 'Importância recebida', 'Importância Recebida',
    // Termos líquidos
    'Valor Líquido', 'Líquido', 'Total Líquido', 'Valor Liq.', 'Val. Líquido',
    // Valor a receber/pagar
    'Valor a Receber', 'Líquido a Receber', 'Total a Receber',
    'Valor a Pagar', 'Total a Pagar', 'Importância a Receber',
    // Após retenção
    'Valor após retenção', 'Líquido após retenção', 'Recebido',
  ],
  imovel: ['Imóvel', 'Imovel', 'Propriedade', 'Fração', 'Artigo', 'Artigo Matricial'],
  estado: ['Estado', 'Status', 'Situação'],
  // ============ CATEGORIA DO RENDIMENTO ============
  // Para distinguir F (Rendas) de B (Serviços) de E (Capitais)
  categoria: ['Categoria', 'Tipo', 'Tipo de Rendimento', 'Cat.', 'Categoria IRS',
    'Natureza', 'Natureza do Rendimento', 'Código Rendimento'],
  // ============ TAXA DE RETENÇÃO ============
  // Para identificar a taxa aplicada (quando explícita)
  taxaRetencao: ['Taxa (%)', 'Taxa', 'Taxa Retenção', 'Taxa de Retenção', '%', 'Percentagem',
    'Taxa IRS', 'Taxa Ret.', 'Taxa Aplicada'],
};

// ============ MAIN PARSER ============

/**
 * Parse an AT Excel file (ListaRecibos.xls or similar)
 */
export async function parseATExcel(
  file: File,
  options: {
    categoria?: ATCategoria;
    taxaRetencao?: number;
    ano?: number;
  } = {}
): Promise<ATParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const records: ATReciboRecord[] = [];

  try {
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        records: [],
        errors: ['Ficheiro Excel vazio ou sem folhas'],
        warnings: [],
        summary: createEmptySummary(),
        fileType: 'unknown',
      };
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      raw: false,
      defval: '',
    });

    if (jsonData.length === 0) {
      return {
        success: false,
        records: [],
        errors: ['Ficheiro Excel sem dados'],
        warnings: [],
        summary: createEmptySummary(),
        fileType: 'unknown',
      };
    }

    // Detect file type based on columns
    const headers = Object.keys(jsonData[0] || {});
    const fileType = detectFileType(headers, file.name);

    // Auto-detect category if not provided
    const categoria = options.categoria || (fileType === 'rendas' ? 'F_PREDIAIS' : 'B_INDEPENDENTES');
    const taxaRetencao = options.taxaRetencao || TAXAS_RETENCAO[categoria];

    // Map columns
    const columnMap = mapColumns(headers);

    // Parse each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // Excel rows start at 1, plus header row

      try {
        const record = parseRow(row, rowNum, columnMap, file.name, categoria, taxaRetencao);
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
    const summary = generateSummary(records);

    return {
      success: records.length > 0,
      records,
      errors,
      warnings,
      summary,
      fileType,
    };

  } catch (err: any) {
    return {
      success: false,
      records: [],
      errors: [`Erro ao processar ficheiro: ${err.message}`],
      warnings: [],
      summary: createEmptySummary(),
      fileType: 'unknown',
    };
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Detect if file is Recibos Verdes or Rendas based on columns/filename
 */
function detectFileType(headers: string[], filename: string): 'recibos_verdes' | 'rendas' | 'unknown' {
  const lowerFilename = filename.toLowerCase();
  const lowerHeaders = headers.map(h => h.toLowerCase());

  // Check filename
  if (lowerFilename.includes('renda') || lowerFilename.includes('predial')) {
    return 'rendas';
  }
  if (lowerFilename.includes('recibo') && !lowerFilename.includes('renda')) {
    return 'recibos_verdes';
  }

  // Check columns
  if (lowerHeaders.some(h => h.includes('locador') || h.includes('senhorio') || h.includes('inquilino'))) {
    return 'rendas';
  }
  if (lowerHeaders.some(h => h.includes('prestador') || h.includes('emitente'))) {
    return 'recibos_verdes';
  }

  return 'unknown';
}

/**
 * Map column headers to our standard names
 * IMPORTANT: Uses two-pass matching to avoid ambiguity:
 * 1. First pass: exact matches only (most reliable)
 * 2. Second pass: partial matches (includes) for remaining headers
 *
 * Also ensures each header is only mapped to ONE key (first match wins)
 * and processes valorLiquido BEFORE valor to avoid "Importância" matching "Importância recebida"
 */
function mapColumns(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const usedHeaders = new Set<string>(); // Track headers already mapped

  // Define processing order - valorLiquido MUST come before valor
  // to prevent "Importância" from matching "Importância recebida"
  const processingOrder = [
    'referencia',
    'numContrato',
    'numRecibo',
    'nomeEmitente',
    'nomeCliente',
    'dataInicio',
    'dataFim',
    'dataRecibo',
    'valorLiquido',  // MUST be before 'valor'!
    'retencao',      // MUST be before 'valor'!
    'valor',         // Process last among value columns
    'imovel',
    'estado',
    'categoria',
    'taxaRetencao',
  ];

  // PASS 1: Exact matches only (most reliable)
  for (const key of processingOrder) {
    const variations = COLUMN_MAPPINGS[key as keyof typeof COLUMN_MAPPINGS];
    if (!variations) continue;

    for (const variation of variations) {
      const found = headers.find(h =>
        !usedHeaders.has(h) &&
        h.toLowerCase().trim() === variation.toLowerCase().trim()
      );
      if (found) {
        map[key] = found;
        usedHeaders.add(found);
        break;
      }
    }
  }

  // PASS 2: Partial matches (includes) for remaining keys
  for (const key of processingOrder) {
    if (map[key]) continue; // Already matched in pass 1

    const variations = COLUMN_MAPPINGS[key as keyof typeof COLUMN_MAPPINGS];
    if (!variations) continue;

    for (const variation of variations) {
      // Skip very short/generic terms in partial matching to avoid false positives
      if (variation.length < 4) continue;

      const found = headers.find(h =>
        !usedHeaders.has(h) &&
        h.toLowerCase().includes(variation.toLowerCase())
      );
      if (found) {
        map[key] = found;
        usedHeaders.add(found);
        break;
      }
    }
  }

  return map;
}

/**
 * Parse a single row into an ATReciboRecord
 */
function parseRow(
  row: Record<string, any>,
  rowNum: number,
  columnMap: Record<string, string>,
  filename: string,
  categoria: ATCategoria,
  taxaRetencao: number
): ATReciboRecord | null {
  const warnings: string[] = [];

  // Get reference (may be property reference like "1633-B", not a NIF)
  const referencia = getColumnValue(row, columnMap, 'referencia') || '';

  // Get emitter name (Locador for rentals)
  const nomeEmitente = getColumnValue(row, columnMap, 'nomeEmitente') || '';
  const nomeCliente = getColumnValue(row, columnMap, 'nomeCliente') || '';

  // Skip empty rows (need at least reference OR name)
  if (!referencia && !nomeEmitente) {
    return null;
  }

  // Try to extract NIF from reference
  let nif = extractNIF(referencia);

  // If reference is not a valid NIF format (e.g., "1633-B"), it's a property reference
  // In this case, we need to use the name as the key (NIF not available in this export)
  if (!nif || (nif && nif.startsWith('0') && nif.length < 9)) {
    // Reference is likely a property ID, not a NIF
    // Generate a pseudo-key from the name for grouping purposes
    if (nomeEmitente) {
      // Create a hash-like key from name (first 9 chars normalized)
      const nameKey = nomeEmitente.replace(/[^A-Za-z0-9]/g, '').substring(0, 20).toUpperCase();
      warnings.push(`NIF não disponível neste ficheiro - usando nome como chave: ${nameKey}`);
      // Keep nif empty - we'll use name for grouping later
      nif = null;
    }
  }

  // Validate NIF if found
  if (nif) {
    const nifValidation = validatePortugueseNIF(nif);
    if (!nifValidation.valid) {
      warnings.push(`NIF inválido: ${nif}`);
    }
  }

  // Get other fields
  const numContrato = getColumnValue(row, columnMap, 'numContrato') || '';
  const numRecibo = getColumnValue(row, columnMap, 'numRecibo') || '';

  // Parse dates - support multiple date columns
  const dataInicio = parseDate(getColumnValue(row, columnMap, 'dataInicio'));
  const dataFim = parseDate(getColumnValue(row, columnMap, 'dataFim'));
  const dataRecibo = parseDate(getColumnValue(row, columnMap, 'dataRecibo'));

  // Use best available date
  const bestDate = dataRecibo || dataFim || dataInicio;
  if (!bestDate) {
    warnings.push('Data não encontrada ou inválida');
  }

  // Try to get explicit tax rate from document (if available)
  const taxaExplicita = parsePercentage(getColumnValue(row, columnMap, 'taxaRetencao'));
  // Use explicit rate if valid, otherwise use default for category
  const taxaFinal = taxaExplicita > 0 ? taxaExplicita : taxaRetencao;
  if (taxaExplicita > 0 && Math.abs(taxaExplicita - taxaRetencao) > 0.01) {
    warnings.push(`Taxa explícita (${(taxaExplicita * 100).toFixed(1)}%) difere da padrão (${(taxaRetencao * 100).toFixed(1)}%)`);
  }

  // Parse amounts - try explicit columns first
  let valorBruto = parseAmount(getColumnValue(row, columnMap, 'valor'));
  let retencao = parseAmount(getColumnValue(row, columnMap, 'retencao'));
  const valorLiquidoExplicito = parseAmount(getColumnValue(row, columnMap, 'valorLiquido'));

  // CASE 1: We have explicit retention value - need to verify if "valor" is really gross or liquid
  if (retencao > 0) {
    if (valorBruto === 0 && valorLiquidoExplicito > 0) {
      // No bruto column, only liquid - calculate bruto
      valorBruto = valorLiquidoExplicito + retencao;
      warnings.push(`Bruto calculado: ${valorLiquidoExplicito.toFixed(2)} + ${retencao.toFixed(2)} = ${valorBruto.toFixed(2)}`);
    } else if (valorBruto > 0 && valorLiquidoExplicito === 0) {
      // We have "valor" and "retencao" but no explicit liquid column
      // Need to verify if "valor" is actually gross or liquid!
      // Test 1: If valor is gross, then valor * taxa ≈ retencao
      const expectedRetencaoIfGross = valorBruto * taxaFinal;
      // Test 2: If valor is liquid, then (valor + retencao) * taxa ≈ retencao
      const possibleGross = valorBruto + retencao;
      const expectedRetencaoIfLiquid = possibleGross * taxaFinal;

      // Check which interpretation makes sense (within 5% tolerance)
      const toleranceGross = Math.abs(expectedRetencaoIfGross - retencao) / retencao;
      const toleranceLiquid = Math.abs(expectedRetencaoIfLiquid - retencao) / retencao;

      if (toleranceLiquid < toleranceGross && toleranceLiquid < 0.05) {
        // "valor" is actually LIQUID, not gross!
        warnings.push(`Coluna "Valor" contém valor líquido (${valorBruto.toFixed(2)}€), não bruto. Corrigido.`);
        valorBruto = possibleGross;
      } else if (toleranceGross > 0.05 && toleranceLiquid > 0.05) {
        // Neither interpretation matches - might be different rate or error
        // Use simple addition as fallback (valor + retencao)
        warnings.push(`Taxa não corresponde. Assumindo Valor=${valorBruto.toFixed(2)}€ é líquido.`);
        valorBruto = possibleGross;
      }
      // else: toleranceGross is good, valorBruto is actually gross - keep as is
    } else if (valorBruto > 0 && valorLiquidoExplicito > 0) {
      // Have both bruto and liquid columns - verify consistency
      const calculatedBruto = valorLiquidoExplicito + retencao;
      if (Math.abs(valorBruto - calculatedBruto) > 1) {
        // Bruto doesn't match liquid + retention
        // The "bruto" column might actually contain liquid value
        if (Math.abs(valorBruto - valorLiquidoExplicito) < 1) {
          // Both columns have same value (both are liquid)
          valorBruto = calculatedBruto;
          warnings.push(`Ambas colunas tinham valor líquido. Bruto corrigido para ${valorBruto.toFixed(2)}€`);
        }
      }
    }
  }
  // CASE 2: No explicit retention but have both bruto and liquid - calculate retention
  else if (valorBruto > 0 && valorLiquidoExplicito > 0) {
    retencao = valorBruto - valorLiquidoExplicito;
    // Validate: retention should be roughly equal to rate applied to bruto
    const expectedRetencao = valorBruto * taxaFinal;
    if (Math.abs(retencao - expectedRetencao) > valorBruto * 0.02) {
      // If difference is more than 2%, warn (might be exemption or different rate)
      warnings.push(`Retenção calculada (${retencao.toFixed(2)}€) difere da esperada (${expectedRetencao.toFixed(2)}€)`);
    }
  }
  // CASE 3: Only have liquid value (Importância recebida) - calculate bruto from rate
  else if (valorBruto === 0 && valorLiquidoExplicito > 0 && taxaFinal > 0) {
    // IMPORTANT: When we only have liquid, calculate bruto using:
    // Bruto = Liquido / (1 - Taxa)
    // Because: Liquido = Bruto - Retencao = Bruto - (Bruto * Taxa) = Bruto * (1 - Taxa)
    valorBruto = valorLiquidoExplicito / (1 - taxaFinal);
    retencao = valorBruto - valorLiquidoExplicito;
    warnings.push(`Valor bruto calculado a partir do líquido (taxa ${(taxaFinal * 100).toFixed(0)}%)`);
  }
  // CASE 4: Only have bruto, no liquid, no retention - apply rate
  else if (valorBruto > 0 && retencao === 0 && valorLiquidoExplicito === 0) {
    // Check if retention should be applied (above threshold)
    // For simplicity, always calculate - exemptions should be handled by explicit 0 retention
    retencao = valorBruto * taxaFinal;
  }
  // CASE 5: Only liquid, rate is 0 (exempt) - bruto equals liquid
  else if (valorBruto === 0 && valorLiquidoExplicito > 0 && taxaFinal === 0) {
    valorBruto = valorLiquidoExplicito;
    retencao = 0;
  }

  const valorLiquido = valorBruto - retencao;

  // Skip if no meaningful data
  if (!nif && !nomeEmitente && valorBruto === 0) {
    return null;
  }

  return {
    id: `${filename}-${rowNum}`,
    referencia,
    nif: nif || '',
    numContrato,
    numRecibo,
    nomeEmitente: nomeEmitente.trim(),
    nomeCliente: nomeCliente.trim(),
    dataInicio: dataInicio || bestDate || new Date(),
    dataFim: dataFim || bestDate || new Date(),
    valorBruto,
    retencao,
    taxaRetencao,
    valorLiquido,
    categoria,
    linha: rowNum,
    ficheiro: filename,
    warnings,
  };
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
 * Extract 9-digit NIF from various formats
 * Examples: "1633-8" → "163380000" (padding), "278137784" → "278137784"
 */
function extractNIF(referencia: string): string | null {
  if (!referencia) return null;

  // Remove all non-digits except hyphen
  let cleaned = referencia.replace(/[^\d-]/g, '');

  // Handle "XXXX-X" format (old AT reference format)
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    if (parts.length === 2) {
      // This is a reference format, not a full NIF
      // Try to find a 9-digit NIF elsewhere or return null
      // For now, we'll try to construct but mark as potentially invalid
      const combined = parts.join('');
      if (combined.length <= 9) {
        // Pad with zeros to make 9 digits - this is likely wrong
        // Return as-is for warning
        return combined.padEnd(9, '0');
      }
    }
  }

  // Remove hyphens and get just digits
  cleaned = cleaned.replace(/-/g, '');

  // If already 9 digits, return as-is
  if (cleaned.length === 9) {
    return cleaned;
  }

  // If less than 9 digits, it might be a partial reference
  if (cleaned.length < 9 && cleaned.length > 0) {
    return cleaned.padStart(9, '0');
  }

  // If more than 9 digits, try to find a valid 9-digit sequence
  if (cleaned.length > 9) {
    // Try first 9 digits
    const first9 = cleaned.substring(0, 9);
    if (validatePortugueseNIF(first9).valid) {
      return first9;
    }
    // Try last 9 digits
    const last9 = cleaned.substring(cleaned.length - 9);
    if (validatePortugueseNIF(last9).valid) {
      return last9;
    }
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

  // Try ISO format (YYYY-MM-DD)
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
    // Excel serial date (days since 1900-01-01)
    const date = new Date((serial - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Parse percentage from various formats (e.g., "23%", "23", "0.23")
 */
function parsePercentage(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;

  if (typeof value === 'number') {
    // If number is between 0 and 1, assume it's already a decimal
    if (value > 0 && value <= 1) return value;
    // If number is between 1 and 100, assume it's a percentage
    if (value > 1 && value <= 100) return value / 100;
    return 0;
  }

  const str = String(value).trim();
  if (!str) return 0;

  // Remove % symbol and spaces
  let cleaned = str.replace(/[%\s]/g, '');

  // Handle Portuguese decimal format
  cleaned = cleaned.replace(',', '.');

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;

  // If number is between 0 and 1, assume it's already a decimal
  if (num > 0 && num <= 1) return num;
  // If number is between 1 and 100, assume it's a percentage
  if (num > 1 && num <= 100) return num / 100;

  return 0;
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
    // Check if comma is decimal separator
    if (/\d+,\d{1,2}$/.test(cleaned)) {
      // Format: 1.234,56 or 1234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Format might be 1,234.56 (US format)
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : Math.abs(amount);
}

/**
 * Generate summary from records
 */
function generateSummary(records: ATReciboRecord[]): ATSummary {
  const byNIF = new Map<string, ATNIFSummary>();
  const byCategoria = new Map<ATCategoria, number>();

  let totalBruto = 0;
  let totalRetencao = 0;
  let totalLiquido = 0;

  for (const record of records) {
    // Totals
    totalBruto += record.valorBruto;
    totalRetencao += record.retencao;
    totalLiquido += record.valorLiquido;

    // By NIF
    const key = record.nif || 'SEM_NIF';
    if (!byNIF.has(key)) {
      byNIF.set(key, {
        nif: record.nif,
        nome: record.nomeEmitente,
        categoria: record.categoria,
        totalBruto: 0,
        totalRetencao: 0,
        totalLiquido: 0,
        numRecibos: 0,
        records: [],
      });
    }
    const nifSummary = byNIF.get(key)!;
    nifSummary.totalBruto += record.valorBruto;
    nifSummary.totalRetencao += record.retencao;
    nifSummary.totalLiquido += record.valorLiquido;
    nifSummary.numRecibos += 1;
    nifSummary.records.push(record);

    // By category
    const catTotal = byCategoria.get(record.categoria) || 0;
    byCategoria.set(record.categoria, catTotal + record.valorBruto);
  }

  return {
    totalRecords: records.length,
    totalBruto,
    totalRetencao,
    totalLiquido,
    byNIF,
    byCategoria,
  };
}

/**
 * Create empty summary
 */
function createEmptySummary(): ATSummary {
  return {
    totalRecords: 0,
    totalBruto: 0,
    totalRetencao: 0,
    totalLiquido: 0,
    byNIF: new Map(),
    byCategoria: new Map(),
  };
}

// ============ EXPORT FUNCTIONS ============

/**
 * Convert ATNIFSummary to Modelo 10 format for import
 */
export function convertToModelo10Format(
  summary: ATSummary,
  year: number
): Array<{
  beneficiary_nif: string;
  beneficiary_name: string;
  income_category: string;
  gross_amount: number;
  withholding_amount: number;
  withholding_rate: number;
  fiscal_region: string;
  payment_date: string;
}> {
  const results: Array<{
    beneficiary_nif: string;
    beneficiary_name: string;
    income_category: string;
    gross_amount: number;
    withholding_amount: number;
    withholding_rate: number;
    fiscal_region: string;
    payment_date: string;
  }> = [];

  for (const [, nifData] of summary.byNIF) {
    if (!nifData.nif || nifData.nif === 'SEM_NIF') continue;

    // Map AT category to Modelo 10 category
    const incomeCategory = mapCategoriaToModelo10(nifData.categoria);

    results.push({
      beneficiary_nif: nifData.nif,
      beneficiary_name: nifData.nome,
      income_category: incomeCategory,
      gross_amount: nifData.totalBruto,
      withholding_amount: nifData.totalRetencao,
      withholding_rate: nifData.totalBruto > 0
        ? (nifData.totalRetencao / nifData.totalBruto) * 100
        : 25,
      fiscal_region: 'C', // Continental by default
      payment_date: `${year}-12-31`, // End of year for annual summary
    });
  }

  return results;
}

/**
 * Map AT category to Modelo 10 income category code
 */
function mapCategoriaToModelo10(categoria: ATCategoria): string {
  switch (categoria) {
    case 'B_INDEPENDENTES':
      return 'B';
    case 'F_PREDIAIS':
      return 'F';
    case 'E_CAPITAIS':
      return 'E';
    case 'H_PENSOES':
      return 'H';
    default:
      return 'B'; // Default to independent work
  }
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
 * Get category display name
 */
export function getCategoriaDisplayName(categoria: ATCategoria): string {
  switch (categoria) {
    case 'B_INDEPENDENTES':
      return 'B. Trabalho Independente';
    case 'F_PREDIAIS':
      return 'F. Rendimentos Prediais';
    case 'E_CAPITAIS':
      return 'E. Rendimentos de Capitais';
    case 'H_PENSOES':
      return 'H. Pensões';
    default:
      return 'Outro';
  }
}
