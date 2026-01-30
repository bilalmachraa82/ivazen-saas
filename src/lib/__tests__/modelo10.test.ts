import { describe, it, expect } from 'vitest';

// ============================================
// MODELO 10 - TESTES UNITÁRIOS
// ============================================

// Tipos para testes
interface TaxWithholding {
  id: string;
  beneficiary_nif: string;
  beneficiary_name: string | null;
  beneficiary_address: string | null;
  gross_amount: number;
  withholding_amount: number;
  withholding_rate: number | null;
  income_category: string;
  location_code: string;
  payment_date: string;
  fiscal_year: number;
  is_non_resident: boolean;
  country_code: string | null;
  dispensed_amount: number | null;
  exempt_amount: number | null;
  document_reference: string | null;
  notes: string | null;
}

interface WithholdingSummary {
  beneficiary_nif: string;
  beneficiary_name: string | null;
  income_category: string;
  location_code: string;
  total_gross: number;
  total_withholding: number;
  document_count: number;
  is_non_resident?: boolean;
  country_code?: string | null;
}

// ============================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================

/**
 * Valida campos obrigatórios para não residentes
 */
function validateNonResidentFields(withholding: Partial<TaxWithholding>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (withholding.is_non_resident) {
    // País é obrigatório para não residentes
    if (!withholding.country_code || withholding.country_code.trim() === '') {
      errors.push('País é obrigatório para não residentes');
    }

    // Endereço é obrigatório para não residentes
    if (!withholding.beneficiary_address || withholding.beneficiary_address.trim() === '') {
      errors.push('Endereço é obrigatório para não residentes');
    }

    // Código de localização deve ser 'E' para estrangeiros
    if (withholding.location_code !== 'E') {
      errors.push('Código de localização deve ser "E" para não residentes');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida que a data de pagamento corresponde ao ano fiscal
 */
function validatePaymentDateFiscalYear(
  paymentDate: string,
  fiscalYear: number
): { valid: boolean; error: string | null } {
  const paymentYear = new Date(paymentDate).getFullYear();

  if (paymentYear !== fiscalYear) {
    return {
      valid: false,
      error: `Data de pagamento (${paymentYear}) não corresponde ao ano fiscal (${fiscalYear})`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Valida NIF do beneficiário
 */
function validateBeneficiaryNif(nif: string, isNonResident: boolean): {
  valid: boolean;
  error: string | null;
} {
  if (!nif || nif.trim() === '') {
    return { valid: false, error: 'NIF é obrigatório' };
  }

  // NIFs portugueses têm 9 dígitos
  if (!isNonResident && !/^\d{9}$/.test(nif)) {
    return { valid: false, error: 'NIF português deve ter 9 dígitos' };
  }

  // Para não residentes, aceita formatos variados
  if (isNonResident && nif.length < 5) {
    return { valid: false, error: 'NIF estrangeiro deve ter pelo menos 5 caracteres' };
  }

  return { valid: true, error: null };
}

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Calcula totais de retenções
 */
function calculateWithholdingTotals(withholdings: TaxWithholding[]): {
  totalGross: number;
  totalWithholding: number;
  totalDispensed: number;
  totalExempt: number;
  averageRate: number;
  documentCount: number;
  beneficiaryCount: number;
} {
  if (withholdings.length === 0) {
    return {
      totalGross: 0,
      totalWithholding: 0,
      totalDispensed: 0,
      totalExempt: 0,
      averageRate: 0,
      documentCount: 0,
      beneficiaryCount: 0,
    };
  }

  const totalGross = withholdings.reduce((sum, w) => sum + w.gross_amount, 0);
  const totalWithholding = withholdings.reduce((sum, w) => sum + w.withholding_amount, 0);
  const totalDispensed = withholdings.reduce((sum, w) => sum + (w.dispensed_amount || 0), 0);
  const totalExempt = withholdings.reduce((sum, w) => sum + (w.exempt_amount || 0), 0);

  const uniqueBeneficiaries = new Set(withholdings.map((w) => w.beneficiary_nif));

  return {
    totalGross,
    totalWithholding,
    totalDispensed,
    totalExempt,
    averageRate: totalGross > 0 ? (totalWithholding / totalGross) * 100 : 0,
    documentCount: withholdings.length,
    beneficiaryCount: uniqueBeneficiaries.size,
  };
}

/**
 * Agrupa retenções por beneficiário para resumo
 */
function calculateSummaryByBeneficiary(withholdings: TaxWithholding[]): WithholdingSummary[] {
  const summaryMap = new Map<string, WithholdingSummary>();

  withholdings.forEach((w) => {
    const key = `${w.beneficiary_nif}-${w.income_category}-${w.location_code}`;

    if (summaryMap.has(key)) {
      const existing = summaryMap.get(key)!;
      existing.total_gross += w.gross_amount;
      existing.total_withholding += w.withholding_amount;
      existing.document_count += 1;
    } else {
      summaryMap.set(key, {
        beneficiary_nif: w.beneficiary_nif,
        beneficiary_name: w.beneficiary_name,
        income_category: w.income_category,
        location_code: w.location_code,
        total_gross: w.gross_amount,
        total_withholding: w.withholding_amount,
        document_count: 1,
        is_non_resident: w.is_non_resident,
        country_code: w.country_code,
      });
    }
  });

  return Array.from(summaryMap.values());
}

// ============================================
// FUNÇÕES DE EXPORTAÇÃO CSV
// ============================================

/**
 * Gera CSV para Portal AT (Modelo 10)
 */
function generateCSVForAT(
  summaries: WithholdingSummary[],
  fiscalYear: number
): string {
  // Cabeçalho conforme especificação AT
  const header = [
    'NIF Beneficiário',
    'Nome Beneficiário',
    'Categoria Rendimento',
    'Código Localização',
    'Rendimento Bruto',
    'Retenção',
    'Nº Documentos',
  ].join(';');

  const rows = summaries.map((s) =>
    [
      s.beneficiary_nif,
      s.beneficiary_name || '',
      s.income_category,
      s.location_code,
      s.total_gross.toFixed(2).replace('.', ','),
      s.total_withholding.toFixed(2).replace('.', ','),
      s.document_count.toString(),
    ].join(';')
  );

  return [header, ...rows].join('\n');
}

/**
 * Formata valor para CSV português (vírgula decimal)
 */
function formatCSVValue(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/**
 * Gera nome do ficheiro CSV
 */
function generateCSVFilename(fiscalYear: number): string {
  const date = new Date();
  const timestamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `Modelo10_${fiscalYear}_${timestamp}.csv`;
}

// ============================================
// TESTES DE VALIDAÇÃO NÃO RESIDENTES
// ============================================

describe('Modelo 10 - Validação Não Residentes', () => {
  describe('validateNonResidentFields', () => {
    it('deve validar corretamente um não residente com todos os campos', () => {
      const withholding: Partial<TaxWithholding> = {
        is_non_resident: true,
        country_code: 'DE',
        beneficiary_address: 'Berliner Str. 123, Berlin',
        location_code: 'E',
      };

      const result = validateNonResidentFields(withholding);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('deve falhar quando país está ausente para não residente', () => {
      const withholding: Partial<TaxWithholding> = {
        is_non_resident: true,
        country_code: null,
        beneficiary_address: 'Berliner Str. 123, Berlin',
        location_code: 'E',
      };

      const result = validateNonResidentFields(withholding);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('País é obrigatório para não residentes');
    });

    it('deve falhar quando endereço está ausente para não residente', () => {
      const withholding: Partial<TaxWithholding> = {
        is_non_resident: true,
        country_code: 'FR',
        beneficiary_address: '',
        location_code: 'E',
      };

      const result = validateNonResidentFields(withholding);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Endereço é obrigatório para não residentes');
    });

    it('deve falhar quando código de localização não é "E" para não residente', () => {
      const withholding: Partial<TaxWithholding> = {
        is_non_resident: true,
        country_code: 'ES',
        beneficiary_address: 'Calle Mayor 1, Madrid',
        location_code: 'C',
      };

      const result = validateNonResidentFields(withholding);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Código de localização deve ser "E" para não residentes');
    });

    it('deve reportar múltiplos erros quando vários campos faltam', () => {
      const withholding: Partial<TaxWithholding> = {
        is_non_resident: true,
        country_code: '',
        beneficiary_address: null,
        location_code: 'C',
      };

      const result = validateNonResidentFields(withholding);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('deve ignorar validações de não residente para residentes', () => {
      const withholding: Partial<TaxWithholding> = {
        is_non_resident: false,
        country_code: null,
        beneficiary_address: null,
        location_code: 'C',
      };

      const result = validateNonResidentFields(withholding);
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePaymentDateFiscalYear', () => {
    it('deve validar quando data de pagamento corresponde ao ano fiscal', () => {
      const result = validatePaymentDateFiscalYear('2024-06-15', 2024);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('deve falhar quando data de pagamento não corresponde ao ano fiscal', () => {
      const result = validatePaymentDateFiscalYear('2023-12-31', 2024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2023');
      expect(result.error).toContain('2024');
    });

    it('deve validar datas no início do ano', () => {
      const result = validatePaymentDateFiscalYear('2024-01-01', 2024);
      expect(result.valid).toBe(true);
    });

    it('deve validar datas no final do ano', () => {
      const result = validatePaymentDateFiscalYear('2024-12-31', 2024);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateBeneficiaryNif', () => {
    it('deve validar NIF português de 9 dígitos', () => {
      const result = validateBeneficiaryNif('123456789', false);
      expect(result.valid).toBe(true);
    });

    it('deve falhar para NIF português com menos de 9 dígitos', () => {
      const result = validateBeneficiaryNif('12345678', false);
      expect(result.valid).toBe(false);
    });

    it('deve falhar para NIF português com letras', () => {
      const result = validateBeneficiaryNif('12345678A', false);
      expect(result.valid).toBe(false);
    });

    it('deve aceitar NIF estrangeiro com formato variado', () => {
      const result = validateBeneficiaryNif('DE123456789', true);
      expect(result.valid).toBe(true);
    });

    it('deve falhar para NIF estrangeiro muito curto', () => {
      const result = validateBeneficiaryNif('DE12', true);
      expect(result.valid).toBe(false);
    });

    it('deve falhar para NIF vazio', () => {
      const result = validateBeneficiaryNif('', false);
      expect(result.valid).toBe(false);
    });
  });
});

// ============================================
// TESTES DE CÁLCULO DE TOTAIS
// ============================================

describe('Modelo 10 - Cálculo de Totais', () => {
  const mockWithholdings: TaxWithholding[] = [
    {
      id: '1',
      beneficiary_nif: '123456789',
      beneficiary_name: 'Empresa A',
      beneficiary_address: null,
      gross_amount: 1000,
      withholding_amount: 250,
      withholding_rate: 25,
      income_category: 'A',
      location_code: 'C',
      payment_date: '2024-03-15',
      fiscal_year: 2024,
      is_non_resident: false,
      country_code: null,
      dispensed_amount: 0,
      exempt_amount: 0,
      document_reference: 'FAT-001',
      notes: null,
    },
    {
      id: '2',
      beneficiary_nif: '123456789',
      beneficiary_name: 'Empresa A',
      beneficiary_address: null,
      gross_amount: 2000,
      withholding_amount: 500,
      withholding_rate: 25,
      income_category: 'A',
      location_code: 'C',
      payment_date: '2024-06-20',
      fiscal_year: 2024,
      is_non_resident: false,
      country_code: null,
      dispensed_amount: 100,
      exempt_amount: 50,
      document_reference: 'FAT-002',
      notes: null,
    },
    {
      id: '3',
      beneficiary_nif: '987654321',
      beneficiary_name: 'Empresa B',
      beneficiary_address: 'Rue de Paris 10',
      gross_amount: 5000,
      withholding_amount: 1250,
      withholding_rate: 25,
      income_category: 'B',
      location_code: 'E',
      payment_date: '2024-09-10',
      fiscal_year: 2024,
      is_non_resident: true,
      country_code: 'FR',
      dispensed_amount: 200,
      exempt_amount: 100,
      document_reference: 'FAT-003',
      notes: null,
    },
  ];

  describe('calculateWithholdingTotals', () => {
    it('deve calcular totais corretos', () => {
      const result = calculateWithholdingTotals(mockWithholdings);

      expect(result.totalGross).toBe(8000);
      expect(result.totalWithholding).toBe(2000);
      expect(result.totalDispensed).toBe(300);
      expect(result.totalExempt).toBe(150);
      expect(result.documentCount).toBe(3);
      expect(result.beneficiaryCount).toBe(2);
    });

    it('deve calcular taxa média corretamente', () => {
      const result = calculateWithholdingTotals(mockWithholdings);

      // (2000 / 8000) * 100 = 25%
      expect(result.averageRate).toBe(25);
    });

    it('deve retornar zeros para lista vazia', () => {
      const result = calculateWithholdingTotals([]);

      expect(result.totalGross).toBe(0);
      expect(result.totalWithholding).toBe(0);
      expect(result.averageRate).toBe(0);
      expect(result.documentCount).toBe(0);
      expect(result.beneficiaryCount).toBe(0);
    });

    it('deve contar beneficiários únicos corretamente', () => {
      const withSameBeneficiary: TaxWithholding[] = [
        { ...mockWithholdings[0] },
        { ...mockWithholdings[1] },
        { ...mockWithholdings[0], id: '4' },
      ];

      const result = calculateWithholdingTotals(withSameBeneficiary);
      expect(result.beneficiaryCount).toBe(1);
    });
  });

  describe('calculateSummaryByBeneficiary', () => {
    it('deve agrupar por beneficiário, categoria e localização', () => {
      const result = calculateSummaryByBeneficiary(mockWithholdings);

      // Deve ter 2 grupos: Empresa A (categoria A) e Empresa B (categoria B)
      expect(result).toHaveLength(2);
    });

    it('deve somar valores corretamente por grupo', () => {
      const result = calculateSummaryByBeneficiary(mockWithholdings);

      const empresaA = result.find((s) => s.beneficiary_nif === '123456789');
      expect(empresaA).toBeDefined();
      expect(empresaA!.total_gross).toBe(3000);
      expect(empresaA!.total_withholding).toBe(750);
      expect(empresaA!.document_count).toBe(2);
    });

    it('deve preservar informação de não residente', () => {
      const result = calculateSummaryByBeneficiary(mockWithholdings);

      const empresaB = result.find((s) => s.beneficiary_nif === '987654321');
      expect(empresaB).toBeDefined();
      expect(empresaB!.is_non_resident).toBe(true);
      expect(empresaB!.country_code).toBe('FR');
    });

    it('deve retornar lista vazia para entrada vazia', () => {
      const result = calculateSummaryByBeneficiary([]);
      expect(result).toHaveLength(0);
    });
  });
});

// ============================================
// TESTES DE EXPORTAÇÃO CSV
// ============================================

describe('Modelo 10 - Exportação CSV', () => {
  const mockSummaries: WithholdingSummary[] = [
    {
      beneficiary_nif: '123456789',
      beneficiary_name: 'Empresa A, Lda',
      income_category: 'A',
      location_code: 'C',
      total_gross: 3000,
      total_withholding: 750,
      document_count: 2,
      is_non_resident: false,
      country_code: null,
    },
    {
      beneficiary_nif: '987654321',
      beneficiary_name: 'Société B',
      income_category: 'B',
      location_code: 'E',
      total_gross: 5000,
      total_withholding: 1250,
      document_count: 1,
      is_non_resident: true,
      country_code: 'FR',
    },
  ];

  describe('generateCSVForAT', () => {
    it('deve gerar CSV com cabeçalho correto', () => {
      const csv = generateCSVForAT(mockSummaries, 2024);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('NIF Beneficiário');
      expect(lines[0]).toContain('Rendimento Bruto');
      expect(lines[0]).toContain('Retenção');
    });

    it('deve usar ponto-e-vírgula como separador', () => {
      const csv = generateCSVForAT(mockSummaries, 2024);
      const lines = csv.split('\n');

      // Cada linha deve ter 6 separadores (7 colunas)
      expect(lines[0].split(';').length).toBe(7);
    });

    it('deve formatar valores numéricos com vírgula decimal', () => {
      const csv = generateCSVForAT(mockSummaries, 2024);

      expect(csv).toContain('3000,00');
      expect(csv).toContain('750,00');
      expect(csv).toContain('5000,00');
    });

    it('deve incluir todos os registos', () => {
      const csv = generateCSVForAT(mockSummaries, 2024);
      const lines = csv.split('\n');

      // 1 cabeçalho + 2 registos
      expect(lines).toHaveLength(3);
    });

    it('deve tratar nomes com caracteres especiais', () => {
      const csv = generateCSVForAT(mockSummaries, 2024);

      expect(csv).toContain('Empresa A, Lda');
      expect(csv).toContain('Société B');
    });

    it('deve gerar CSV vazio com apenas cabeçalho para lista vazia', () => {
      const csv = generateCSVForAT([], 2024);
      const lines = csv.split('\n');

      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('NIF Beneficiário');
    });
  });

  describe('formatCSVValue', () => {
    it('deve formatar número com 2 casas decimais', () => {
      expect(formatCSVValue(1000)).toBe('1000,00');
      expect(formatCSVValue(1234.56)).toBe('1234,56');
    });

    it('deve arredondar corretamente', () => {
      expect(formatCSVValue(1234.567)).toBe('1234,57');
      expect(formatCSVValue(1234.564)).toBe('1234,56');
    });

    it('deve tratar zeros', () => {
      expect(formatCSVValue(0)).toBe('0,00');
    });

    it('deve tratar valores negativos', () => {
      expect(formatCSVValue(-100.5)).toBe('-100,50');
    });
  });

  describe('generateCSVFilename', () => {
    it('deve incluir ano fiscal no nome', () => {
      const filename = generateCSVFilename(2024);
      expect(filename).toContain('2024');
    });

    it('deve ter extensão .csv', () => {
      const filename = generateCSVFilename(2024);
      expect(filename).toMatch(/\.csv$/);
    });

    it('deve começar com Modelo10', () => {
      const filename = generateCSVFilename(2024);
      expect(filename).toMatch(/^Modelo10_/);
    });

    it('deve incluir timestamp', () => {
      const filename = generateCSVFilename(2024);
      // Formato: Modelo10_YYYY_YYYYMMDD.csv
      expect(filename).toMatch(/Modelo10_\d{4}_\d{8}\.csv/);
    });
  });
});

// ============================================
// TESTES DE CASOS EDGE
// ============================================

describe('Modelo 10 - Casos Edge', () => {
  describe('Valores extremos', () => {
    it('deve lidar com valores muito grandes', () => {
      const largeWithholding: TaxWithholding = {
        id: '1',
        beneficiary_nif: '123456789',
        beneficiary_name: 'Grande Empresa',
        beneficiary_address: null,
        gross_amount: 999999999.99,
        withholding_amount: 249999999.99,
        withholding_rate: 25,
        income_category: 'A',
        location_code: 'C',
        payment_date: '2024-12-31',
        fiscal_year: 2024,
        is_non_resident: false,
        country_code: null,
        dispensed_amount: 0,
        exempt_amount: 0,
        document_reference: null,
        notes: null,
      };

      const result = calculateWithholdingTotals([largeWithholding]);
      expect(result.totalGross).toBe(999999999.99);
    });

    it('deve lidar com valores decimais precisos', () => {
      const preciseWithholding: TaxWithholding = {
        id: '1',
        beneficiary_nif: '123456789',
        beneficiary_name: 'Empresa',
        beneficiary_address: null,
        gross_amount: 1234.567,
        withholding_amount: 308.64,
        withholding_rate: 25,
        income_category: 'A',
        location_code: 'C',
        payment_date: '2024-06-15',
        fiscal_year: 2024,
        is_non_resident: false,
        country_code: null,
        dispensed_amount: 0,
        exempt_amount: 0,
        document_reference: null,
        notes: null,
      };

      const result = calculateWithholdingTotals([preciseWithholding]);
      expect(result.totalGross).toBeCloseTo(1234.567, 2);
    });
  });

  describe('Caracteres especiais', () => {
    it('deve lidar com nomes com acentos', () => {
      const summary: WithholdingSummary = {
        beneficiary_nif: '123456789',
        beneficiary_name: 'José António Conceição',
        income_category: 'A',
        location_code: 'C',
        total_gross: 1000,
        total_withholding: 250,
        document_count: 1,
      };

      const csv = generateCSVForAT([summary], 2024);
      expect(csv).toContain('José António Conceição');
    });

    it('deve lidar com nomes nulos', () => {
      const summary: WithholdingSummary = {
        beneficiary_nif: '123456789',
        beneficiary_name: null,
        income_category: 'A',
        location_code: 'C',
        total_gross: 1000,
        total_withholding: 250,
        document_count: 1,
      };

      const csv = generateCSVForAT([summary], 2024);
      expect(csv).toContain('123456789;;A'); // Nome vazio entre separadores
    });
  });

  describe('Diferentes categorias de rendimento', () => {
    it('deve suportar todas as categorias portuguesas', () => {
      const categories = ['A', 'B', 'E', 'F', 'G', 'H'];

      categories.forEach((cat) => {
        const withholding: Partial<TaxWithholding> = {
          income_category: cat,
          is_non_resident: false,
        };

        // Não deve lançar erro
        expect(() => validateNonResidentFields(withholding)).not.toThrow();
      });
    });
  });
});
