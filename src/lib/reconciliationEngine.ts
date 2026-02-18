/**
 * Reconciliation Engine
 * Motor de comparação multi-fonte para validação Zero-Delta
 * Compara: Excel (verdade) vs IA (extraído) vs AT (e-Fatura)
 */

import { validateNIF } from '@/components/ui/nif-input';
import * as XLSX from 'xlsx';

// ============= TYPES =============

export type ReconciliationType = 'iva' | 'modelo10' | 'ambos';
export type MatchStatus = 'perfect' | 'within_tolerance' | 'discrepancy' | 'missing' | 'extra';

export interface ExcelRecord {
  rowNumber: number;
  nif: string;
  name?: string;
  documentDate?: Date;
  documentReference?: string;
  // IVA fields
  totalAmount?: number;
  baseStandard?: number;    // Base 23%
  vatStandard?: number;     // IVA 23%
  baseIntermediate?: number; // Base 13%
  vatIntermediate?: number;  // IVA 13%
  baseReduced?: number;      // Base 6%
  vatReduced?: number;       // IVA 6%
  baseExempt?: number;       // Isento
  // Modelo 10 fields
  grossAmount?: number;
  withholdingAmount?: number;
  withholdingRate?: number;
  netAmount?: number;
  incomeCategory?: string;
}

export interface ExtractedRecord {
  id?: string;
  fileName?: string;
  nif: string;
  name?: string;
  documentDate?: Date;
  documentReference?: string;
  totalAmount?: number;
  baseStandard?: number;
  vatStandard?: number;
  baseIntermediate?: number;
  vatIntermediate?: number;
  baseReduced?: number;
  vatReduced?: number;
  baseExempt?: number;
  grossAmount?: number;
  withholdingAmount?: number;
  withholdingRate?: number;
  netAmount?: number;
  incomeCategory?: string;
  confidence?: number;
}

export interface MatchedRecord {
  status: MatchStatus;
  excel: ExcelRecord;
  extracted?: ExtractedRecord;
  at?: ExtractedRecord;
  deltas: {
    totalAmount?: number;
    vatTotal?: number;
    grossAmount?: number;
    withholdingAmount?: number;
  };
  totalDelta: number;
}

export interface Discrepancy {
  field: string;
  excelValue: number | string;
  systemValue: number | string;
  delta: number | string;
  severity: 'warning' | 'error' | 'critical';
}

export interface ReconciliationInput {
  excelRecords: ExcelRecord[];
  extractedRecords: ExtractedRecord[];
  atRecords?: ExtractedRecord[];
  type: ReconciliationType;
  toleranceEur?: number;
}

export interface ReconciliationSummary {
  totalExcel: number;
  totalExtracted: number;
  totalAT?: number;
  matchRate: number;
  perfectMatches: number;
  withinTolerance: number;
  outsideTolerance: number;
  missing: number;
  extra: number;
}

export interface IVAReconciliation {
  vatDeductibleExcel: number;
  vatDeductibleSystem: number;
  deltaVat: number;
  vatLiquidatedExcel?: number;
  vatLiquidatedSystem?: number;
  deltaVatLiquidated?: number;
  balanceExcel?: number;
  balanceSystem?: number;
  deltaBalance?: number;
}

export interface Modelo10Reconciliation {
  grossIncomeExcel: number;
  grossIncomeSystem: number;
  withholdingExcel: number;
  withholdingSystem: number;
  deltaGross: number;
  deltaWithholding: number;
  uniqueNifsExcel: number;
  uniqueNifsSystem: number;
}

export interface ReconciliationResult {
  matches: MatchedRecord[];
  discrepancies: Discrepancy[];
  missing: ExcelRecord[];
  extra: ExtractedRecord[];
  summary: ReconciliationSummary;
  ivaRecon?: IVAReconciliation;
  modelo10Recon?: Modelo10Reconciliation;
  isZeroDelta: boolean;
  auditTimestamp: Date;
}

// ============= EXCEL PARSING =============

