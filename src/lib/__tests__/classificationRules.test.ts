/**
 * Testes das Regras de Classificação Fiscal
 * Cobre o motor de classificação de despesas portuguesas:
 *  - Fornecedores conhecidos (KNOWN_SUPPLIERS em memória)
 *  - Inferência por CAE
 *  - Heurística por valor
 *  - Classificação por defeito
 *  - Constantes e tipos exportados
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase BEFORE importing the module under test so the import-time
// side-effect (supabase client initialization) uses the mock.
// ---------------------------------------------------------------------------
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

import {
  classifyExpense,
  classifyExpenses,
  DP_FIELD_MAP,
  type ClassificationInput,
  type ClassificationResult,
  type Classification,
} from '../classificationRules';

// ---------------------------------------------------------------------------
// Helper — builds a minimal ClassificationInput
// ---------------------------------------------------------------------------
function makeInput(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  return {
    supplierNif: '999999999',
    supplierName: 'Fornecedor Genérico Lda',
    valorTotal: 100,
    valorIva: 23,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DP_FIELD_MAP constants
// ---------------------------------------------------------------------------
describe('DP_FIELD_MAP', () => {
  it('deve expor os campos obrigatórios da declaração IVA', () => {
    expect(DP_FIELD_MAP.IMOBILIZADO).toBe(20);
    expect(DP_FIELD_MAP.EXISTENCIAS_6).toBe(21);
    expect(DP_FIELD_MAP.EXISTENCIAS_13).toBe(23);
    expect(DP_FIELD_MAP.EXISTENCIAS_23).toBe(22);
    expect(DP_FIELD_MAP.OUTROS_BENS).toBe(24);
  });
});

// ---------------------------------------------------------------------------
// Fornecedores Conhecidos (KNOWN_SUPPLIERS)
// ---------------------------------------------------------------------------
describe('classifyExpense — fornecedores conhecidos', () => {
  it('classifica EDP como ACTIVIDADE, campo 24, 100% dedutível', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '503504564' }));
    expect(result.classification).toBe('ACTIVIDADE');
    expect(result.dpField).toBe(24);
    expect(result.deductibility).toBe(100);
    expect(result.confidence).toBeGreaterThanOrEqual(90);
    expect(result.source).toBe('global_rule');
    expect(result.requiresReview).toBe(false);
    expect(result.reason).toContain('EDP');
  });

  it('classifica NOS (telecomunicações) como ACTIVIDADE, 100% dedutível', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '503423971' }));
    expect(result.classification).toBe('ACTIVIDADE');
    expect(result.deductibility).toBe(100);
    expect(result.reason).toContain('NOS');
  });

  it('classifica MEO como ACTIVIDADE, 100% dedutível', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '501532927' }));
    expect(result.deductibility).toBe(100);
    expect(result.reason).toContain('MEO');
  });

  it('classifica Vodafone como ACTIVIDADE, 100% dedutível', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '501525480' }));
    expect(result.deductibility).toBe(100);
    expect(result.reason).toContain('Vodafone');
  });

  it('classifica EPAL (água) como ACTIVIDADE, 100% dedutível', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '500091241' }));
    expect(result.deductibility).toBe(100);
    expect(result.reason).toContain('EPAL');
  });

  it('classifica GALP (combustível) como ACTIVIDADE, 50% dedutível (viatura ligeira)', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '500220152' }));
    expect(result.classification).toBe('ACTIVIDADE');
    expect(result.dpField).toBe(24);
    expect(result.deductibility).toBe(50);
    expect(result.reason).toContain('GALP');
    expect(result.reason).toContain('Combustível');
  });

  it('classifica BP (combustível) com 50% dedutibilidade', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '503217580' }));
    expect(result.deductibility).toBe(50);
    expect(result.reason).toContain('BP');
  });

  it('classifica Repsol com 50% dedutibilidade', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '500667820' }));
    expect(result.deductibility).toBe(50);
  });

  it('classifica Cepsa com 50% dedutibilidade', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '502088378' }));
    expect(result.deductibility).toBe(50);
  });

  it('classifica Continente (supermercado) com requiresReview=true e deductibility=0', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '500100144' }));
    expect(result.requiresReview).toBe(true);
    expect(result.deductibility).toBe(0);
    // KNOWN_SUPPLIERS has dpField: null but classifyExpense coerces null → 24 via ?? 24
    expect(result.dpField).toBe(24);
    expect(result.reason).toContain('Continente');
  });

  it('classifica Pingo Doce com requiresReview=true', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '500273170' }));
    expect(result.requiresReview).toBe(true);
    expect(result.deductibility).toBe(0);
  });

  it('classifica Lidl com requiresReview=true', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '501659300' }));
    expect(result.requiresReview).toBe(true);
  });

  it('classifica Auchan com requiresReview=true', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '502011475' }));
    expect(result.requiresReview).toBe(true);
  });

  it('classifica Staples (material escritório) como 100% dedutível, campo 24', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '500699654' }));
    expect(result.deductibility).toBe(100);
    expect(result.dpField).toBe(24);
    expect(result.reason).toContain('escritório');
  });

  it('classifica fornecedor de software/serviços digitais como 100% dedutível', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '513755490' }));
    expect(result.deductibility).toBe(100);
    expect(result.source).toBe('global_rule');
  });

  it('classifica NIF consumidor final (999999990) como PESSOAL, 0% dedutível', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '999999990' }));
    expect(result.classification).toBe('PESSOAL');
    expect(result.deductibility).toBe(0);
    // KNOWN_SUPPLIERS has dpField: null but classifyExpense coerces null → 24 via ?? 24
    expect(result.dpField).toBe(24);
  });

  it('resultado de fornecedor conhecido tem sempre confidence >= 90', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '503504564' }));
    expect(result.confidence).toBeGreaterThanOrEqual(90);
  });
});

// ---------------------------------------------------------------------------
// Inferência por CAE (quando BD não tem regras)
// ---------------------------------------------------------------------------
describe('classifyExpense — inferência por CAE', () => {
  it('deduz ACTIVIDADE para restaurante com nome contendo "alimentar" (CAE 56)', async () => {
    const result = await classifyExpense(
      makeInput({
        supplierNif: '111111111',
        supplierName: 'Produtos alimentar Lda',
        clientCae: '561',
      })
    );
    expect(result.classification).toBe('ACTIVIDADE');
    expect(result.source).toBe('cae_inference');
    expect(result.confidence).toBe(60);
    expect(result.requiresReview).toBe(true);
    expect(result.reason).toContain('561');
  });

  it('atribui campo 20 (imobilizado) quando valor > 1000 € na inferência por CAE', async () => {
    const result = await classifyExpense(
      makeInput({
        supplierNif: '111111111',
        supplierName: 'equipamento de cozinha',
        valorTotal: 1500,
        clientCae: '561',
      })
    );
    expect(result.dpField).toBe(20);
  });

  it('atribui campo 24 quando valor <= 1000 € na inferência por CAE', async () => {
    const result = await classifyExpense(
      makeInput({
        supplierNif: '111111111',
        supplierName: 'bebidas premium',
        valorTotal: 200,
        clientCae: '56',
      })
    );
    expect(result.dpField).toBe(24);
  });

  it('infere ACTIVIDADE para empresa de TI com nome contendo "software" (CAE 62)', async () => {
    const result = await classifyExpense(
      makeInput({
        supplierNif: '111111111',
        supplierName: 'software especializado',
        clientCae: '62',
      })
    );
    expect(result.source).toBe('cae_inference');
    expect(result.classification).toBe('ACTIVIDADE');
  });

  it('infere ACTIVIDADE para consultoria com material escritório (CAE 70)', async () => {
    const result = await classifyExpense(
      makeInput({
        supplierNif: '111111111',
        supplierName: 'material escritório empresa',
        clientCae: '70',
      })
    );
    expect(result.source).toBe('cae_inference');
  });

  it('infere ACTIVIDADE para transporte com combustível (CAE 49)', async () => {
    const result = await classifyExpense(
      makeInput({
        supplierNif: '111111111',
        supplierName: 'posto combustível norte',
        clientCae: '49',
      })
    );
    expect(result.source).toBe('cae_inference');
  });

  it('não infere quando nome do fornecedor não corresponde às categorias do CAE', async () => {
    const result = await classifyExpense(
      makeInput({
        supplierNif: '111111111',
        supplierName: 'Serviços Gerais Lda',
        clientCae: '56',
      })
    );
    // Should NOT use cae_inference — falls through to heuristic or default
    expect(result.source).not.toBe('cae_inference');
  });
});

// ---------------------------------------------------------------------------
// Heurística por valor
// ---------------------------------------------------------------------------
describe('classifyExpense — heurística por valor', () => {
  it('classifica como imobilizado (campo 20) quando valorTotal > 1000, fonte default', async () => {
    const result = await classifyExpense(
      makeInput({
        supplierNif: '111111111',
        supplierName: 'Fornecedor Desconhecido',
        valorTotal: 1500,
      })
    );
    expect(result.dpField).toBe(20);
    expect(result.source).toBe('default');
    expect(result.requiresReview).toBe(true);
    expect(result.confidence).toBe(50);
  });

  it('inclui "imobilizado" na razão para valores elevados', async () => {
    const result = await classifyExpense(
      makeInput({ supplierNif: '111111111', valorTotal: 2000 })
    );
    expect(result.reason.toLowerCase()).toContain('imobilizado');
  });

  it('NOT triggered for valorTotal exactly 1000 (boundary)', async () => {
    const result = await classifyExpense(
      makeInput({ supplierNif: '111111111', valorTotal: 1000 })
    );
    // 1000 is not > 1000, so falls to default
    expect(result.dpField).toBe(24);
    expect(result.confidence).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Classificação por defeito
// ---------------------------------------------------------------------------
describe('classifyExpense — classificação por defeito', () => {
  it('retorna classificação por defeito para fornecedor completamente desconhecido', async () => {
    const result = await classifyExpense(
      makeInput({ supplierNif: '111111111', valorTotal: 50 })
    );
    expect(result.classification).toBe('ACTIVIDADE');
    expect(result.dpField).toBe(24);
    expect(result.deductibility).toBe(100);
    expect(result.confidence).toBe(30);
    expect(result.source).toBe('default');
    expect(result.requiresReview).toBe(true);
  });

  it('resultado por defeito tem reason com "defeito" ou "manual"', async () => {
    const result = await classifyExpense(
      makeInput({ supplierNif: '111111111', valorTotal: 50 })
    );
    expect(result.reason.toLowerCase()).toMatch(/defeito|manual/);
  });
});

// ---------------------------------------------------------------------------
// Estrutura do resultado
// ---------------------------------------------------------------------------
describe('classifyExpense — estrutura do resultado', () => {
  it('retorna sempre todos os campos obrigatórios da interface ClassificationResult', async () => {
    const result = await classifyExpense(makeInput({ supplierNif: '503504564' }));
    expect(result).toHaveProperty('classification');
    expect(result).toHaveProperty('dpField');
    expect(result).toHaveProperty('deductibility');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('requiresReview');
  });

  it('confidence está sempre entre 0 e 100', async () => {
    const nifs = ['503504564', '500220152', '111111111'];
    for (const nif of nifs) {
      const result = await classifyExpense(makeInput({ supplierNif: nif }));
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    }
  });

  it('deductibility está sempre entre 0 e 100', async () => {
    const nifs = ['503504564', '500220152', '500100144', '111111111'];
    for (const nif of nifs) {
      const result = await classifyExpense(makeInput({ supplierNif: nif }));
      expect(result.deductibility).toBeGreaterThanOrEqual(0);
      expect(result.deductibility).toBeLessThanOrEqual(100);
    }
  });

  it('source é um dos valores permitidos', async () => {
    const validSources = ['global_rule', 'client_history', 'cae_inference', 'default'];
    const result = await classifyExpense(makeInput({ supplierNif: '503504564' }));
    expect(validSources).toContain(result.source);
  });

  it('classification é um dos valores permitidos', async () => {
    const validClassifications: Classification[] = ['ACTIVIDADE', 'PESSOAL', 'MISTA'];
    const result = await classifyExpense(makeInput({ supplierNif: '503504564' }));
    expect(validClassifications).toContain(result.classification);
  });
});

// ---------------------------------------------------------------------------
// classifyExpenses (bulk)
// ---------------------------------------------------------------------------
describe('classifyExpenses — processamento em lote', () => {
  it('retorna um Map com resultado para cada NIF de entrada', async () => {
    const inputs: ClassificationInput[] = [
      makeInput({ supplierNif: '503504564' }),
      makeInput({ supplierNif: '500220152' }),
    ];
    const results = await classifyExpenses(inputs);
    expect(results).toBeInstanceOf(Map);
    expect(results.size).toBe(2);
    expect(results.has('503504564')).toBe(true);
    expect(results.has('500220152')).toBe(true);
  });

  it('processa corretamente um lote de 0 entradas', async () => {
    const results = await classifyExpenses([]);
    expect(results).toBeInstanceOf(Map);
    expect(results.size).toBe(0);
  });

  it('processa corretamente um lote maior que 10 (múltiplos batches)', async () => {
    const inputs: ClassificationInput[] = Array.from({ length: 15 }, (_, i) =>
      makeInput({ supplierNif: `11111111${i}` })
    );
    const results = await classifyExpenses(inputs);
    expect(results.size).toBe(15);
  });

  it('mantém correcta a classificação de fornecedores conhecidos no lote', async () => {
    const inputs: ClassificationInput[] = [
      makeInput({ supplierNif: '503504564' }),  // EDP
      makeInput({ supplierNif: '999999990' }),  // Consumidor final
    ];
    const results = await classifyExpenses(inputs);
    expect(results.get('503504564')?.classification).toBe('ACTIVIDADE');
    expect(results.get('999999990')?.classification).toBe('PESSOAL');
  });
});
