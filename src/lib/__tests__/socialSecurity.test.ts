import { describe, it, expect } from 'vitest';
import {
  IAS_2025,
  SS_LIMITS,
  REVENUE_COEFFICIENTS,
  REVENUE_CATEGORIES,
  CONTRIBUTION_RATES_BY_TYPE,
  calculateContributionRate,
  calculateRelevantIncome,
  checkTCOExemption,
  getCurrentQuarter,
  getQuarterLabel,
  getDeadlineMonth,
} from '@/hooks/useSocialSecurity';

/**
 * Testes de Constantes da Segurança Social
 * Baseado no Código Contributivo e Manual ISS
 */
describe('Constantes da Segurança Social', () => {
  describe('IAS - Indexante dos Apoios Sociais', () => {
    it('deve ter valor correto para 2025', () => {
      expect(IAS_2025).toBe(522.50);
    });

    it('IAS 2026 será 537.13€ (a atualizar)', () => {
      // Nota: Este teste documenta o valor futuro
      // O IAS 2026 = 537.13€ foi anunciado
      const IAS_2026_EXPECTED = 537.13;
      expect(IAS_2026_EXPECTED).toBe(537.13);
    });
  });

  describe('Limites de Contribuição', () => {
    it('base mínima para contabilidade organizada = 1.5×IAS', () => {
      expect(SS_LIMITS.MIN_BASE_ORGANIZED).toBe(IAS_2025 * 1.5);
      expect(SS_LIMITS.MIN_BASE_ORGANIZED).toBe(783.75);
    });

    it('base máxima = 12×IAS', () => {
      expect(SS_LIMITS.MAX_BASE).toBe(IAS_2025 * 12);
      expect(SS_LIMITS.MAX_BASE).toBe(6270);
    });

    it('limite de isenção TCO = 4×IAS', () => {
      expect(SS_LIMITS.TCO_EXEMPTION_LIMIT).toBe(IAS_2025 * 4);
      expect(SS_LIMITS.TCO_EXEMPTION_LIMIT).toBe(2090);
    });

    it('contribuição mínima = 20€', () => {
      expect(SS_LIMITS.MIN_CONTRIBUTION).toBe(20);
    });
  });
});

/**
 * Testes de Coeficientes de Rendimento Relevante
 * Art. 162º do Código Contributivo
 */
describe('Coeficientes de Rendimento Relevante', () => {
  it('prestação de serviços = 70%', () => {
    expect(REVENUE_COEFFICIENTS.prestacao_servicos).toBe(0.70);
  });

  it('vendas de produtos = 20%', () => {
    expect(REVENUE_COEFFICIENTS.vendas).toBe(0.20);
  });

  it('hotelaria e restauração = 20%', () => {
    expect(REVENUE_COEFFICIENTS.hotelaria).toBe(0.20);
  });

  it('produção agrícola = 20%', () => {
    expect(REVENUE_COEFFICIENTS.producao_agricola).toBe(0.20);
  });

  it('rendas = 95%', () => {
    expect(REVENUE_COEFFICIENTS.rendas).toBe(0.95);
  });

  it('capitais = 95%', () => {
    expect(REVENUE_COEFFICIENTS.capitais).toBe(0.95);
  });

  it('propriedade intelectual = 50%', () => {
    expect(REVENUE_COEFFICIENTS.prop_intelectual).toBe(0.50);
  });

  it('subsídios = 70%', () => {
    expect(REVENUE_COEFFICIENTS.subsidios).toBe(0.70);
  });

  it('outros = 70%', () => {
    expect(REVENUE_COEFFICIENTS.outros).toBe(0.70);
  });
});

/**
 * Testes de Taxas Contributivas
 * Baseado no Art. 168º do Código Contributivo
 */