interface ColumnMapping {
  nif?: number;
  name?: number;
  date?: number;
  reference?: number;
  total?: number;
  baseStandard?: number;
  vatStandard?: number;
  baseIntermediate?: number;
  vatIntermediate?: number;
  baseReduced?: number;
  vatReduced?: number;
  baseExempt?: number;
  gross?: number;
  withholding?: number;
  withholdingRate?: number;
  net?: number;
  category?: number;
}

const COLUMN_PATTERNS: Record<string, RegExp[]> = {
  nif: [
    /nif/i, 
    /contribuinte/i, 
    /fiscal/i, 
    /nif\s*fornec/i, 
    /nif\s*sujeito/i, 
    /n[ºo]\s*contrib/i,
    /emitente/i,
    /suj.*passivo/i,
  ],
  name: [
    /nome/i, 
    /fornecedor/i, 
    /benefici[aá]rio/i, 
    /entidade/i, 
    /designa[çc][aã]o/i,
    /raz[aã]o\s*social/i,
  ],
  date: [
    /data/i, 
    /date/i, 
    /dt\.?/i, 
    /data\s*doc/i, 
    /data\s*emiss/i,
    /data\s*fatura/i,
    /data\s*factura/i,
  ],
  reference: [
    /refer[eê]ncia/i, 
    /documento/i, 
    /n[uú]mero/i, 
    /doc/i, 
    /fatura/i, 
    /factura/i,
    /n[ºo]\s*doc/i,
  ],
  total: [
    /total/i, 
    /valor\s*total/i, 
    /montante/i, 
    /valor\s*bruto/i, 
    /bruto/i, 
    /total\s*doc/i,
    /vlr\s*total/i,
  ],
  baseStandard: [/base.*23/i, /base.*normal/i, /incid.*23/i, /mat.*colect.*23/i],
  vatStandard: [/iva.*23/i, /imposto.*23/i, /i\.v\.a\..*23/i, /taxa.*23/i],
  baseIntermediate: [/base.*13/i, /base.*interm/i, /incid.*13/i],
  vatIntermediate: [/iva.*13/i, /imposto.*13/i],
  baseReduced: [/base.*6/i, /base.*reduzid/i, /incid.*6/i],
  vatReduced: [/iva.*6/i, /imposto.*6/i],
  baseExempt: [/isento/i, /exempt/i, /base.*0/i, /s\/iva/i, /sem\s*iva/i],
  gross: [/bruto/i, /gross/i, /rendimento/i, /valor\s*il[ií]quido/i],
  withholding: [/reten[çc][aã]o/i, /withhold/i, /imposto.*retido/i, /irs/i],
  withholdingRate: [/taxa/i, /rate/i, /%/, /percentagem/i],
  net: [/l[ií]quido/i, /net/i, /a\s*receber/i],
  category: [/categoria/i, /category/i, /tipo/i, /classif/i],
};

function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  
  headers.forEach((header, index) => {
    const headerLower = header?.toString().toLowerCase() || '';
    
    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      if (patterns.some(p => p.test(headerLower))) {
        (mapping as any)[field] = index;
        break;
      }
    }
  });
  
  return mapping;
}

function parseExcelDate(value: any): Date | undefined {
  if (!value) return undefined;
  
  // Excel serial date
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? undefined : date;
  }
  
  // String date
  if (typeof value === 'string') {
    // Try DD/MM/YYYY or DD-MM-YYYY
    const ptMatch = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ptMatch) {
      const [, day, month, year] = ptMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Try ISO format
    const isoDate = new Date(value);
    return isNaN(isoDate.getTime()) ? undefined : isoDate;
  }
  
  return undefined;
}

function parseNumericValue(value: any): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    // Handle Portuguese format: 1.234,56
    const cleaned = value
      .replace(/[€\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }
  
  return undefined;
}

export function detectReconciliationType(records: ExcelRecord[]): ReconciliationType {
  const hasIvaFields = records.some(r => 
    r.vatStandard !== undefined || 
    r.vatIntermediate !== undefined || 
    r.vatReduced !== undefined
  );
  
  const hasModelo10Fields = records.some(r => 
    r.grossAmount !== undefined || 
    r.withholdingAmount !== undefined
  );
  
  if (hasIvaFields && hasModelo10Fields) return 'ambos';
  if (hasModelo10Fields) return 'modelo10';
  return 'iva';
}

