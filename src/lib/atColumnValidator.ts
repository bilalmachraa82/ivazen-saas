/**
 * AT Column Validator
 * Validates the "yellow columns" (mandatory fields) in AT Portal das Finanças Excel exports
 *
 * Yellow columns in AT exports are mandatory fields that must be present
 * and contain valid data for proper processing.
 *
 * For ListaRecibos (Recibos de Renda):
 * - Referência: Property reference
 * - Nº de Contrato: Contract number
 * - Locador: Landlord name
 * - Valor (€): Gross rental amount
 * - Retenção IRS (€): Withholding amount
 * - Importância recebida (€): Net amount received
 *
 * For Recibos Verdes:
 * - NIF: Tax ID
 * - Emitente: Issuer name
 * - Valor: Gross amount
 * - Retenção: Withholding amount
 */

import { ATReciboRecord, ATParseResult } from './atRecibosParser';
import { validatePortugueseNIF } from './nifValidator';

// ============ TYPES ============

export interface ColumnValidationResult {
  valid: boolean;
  column: string;
  columnPT: string;        // Portuguese column name
  isYellow: boolean;       // Is this a "yellow" (mandatory) column?
  value: any;
  error?: string;
  warning?: string;
}

export interface RecordValidationResult {
  recordId: string;
  linha: number;
  valid: boolean;
  criticalErrors: ColumnValidationResult[];
  warnings: ColumnValidationResult[];
  allResults: ColumnValidationResult[];
}

export interface FileValidationResult {
  filename: string;
  fileType: 'recibos_verdes' | 'rendas' | 'unknown';
  valid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  recordResults: RecordValidationResult[];
  summary: ValidationSummary;
}

export interface ValidationSummary {
  yellowColumnsPresent: string[];
  yellowColumnsMissing: string[];
  criticalErrorCount: number;
  warningCount: number;
  commonErrors: Map<string, number>;
  recommendations: string[];
}

// ============ YELLOW COLUMN DEFINITIONS ============

interface YellowColumnDef {
  key: string;
  namePT: string;
  nameEN: string;
  required: boolean;
  fileTypes: ('recibos_verdes' | 'rendas' | 'both')[];
  validator: (value: any, record: ATReciboRecord) => { valid: boolean; error?: string };
}

