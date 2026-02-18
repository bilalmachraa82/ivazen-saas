/**
 * Universal Database Import Parser
 * Suporta importação de múltiplos tipos de dados com validação multi-camada
 */

import * as XLSX from 'xlsx';
import { validatePortugueseNIF } from './nifValidator';

// ============= TYPES =============

export type DataType = 'clients' | 'tax_withholdings' | 'invoices' | 'sales_invoices' | 'revenue_entries' | 'unknown';

export type DuplicateStrategy = 'skip' | 'update' | 'merge';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  autoDetected: boolean;
  transform?: (value: any) => any;
}

export interface ValidationResult {
  row: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  data?: Record<string, any>;
}

export interface ParsedData {
  type: DataType;
  headers: string[];
  rows: any[][];
  totalRows: number;
  mapping: ColumnMapping[];
  validationResults: ValidationResult[];
}

export interface ImportSummary {
  total: number;
  valid: number;
  withWarnings: number;
  withErrors: number;
  duplicates: number;
}

// ============= TYPE SIGNATURES =============

const TYPE_SIGNATURES: Record<DataType, string[]> = {
  clients: ['nome', 'contribuinte', 'nif', 'email', 'morada', 'estado', 'cliente', 'empresa', 'telefone', 'telemovel'],
  tax_withholdings: ['beneficiário', 'beneficiario', 'retenção', 'retencao', 'bruto', 'categoria', 'data pagamento', 'rendimento'],
  invoices: ['fornecedor', 'documento', 'iva', 'total', 'data', 'factura', 'fatura', 'supplier'],
  sales_invoices: ['cliente', 'venda', 'receita', 'factura emitida', 'faturacao'],
  revenue_entries: ['trimestre', 'rendimento', 'categoria', 'período', 'periodo', 'quarter'],
  unknown: [],
};

// ============= COLUMN MAPPINGS =============

const COLUMN_ALIASES: Record<string, string[]> = {
  // Client fields
  full_name: ['nome', 'name', 'nome completo', 'full_name', 'razão social', 'razao social', 'denominação', 'denominacao'],
  company_name: ['empresa', 'company', 'nome empresa', 'company_name', 'denominação social', 'denominacao social'],
  nif: ['nif', 'contribuinte', 'nº contribuinte', 'numero contribuinte', 'n contribuinte', 'tax_id', 'vat', 'vat_number'],
  email: ['email', 'e-mail', 'correio', 'mail'],
  phone: ['telefone', 'telemovel', 'telemóvel', 'phone', 'mobile', 'contacto'],
  address: ['morada', 'endereço', 'endereco', 'address', 'rua'],
  status: ['estado', 'status', 'situação', 'situacao', 'ativo', 'active'],
  
  // Tax withholding fields
  beneficiary_nif: ['nif beneficiário', 'nif beneficiario', 'nif', 'contribuinte', 'beneficiary_nif'],
  beneficiary_name: ['nome beneficiário', 'nome beneficiario', 'beneficiário', 'beneficiario', 'nome', 'beneficiary_name'],
  gross_amount: ['bruto', 'valor bruto', 'rendimento bruto', 'gross', 'gross_amount', 'valor'],
  withholding_amount: ['retenção', 'retencao', 'valor retenção', 'irs retido', 'withholding', 'withholding_amount'],
  withholding_rate: ['taxa', 'taxa retenção', 'rate', '%', 'percentagem'],
  payment_date: ['data pagamento', 'data', 'date', 'payment_date', 'data_pagamento'],
  income_category: ['categoria', 'category', 'cat', 'tipo rendimento', 'income_category'],
  document_reference: ['documento', 'referência', 'referencia', 'doc', 'document_reference', 'ref'],
  
  // Invoice fields
  supplier_nif: ['nif fornecedor', 'fornecedor nif', 'supplier_nif'],
  supplier_name: ['fornecedor', 'nome fornecedor', 'supplier', 'supplier_name'],
  document_number: ['número documento', 'numero documento', 'nº doc', 'document_number', 'factura'],
  document_date: ['data documento', 'data factura', 'document_date', 'data'],
  total_amount: ['total', 'valor total', 'total_amount', 'montante'],
  total_vat: ['iva', 'total iva', 'vat', 'total_vat'],
};

// ============= STATUS MAPPING =============

