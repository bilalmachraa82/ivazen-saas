/**
 * Testes do Parser Universal de Importação
 * Cobre:
 *  - detectDataType — detecção do tipo de dados pelos cabeçalhos
 *  - autoMapColumns — mapeamento automático de colunas
 *  - validateEmail — validação de email
 *  - parseDate — formatos de data DD/MM/YYYY, YYYY-MM-DD, objecto Date
 *  - parseNumericValue — formatos numéricos portugueses
 *  - normalizeIncomeCategory — categorias de rendimento
 *  - normalizeStatus — normalização de estados de cliente
 *  - validateRow — validação por tipo (clients, tax_withholdings, invoices)
 *  - validateAllRows — validação em lote
 *  - calculateSummary — resumo de importação
 *  - getRequiredFields — campos obrigatórios por tipo
 *  - getDuplicateKeyFields — chaves de duplicado por tipo
 *  - getDataTypeLabel — etiqueta em português
 *  - STATUS_MAPPING — constante exportada
 */

import { describe, it, expect } from 'vitest';
import {
  detectDataType,
  autoMapColumns,
  validateEmail,
  parseDate,
  parseNumericValue,
  normalizeIncomeCategory,
  normalizeStatus,
  validateRow,
  validateAllRows,
  calculateSummary,
  getRequiredFields,
  getDuplicateKeyFields,
  getDataTypeLabel,
  STATUS_MAPPING,
  type DataType,
  type ColumnMapping,
} from '../universalImportParser';

// ---------------------------------------------------------------------------
// detectDataType
// ---------------------------------------------------------------------------
describe('detectDataType', () => {
  it('detecta "clients" quando cabeçalhos contêm "nome" e "nif"', () => {
    expect(detectDataType(['nome', 'nif', 'email'])).toBe('clients');
  });

  it('detecta "clients" quando cabeçalhos contêm "contribuinte" e "empresa"', () => {
    expect(detectDataType(['empresa', 'contribuinte', 'telefone'])).toBe('clients');
  });

  it('detecta "tax_withholdings" quando cabeçalhos contêm "beneficiário" e "retenção"', () => {
    expect(detectDataType(['beneficiário', 'retenção', 'bruto'])).toBe('tax_withholdings');
  });

  it('detecta "tax_withholdings" quando cabeçalhos contêm "bruto" e "categoria" e "rendimento"', () => {
    expect(detectDataType(['bruto', 'categoria', 'rendimento', 'data pagamento'])).toBe('tax_withholdings');
  });

  it('detecta "invoices" quando cabeçalhos contêm "fornecedor", "iva" e "total"', () => {
    expect(detectDataType(['fornecedor', 'iva', 'total', 'data'])).toBe('invoices');
  });

  it('detecta "invoices" quando cabeçalhos contêm "fatura" e "supplier"', () => {
    expect(detectDataType(['fatura', 'supplier', 'total'])).toBe('invoices');
  });

  it('detecta "revenue_entries" quando cabeçalhos contêm "trimestre" e "rendimento"', () => {
    expect(detectDataType(['trimestre', 'rendimento', 'categoria', 'período'])).toBe('revenue_entries');
  });

  it('retorna "unknown" quando pontuação é menor que 2', () => {
    expect(detectDataType(['campo1', 'campo2', 'campo3'])).toBe('unknown');
  });

  it('retorna "unknown" para array vazio', () => {
    expect(detectDataType([])).toBe('unknown');
  });

  it('é case-insensitive (cabeçalhos em maiúsculas)', () => {
    expect(detectDataType(['NOME', 'NIF', 'EMAIL'])).toBe('clients');
  });
});