const YELLOW_COLUMNS: YellowColumnDef[] = [
  // Reference/NIF - Yellow column
  {
    key: 'referencia',
    namePT: 'Referência',
    nameEN: 'Reference',
    required: true,
    fileTypes: ['both'],
    validator: (value) => {
      if (!value || value.trim() === '') {
        return { valid: false, error: 'Referência obrigatória está vazia' };
      }
      return { valid: true };
    },
  },
  // Contract number - Yellow column for rentals
  {
    key: 'numContrato',
    namePT: 'Nº de Contrato',
    nameEN: 'Contract Number',
    required: true,
    fileTypes: ['rendas'],
    validator: (value) => {
      if (!value || value.trim() === '') {
        return { valid: false, error: 'Número de contrato obrigatório está vazio' };
      }
      return { valid: true };
    },
  },
  // Locador/Emitente name - Yellow column
  {
    key: 'nomeEmitente',
    namePT: 'Locador/Emitente',
    nameEN: 'Issuer/Landlord Name',
    required: true,
    fileTypes: ['both'],
    validator: (value) => {
      if (!value || value.trim() === '') {
        return { valid: false, error: 'Nome do emitente/locador obrigatório está vazio' };
      }
      if (value.trim().length < 3) {
        return { valid: false, error: 'Nome do emitente/locador demasiado curto' };
      }
      return { valid: true };
    },
  },
  // NIF - Yellow column (when available)
  {
    key: 'nif',
    namePT: 'NIF',
    nameEN: 'Tax ID',
    required: false, // May not be in all exports
    fileTypes: ['both'],
    validator: (value) => {
      if (!value || value.trim() === '') {
        return { valid: true }; // NIF may not be present in all exports
      }
      const nifResult = validatePortugueseNIF(value);
      if (!nifResult.valid) {
        return { valid: false, error: `NIF inválido: ${nifResult.error}` };
      }
      return { valid: true };
    },
  },
  // Valor (€) - Yellow column
  {
    key: 'valorBruto',
    namePT: 'Valor (€)',
    nameEN: 'Gross Amount',
    required: true,
    fileTypes: ['both'],
    validator: (value) => {
      if (value === undefined || value === null) {
        return { valid: false, error: 'Valor bruto obrigatório está vazio' };
      }
      if (typeof value === 'number' && value < 0) {
        return { valid: false, error: 'Valor bruto não pode ser negativo' };
      }
      if (typeof value === 'number' && value === 0) {
        return { valid: false, error: 'Valor bruto é zero' };
      }
      return { valid: true };
    },
  },
  // Retenção IRS (€) - Yellow column
  {
    key: 'retencao',
    namePT: 'Retenção IRS (€)',
    nameEN: 'Withholding Amount',
    required: true,
    fileTypes: ['both'],
    validator: (value, record) => {
      if (value === undefined || value === null) {
        return { valid: false, error: 'Valor de retenção obrigatório está vazio' };
      }
      if (typeof value === 'number' && value < 0) {
        return { valid: false, error: 'Valor de retenção não pode ser negativo' };
      }
      // Validate retention rate is reasonable (between 0% and 50%)
      if (record.valorBruto > 0) {
        const rate = value / record.valorBruto;
        if (rate > 0.5) {
          return { valid: false, error: `Taxa de retenção muito alta: ${(rate * 100).toFixed(1)}%` };
        }
      }
      return { valid: true };
    },
  },
  // Importância recebida (€) - Yellow column
  {
    key: 'valorLiquido',
    namePT: 'Importância recebida (€)',
    nameEN: 'Net Amount',
    required: true,
    fileTypes: ['both'],
    validator: (value, record) => {
      if (value === undefined || value === null) {
        return { valid: false, error: 'Valor líquido obrigatório está vazio' };
      }
      if (typeof value === 'number' && value < 0) {
        return { valid: false, error: 'Valor líquido não pode ser negativo' };
      }
      // Validate net = gross - retention
      const expectedNet = record.valorBruto - record.retencao;
      const tolerance = 0.01; // Allow 1 cent difference for rounding
      if (Math.abs(value - expectedNet) > tolerance) {
        return {
          valid: false,
          error: `Valor líquido ${value.toFixed(2)}€ não corresponde ao cálculo (${expectedNet.toFixed(2)}€)`,
        };
      }
      return { valid: true };
    },
  },
  // Data - Yellow column
  {
    key: 'dataInicio',
    namePT: 'Data',
    nameEN: 'Date',
    required: true,
    fileTypes: ['both'],
    validator: (value) => {
      if (!value) {
        return { valid: false, error: 'Data obrigatória está vazia' };
      }
      if (value instanceof Date && isNaN(value.getTime())) {
        return { valid: false, error: 'Data inválida' };
      }
      // Check reasonable date range (not in the future, not too old)
      if (value instanceof Date) {
        const now = new Date();
        if (value > now) {
          return { valid: false, error: 'Data está no futuro' };
        }
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        if (value < fiveYearsAgo) {
          return { valid: false, error: 'Data é demasiado antiga (mais de 5 anos)' };
        }
      }
      return { valid: true };
    },
  },
];

// ============ MAIN VALIDATION FUNCTIONS ============

/**
 * Validate a single AT record against yellow column rules
 */