export const STATUS_MAPPING: Record<string, string> = {
  'adjudicado': 'active',
  'activo': 'active',
  'ativo': 'active',
  'active': 'active',
  'cessado em iva': 'inactive_vat',
  'cessado': 'inactive',
  'inactivo': 'inactive',
  'inativo': 'inactive',
  'inactive': 'inactive',
  'dissolvida': 'dissolved',
  'dissolved': 'dissolved',
  'renuncia na occ': 'resigned',
  'renunciado': 'resigned',
  'fim de contrato - fim de ano': 'contract_ended',
  'fim de contrato': 'contract_ended',
  'novo cc - fim de ano': 'new_contract',
  'novo cc - fim de mês': 'new_contract',
  'novo contrato': 'new_contract',
};

// ============= INCOME CATEGORY MAPPING =============

const INCOME_CATEGORY_MAPPING: Record<string, string> = {
  'a': 'A',
  'b': 'B',
  'e': 'E',
  'f': 'F',
  'g': 'G',
  'h': 'H',
  'trabalho dependente': 'A',
  'empresariais': 'B',
  'profissionais': 'B',
  'capitais': 'E',
  'prediais': 'F',
  'rendas': 'F',
  'mais-valias': 'G',
  'pensões': 'H',
  'pensoes': 'H',
};

// ============= CORE FUNCTIONS =============

/**
 * Parse Excel/CSV file and return structured data
 */
export function parseFile(file: File): Promise<{ headers: string[]; rows: any[][]; }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as any[][];
        
        if (jsonData.length < 2) {
          reject(new Error('Ficheiro deve ter pelo menos uma linha de cabeçalho e uma linha de dados'));
          return;
        }
        
        const headers = jsonData[0].map(h => String(h || '').trim().toLowerCase());
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));
        
        resolve({ headers, rows });
      } catch (error) {
        reject(new Error('Erro ao ler o ficheiro. Verifique se é um ficheiro Excel ou CSV válido.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler o ficheiro'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Detect data type based on column headers
 */
export function detectDataType(headers: string[]): DataType {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  const scores: Record<DataType, number> = {
    clients: 0,
    tax_withholdings: 0,
    invoices: 0,
    sales_invoices: 0,
    revenue_entries: 0,
    unknown: 0,
  };
  
  for (const [type, signatures] of Object.entries(TYPE_SIGNATURES)) {
    if (type === 'unknown') continue;
    
    for (const sig of signatures) {
      if (normalizedHeaders.some(h => h.includes(sig))) {
        scores[type as DataType] += 1;
      }
    }
  }
  
  // Find type with highest score
  let maxScore = 0;
  let detectedType: DataType = 'unknown';
  
  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedType = type as DataType;
    }
  }
  
  return maxScore >= 2 ? detectedType : 'unknown';
}

/**
 * Auto-detect column mapping
 */
export function autoMapColumns(headers: string[], dataType: DataType): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  for (const [targetField, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      if (aliases.some(alias => header.includes(alias) || alias.includes(header))) {
        // Check if not already mapped
        if (!mappings.some(m => m.sourceColumn === headers[i])) {
          mappings.push({
            sourceColumn: headers[i],
            targetField,
            autoDetected: true,
          });
          break;
        }
      }
    }
  }
  
  return mappings;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim() === '') return { valid: true }; // Optional
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Formato de email inválido' };
  }
  return { valid: true };
}

/**
 * Parse date from multiple formats
 */
export function parseDate(value: any): { valid: boolean; date?: string; error?: string } {
  if (!value) return { valid: false, error: 'Data obrigatória' };
  
  // If already a Date object
  if (value instanceof Date) {
    return { valid: true, date: value.toISOString().split('T')[0] };
  }
  
  const strValue = String(value).trim();
  
  // Try DD/MM/YYYY
  const ddmmyyyy = strValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return { valid: true, date: date.toISOString().split('T')[0] };
    }
  }
  
  // Try YYYY-MM-DD
  const yyyymmdd = strValue.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return { valid: true, date: date.toISOString().split('T')[0] };
    }
  }
  
  // Try Excel serial number
  if (!isNaN(Number(value))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(value));
    if (excelDate) {
      const date = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
      return { valid: true, date: date.toISOString().split('T')[0] };
    }
  }
  
  return { valid: false, error: 'Formato de data inválido' };
}

/**
 * Parse numeric value
 */
export function parseNumericValue(value: any): { valid: boolean; number?: number; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: 'Valor numérico obrigatório' };
  }
  
  // Clean the value
  let cleanValue = String(value)
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/[.]/g, '') // Remove thousand separators (Portuguese format)
    .replace(/,/g, '.'); // Convert decimal separator
  
  const num = parseFloat(cleanValue);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Valor numérico inválido' };
  }
  
  return { valid: true, number: num };
}

/**
 * Normalize income category
 */