// ---------------------------------------------------------------------------
// autoMapColumns
// ---------------------------------------------------------------------------
describe('autoMapColumns', () => {
  it('mapeia "nome" para targetField "full_name"', () => {
    const mappings = autoMapColumns(['nome', 'nif', 'email'], 'clients');
    const nameMapping = mappings.find(m => m.targetField === 'full_name');
    expect(nameMapping).toBeDefined();
    expect(nameMapping?.sourceColumn).toBe('nome');
  });

  it('mapeia "nif" para targetField "nif"', () => {
    const mappings = autoMapColumns(['nome', 'nif', 'email'], 'clients');
    const nifMapping = mappings.find(m => m.targetField === 'nif');
    expect(nifMapping).toBeDefined();
  });

  it('mapeia "contribuinte" para targetField "nif"', () => {
    const mappings = autoMapColumns(['empresa', 'contribuinte'], 'clients');
    const nifMapping = mappings.find(m => m.targetField === 'nif');
    expect(nifMapping).toBeDefined();
    expect(nifMapping?.sourceColumn).toBe('contribuinte');
  });

  it('mapeia "email" para targetField "email"', () => {
    const mappings = autoMapColumns(['nome', 'nif', 'email'], 'clients');
    const emailMapping = mappings.find(m => m.targetField === 'email');
    expect(emailMapping).toBeDefined();
  });

  it('marca todas as colunas auto-detectadas com autoDetected=true', () => {
    const mappings = autoMapColumns(['nome', 'nif', 'email'], 'clients');
    expect(mappings.every(m => m.autoDetected === true)).toBe(true);
  });

  it('não duplica mapeamentos para a mesma coluna de origem', () => {
    const mappings = autoMapColumns(['nome', 'nif', 'email', 'morada'], 'clients');
    const sourceColumns = mappings.map(m => m.sourceColumn);
    const uniqueColumns = [...new Set(sourceColumns)];
    expect(sourceColumns.length).toBe(uniqueColumns.length);
  });

  it('retorna array vazio para cabeçalhos não reconhecidos', () => {
    const mappings = autoMapColumns(['campoX', 'campoY', 'campoZ'], 'clients');
    expect(mappings).toHaveLength(0);
  });

  it('mapeia "bruto" para "gross_amount" em tax_withholdings', () => {
    const mappings = autoMapColumns(['beneficiário', 'bruto', 'retenção'], 'tax_withholdings');
    const grossMapping = mappings.find(m => m.targetField === 'gross_amount');
    expect(grossMapping).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------
describe('validateEmail', () => {
  it('aceita email válido', () => {
    expect(validateEmail('user@example.com').valid).toBe(true);
    expect(validateEmail('info@empresa.pt').valid).toBe(true);
    expect(validateEmail('nome.apelido+tag@dominio.co.pt').valid).toBe(true);
  });

  it('rejeita email sem @', () => {
    expect(validateEmail('invalido.email').valid).toBe(false);
  });

  it('rejeita email sem domínio', () => {
    expect(validateEmail('user@').valid).toBe(false);
  });

  it('rejeita email sem TLD', () => {
    expect(validateEmail('user@domain').valid).toBe(false);
  });

  it('aceita string vazia (campo opcional)', () => {
    expect(validateEmail('').valid).toBe(true);
  });

  it('retorna mensagem de erro quando email é inválido', () => {
    const result = validateEmail('invalido');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------
describe('parseDate', () => {
  it('converte DD/MM/YYYY para formato ISO', () => {
    const result = parseDate('15/01/2025');
    expect(result.valid).toBe(true);
    expect(result.date).toBe('2025-01-15');
  });

  it('converte DD-MM-YYYY para formato ISO', () => {
    const result = parseDate('15-01-2025');
    expect(result.valid).toBe(true);
    expect(result.date).toBe('2025-01-15');
  });

  it('converte YYYY-MM-DD para formato ISO', () => {
    const result = parseDate('2025-01-15');
    expect(result.valid).toBe(true);
    expect(result.date).toBe('2025-01-15');
  });

  it('converte YYYY/MM/DD para formato ISO', () => {
    const result = parseDate('2025/01/15');
    expect(result.valid).toBe(true);
    expect(result.date).toBe('2025-01-15');
  });

  it('aceita objecto Date directamente', () => {
    const date = new Date(2025, 0, 15); // 15 Jan 2025
    const result = parseDate(date);
    expect(result.valid).toBe(true);
    expect(result.date).toBe('2025-01-15');
  });

  it('retorna erro para string nula/vazia', () => {
    expect(parseDate('').valid).toBe(false);
    expect(parseDate(null).valid).toBe(false);
    expect(parseDate(undefined).valid).toBe(false);
  });

  it('retorna erro para formato inválido', () => {
    const result = parseDate('data-invalida');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('converte data de final de mês correctamente (28/02/2025)', () => {
    const result = parseDate('28/02/2025');
    expect(result.valid).toBe(true);
    expect(result.date).toBe('2025-02-28');
  });
});

// ---------------------------------------------------------------------------
// parseNumericValue
// ---------------------------------------------------------------------------
describe('parseNumericValue', () => {
  it('converte número simples', () => {
    expect(parseNumericValue('100').number).toBe(100);
    expect(parseNumericValue(100).number).toBe(100);
  });

  it('converte valor com vírgula decimal (formato português)', () => {
    const result = parseNumericValue('1234,56');
    expect(result.valid).toBe(true);
    expect(result.number).toBeCloseTo(1234.56, 2);
  });

  it('converte valor com ponto como separador de milhares e vírgula decimal', () => {
    const result = parseNumericValue('1.234,56');
    expect(result.valid).toBe(true);
    // Removes dots (thousand sep), converts comma to dot → 1234.56
    expect(result.number).toBeCloseTo(1234.56, 2);
  });

  it('remove símbolo € antes de converter', () => {
    const result = parseNumericValue('225,98 €');
    expect(result.valid).toBe(true);
    expect(result.number).toBeCloseTo(225.98, 2);
  });

  it('retorna erro para valor vazio', () => {
    expect(parseNumericValue('').valid).toBe(false);
    expect(parseNumericValue(null).valid).toBe(false);
    expect(parseNumericValue(undefined).valid).toBe(false);
  });

  it('retorna erro para string não numérica', () => {
    const result = parseNumericValue('não é número');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('aceita zero como valor válido', () => {
    const result = parseNumericValue('0');
    expect(result.valid).toBe(true);
    expect(result.number).toBe(0);
  });

  it('aceita valores negativos', () => {
    const result = parseNumericValue('-100,50');
    expect(result.valid).toBe(true);
    expect(result.number).toBeCloseTo(-100.5, 2);
  });
});

// ---------------------------------------------------------------------------
// normalizeIncomeCategory
// ---------------------------------------------------------------------------
describe('normalizeIncomeCategory', () => {
  it('converte "a" para "A" (trabalho dependente)', () => {
    expect(normalizeIncomeCategory('a')).toBe('A');
    expect(normalizeIncomeCategory('A')).toBe('A');
  });

  it('converte "b" para "B" (rendimentos empresariais)', () => {
    expect(normalizeIncomeCategory('b')).toBe('B');
  });

  it('converte "trabalho dependente" para "A"', () => {
    expect(normalizeIncomeCategory('trabalho dependente')).toBe('A');
  });

  it('converte "empresariais" para "B"', () => {
    expect(normalizeIncomeCategory('empresariais')).toBe('B');
  });

  it('converte "profissionais" para "B"', () => {
    expect(normalizeIncomeCategory('profissionais')).toBe('B');
  });

  it('converte "capitais" para "E"', () => {
    expect(normalizeIncomeCategory('capitais')).toBe('E');
  });

  it('converte "prediais" / "rendas" para "F"', () => {
    expect(normalizeIncomeCategory('prediais')).toBe('F');
    expect(normalizeIncomeCategory('rendas')).toBe('F');
  });

  it('converte "mais-valias" para "G"', () => {
    expect(normalizeIncomeCategory('mais-valias')).toBe('G');
  });

  it('converte "pensões" / "pensoes" para "H"', () => {
    expect(normalizeIncomeCategory('pensões')).toBe('H');
    expect(normalizeIncomeCategory('pensoes')).toBe('H');
  });

  it('retorna null para string vazia', () => {
    expect(normalizeIncomeCategory('')).toBeNull();
  });

  it('usa o primeiro caractere em maiúsculas para categorias desconhecidas', () => {
    // Falls through to value.toUpperCase().charAt(0)
    expect(normalizeIncomeCategory('Z')).toBe('Z');
  });
});

// ---------------------------------------------------------------------------
// normalizeStatus
// ---------------------------------------------------------------------------
describe('normalizeStatus', () => {
  it('converte "adjudicado" para "active"', () => {
    expect(normalizeStatus('adjudicado')).toBe('active');
  });

  it('converte "activo" / "ativo" para "active"', () => {
    expect(normalizeStatus('activo')).toBe('active');
    expect(normalizeStatus('ativo')).toBe('active');
  });

  it('converte "cessado em iva" para "inactive_vat"', () => {
    expect(normalizeStatus('cessado em iva')).toBe('inactive_vat');
  });

  it('converte "cessado" / "inactivo" / "inativo" para "inactive"', () => {
    expect(normalizeStatus('cessado')).toBe('inactive');
    expect(normalizeStatus('inactivo')).toBe('inactive');
    expect(normalizeStatus('inativo')).toBe('inactive');
  });

  it('converte "dissolvida" para "dissolved"', () => {
    expect(normalizeStatus('dissolvida')).toBe('dissolved');
  });

  it('converte "renuncia na occ" para "resigned"', () => {
    expect(normalizeStatus('renuncia na occ')).toBe('resigned');
  });

  it('converte "fim de contrato" para "contract_ended"', () => {
    expect(normalizeStatus('fim de contrato')).toBe('contract_ended');
  });

  it('converte "novo cc - fim de ano" para "new_contract"', () => {
    expect(normalizeStatus('novo cc - fim de ano')).toBe('new_contract');
  });

  it('retorna "active" para string vazia', () => {
    expect(normalizeStatus('')).toBe('active');
  });

  it('retorna "active" para valor desconhecido (fallback)', () => {
    expect(normalizeStatus('valor_desconhecido')).toBe('active');
  });

  it('STATUS_MAPPING exportado contém todas as chaves do domínio português', () => {
    expect(STATUS_MAPPING).toHaveProperty('adjudicado');
    expect(STATUS_MAPPING).toHaveProperty('cessado');
    expect(STATUS_MAPPING).toHaveProperty('dissolvida');
    expect(STATUS_MAPPING).toHaveProperty('inactivo');
  });
});

// ---------------------------------------------------------------------------
// validateRow — tipo clients
// ---------------------------------------------------------------------------
describe('validateRow — tipo clients', () => {
  const headers = ['nome', 'nif', 'email', 'estado'];
  const mapping: ColumnMapping[] = [
    { sourceColumn: 'nome', targetField: 'full_name', autoDetected: true },
    { sourceColumn: 'nif', targetField: 'nif', autoDetected: true },
    { sourceColumn: 'email', targetField: 'email', autoDetected: true },
    { sourceColumn: 'estado', targetField: 'status', autoDetected: true },
  ];

  it('valida linha de cliente correcta', () => {
    // Use a known-valid NIF (checksum passes): 503504564 (EDP)
    const result = validateRow(0, ['EDP Comercial SA', '503504564', 'info@edp.pt', 'activo'], headers, mapping, 'clients');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('falha quando nome e denominação social estão ausentes', () => {
    const result = validateRow(0, ['', '', '', ''], headers, mapping, 'clients');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Nome') || e.includes('nome'))).toBe(true);
  });

  it('falha com NIF inválido (formato incorrecto)', () => {
    const result = validateRow(0, ['Empresa Teste', '12345678', 'a@b.pt', ''], headers, mapping, 'clients');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('NIF'))).toBe(true);
  });

  it('emite aviso para email inválido (não é erro, é warning)', () => {
    const result = validateRow(0, ['Empresa Teste', '503504564', 'email-invalido', ''], headers, mapping, 'clients');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('normaliza status "ativo" para "active"', () => {
    const result = validateRow(0, ['Empresa Teste', '503504564', '', 'ativo'], headers, mapping, 'clients');
    expect(result.data?.status).toBe('active');
  });

  it('propaga full_name a partir de company_name quando full_name está ausente', () => {
    const h2 = ['empresa', 'nif'];
    const m2: ColumnMapping[] = [
      { sourceColumn: 'empresa', targetField: 'company_name', autoDetected: true },
      { sourceColumn: 'nif', targetField: 'nif', autoDetected: true },
    ];
    const result = validateRow(0, ['EDP Comercial SA', '503504564'], h2, m2, 'clients');
    expect(result.data?.full_name).toBe('EDP Comercial SA');
  });

  it('row number no resultado é rowIndex + 2 (Excel 1-indexed + header)', () => {
    const result = validateRow(3, ['Empresa', '503504564', '', ''], headers, mapping, 'clients');
    expect(result.row).toBe(5); // 3 + 2
  });

  it('data é undefined quando há erros', () => {
    const result = validateRow(0, ['', '', '', ''], headers, mapping, 'clients');
    expect(result.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateRow — tipo tax_withholdings
// ---------------------------------------------------------------------------
describe('validateRow — tipo tax_withholdings', () => {
  const headers = ['beneficiario', 'bruto', 'retencao', 'data pagamento', 'categoria'];
  const mapping: ColumnMapping[] = [
    { sourceColumn: 'beneficiario', targetField: 'beneficiary_nif', autoDetected: true },
    { sourceColumn: 'bruto', targetField: 'gross_amount', autoDetected: true },
    { sourceColumn: 'retencao', targetField: 'withholding_amount', autoDetected: true },
    { sourceColumn: 'data pagamento', targetField: 'payment_date', autoDetected: true },
    { sourceColumn: 'categoria', targetField: 'income_category', autoDetected: true },
  ];

  it('valida linha de retenção correcta', () => {
    const result = validateRow(
      0,
      ['503504564', '1000,00', '230,00', '2025-01-15', 'B'],
      headers, mapping, 'tax_withholdings'
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('falha quando NIF do beneficiário está ausente', () => {
    const result = validateRow(
      0,
      ['', '1000,00', '230,00', '2025-01-15', 'B'],
      headers, mapping, 'tax_withholdings'
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('NIF') || e.includes('beneficiário') || e.includes('beneficiario'))).toBe(true);
  });

  it('falha quando valor bruto está ausente', () => {
    const result = validateRow(
      0,
      ['503504564', '', '230,00', '2025-01-15', 'B'],
      headers, mapping, 'tax_withholdings'
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('bruto'))).toBe(true);
  });

  it('falha quando data de pagamento está ausente', () => {
    const result = validateRow(
      0,
      ['503504564', '1000,00', '230,00', '', 'B'],
      headers, mapping, 'tax_withholdings'
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('data') || e.includes('Data'))).toBe(true);
  });

  it('normaliza categoria de rendimento "trabalho dependente" para "A"', () => {
    const result = validateRow(
      0,
      ['503504564', '1000,00', '0,00', '2025-01-15', 'trabalho dependente'],
      headers, mapping, 'tax_withholdings'
    );
    expect(result.data?.income_category).toBe('A');
  });

  it('converte valor bruto de formato português para número', () => {
    const result = validateRow(
      0,
      ['503504564', '1.500,00', '345,00', '15/01/2025', 'B'],
      headers, mapping, 'tax_withholdings'
    );
    expect(result.data?.gross_amount).toBeCloseTo(1500, 2);
  });

  it('calcula taxa de retenção quando ausente (retenção / bruto * 100)', () => {
    const result = validateRow(
      0,
      ['503504564', '1000', '230', '2025-01-15', 'B'],
      headers, mapping, 'tax_withholdings'
    );
    // 230 / 1000 * 100 = 23
    expect(result.data?.withholding_rate).toBeCloseTo(23, 1);
  });
});

// ---------------------------------------------------------------------------
// validateRow — tipo invoices
// ---------------------------------------------------------------------------
describe('validateRow — tipo invoices', () => {
  const headers = ['fornecedor nif', 'fornecedor', 'data documento', 'total'];
  const mapping: ColumnMapping[] = [
    { sourceColumn: 'fornecedor nif', targetField: 'supplier_nif', autoDetected: true },
    { sourceColumn: 'fornecedor', targetField: 'supplier_name', autoDetected: true },
    { sourceColumn: 'data documento', targetField: 'document_date', autoDetected: true },
    { sourceColumn: 'total', targetField: 'total_amount', autoDetected: true },
  ];

  it('valida factura correcta', () => {
    const result = validateRow(
      0,
      ['503504564', 'EDP Comercial', '15/01/2025', '100,00'],
      headers, mapping, 'invoices'
    );
    expect(result.valid).toBe(true);
  });

  it('emite aviso (não erro) para NIF fornecedor inválido em invoices', () => {
    const result = validateRow(
      0,
      ['000000000', 'Fornecedor Invalido', '15/01/2025', '100,00'],
      headers, mapping, 'invoices'
    );
    // NIF with first digit 0 is invalid — should be warning not blocking error
    expect(result.warnings.some(w => w.includes('NIF'))).toBe(true);
  });

  it('converte valor total de formato português', () => {
    const result = validateRow(
      0,
      ['503504564', 'EDP', '15/01/2025', '1.234,56'],
      headers, mapping, 'invoices'
    );
    expect(result.data?.total_amount).toBeCloseTo(1234.56, 2);
  });

  it('converte data do documento para ISO', () => {
    const result = validateRow(
      0,
      ['503504564', 'EDP', '31/12/2025', '100,00'],
      headers, mapping, 'invoices'
    );
    expect(result.data?.document_date).toBe('2025-12-31');
  });
});

// ---------------------------------------------------------------------------
// validateAllRows
// ---------------------------------------------------------------------------
describe('validateAllRows', () => {
  const headers = ['nome', 'nif'];
  const mapping: ColumnMapping[] = [
    { sourceColumn: 'nome', targetField: 'full_name', autoDetected: true },
    { sourceColumn: 'nif', targetField: 'nif', autoDetected: true },
  ];

  it('retorna um resultado por linha', () => {
    const rows = [
      ['Empresa A', '503504564'],
      ['Empresa B', '503423971'],
    ];
    const results = validateAllRows(rows, headers, mapping, 'clients');
    expect(results).toHaveLength(2);
  });

  it('retorna array vazio para input vazio', () => {
    const results = validateAllRows([], headers, mapping, 'clients');
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// calculateSummary
// ---------------------------------------------------------------------------
describe('calculateSummary', () => {
  it('conta correctamente válidos, com avisos, com erros e duplicados', () => {
    const validationResults = [
      { row: 2, valid: true, errors: [], warnings: [] },
      { row: 3, valid: true, errors: [], warnings: ['aviso'] },
      { row: 4, valid: false, errors: ['erro'], warnings: [] },
    ];
    const summary = calculateSummary(validationResults, 1);
    expect(summary.total).toBe(3);
    expect(summary.valid).toBe(1);
    expect(summary.withWarnings).toBe(1);
    expect(summary.withErrors).toBe(1);
    expect(summary.duplicates).toBe(1);
  });

  it('duplicates por defeito é 0', () => {
    const results = [{ row: 2, valid: true, errors: [], warnings: [] }];
    const summary = calculateSummary(results);
    expect(summary.duplicates).toBe(0);
  });

  it('retorna zeros para array vazio', () => {
    const summary = calculateSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.valid).toBe(0);
    expect(summary.withErrors).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getRequiredFields
// ---------------------------------------------------------------------------
describe('getRequiredFields', () => {
  it('retorna ["full_name"] para clients', () => {
    expect(getRequiredFields('clients')).toContain('full_name');
  });

  it('retorna campos obrigatórios para tax_withholdings', () => {
    const fields = getRequiredFields('tax_withholdings');
    expect(fields).toContain('beneficiary_nif');
    expect(fields).toContain('gross_amount');
    expect(fields).toContain('payment_date');
  });

  it('retorna campos obrigatórios para invoices', () => {
    const fields = getRequiredFields('invoices');
    expect(fields).toContain('supplier_nif');
    expect(fields).toContain('total_amount');
    expect(fields).toContain('document_date');
  });

  it('retorna array vazio para "unknown"', () => {
    expect(getRequiredFields('unknown')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getDuplicateKeyFields
// ---------------------------------------------------------------------------
describe('getDuplicateKeyFields', () => {
  it('retorna ["nif"] para clients', () => {
    expect(getDuplicateKeyFields('clients')).toEqual(['nif']);
  });

  it('retorna campos compostos para tax_withholdings', () => {
    const keys = getDuplicateKeyFields('tax_withholdings');
    expect(keys).toContain('beneficiary_nif');
    expect(keys).toContain('fiscal_year');
  });

  it('retorna campos compostos para invoices', () => {
    const keys = getDuplicateKeyFields('invoices');
    expect(keys).toContain('supplier_nif');
    expect(keys).toContain('document_number');
    expect(keys).toContain('document_date');
  });

  it('retorna array vazio para "unknown"', () => {
    expect(getDuplicateKeyFields('unknown')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getDataTypeLabel
// ---------------------------------------------------------------------------
describe('getDataTypeLabel', () => {
  it('retorna "Clientes" para "clients"', () => {
    expect(getDataTypeLabel('clients')).toBe('Clientes');
  });

  it('retorna "Retenções (Modelo 10)" para "tax_withholdings"', () => {
    expect(getDataTypeLabel('tax_withholdings')).toBe('Retenções (Modelo 10)');
  });

  it('retorna "Facturas IVA" para "invoices"', () => {
    expect(getDataTypeLabel('invoices')).toBe('Facturas IVA');
  });

  it('retorna "Vendas" para "sales_invoices"', () => {
    expect(getDataTypeLabel('sales_invoices')).toBe('Vendas');
  });

  it('retorna "Rendimentos SS" para "revenue_entries"', () => {
    expect(getDataTypeLabel('revenue_entries')).toBe('Rendimentos SS');
  });

  it('retorna "Desconhecido" para "unknown"', () => {
    expect(getDataTypeLabel('unknown')).toBe('Desconhecido');
  });
});