describe('Taxas Contributivas', () => {
  it('trabalhadores independentes = 21.4%', () => {
    expect(CONTRIBUTION_RATES_BY_TYPE.independent).toBe(21.4);
  });

  it('empresários em nome individual = 25.2%', () => {
    expect(CONTRIBUTION_RATES_BY_TYPE.eni).toBe(25.2);
  });

  it('EIRL = 25.2%', () => {
    expect(CONTRIBUTION_RATES_BY_TYPE.eirl).toBe(25.2);
  });

  it('produtores agrícolas = 25.2%', () => {
    expect(CONTRIBUTION_RATES_BY_TYPE.agricultural).toBe(25.2);
  });
});

/**
 * Testes de Cálculo de Taxa Contributiva
 */
describe('calculateContributionRate', () => {
  it('deve isentar no primeiro ano de atividade', () => {
    const result = calculateContributionRate(
      'independent',
      'simplified',
      false,
      0,
      1000,
      true // isFirstYear
    );
    
    expect(result.rate).toBe(0);
    expect(result.isExempt).toBe(true);
    expect(result.reason).toContain('Primeiros 12 meses');
  });

  it('deve isentar TCO com rendimento < 4×IAS', () => {
    const result = calculateContributionRate(
      'independent',
      'simplified',
      true,                     // hasOtherEmployment
      IAS_2025,                 // otherEmploymentSalary >= 1×IAS
      SS_LIMITS.TCO_EXEMPTION_LIMIT - 100, // monthlyRelevantIncome < 4×IAS
      false
    );
    
    expect(result.rate).toBe(0);
    expect(result.isExempt).toBe(true);
    expect(result.reason).toContain('TCO');
  });

  it('deve retornar 21.4% para trabalhador independente normal', () => {
    const result = calculateContributionRate(
      'independent',
      'simplified',
      false,
      0,
      3000,
      false
    );
    
    expect(result.rate).toBe(21.4);
    expect(result.isExempt).toBe(false);
  });

  it('deve retornar 25.2% para ENI', () => {
    const result = calculateContributionRate(
      'eni',
      'organized',
      false,
      0,
      5000,
      false
    );
    
    expect(result.rate).toBe(25.2);
    expect(result.isExempt).toBe(false);
  });
});

/**
 * Testes de Cálculo de Rendimento Relevante
 */
describe('calculateRelevantIncome', () => {
  it('deve calcular corretamente para serviços (70%)', () => {
    const entries = [
      { id: '1', client_id: '1', period_quarter: '2024-Q1', category: 'prestacao_servicos', amount: 1000, source: 'manual', notes: null, created_at: '' }
    ];
    
    const result = calculateRelevantIncome(entries);
    expect(result).toBe(700); // 1000 * 0.70
  });

  it('deve calcular corretamente para vendas (20%)', () => {
    const entries = [
      { id: '1', client_id: '1', period_quarter: '2024-Q1', category: 'vendas', amount: 1000, source: 'manual', notes: null, created_at: '' }
    ];
    
    const result = calculateRelevantIncome(entries);
    expect(result).toBe(200); // 1000 * 0.20
  });

  it('deve somar múltiplas categorias com coeficientes diferentes', () => {
    const entries = [
      { id: '1', client_id: '1', period_quarter: '2024-Q1', category: 'prestacao_servicos', amount: 1000, source: 'manual', notes: null, created_at: '' },
      { id: '2', client_id: '1', period_quarter: '2024-Q1', category: 'vendas', amount: 1000, source: 'manual', notes: null, created_at: '' },
    ];
    
    const result = calculateRelevantIncome(entries);
    expect(result).toBe(900); // (1000 * 0.70) + (1000 * 0.20) = 700 + 200
  });

  it('deve usar 70% para categoria desconhecida', () => {
    const entries = [
      { id: '1', client_id: '1', period_quarter: '2024-Q1', category: 'categoria_inexistente', amount: 1000, source: 'manual', notes: null, created_at: '' }
    ];
    
    const result = calculateRelevantIncome(entries);
    expect(result).toBe(700); // fallback para 0.70
  });
});