export function normalizeIncomeCategory(value: string): string | null {
  if (!value) return null;
  
  const normalized = value.toLowerCase().trim();
  return INCOME_CATEGORY_MAPPING[normalized] || value.toUpperCase().charAt(0);
}

/**
 * Normalize status value
 */
export function normalizeStatus(value: string): string {
  if (!value) return 'active';
  
  const normalized = value.toLowerCase().trim();
  return STATUS_MAPPING[normalized] || 'active';
}

/**
 * Validate a single row based on data type
 */
export function validateRow(
  rowIndex: number,
  rowData: any[],
  headers: string[],
  mapping: ColumnMapping[],
  dataType: DataType
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, any> = {};
  
  // Build data object from mapping
  for (const map of mapping) {
    const colIndex = headers.indexOf(map.sourceColumn);
    if (colIndex === -1) continue;
    
    let value = rowData[colIndex];
    if (map.transform) {
      value = map.transform(value);
    }
    data[map.targetField] = value;
  }
  
  // Type-specific validation
  if (dataType === 'clients') {
    // Name is required
    if (!data.full_name && !data.company_name) {
      errors.push('Nome ou denominação social obrigatório');
    }
    
    // Validate NIF if present
    if (data.nif) {
      const cleanNif = String(data.nif).replace(/\D/g, '');
      data.nif = cleanNif;
      const nifResult = validatePortugueseNIF(cleanNif);
      if (!nifResult.valid) {
        errors.push(`NIF inválido: ${nifResult.error}`);
      }
    }
    
    // Validate email if present
    if (data.email) {
      const emailResult = validateEmail(data.email);
      if (!emailResult.valid) {
        warnings.push(emailResult.error || 'Email inválido');
      }
    }
    
    // Normalize status
    if (data.status) {
      data.status = normalizeStatus(data.status);
    }
    
    // Use company_name as full_name if not present
    if (!data.full_name && data.company_name) {
      data.full_name = data.company_name;
    }
    if (!data.company_name && data.full_name) {
      data.company_name = data.full_name;
    }
  }
  
  if (dataType === 'tax_withholdings') {
    // Validate beneficiary NIF (required)
    if (!data.beneficiary_nif) {
      errors.push('NIF do beneficiário obrigatório');
    } else {
      const cleanNif = String(data.beneficiary_nif).replace(/\D/g, '');
      data.beneficiary_nif = cleanNif;
      const nifResult = validatePortugueseNIF(cleanNif);
      if (!nifResult.valid) {
        errors.push(`NIF beneficiário inválido: ${nifResult.error}`);
      }
    }
    
    // Validate gross amount
    if (data.gross_amount !== undefined) {
      const amountResult = parseNumericValue(data.gross_amount);
      if (!amountResult.valid) {
        errors.push('Valor bruto inválido');
      } else {
        data.gross_amount = amountResult.number;
      }
    } else {
      errors.push('Valor bruto obrigatório');
    }
    
    // Validate withholding amount
    if (data.withholding_amount !== undefined) {
      const amountResult = parseNumericValue(data.withholding_amount);
      if (!amountResult.valid) {
        warnings.push('Valor de retenção inválido, será 0');
        data.withholding_amount = 0;
      } else {
        data.withholding_amount = amountResult.number;
      }
    } else {
      data.withholding_amount = 0;
    }
    
    // Validate payment date
    if (data.payment_date) {
      const dateResult = parseDate(data.payment_date);
      if (!dateResult.valid) {
        errors.push('Data de pagamento inválida');
      } else {
        data.payment_date = dateResult.date;
      }
    } else {
      errors.push('Data de pagamento obrigatória');
    }
    
    // Normalize income category
    if (data.income_category) {
      data.income_category = normalizeIncomeCategory(data.income_category);
    }
    
    // Calculate rate if not present
    if (!data.withholding_rate && data.gross_amount > 0 && data.withholding_amount > 0) {
      data.withholding_rate = (data.withholding_amount / data.gross_amount) * 100;
    }
    
    // Normalize rate (if > 1, it's already a percentage)
    if (data.withholding_rate !== undefined) {
      const rateResult = parseNumericValue(data.withholding_rate);
      if (rateResult.valid && rateResult.number !== undefined) {
        data.withholding_rate = rateResult.number > 1 ? rateResult.number : rateResult.number * 100;
      }
    }
  }
  
  if (dataType === 'invoices') {
    // Validate supplier NIF
    if (data.supplier_nif) {
      const cleanNif = String(data.supplier_nif).replace(/\D/g, '');
      data.supplier_nif = cleanNif;
      const nifResult = validatePortugueseNIF(cleanNif);
      if (!nifResult.valid) {
        warnings.push(`NIF fornecedor inválido: ${nifResult.error}`);
      }
    }
    
    // Validate total amount
    if (data.total_amount !== undefined) {
      const amountResult = parseNumericValue(data.total_amount);
      if (amountResult.valid) {
        data.total_amount = amountResult.number;
      }
    }
    
    // Validate document date
    if (data.document_date) {
      const dateResult = parseDate(data.document_date);
      if (dateResult.valid) {
        data.document_date = dateResult.date;
      }
    }
  }
  
  return {
    row: rowIndex + 2, // Excel row (1-indexed + header)
    valid: errors.length === 0,
    errors,
    warnings,
    data: errors.length === 0 ? data : undefined,
  };
}