export function validateRecord(
  record: ATReciboRecord,
  fileType: 'recibos_verdes' | 'rendas' | 'unknown'
): RecordValidationResult {
  const allResults: ColumnValidationResult[] = [];
  const criticalErrors: ColumnValidationResult[] = [];
  const warnings: ColumnValidationResult[] = [];

  for (const colDef of YELLOW_COLUMNS) {
    // Skip columns not applicable to this file type
    if (fileType !== 'unknown' &&
        !colDef.fileTypes.includes('both') &&
        !colDef.fileTypes.includes(fileType)) {
      continue;
    }

    const value = (record as any)[colDef.key];
    const validation = colDef.validator(value, record);

    const result: ColumnValidationResult = {
      valid: validation.valid,
      column: colDef.key,
      columnPT: colDef.namePT,
      isYellow: colDef.required,
      value: formatValueForDisplay(value),
      error: validation.error,
    };

    allResults.push(result);

    if (!validation.valid) {
      if (colDef.required) {
        criticalErrors.push(result);
      } else {
        warnings.push(result);
      }
    }
  }

  return {
    recordId: record.id,
    linha: record.linha,
    valid: criticalErrors.length === 0,
    criticalErrors,
    warnings,
    allResults,
  };
}

/**
 * Validate an entire AT parse result
 */
export function validateATParseResult(result: ATParseResult): FileValidationResult {
  const recordResults: RecordValidationResult[] = [];
  let validRecords = 0;
  let invalidRecords = 0;
  const commonErrors = new Map<string, number>();

  for (const record of result.records) {
    const validation = validateRecord(record, result.fileType);
    recordResults.push(validation);

    if (validation.valid) {
      validRecords++;
    } else {
      invalidRecords++;
      // Track common errors
      for (const err of validation.criticalErrors) {
        const key = err.error || 'Unknown error';
        commonErrors.set(key, (commonErrors.get(key) || 0) + 1);
      }
    }
  }

  // Determine which yellow columns are present
  const yellowColumnsPresent: string[] = [];
  const yellowColumnsMissing: string[] = [];

  for (const colDef of YELLOW_COLUMNS) {
    if (!colDef.required) continue;

    const hasColumn = result.records.some(r => {
      const value = (r as any)[colDef.key];
      return value !== undefined && value !== null && value !== '';
    });

    if (hasColumn) {
      yellowColumnsPresent.push(colDef.namePT);
    } else {
      yellowColumnsMissing.push(colDef.namePT);
    }
  }

  // Generate recommendations
  const recommendations = generateRecommendations(
    commonErrors,
    yellowColumnsMissing,
    result.fileType
  );

  const summary: ValidationSummary = {
    yellowColumnsPresent,
    yellowColumnsMissing,
    criticalErrorCount: recordResults.reduce((sum, r) => sum + r.criticalErrors.length, 0),
    warningCount: recordResults.reduce((sum, r) => sum + r.warnings.length, 0),
    commonErrors,
    recommendations,
  };

  return {
    filename: result.records[0]?.ficheiro || 'unknown',
    fileType: result.fileType,
    valid: invalidRecords === 0 && yellowColumnsMissing.length === 0,
    totalRecords: result.records.length,
    validRecords,
    invalidRecords,
    recordResults,
    summary,
  };
}

/**
 * Quick validation check for a parse result
 */
export function quickValidate(result: ATParseResult): {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  firstErrors: string[];
} {
  let errorCount = 0;
  let warningCount = 0;
  const firstErrors: string[] = [];

  for (const record of result.records) {
    const validation = validateRecord(record, result.fileType);
    errorCount += validation.criticalErrors.length;
    warningCount += validation.warnings.length;

    if (firstErrors.length < 5) {
      for (const err of validation.criticalErrors) {
        if (firstErrors.length < 5 && err.error) {
          firstErrors.push(`Linha ${record.linha}: ${err.error}`);
        }
      }
    }
  }

  return {
    valid: errorCount === 0,
    errorCount,
    warningCount,
    firstErrors,
  };
}

// ============ HELPER FUNCTIONS ============

/**
 * Format a value for display in validation results
 */