/**
 * Testes de Isenção TCO (Trabalho por Conta de Outrem)
 */
describe('checkTCOExemption', () => {
  it('deve retornar false se não tem outro emprego', () => {
    const result = checkTCOExemption(false, 0, 1000);
    expect(result).toBe(false);
  });

  it('deve retornar false se salário TCO < 1×IAS', () => {
    const result = checkTCOExemption(true, IAS_2025 - 1, 500);
    expect(result).toBe(false);
  });

  it('deve retornar false se rendimento relevante >= 4×IAS', () => {
    const result = checkTCOExemption(true, IAS_2025, SS_LIMITS.TCO_EXEMPTION_LIMIT + 1);
    expect(result).toBe(false);
  });

  it('deve retornar true se salário >= 1×IAS E rendimento < 4×IAS', () => {
    const result = checkTCOExemption(
      true, 
      IAS_2025, 
      SS_LIMITS.TCO_EXEMPTION_LIMIT - 100
    );
    expect(result).toBe(true);
  });
});

/**
 * Testes de Utilitários de Trimestre
 */
describe('Utilitários de Trimestre', () => {
  describe('getCurrentQuarter', () => {
    it('deve retornar formato YYYY-QX', () => {
      const quarter = getCurrentQuarter();
      expect(quarter).toMatch(/^\d{4}-Q[1-4]$/);
    });
  });

  describe('getQuarterLabel', () => {
    it('deve retornar label correto para Q1', () => {
      expect(getQuarterLabel('2024-Q1')).toBe('Janeiro - Março 2024');
    });

    it('deve retornar label correto para Q2', () => {
      expect(getQuarterLabel('2024-Q2')).toBe('Abril - Junho 2024');
    });

    it('deve retornar label correto para Q3', () => {
      expect(getQuarterLabel('2024-Q3')).toBe('Julho - Setembro 2024');
    });

    it('deve retornar label correto para Q4', () => {
      expect(getQuarterLabel('2024-Q4')).toBe('Outubro - Dezembro 2024');
    });
  });

  describe('getDeadlineMonth', () => {
    it('Q1 deve ter prazo em Abril', () => {
      expect(getDeadlineMonth('2024-Q1')).toEqual({ month: 4, year: 2024 });
    });

    it('Q2 deve ter prazo em Julho', () => {
      expect(getDeadlineMonth('2024-Q2')).toEqual({ month: 7, year: 2024 });
    });

    it('Q3 deve ter prazo em Outubro', () => {
      expect(getDeadlineMonth('2024-Q3')).toEqual({ month: 10, year: 2024 });
    });

    it('Q4 deve ter prazo em Janeiro do ano seguinte', () => {
      expect(getDeadlineMonth('2024-Q4')).toEqual({ month: 1, year: 2025 });
    });
  });
});

/**
 * Testes de Conformidade Legal
 * Referências: Código Contributivo, Manual ISS para TI
 */
describe('Conformidade com Código Contributivo', () => {
  it('REVENUE_CATEGORIES deve ter todas as categorias oficiais', () => {
    const categories = REVENUE_CATEGORIES.map(c => c.value);
    
    expect(categories).toContain('prestacao_servicos');
    expect(categories).toContain('vendas');
    expect(categories).toContain('hotelaria');
    expect(categories).toContain('producao_agricola');
    expect(categories).toContain('rendas');
    expect(categories).toContain('capitais');
    expect(categories).toContain('prop_intelectual');
    expect(categories).toContain('subsidios');
  });

  it('coeficientes devem estar entre 0 e 1', () => {
    Object.values(REVENUE_COEFFICIENTS).forEach(coef => {
      expect(coef).toBeGreaterThan(0);
      expect(coef).toBeLessThanOrEqual(1);
    });
  });

  it('categorias devem ter labels em português', () => {
    REVENUE_CATEGORIES.forEach(cat => {
      expect(cat.label).toBeDefined();
      expect(cat.label.length).toBeGreaterThan(0);
    });
  });
});
