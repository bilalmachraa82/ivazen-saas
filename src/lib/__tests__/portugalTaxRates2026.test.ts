/**
 * Portugal Tax Rates 2026 Tests
 * Validates official tax rates and thresholds for Portuguese tax compliance
 */

import { describe, it, expect } from 'vitest';
import {
  TAXA_RETENCAO_CATEGORIA_B,
  TAXAS_RETENCAO_CATEGORIA_F,
  TAXA_RETENCAO_CATEGORIA_E,
  TAXA_RETENCAO_CATEGORIA_H,
  TAXAS_RETENCAO,
  LIMITES_DISPENSA_RETENCAO,
  verificarDispensaRetencao,
  TAXAS_IVA,
  LIMITES_IVA,
  verificarIsencaoIVA,
  TAXAS_SEGURANCA_SOCIAL,
  IAS_2026,
  PRAZO_MODELO_10,
  CATEGORIAS_MODELO_10,
  REGIOES_FISCAIS,
  getTaxaRetencao,
  formatPercentage,
  formatCurrency,
} from '../portugalTaxRates2026';

describe('portugalTaxRates2026', () => {
  describe('IRS Withholding Rates', () => {
    it('should have correct Categoria B rate (23% - OE2026)', () => {
      expect(TAXA_RETENCAO_CATEGORIA_B).toBe(0.23);
      // Verify it's NOT the old 25% rate
      expect(TAXA_RETENCAO_CATEGORIA_B).not.toBe(0.25);
    });

    it('should have correct Categoria F rates', () => {
      expect(TAXAS_RETENCAO_CATEGORIA_F.HABITACIONAL).toBe(0.25);
      expect(TAXAS_RETENCAO_CATEGORIA_F.NAO_HABITACIONAL).toBe(0.28);
    });

    it('should have correct Categoria E rate (28%)', () => {
      expect(TAXA_RETENCAO_CATEGORIA_E).toBe(0.28);
    });

    it('should have correct Categoria H rate', () => {
      expect(TAXA_RETENCAO_CATEGORIA_H).toBe(0.25);
    });

    it('should export unified TAXAS_RETENCAO object', () => {
      expect(TAXAS_RETENCAO.B).toBe(0.23);
      expect(TAXAS_RETENCAO.F_HABITACIONAL).toBe(0.25);
      expect(TAXAS_RETENCAO.F_NAO_HABITACIONAL).toBe(0.28);
      expect(TAXAS_RETENCAO.E).toBe(0.28);
    });
  });

  describe('Retention Exemptions (Artigo 101.º-B CIRS)', () => {
    it('should have €10,000 annual threshold for Categoria F', () => {
      expect(LIMITES_DISPENSA_RETENCAO.CATEGORIA_F_ANUAL).toBe(10000);
    });

    it('should have €25 minimum retention threshold', () => {
      expect(LIMITES_DISPENSA_RETENCAO.VALOR_MINIMO).toBe(25);
    });

    describe('verificarDispensaRetencao', () => {
      it('should exempt amounts below €25', () => {
        const result = verificarDispensaRetencao(20, 'B');

        expect(result.dispensado).toBe(true);
        expect(result.motivo).toContain('€25');
      });

      it('should not exempt amounts above €25', () => {
        const result = verificarDispensaRetencao(100, 'B');

        expect(result.dispensado).toBe(false);
      });

      it('should exempt Categoria F with annual income ≤ €10,000', () => {
        const result = verificarDispensaRetencao(500, 'F', 8000);

        expect(result.dispensado).toBe(true);
        expect(result.motivo).toContain('€10000');
      });

      it('should not exempt Categoria F with annual income > €10,000', () => {
        const result = verificarDispensaRetencao(500, 'F', 15000);

        expect(result.dispensado).toBe(false);
      });
    });
  });

  describe('IVA Rates', () => {
    it('should have correct Continental rates', () => {
      expect(TAXAS_IVA.NORMAL).toBe(0.23);
      expect(TAXAS_IVA.INTERMEDIA).toBe(0.13);
      expect(TAXAS_IVA.REDUZIDA).toBe(0.06);
    });

    it('should have correct exemption thresholds', () => {
      expect(LIMITES_IVA.ISENCAO).toBe(15000);
      expect(LIMITES_IVA.ALERTA_25_PERCENT).toBe(18750);
      expect(LIMITES_IVA.LIMITE_UE).toBe(100000);
    });

    describe('verificarIsencaoIVA', () => {
      it('should identify exemption below €15,000', () => {
        const result = verificarIsencaoIVA(10000);

        expect(result.isento).toBe(true);
        expect(result.obrigatorioNormal).toBe(false);
      });

      it('should alert when approaching €15,000 (80%+)', () => {
        const result = verificarIsencaoIVA(13000);

        expect(result.isento).toBe(true);
        expect(result.alertaProximo).toBe(true);
      });

      it('should not be exempt above €15,000', () => {
        const result = verificarIsencaoIVA(16000);

        expect(result.isento).toBe(false);
      });

      it('should be mandatory normal regime above €18,750', () => {
        const result = verificarIsencaoIVA(20000);

        expect(result.isento).toBe(false);
        expect(result.obrigatorioNormal).toBe(true);
        expect(result.mensagem).toContain('OBRIGATÓRIO');
      });
    });
  });

  describe('Social Security Rates', () => {
    it('should have correct for-profit rates', () => {
      expect(TAXAS_SEGURANCA_SOCIAL.LUCRATIVOS.ENTIDADE).toBe(0.2375);
      expect(TAXAS_SEGURANCA_SOCIAL.LUCRATIVOS.TRABALHADOR).toBe(0.11);
      expect(TAXAS_SEGURANCA_SOCIAL.LUCRATIVOS.TOTAL).toBe(0.3475);
    });

    it('should have correct IPSS rates', () => {
      expect(TAXAS_SEGURANCA_SOCIAL.IPSS.ENTIDADE).toBe(0.223);
      expect(TAXAS_SEGURANCA_SOCIAL.IPSS.TRABALHADOR).toBe(0.11);
      expect(TAXAS_SEGURANCA_SOCIAL.IPSS.TOTAL).toBe(0.333);
    });

    it('should have correct IAS 2026 value', () => {
      expect(IAS_2026).toBe(537.13);
    });
  });

  describe('Modelo 10', () => {
    it('should have correct submission deadline', () => {
      expect(PRAZO_MODELO_10.ANO).toBe(2026);
      expect(PRAZO_MODELO_10.MES).toBe(2); // February
      expect(PRAZO_MODELO_10.DIA).toBe(10);
    });

    it('should have all income categories defined', () => {
      expect(CATEGORIAS_MODELO_10.A).toBeDefined();
      expect(CATEGORIAS_MODELO_10.B).toBeDefined();
      expect(CATEGORIAS_MODELO_10.E).toBeDefined();
      expect(CATEGORIAS_MODELO_10.F).toBeDefined();
      expect(CATEGORIAS_MODELO_10.G).toBeDefined();
      expect(CATEGORIAS_MODELO_10.H).toBeDefined();
    });

    it('should have correct default rates in categories', () => {
      expect(CATEGORIAS_MODELO_10.B.taxaDefault).toBe(0.23);
      expect(CATEGORIAS_MODELO_10.E.taxaDefault).toBe(0.28);
      expect(CATEGORIAS_MODELO_10.F.taxaHabitacional).toBe(0.25);
      expect(CATEGORIAS_MODELO_10.F.taxaNaoHabitacional).toBe(0.28);
    });

    it('should have all fiscal regions', () => {
      expect(REGIOES_FISCAIS.C.nome).toBe('Continente');
      expect(REGIOES_FISCAIS.RA.nome).toBe('Região Autónoma dos Açores');
      expect(REGIOES_FISCAIS.RM.nome).toBe('Região Autónoma da Madeira');
    });
  });

  describe('getTaxaRetencao', () => {
    it('should return 23% for Categoria B', () => {
      expect(getTaxaRetencao('B')).toBe(0.23);
    });

    it('should return 25% for Categoria F habitacional', () => {
      expect(getTaxaRetencao('F')).toBe(0.25);
      expect(getTaxaRetencao('F', 'habitacional')).toBe(0.25);
    });

    it('should return 28% for Categoria F não-habitacional', () => {
      expect(getTaxaRetencao('F', 'nao_habitacional')).toBe(0.28);
    });

    it('should return 28% for Categoria E', () => {
      expect(getTaxaRetencao('E')).toBe(0.28);
    });

    it('should handle lowercase categories', () => {
      expect(getTaxaRetencao('b')).toBe(0.23);
      expect(getTaxaRetencao('f')).toBe(0.25);
    });

    it('should default to Categoria B rate for unknown', () => {
      expect(getTaxaRetencao('X')).toBe(0.23);
    });
  });

  describe('Formatting Functions', () => {
    it('should format percentage correctly', () => {
      expect(formatPercentage(0.23)).toBe('23.0%');
      expect(formatPercentage(0.25)).toBe('25.0%');
      expect(formatPercentage(0.28)).toBe('28.0%');
    });

    it('should format currency in Portuguese format', () => {
      const formatted = formatCurrency(1234.56);

      expect(formatted).toContain('1');
      expect(formatted).toContain('234');
      expect(formatted).toContain('€');
    });
  });

  describe('2026 Compliance Validation', () => {
    it('should NOT use old 25% rate for Categoria B', () => {
      // This is the critical check for OE2026 compliance
      const rateB = getTaxaRetencao('B');

      expect(rateB).toBe(0.23);
      expect(rateB).not.toBe(0.25);
    });

    it('should distinguish between rental types for Categoria F', () => {
      const habitacional = getTaxaRetencao('F', 'habitacional');
      const comercial = getTaxaRetencao('F', 'nao_habitacional');

      expect(habitacional).toBe(0.25);
      expect(comercial).toBe(0.28);
      expect(habitacional).not.toBe(comercial);
    });

    it('should have correct total social security rate', () => {
      const total = TAXAS_SEGURANCA_SOCIAL.LUCRATIVOS.TOTAL;
      const calculated =
        TAXAS_SEGURANCA_SOCIAL.LUCRATIVOS.ENTIDADE +
        TAXAS_SEGURANCA_SOCIAL.LUCRATIVOS.TRABALHADOR;

      expect(total).toBeCloseTo(calculated, 4);
      expect(total).toBe(0.3475);
    });
  });
});
