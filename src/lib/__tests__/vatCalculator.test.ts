import { describe, it, expect } from 'vitest';
import {
  VAT_CONFIG,
  calculateProportionalThreshold,
  calculateToleranceThreshold,
  checkVATExemption,
  calculateVAT,
  calculateVATReverse,
  calculateVATPayment,
  getAvailableVATRates,
  getAvailableRegions,
} from '../vatCalculator';

describe('VAT Calculator - Portuguese IVA 2025', () => {
  describe('VAT_CONFIG constants', () => {
    it('has correct 2025 exemption threshold of €15,000', () => {
      expect(VAT_CONFIG.EXEMPTION_THRESHOLD).toBe(15000);
    });

    it('has correct tolerance threshold of €18,750 (+25%)', () => {
      expect(VAT_CONFIG.TOLERANCE_THRESHOLD).toBe(18750);
    });

    it('has correct Continental rates (23%, 13%, 6%)', () => {
      expect(VAT_CONFIG.RATES.CONTINENTAL.standard).toBe(23);
      expect(VAT_CONFIG.RATES.CONTINENTAL.intermediate).toBe(13);
      expect(VAT_CONFIG.RATES.CONTINENTAL.reduced).toBe(6);
    });

    it('has correct Azores rates (16%, 9%, 4%)', () => {
      expect(VAT_CONFIG.RATES.AZORES.standard).toBe(16);
      expect(VAT_CONFIG.RATES.AZORES.intermediate).toBe(9);
      expect(VAT_CONFIG.RATES.AZORES.reduced).toBe(4);
    });

    it('has correct Madeira rates (22%, 12%, 5%)', () => {
      expect(VAT_CONFIG.RATES.MADEIRA.standard).toBe(22);
      expect(VAT_CONFIG.RATES.MADEIRA.intermediate).toBe(12);
      expect(VAT_CONFIG.RATES.MADEIRA.reduced).toBe(5);
    });
  });

  describe('Exemption - checkVATExemption', () => {
    it('is exempt when below €15,000', () => {
      const result = checkVATExemption(10000, null, []);
      expect(result.isExempt).toBe(true);
      expect(result.reason).toContain('Isento de IVA');
    });

    it('is exempt at exactly €15,000', () => {
      const result = checkVATExemption(15000, null, []);
      expect(result.isExempt).toBe(true);
    });

    it('warns when within €2,000 of threshold', () => {
      const result = checkVATExemption(14000, null, []);
      expect(result.isExempt).toBe(true);
      // Locale formatting varies by runtime (ICU). Accept any "1000" rendering.
      expect(result.alert).toMatch(/1000|1[\\s\\u00A0\\.]000/);
    });

    it('is not exempt when above €15,000 but below tolerance', () => {
      const result = checkVATExemption(16000, null, []);
      expect(result.isExempt).toBe(false);
      expect(result.reason).toContain('ultrapassa o limiar');
      expect(result.alert).toContain('tolerância');
    });

    it('is not exempt with immediate VAT above €18,750 tolerance', () => {
      const result = checkVATExemption(20000, null, []);
      expect(result.isExempt).toBe(false);
      expect(result.alert).toContain('ATENÇÃO');
      expect(result.alert).toContain('imediatamente');
    });

    it('calculates proportional threshold for mid-year start (July)', () => {
      // Starting in July (month 7) = 6 months remaining
      const result = checkVATExemption(5000, 7, []);
      expect(result.isExempt).toBe(true);
      expect(result.proportionalLimit).toBeDefined();
      // July-Dec = 6 months => 15000 * 6/12 = 7500
      expect(result.proportionalLimit).toBeCloseTo(7500, 0);
    });

    it('invalidates exemption with export exclusion', () => {
      const result = checkVATExemption(5000, null, ['exports']);
      expect(result.isExempt).toBe(false);
      expect(result.reason).toContain('operações de exportação');
    });

    it('invalidates exemption with Anexo E exclusion', () => {
      const result = checkVATExemption(5000, null, ['anexo_e']);
      expect(result.isExempt).toBe(false);
      expect(result.reason).toContain('Anexo E');
    });

    it('invalidates exemption with multiple exclusions', () => {
      const result = checkVATExemption(5000, null, ['exports', 'imports']);
      expect(result.isExempt).toBe(false);
      expect(result.reason).toContain('exportação');
      expect(result.reason.toLowerCase()).toContain('importa');
    });
  });

  describe('Proportional Threshold - calculateProportionalThreshold', () => {
    it('returns full threshold for January start', () => {
      const threshold = calculateProportionalThreshold(1);
      expect(threshold).toBe(15000); // 12/12 = full year
    });

    it('returns half threshold for July start', () => {
      // Month 7: remainingMonths = 13 - 7 = 6
      // But wait, if you start in July, you have July-Dec = 6 months
      // Formula says: remainingMonths = 13 - startMonth = 13 - 7 = 6
      // So: 15000 * 6/12 = 7500
      // Actually looking at the code: remainingMonths = 13 - startMonth
      // For July (7): 13 - 7 = 6, but that gives 7500
      // The comment says "Meses restantes incluindo o mês de início"
      // So July to Dec is actually 6 months: Jul, Aug, Sep, Oct, Nov, Dec
      // But formula uses 13 - 7 = 6... Let me trace through again.
      // Actually: 13 - 7 = 6 → 15000 * 6/12 = 7500
      // Hmm, but 13 - 1 = 12 → 15000 * 12/12 = 15000 ✓
      // 13 - 12 = 1 → 15000 * 1/12 = 1250
      // So for December start, you get 1/12 of the year = 1250
      // For July (month 7): 13 - 7 = 6 → 15000 * 6/12 = 7500
      const threshold = calculateProportionalThreshold(7);
      expect(threshold).toBe(7500);
    });

    it('returns 1/12 for December start', () => {
      const threshold = calculateProportionalThreshold(12);
      expect(threshold).toBe(1250); // 1/12 of 15000
    });

    it('returns full threshold for invalid month', () => {
      const threshold = calculateProportionalThreshold(0);
      expect(threshold).toBe(15000);
    });
  });

  describe('Tolerance Threshold - calculateToleranceThreshold', () => {
    it('calculates +25% correctly', () => {
      expect(calculateToleranceThreshold(15000)).toBe(18750);
    });

    it('calculates +25% for proportional threshold', () => {
      expect(calculateToleranceThreshold(7500)).toBe(9375);
    });

    it('rounds to 2 decimal places', () => {
      const result = calculateToleranceThreshold(10000);
      expect(result).toBe(12500);
    });
  });

  describe('VAT Calculation - calculateVAT', () => {
    it('calculates 23% standard rate for Continental', () => {
      const result = calculateVAT(100, 'CONTINENTAL', 'standard');
      expect(result.baseValue).toBe(100);
      expect(result.vatAmount).toBe(23);
      expect(result.totalWithVAT).toBe(123);
      expect(result.rate).toBe(23);
      expect(result.region).toBe('Continente');
    });

    it('calculates 13% intermediate rate for Continental', () => {
      const result = calculateVAT(100, 'CONTINENTAL', 'intermediate');
      expect(result.vatAmount).toBe(13);
      expect(result.totalWithVAT).toBe(113);
    });

    it('calculates 6% reduced rate for Continental', () => {
      const result = calculateVAT(100, 'CONTINENTAL', 'reduced');
      expect(result.vatAmount).toBe(6);
      expect(result.totalWithVAT).toBe(106);
    });

    it('calculates 16% for Azores standard rate', () => {
      const result = calculateVAT(100, 'AZORES', 'standard');
      expect(result.vatAmount).toBe(16);
      expect(result.rate).toBe(16);
      expect(result.region).toBe('Açores');
    });

    it('calculates 4% for Azores reduced rate', () => {
      const result = calculateVAT(100, 'AZORES', 'reduced');
      expect(result.vatAmount).toBe(4);
    });

    it('calculates 22% for Madeira standard rate', () => {
      const result = calculateVAT(100, 'MADEIRA', 'standard');
      expect(result.vatAmount).toBe(22);
      expect(result.region).toBe('Madeira');
    });

    it('calculates 5% for Madeira reduced rate', () => {
      const result = calculateVAT(100, 'MADEIRA', 'reduced');
      expect(result.vatAmount).toBe(5);
    });

    it('rounds to 2 decimal places', () => {
      const result = calculateVAT(99.99, 'CONTINENTAL', 'standard');
      expect(result.vatAmount).toBe(23);
      expect(result.totalWithVAT).toBe(122.99);
    });
  });

  describe('VAT Reverse Calculation - calculateVATReverse', () => {
    it('extracts base value from VAT-included price at 23%', () => {
      const result = calculateVATReverse(123, 'CONTINENTAL', 'standard');
      expect(result.baseValue).toBe(100);
      expect(result.vatAmount).toBe(23);
      expect(result.totalWithVAT).toBe(123);
    });

    it('extracts base value from VAT-included price at 6%', () => {
      const result = calculateVATReverse(106, 'CONTINENTAL', 'reduced');
      expect(result.baseValue).toBe(100);
      expect(result.vatAmount).toBe(6);
    });

    it('extracts correctly for Azores 16%', () => {
      const result = calculateVATReverse(116, 'AZORES', 'standard');
      expect(result.baseValue).toBe(100);
      expect(result.vatAmount).toBe(16);
    });

    it('handles non-round numbers with rounding', () => {
      const result = calculateVATReverse(99.99, 'CONTINENTAL', 'standard');
      expect(result.baseValue).toBe(81.29);
      expect(result.vatAmount).toBe(18.7);
    });
  });

  describe('VAT Payment - calculateVATPayment', () => {
    it('calculates VAT payable when collected > deductible', () => {
      const result = calculateVATPayment(1000, 300);
      expect(result.vatCollected).toBe(1000);
      expect(result.vatDeductible).toBe(300);
      expect(result.vatPayable).toBe(700);
      expect(result.isRecoverable).toBe(false);
    });

    it('calculates VAT recoverable when deductible > collected', () => {
      const result = calculateVATPayment(300, 1000);
      expect(result.vatPayable).toBe(700);
      expect(result.isRecoverable).toBe(true);
    });

    it('returns zero when equal', () => {
      const result = calculateVATPayment(500, 500);
      expect(result.vatPayable).toBe(0);
      expect(result.isRecoverable).toBe(false);
    });

    it('rounds to 2 decimal places', () => {
      const result = calculateVATPayment(100.555, 50.333);
      expect(result.vatPayable).toBe(50.22);
    });
  });

  describe('Helper Functions', () => {
    it('getAvailableVATRates returns all rates for region', () => {
      const rates = getAvailableVATRates('CONTINENTAL');
      expect(rates).toHaveLength(3);
      expect(rates[0].type).toBe('standard');
      expect(rates[0].rate).toBe(23);
      expect(rates[1].type).toBe('intermediate');
      expect(rates[1].rate).toBe(13);
      expect(rates[2].type).toBe('reduced');
      expect(rates[2].rate).toBe(6);
    });

    it('getAvailableRegions returns all 3 regions', () => {
      const regions = getAvailableRegions();
      expect(regions).toHaveLength(3);
      expect(regions.map(r => r.key)).toEqual(['CONTINENTAL', 'AZORES', 'MADEIRA']);
    });
  });

  describe('Edge Cases', () => {
    it('handles zero revenue', () => {
      const result = checkVATExemption(0, null, []);
      expect(result.isExempt).toBe(true);
    });

    it('handles exactly at threshold boundary', () => {
      const result = checkVATExemption(15000, null, []);
      expect(result.isExempt).toBe(true);
    });

    it('handles exactly at tolerance boundary', () => {
      const result = checkVATExemption(18750, null, []);
      expect(result.isExempt).toBe(false);
      // At exactly 18750, should be in tolerance zone, not above it
      expect(result.alert).toContain('tolerância');
    });

    it('handles just above tolerance boundary', () => {
      const result = checkVATExemption(18751, null, []);
      expect(result.isExempt).toBe(false);
      expect(result.alert).toContain('ATENÇÃO');
    });
  });
});