export async function parseExcelReference(file: File): Promise<{
  records: ExcelRecord[];
  type: ReconciliationType;
  headers: string[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // Use first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          reject(new Error('Excel vazio ou sem dados'));
          return;
        }
        
        // INTELLIGENT HEADER DETECTION: Scan first 10 rows to find header row
        let headerRowIndex = 0;
        let headers: string[] = [];
        
        const HEADER_KEYWORDS = /nif|contribuinte|data|total|valor|fatura|factura|documento|emitente|fornecedor|referência|montante|base|iva|incidência/i;
        
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          const row = jsonData[i];
          if (!row || row.length < 2) continue;
          
          const rowAsStrings = row.map(cell => String(cell || '').toLowerCase());
          
          // Count how many cells look like headers
          const headerLikeCount = rowAsStrings.filter(cell => 
            cell.length > 0 && cell.length < 50 && HEADER_KEYWORDS.test(cell)
          ).length;
          
          // If at least 2 header-like cells found, this is probably the header row
          if (headerLikeCount >= 2) {
            headerRowIndex = i;
            headers = row.map(h => String(h || ''));
            console.log(`[ReconciliationEngine] Header detectado na linha ${i + 1}:`, headers.slice(0, 5));
            break;
          }
        }
        
        // Fallback to first row if no header detected
        if (headers.length === 0) {
          headers = jsonData[0]?.map(h => String(h || '')) || [];
          warnings.push(`Linha de cabeçalho não detectada, usando linha 1`);
        }
        
        console.log(`[ReconciliationEngine] Headers finais (${headers.length}):`, headers);
        
        const mapping = detectColumnMapping(headers);
        
        console.log(`[ReconciliationEngine] Mapeamento detectado:`, Object.entries(mapping).filter(([_, v]) => v !== undefined));
        
        // Check required fields - fallback NIF detection
        if (mapping.nif === undefined) {
          // Fallback: procurar primeira coluna com valores de 9 dígitos numéricos
          for (let col = 0; col < headers.length; col++) {
            let nifCount = 0;
            for (let row = headerRowIndex + 1; row < Math.min(jsonData.length, headerRowIndex + 15); row++) {
              const cellValue = String(jsonData[row]?.[col] || '').replace(/\D/g, '');
              if (cellValue.length === 9 && /^\d{9}$/.test(cellValue)) {
                nifCount++;
              }
            }
            if (nifCount >= 3) {
              mapping.nif = col;
              warnings.push(`Coluna "${headers[col] || `Coluna ${col + 1}`}" detectada como NIF (fallback)`);
              console.log(`[ReconciliationEngine] NIF fallback: coluna ${col} (${headers[col]})`);
              break;
            }
          }
          
          if (mapping.nif === undefined) {
            warnings.push('Coluna de NIF não detectada - verifique se o Excel tem coluna de NIF');
          }
        }
        
        const records: ExcelRecord[] = [];
        
        // Process data rows (starting after header row)
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.every(cell => !cell)) continue; // Skip empty rows
          
          const nif = mapping.nif !== undefined ? String(row[mapping.nif] || '').replace(/\D/g, '') : '';
          
          // Skip rows without valid 9-digit NIF but don't fail completely
          if (!nif || nif.length !== 9) {
            // Only warn if it looks like it might be data (has some content)
            if (nif && nif.length > 0 && nif.length !== 9) {
              warnings.push(`Linha ${i + 1}: NIF inválido "${nif}" (${nif.length} dígitos)`);
            }
            continue;
          }
          
          // Validate NIF checksum (warning only, don't skip)
          const nifValidation = validateNIF(nif, { required: true });
          if (!nifValidation.valid) {
            warnings.push(`Linha ${i + 1}: NIF ${nif} falha checksum (incluído mesmo assim)`);
          }
          
          const record: ExcelRecord = {
            rowNumber: i + 1,
            nif,
            name: mapping.name !== undefined ? String(row[mapping.name] || '') : undefined,
            documentDate: mapping.date !== undefined ? parseExcelDate(row[mapping.date]) : undefined,
            documentReference: mapping.reference !== undefined ? String(row[mapping.reference] || '') : undefined,
            totalAmount: mapping.total !== undefined ? parseNumericValue(row[mapping.total]) : undefined,
            baseStandard: mapping.baseStandard !== undefined ? parseNumericValue(row[mapping.baseStandard]) : undefined,
            vatStandard: mapping.vatStandard !== undefined ? parseNumericValue(row[mapping.vatStandard]) : undefined,
            baseIntermediate: mapping.baseIntermediate !== undefined ? parseNumericValue(row[mapping.baseIntermediate]) : undefined,
            vatIntermediate: mapping.vatIntermediate !== undefined ? parseNumericValue(row[mapping.vatIntermediate]) : undefined,
            baseReduced: mapping.baseReduced !== undefined ? parseNumericValue(row[mapping.baseReduced]) : undefined,
            vatReduced: mapping.vatReduced !== undefined ? parseNumericValue(row[mapping.vatReduced]) : undefined,
            baseExempt: mapping.baseExempt !== undefined ? parseNumericValue(row[mapping.baseExempt]) : undefined,
            grossAmount: mapping.gross !== undefined ? parseNumericValue(row[mapping.gross]) : undefined,
            withholdingAmount: mapping.withholding !== undefined ? parseNumericValue(row[mapping.withholding]) : undefined,
            withholdingRate: mapping.withholdingRate !== undefined ? parseNumericValue(row[mapping.withholdingRate]) : undefined,
            netAmount: mapping.net !== undefined ? parseNumericValue(row[mapping.net]) : undefined,
            incomeCategory: mapping.category !== undefined ? String(row[mapping.category] || '') : undefined,
          };
          
          records.push(record);
        }
        
        const type = detectReconciliationType(records);
        
        resolve({ records, type, headers, warnings });
      } catch (error: any) {
        reject(new Error(`Erro ao processar Excel: ${error.message}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler ficheiro'));
    reader.readAsArrayBuffer(file);
  });
}

// ============= MATCHING ENGINE =============

function normalizeDate(date?: Date): string {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calculateDelta(a?: number, b?: number): number {
  const valA = a ?? 0;
  const valB = b ?? 0;
  return Math.abs(valA - valB);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function matchRecords(input: ReconciliationInput): ReconciliationResult {
  const { excelRecords, extractedRecords, atRecords, type, toleranceEur = 0.01 } = input;
  
  const matches: MatchedRecord[] = [];
  const discrepancies: Discrepancy[] = [];
  const missing: ExcelRecord[] = [];
  const extra: ExtractedRecord[] = [...extractedRecords];
  
  // Process each Excel record
  for (const excel of excelRecords) {
    // Try exact match: NIF + Date + Amount
    let matchIndex = extra.findIndex(ext => {
      if (ext.nif !== excel.nif) return false;
      
      // If we have dates, they must match
      if (excel.documentDate && ext.documentDate) {
        if (normalizeDate(excel.documentDate) !== normalizeDate(ext.documentDate)) return false;
      }
      
      // Amount tolerance check
      const amountToCompare = type === 'modelo10' ? excel.grossAmount : excel.totalAmount;
      const extractedAmount = type === 'modelo10' ? ext.grossAmount : ext.totalAmount;
      
      if (amountToCompare !== undefined && extractedAmount !== undefined) {
        if (calculateDelta(amountToCompare, extractedAmount) > 1.00) return false;
      }
      
      return true;
    });
    
    // Try partial match: NIF only
    if (matchIndex === -1) {
      matchIndex = extra.findIndex(ext => ext.nif === excel.nif);
    }
    
    if (matchIndex === -1) {
      // No match found
      missing.push(excel);
      continue;
    }
    
    const extracted = extra.splice(matchIndex, 1)[0];
    
    // Calculate deltas
    const deltas = {
      totalAmount: calculateDelta(excel.totalAmount, extracted.totalAmount),
      vatTotal: calculateDelta(
        (excel.vatStandard ?? 0) + (excel.vatIntermediate ?? 0) + (excel.vatReduced ?? 0),
        (extracted.vatStandard ?? 0) + (extracted.vatIntermediate ?? 0) + (extracted.vatReduced ?? 0)
      ),
      grossAmount: calculateDelta(excel.grossAmount, extracted.grossAmount),
      withholdingAmount: calculateDelta(excel.withholdingAmount, extracted.withholdingAmount),
    };
    
    const totalDelta = type === 'modelo10' 
      ? deltas.grossAmount + deltas.withholdingAmount
      : deltas.totalAmount + deltas.vatTotal;
    
    // Determine status
    let status: MatchStatus;
    if (totalDelta === 0) {
      status = 'perfect';
    } else if (totalDelta <= toleranceEur) {
      status = 'within_tolerance';
    } else {
      status = 'discrepancy';
      
      // Log specific discrepancies
      if (type === 'iva') {
        if (deltas.totalAmount > toleranceEur) {
          discrepancies.push({
            field: 'Total',
            excelValue: excel.totalAmount ?? 0,
            systemValue: extracted.totalAmount ?? 0,
            delta: roundToTwoDecimals(deltas.totalAmount),
            severity: deltas.totalAmount > 1 ? 'error' : 'warning',
          });
        }
        if (deltas.vatTotal > toleranceEur) {
          discrepancies.push({
            field: 'IVA Total',
            excelValue: (excel.vatStandard ?? 0) + (excel.vatIntermediate ?? 0) + (excel.vatReduced ?? 0),
            systemValue: (extracted.vatStandard ?? 0) + (extracted.vatIntermediate ?? 0) + (extracted.vatReduced ?? 0),
            delta: roundToTwoDecimals(deltas.vatTotal),
            severity: deltas.vatTotal > 1 ? 'error' : 'warning',
          });
        }
      } else {
        if (deltas.grossAmount > toleranceEur) {
          discrepancies.push({
            field: 'Valor Bruto',
            excelValue: excel.grossAmount ?? 0,
            systemValue: extracted.grossAmount ?? 0,
            delta: roundToTwoDecimals(deltas.grossAmount),
            severity: deltas.grossAmount > 1 ? 'error' : 'warning',
          });
        }
        if (deltas.withholdingAmount > toleranceEur) {
          discrepancies.push({
            field: 'Retenção',
            excelValue: excel.withholdingAmount ?? 0,
            systemValue: extracted.withholdingAmount ?? 0,
            delta: roundToTwoDecimals(deltas.withholdingAmount),
            severity: deltas.withholdingAmount > 1 ? 'error' : 'warning',
          });
        }
      }
    }
    
    matches.push({
      status,
      excel,
      extracted,
      deltas,
      totalDelta: roundToTwoDecimals(totalDelta),
    });
  }
  
  // Calculate summary
  const perfectMatches = matches.filter(m => m.status === 'perfect').length;
  const withinTolerance = matches.filter(m => m.status === 'within_tolerance').length;
  const outsideTolerance = matches.filter(m => m.status === 'discrepancy').length;
  
  const summary: ReconciliationSummary = {
    totalExcel: excelRecords.length,
    totalExtracted: extractedRecords.length,
    totalAT: atRecords?.length,
    matchRate: excelRecords.length > 0 
      ? roundToTwoDecimals(((perfectMatches + withinTolerance) / excelRecords.length) * 100)
      : 0,
    perfectMatches,
    withinTolerance,
    outsideTolerance,
    missing: missing.length,
    extra: extra.length,
  };
  
  // Calculate IVA reconciliation
  let ivaRecon: IVAReconciliation | undefined;
  if (type === 'iva' || type === 'ambos') {
    const vatDeductibleExcel = excelRecords.reduce((sum, r) => 
      sum + (r.vatStandard ?? 0) + (r.vatIntermediate ?? 0) + (r.vatReduced ?? 0), 0);
    const vatDeductibleSystem = extractedRecords.reduce((sum, r) => 
      sum + (r.vatStandard ?? 0) + (r.vatIntermediate ?? 0) + (r.vatReduced ?? 0), 0);
    
    ivaRecon = {
      vatDeductibleExcel: roundToTwoDecimals(vatDeductibleExcel),
      vatDeductibleSystem: roundToTwoDecimals(vatDeductibleSystem),
      deltaVat: roundToTwoDecimals(Math.abs(vatDeductibleExcel - vatDeductibleSystem)),
    };
  }
  
  // Calculate Modelo 10 reconciliation
  let modelo10Recon: Modelo10Reconciliation | undefined;
  if (type === 'modelo10' || type === 'ambos') {
    const grossIncomeExcel = excelRecords.reduce((sum, r) => sum + (r.grossAmount ?? 0), 0);
    const grossIncomeSystem = extractedRecords.reduce((sum, r) => sum + (r.grossAmount ?? 0), 0);
    const withholdingExcel = excelRecords.reduce((sum, r) => sum + (r.withholdingAmount ?? 0), 0);
    const withholdingSystem = extractedRecords.reduce((sum, r) => sum + (r.withholdingAmount ?? 0), 0);
    
    const uniqueNifsExcel = new Set(excelRecords.map(r => r.nif)).size;
    const uniqueNifsSystem = new Set(extractedRecords.map(r => r.nif)).size;
    
    modelo10Recon = {
      grossIncomeExcel: roundToTwoDecimals(grossIncomeExcel),
      grossIncomeSystem: roundToTwoDecimals(grossIncomeSystem),
      withholdingExcel: roundToTwoDecimals(withholdingExcel),
      withholdingSystem: roundToTwoDecimals(withholdingSystem),
      deltaGross: roundToTwoDecimals(Math.abs(grossIncomeExcel - grossIncomeSystem)),
      deltaWithholding: roundToTwoDecimals(Math.abs(withholdingExcel - withholdingSystem)),
      uniqueNifsExcel,
      uniqueNifsSystem,
    };
  }
  
  // Determine if Zero Delta
  const isZeroDelta = missing.length === 0 && 
    extra.length === 0 && 
    outsideTolerance === 0 &&
    (ivaRecon?.deltaVat ?? 0) <= toleranceEur &&
    (modelo10Recon?.deltaGross ?? 0) <= toleranceEur &&
    (modelo10Recon?.deltaWithholding ?? 0) <= toleranceEur;
  
  return {
    matches,
    discrepancies,
    missing,
    extra,
    summary,
    ivaRecon,
    modelo10Recon,
    isZeroDelta,
    auditTimestamp: new Date(),
  };
}

// ============= REPORT GENERATION =============

export interface AuditReport {
  title: string;
  generatedAt: Date;
  clientName?: string;
  fiscalYear?: number;
  quarter?: number;
  result: ReconciliationResult;
  conclusion: 'APROVADO' | 'REPROVADO' | 'REQUER_REVISÃO';
  notes: string[];
}

export function generateAuditReport(
  result: ReconciliationResult,
  options: {
    clientName?: string;
    fiscalYear?: number;
    quarter?: number;
  } = {}
): AuditReport {
  const notes: string[] = [];
  
  if (result.missing.length > 0) {
    notes.push(`${result.missing.length} registos no Excel não encontrados na extracção`);
  }
  
  if (result.extra.length > 0) {
    notes.push(`${result.extra.length} registos extraídos não existem no Excel`);
  }
  
  if (result.summary.outsideTolerance > 0) {
    notes.push(`${result.summary.outsideTolerance} registos com discrepâncias acima da tolerância`);
  }
  
  let conclusion: AuditReport['conclusion'];
  if (result.isZeroDelta) {
    conclusion = 'APROVADO';
    notes.unshift('✅ Zero Delta alcançado - todos os valores conferem');
  } else if (result.summary.matchRate >= 95 && result.summary.outsideTolerance <= 2) {
    conclusion = 'REQUER_REVISÃO';
    notes.unshift('⚠️ Pequenas discrepâncias detectadas - revisão manual recomendada');
  } else {
    conclusion = 'REPROVADO';
    notes.unshift('❌ Discrepâncias significativas - reconciliação falhada');
  }
  
  return {
    title: 'Relatório de Auditoria de Reconciliação',
    generatedAt: new Date(),
    clientName: options.clientName,
    fiscalYear: options.fiscalYear,
    quarter: options.quarter,
    result,
    conclusion,
    notes,
  };
}

// ============= EXPORT UTILITIES =============

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function exportReportToText(report: AuditReport): string {
  const lines: string[] = [
    '═'.repeat(60),
    report.title.toUpperCase(),
    '═'.repeat(60),
    '',
    `Data: ${report.generatedAt.toLocaleString('pt-PT')}`,
  ];
  
  if (report.clientName) lines.push(`Cliente: ${report.clientName}`);
  if (report.fiscalYear) lines.push(`Ano Fiscal: ${report.fiscalYear}`);
  if (report.quarter) lines.push(`Trimestre: ${report.quarter}º`);
  
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('SUMÁRIO');
  lines.push('─'.repeat(60));
  lines.push(`Total no Excel:        ${report.result.summary.totalExcel}`);
  lines.push(`Total Extraído:        ${report.result.summary.totalExtracted}`);
  lines.push(`Taxa de Match:         ${report.result.summary.matchRate}%`);
  lines.push(`Matches Perfeitos:     ${report.result.summary.perfectMatches}`);
  lines.push(`Dentro Tolerância:     ${report.result.summary.withinTolerance}`);
  lines.push(`Fora Tolerância:       ${report.result.summary.outsideTolerance}`);
  lines.push(`Em Falta:              ${report.result.summary.missing}`);
  lines.push(`Extras:                ${report.result.summary.extra}`);
  
  if (report.result.ivaRecon) {
    lines.push('');
    lines.push('─'.repeat(60));
    lines.push('RECONCILIAÇÃO IVA');
    lines.push('─'.repeat(60));
    lines.push(`IVA Dedutível (Excel):   ${formatCurrency(report.result.ivaRecon.vatDeductibleExcel)}`);
    lines.push(`IVA Dedutível (Sistema): ${formatCurrency(report.result.ivaRecon.vatDeductibleSystem)}`);
    lines.push(`Delta:                   ${formatCurrency(report.result.ivaRecon.deltaVat)}`);
  }
  
  if (report.result.modelo10Recon) {
    lines.push('');
    lines.push('─'.repeat(60));
    lines.push('RECONCILIAÇÃO MODELO 10');
    lines.push('─'.repeat(60));
    lines.push(`Valor Bruto (Excel):     ${formatCurrency(report.result.modelo10Recon.grossIncomeExcel)}`);
    lines.push(`Valor Bruto (Sistema):   ${formatCurrency(report.result.modelo10Recon.grossIncomeSystem)}`);
    lines.push(`Delta Bruto:             ${formatCurrency(report.result.modelo10Recon.deltaGross)}`);
    lines.push('');
    lines.push(`Retenção (Excel):        ${formatCurrency(report.result.modelo10Recon.withholdingExcel)}`);
    lines.push(`Retenção (Sistema):      ${formatCurrency(report.result.modelo10Recon.withholdingSystem)}`);
    lines.push(`Delta Retenção:          ${formatCurrency(report.result.modelo10Recon.deltaWithholding)}`);
    lines.push('');
    lines.push(`NIFs Únicos (Excel):     ${report.result.modelo10Recon.uniqueNifsExcel}`);
    lines.push(`NIFs Únicos (Sistema):   ${report.result.modelo10Recon.uniqueNifsSystem}`);
  }
  
  lines.push('');
  lines.push('═'.repeat(60));
  lines.push(`CONCLUSÃO: ${report.conclusion}`);
  lines.push('═'.repeat(60));
  
  if (report.notes.length > 0) {
    lines.push('');
    lines.push('Notas:');
    report.notes.forEach(note => lines.push(`  • ${note}`));
  }
  
  return lines.join('\n');
}