/**
 * Validate all rows
 */
export function validateAllRows(
  rows: any[][],
  headers: string[],
  mapping: ColumnMapping[],
  dataType: DataType
): ValidationResult[] {
  return rows.map((row, index) => validateRow(index, row, headers, mapping, dataType));
}

/**
 * Calculate import summary
 */
export function calculateSummary(validationResults: ValidationResult[], duplicateCount: number = 0): ImportSummary {
  const valid = validationResults.filter(r => r.valid && r.warnings.length === 0).length;
  const withWarnings = validationResults.filter(r => r.valid && r.warnings.length > 0).length;
  const withErrors = validationResults.filter(r => !r.valid).length;
  
  return {
    total: validationResults.length,
    valid,
    withWarnings,
    withErrors,
    duplicates: duplicateCount,
  };
}

/**
 * Get required fields for a data type
 */
export function getRequiredFields(dataType: DataType): string[] {
  switch (dataType) {
    case 'clients':
      return ['full_name'];
    case 'tax_withholdings':
      return ['beneficiary_nif', 'gross_amount', 'payment_date'];
    case 'invoices':
      return ['supplier_nif', 'total_amount', 'document_date'];
    case 'sales_invoices':
      return ['total_amount', 'document_date'];
    case 'revenue_entries':
      return ['amount', 'period_quarter'];
    default:
      return [];
  }
}

/**
 * Get duplicate key fields for a data type
 */
export function getDuplicateKeyFields(dataType: DataType): string[] {
  switch (dataType) {
    case 'clients':
      return ['nif'];
    case 'tax_withholdings':
      return ['beneficiary_nif', 'document_reference', 'fiscal_year'];
    case 'invoices':
      return ['supplier_nif', 'document_number', 'document_date'];
    case 'sales_invoices':
      return ['document_number', 'document_date'];
    case 'revenue_entries':
      return ['period_quarter', 'category'];
    default:
      return [];
  }
}

/**
 * Generate template for download
 */
export function generateTemplate(dataType: DataType): Blob {
  let headers: string[] = [];
  let exampleRow: any[] = [];
  
  switch (dataType) {
    case 'clients':
      headers = ['Nome', 'NIF', 'Email', 'Telefone', 'Morada', 'Estado'];
      exampleRow = ['Empresa Exemplo Lda', '123456789', 'email@exemplo.pt', '912345678', 'Rua Exemplo, 123', 'Activo'];
      break;
    case 'tax_withholdings':
      headers = ['NIF Beneficiário', 'Nome Beneficiário', 'Valor Bruto', 'Retenção', 'Taxa', 'Data Pagamento', 'Categoria', 'Documento'];
      exampleRow = ['123456789', 'Fornecedor Exemplo', '1000.00', '230.00', '23', '2025-01-15', 'B', 'RV/2025/001'];
      break;
    case 'invoices':
      headers = ['NIF Fornecedor', 'Fornecedor', 'Nº Documento', 'Data', 'Total', 'IVA'];
      exampleRow = ['123456789', 'Fornecedor Exemplo', 'FT 2025/001', '2025-01-15', '123.00', '28.29'];
      break;
    default:
      headers = ['Campo1', 'Campo2', 'Campo3'];
      exampleRow = ['Valor1', 'Valor2', 'Valor3'];
  }
  
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Get data type label in Portuguese
 */
export function getDataTypeLabel(type: DataType): string {
  switch (type) {
    case 'clients':
      return 'Clientes';
    case 'tax_withholdings':
      return 'Retenções (Modelo 10)';
    case 'invoices':
      return 'Facturas IVA';
    case 'sales_invoices':
      return 'Vendas';
    case 'revenue_entries':
      return 'Rendimentos SS';
    default:
      return 'Desconhecido';
  }
}