function formatValueForDisplay(value: any): string {
  if (value === undefined || value === null) {
    return '(vazio)';
  }
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-PT');
  }
  if (typeof value === 'number') {
    return value.toFixed(2) + '€';
  }
  return String(value);
}

/**
 * Generate recommendations based on validation results
 */
function generateRecommendations(
  commonErrors: Map<string, number>,
  missingColumns: string[],
  fileType: 'recibos_verdes' | 'rendas' | 'unknown'
): string[] {
  const recommendations: string[] = [];

  // Missing columns
  if (missingColumns.length > 0) {
    recommendations.push(
      `Colunas obrigatórias em falta: ${missingColumns.join(', ')}. ` +
      'Verifique se está a usar o ficheiro correto do Portal das Finanças.'
    );
  }

  // Common error patterns
  for (const [error, count] of commonErrors) {
    if (count > 5) {
      if (error.includes('NIF')) {
        recommendations.push(
          `${count} registos com problemas de NIF. ` +
          'Verifique se os NIFs estão no formato correto (9 dígitos).'
        );
      } else if (error.includes('retenção')) {
        recommendations.push(
          `${count} registos com problemas na retenção. ` +
          'Verifique se as taxas de retenção estão corretas (25% para Cat. B, 28% para Cat. F).'
        );
      } else if (error.includes('valor')) {
        recommendations.push(
          `${count} registos com problemas nos valores. ` +
          'Verifique se os valores estão no formato correto (usar vírgula como separador decimal).'
        );
      }
    }
  }

  // File type specific
  if (fileType === 'unknown') {
    recommendations.push(
      'Tipo de ficheiro não identificado. ' +
      'Use ficheiros exportados diretamente do Portal das Finanças AT.'
    );
  }

  return recommendations;
}

// ============ EXPORTS ============

/**
 * Get list of yellow (mandatory) columns
 */
export function getYellowColumns(
  fileType: 'recibos_verdes' | 'rendas' = 'rendas'
): Array<{ key: string; name: string; description: string }> {
  return YELLOW_COLUMNS
    .filter(col => col.required && (col.fileTypes.includes('both') || col.fileTypes.includes(fileType)))
    .map(col => ({
      key: col.key,
      name: col.namePT,
      description: col.nameEN,
    }));
}

/**
 * Format validation result as text report
 */
export function formatValidationReport(result: FileValidationResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('RELATÓRIO DE VALIDAÇÃO AT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Ficheiro: ${result.filename}`);
  lines.push(`Tipo: ${result.fileType === 'rendas' ? 'Recibos de Renda' : 'Recibos Verdes'}`);
  lines.push(`Estado: ${result.valid ? '✓ VÁLIDO' : '✗ INVÁLIDO'}`);
  lines.push('');
  lines.push(`Total de registos: ${result.totalRecords}`);
  lines.push(`Registos válidos: ${result.validRecords}`);
  lines.push(`Registos inválidos: ${result.invalidRecords}`);
  lines.push('');

  lines.push('COLUNAS OBRIGATÓRIAS (AMARELAS):');
  lines.push('-'.repeat(40));
  for (const col of result.summary.yellowColumnsPresent) {
    lines.push(`  ✓ ${col}`);
  }
  for (const col of result.summary.yellowColumnsMissing) {
    lines.push(`  ✗ ${col} (EM FALTA)`);
  }
  lines.push('');

  if (result.summary.criticalErrorCount > 0) {
    lines.push('ERROS CRÍTICOS:');
    lines.push('-'.repeat(40));
    for (const [error, count] of result.summary.commonErrors) {
      lines.push(`  ${count}x ${error}`);
    }
    lines.push('');
  }

  if (result.summary.recommendations.length > 0) {
    lines.push('RECOMENDAÇÕES:');
    lines.push('-'.repeat(40));
    for (const rec of result.summary.recommendations) {
      lines.push(`  • ${rec}`);
    }
  }

  return lines.join('\n');
}
