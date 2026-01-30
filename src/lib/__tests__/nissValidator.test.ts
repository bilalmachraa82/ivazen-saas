import { describe, it, expect } from 'vitest';
import { validateNISS } from '../utils';
import { validatePortugueseNISS } from '../nifValidator';

/**
 * Testes de Validação de NISS Português
 * Baseado no algoritmo oficial da Segurança Social
 * 
 * Algoritmo:
 * - 11 dígitos numéricos
 * - Primeiro dígito: 1 ou 2
 * - Pesos (primos decrescentes): [29, 23, 19, 17, 13, 11, 7, 5, 3, 2]
 * - Soma ponderada dos 10 primeiros dígitos
 * - Dígito de controlo = 9 - (soma % 10)
 */
describe('validateNISS (utils.ts)', () => {
  describe('NISS Válidos', () => {
    it('deve aceitar NISS válido começando com 1', () => {
      // NISS de teste: 11234567890
      // Calcular dígito de controlo correcto:
      // Pesos: [29, 23, 19, 17, 13, 11, 7, 5, 3, 2]
      // Dígitos: 1, 1, 2, 3, 4, 5, 6, 7, 8, 9
      // Soma = 1*29 + 1*23 + 2*19 + 3*17 + 4*13 + 5*11 + 6*7 + 7*5 + 8*3 + 9*2
      //      = 29 + 23 + 38 + 51 + 52 + 55 + 42 + 35 + 24 + 18 = 367
      // DC = 9 - (367 % 10) = 9 - 7 = 2
      const result = validateNISS('11234567892');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar NISS válido começando com 2', () => {
      // NISS: 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?
      // Soma = 2*29 + 0*23 + 0*19 + 0*17 + 0*13 + 0*11 + 0*7 + 0*5 + 0*3 + 0*2 = 58
      // DC = 9 - (58 % 10) = 9 - 8 = 1
      const result = validateNISS('20000000001');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar NISS com dígito de controlo 0', () => {
      // Precisamos de uma soma onde soma % 10 = 9
      // Dígitos: 1, 0, 0, 0, 0, 0, 0, 0, 0, 0
      // Soma = 1*29 = 29
      // DC = 9 - (29 % 10) = 9 - 9 = 0
      const result = validateNISS('10000000000');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar campo vazio como válido (campo opcional)', () => {
      const result = validateNISS('');
      expect(result.valid).toBe(true);
    });
  });

  describe('NISS Inválidos - Formato', () => {
    it('deve rejeitar NISS com menos de 11 dígitos', () => {
      const result = validateNISS('1234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('O NISS deve ter 11 dígitos');
    });

    it('deve rejeitar NISS com mais de 11 dígitos', () => {
      const result = validateNISS('123456789012');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('O NISS deve ter 11 dígitos');
    });

    it('deve rejeitar NISS com letras', () => {
      const result = validateNISS('1234567890A');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('O NISS deve conter apenas números');
    });

    it('deve rejeitar NISS com caracteres especiais', () => {
      const result = validateNISS('123-456-789');
      expect(result.valid).toBe(false);
    });

    it('deve rejeitar NISS com espaços', () => {
      const result = validateNISS('123 456 789');
      expect(result.valid).toBe(false);
    });
  });

  describe('NISS Inválidos - Primeiro Dígito', () => {
    it('deve rejeitar NISS começando com 0', () => {
      const result = validateNISS('01234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NISS inválido - primeiro dígito deve ser 1 ou 2');
    });

    it('deve rejeitar NISS começando com 3', () => {
      const result = validateNISS('31234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NISS inválido - primeiro dígito deve ser 1 ou 2');
    });

    it('deve rejeitar NISS começando com 9', () => {
      const result = validateNISS('91234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NISS inválido - primeiro dígito deve ser 1 ou 2');
    });
  });

  describe('NISS Inválidos - Dígito de Controlo', () => {
    it('deve rejeitar NISS com dígito de controlo errado', () => {
      // NISS válido: 11234567892, com DC errado: 11234567891
      const result = validateNISS('11234567891');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NISS inválido - dígito de controlo incorrecto');
    });

    it('deve rejeitar NISS com todos os dígitos iguais (excepto válidos)', () => {
      // 11111111111 - verificar dígito de controlo
      // Soma = 1*(29+23+19+17+13+11+7+5+3+2) = 1*129 = 129
      // DC = 9 - (129 % 10) = 9 - 9 = 0
      // Portanto 11111111110 seria válido, não 11111111111
      const result = validateNISS('11111111111');
      expect(result.valid).toBe(false);
    });
  });

  describe('Algoritmo de Validação', () => {
    it('deve usar pesos primos correctos: [29, 23, 19, 17, 13, 11, 7, 5, 3, 2]', () => {
      // Este teste verifica que o algoritmo usa os pesos correctos
      // calculando manualmente um NISS e verificando
      
      // NISS base: 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, ?
      // Soma = 1*29 + 2*23 + 3*19 + 4*17 + 5*13 + 6*11 + 7*7 + 8*5 + 9*3 + 0*2
      //      = 29 + 46 + 57 + 68 + 65 + 66 + 49 + 40 + 27 + 0 = 447
      // DC = 9 - (447 % 10) = 9 - 7 = 2
      const result = validateNISS('12345678902');
      expect(result.valid).toBe(true);
    });

    it('deve validar correctamente quando soma % 10 = 9', () => {
      // DC = 9 - 9 = 0
      const result = validateNISS('10000000000');
      expect(result.valid).toBe(true);
    });

    it('deve validar correctamente quando soma % 10 = 0', () => {
      // DC = 9 - 0 = 9
      // Precisamos de soma múltipla de 10
      // Para NISS '20000000409':
      // Posições:    0   1   2   3   4   5   6   7   8   9  10
      // Dígitos:     2   0   0   0   0   0   0   0   4   0   9
      // Pesos:      29  23  19  17  13  11   7   5   3   2   -
      // Soma = 2*29 + 4*3 = 58 + 12 = 70
      // DC = 9 - (70 % 10) = 9 - 0 = 9
      const result = validateNISS('20000000409');
      expect(result.valid).toBe(true);
    });
  });
});

/**
 * Testes para validatePortugueseNISS (nifValidator.ts)
 * Deve ter comportamento idêntico a validateNISS
 */
describe('validatePortugueseNISS (nifValidator.ts)', () => {
  it('deve validar NISS válido', () => {
    const result = validatePortugueseNISS('11234567892');
    expect(result.valid).toBe(true);
  });

  it('deve rejeitar NISS inválido', () => {
    const result = validatePortugueseNISS('11234567891');
    expect(result.valid).toBe(false);
  });

  it('deve aceitar campo vazio', () => {
    const result = validatePortugueseNISS('');
    expect(result.valid).toBe(true);
  });

  it('deve rejeitar formato incorreto', () => {
    const result = validatePortugueseNISS('123');
    expect(result.valid).toBe(false);
  });
});

/**
 * Testes de Conformidade
 */
describe('Conformidade com Regras da Segurança Social', () => {
  it('deve aceitar apenas primeiro dígito 1 (beneficiário) ou 2 (entidade empregadora)', () => {
    // 1 = Número de beneficiário
    // 2 = Número de entidade empregadora
    expect(validateNISS('11234567892').valid).toBe(true);
    expect(validateNISS('20000000001').valid).toBe(true);
    expect(validateNISS('31234567890').valid).toBe(false);
  });

  it('deve ter exactamente 11 dígitos', () => {
    expect(validateNISS('1234567890').error).toContain('11 dígitos');
    expect(validateNISS('123456789012').error).toContain('11 dígitos');
  });
});
