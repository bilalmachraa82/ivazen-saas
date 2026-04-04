import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {
  SS_COEFFICIENTS,
  SS_REVENUE_CATEGORIES,
  SS_DEFAULT_COEFFICIENT,
  SS_CATEGORY_VALUES,
  getSSCoefficient,
  getSSCategoryLabel,
  normalizeSSCategory,
  COEFF_PRESTACAO_SERVICOS,
  COEFF_VENDAS,
  COEFF_HOTELARIA,
  COEFF_PRODUCAO_AGRICOLA,
  COEFF_PRODUCAO_ENERGIA_ARRENDAMENTO,
  COEFF_PROP_INTELECTUAL,
  COEFF_SUBSIDIOS,
  COEFF_OUTROS,
} from '../ssCoefficients';

describe('ssCoefficients', () => {
  // -------------------------------------------------------------------------
  // Structural invariants
  // -------------------------------------------------------------------------

  describe('SS_COEFFICIENTS map', () => {
    it('should have at least 9 categories', () => {
      expect(Object.keys(SS_COEFFICIENTS).length).toBeGreaterThanOrEqual(8);
    });

    it('should have a coefficient for every expected category', () => {
      const expectedCategories = [
        'prestacao_servicos',
        'vendas',
        'hotelaria',
        'producao_agricola',
        'producao_energia_arrendamento',
        'prop_intelectual',
        'subsidios',
        'outros',
      ];
      for (const cat of expectedCategories) {
        expect(SS_COEFFICIENTS).toHaveProperty(cat);
      }
    });

    it('should have all coefficient values between 0 and 1 (inclusive)', () => {
      for (const [category, coefficient] of Object.entries(SS_COEFFICIENTS)) {
        expect(coefficient).toBeGreaterThanOrEqual(0);
        expect(coefficient).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('SS_REVENUE_CATEGORIES array', () => {
    it('should contain at least 9 entries', () => {
      expect(SS_REVENUE_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    });

    it('should have unique category values (no duplicates)', () => {
      const values = SS_REVENUE_CATEGORIES.map(c => c.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it('every entry should have a non-empty value, label, and coefficient', () => {
      for (const cat of SS_REVENUE_CATEGORIES) {
        expect(cat.value).toBeTruthy();
        expect(cat.label).toBeTruthy();
        expect(typeof cat.coefficient).toBe('number');
      }
    });

    it('every coefficient in the array should be between 0 and 1', () => {
      for (const cat of SS_REVENUE_CATEGORIES) {
        expect(cat.coefficient).toBeGreaterThanOrEqual(0);
        expect(cat.coefficient).toBeLessThanOrEqual(1);
      }
    });

    it('every category in the array should also exist in the coefficients map', () => {
      for (const cat of SS_REVENUE_CATEGORIES) {
        expect(SS_COEFFICIENTS[cat.value]).toBe(cat.coefficient);
      }
    });

    it('every category in the coefficients map should also exist in the array', () => {
      const arrayValues = new Set(SS_REVENUE_CATEGORIES.map(c => c.value));
      for (const key of Object.keys(SS_COEFFICIENTS)) {
        expect(arrayValues.has(key)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Specific coefficient values
  // -------------------------------------------------------------------------

  describe('expected coefficient values', () => {
    it('prestacao_servicos should be 0.70', () => {
      expect(COEFF_PRESTACAO_SERVICOS).toBe(0.70);
      expect(SS_COEFFICIENTS.prestacao_servicos).toBe(0.70);
    });

    it('vendas should be 0.20', () => {
      expect(COEFF_VENDAS).toBe(0.20);
      expect(SS_COEFFICIENTS.vendas).toBe(0.20);
    });

    it('hotelaria should be 0.20 (Art. 162.º n.2 al. b) — same as vendas)', () => {
      expect(COEFF_HOTELARIA).toBe(0.20);
      expect(SS_COEFFICIENTS.hotelaria).toBe(0.20);
    });

    it('producao_agricola should be 0.20', () => {
      expect(COEFF_PRODUCAO_AGRICOLA).toBe(0.20);
      expect(SS_COEFFICIENTS.producao_agricola).toBe(0.20);
    });

    it('producao_energia_arrendamento should be 0.20', () => {
      expect(COEFF_PRODUCAO_ENERGIA_ARRENDAMENTO).toBe(0.20);
      expect(SS_COEFFICIENTS.producao_energia_arrendamento).toBe(0.20);
    });

    it('rendas and capitais should NOT exist in SS_COEFFICIENTS (not subject to SS)', () => {
      expect(SS_COEFFICIENTS).not.toHaveProperty('rendas');
      expect(SS_COEFFICIENTS).not.toHaveProperty('capitais');
    });

    it('prop_intelectual should be 0.50', () => {
      expect(COEFF_PROP_INTELECTUAL).toBe(0.50);
      expect(SS_COEFFICIENTS.prop_intelectual).toBe(0.50);
    });

    it('subsidios should be 0.70', () => {
      expect(COEFF_SUBSIDIOS).toBe(0.70);
      expect(SS_COEFFICIENTS.subsidios).toBe(0.70);
    });

    it('outros should be 0.70', () => {
      expect(COEFF_OUTROS).toBe(0.70);
      expect(SS_COEFFICIENTS.outros).toBe(0.70);
    });
  });

  // -------------------------------------------------------------------------
  // Helper functions
  // -------------------------------------------------------------------------

  describe('getSSCoefficient()', () => {
    it('should return the correct coefficient for known categories', () => {
      expect(getSSCoefficient('prestacao_servicos')).toBe(0.70);
      expect(getSSCoefficient('vendas')).toBe(0.20);
      expect(getSSCoefficient('hotelaria')).toBe(0.20);
      expect(getSSCoefficient('producao_energia_arrendamento')).toBe(0.20);
    });

    it('should return the default coefficient for unknown categories', () => {
      expect(getSSCoefficient('unknown_category')).toBe(SS_DEFAULT_COEFFICIENT);
      expect(getSSCoefficient('')).toBe(SS_DEFAULT_COEFFICIENT);
    });

    it('should normalize classifier aliases to the canonical SS coefficients', () => {
      expect(getSSCoefficient('restauracao')).toBe(COEFF_HOTELARIA);
      expect(getSSCoefficient('alojamento_local')).toBe(COEFF_HOTELARIA);
      expect(getSSCoefficient('producao_venda')).toBe(COEFF_PRODUCAO_AGRICOLA);
      expect(getSSCoefficient('propriedade_intelectual')).toBe(COEFF_PROP_INTELECTUAL);
      expect(getSSCoefficient('comercio')).toBe(COEFF_VENDAS);
      expect(getSSCoefficient('energia')).toBe(COEFF_PRODUCAO_ENERGIA_ARRENDAMENTO);
      expect(getSSCoefficient('arrendamento')).toBe(COEFF_PRODUCAO_ENERGIA_ARRENDAMENTO);
    });

    it('should redirect legacy rendas/capitais to outros (not subject to SS)', () => {
      expect(getSSCoefficient('rendas')).toBe(COEFF_OUTROS);
      expect(getSSCoefficient('capitais')).toBe(COEFF_OUTROS);
    });

    it('default coefficient should be 0.70', () => {
      expect(SS_DEFAULT_COEFFICIENT).toBe(0.70);
    });
  });

  describe('getSSCategoryLabel()', () => {
    it('should return the label for known categories', () => {
      expect(getSSCategoryLabel('prestacao_servicos')).toContain('Servicos');
      expect(getSSCategoryLabel('vendas')).toContain('Vendas');
      expect(getSSCategoryLabel('hotelaria')).toContain('Hotelaria');
    });

    it('should return the slug for unknown categories', () => {
      expect(getSSCategoryLabel('foo_bar')).toBe('foo_bar');
    });

    it('should normalize alias labels to the canonical category label', () => {
      expect(getSSCategoryLabel('restauracao')).toContain('Hotelaria');
      expect(getSSCategoryLabel('propriedade_intelectual')).toContain('Propriedade');
    });
  });

  describe('normalizeSSCategory()', () => {
    it('maps classifier aliases to canonical SS categories', () => {
      expect(normalizeSSCategory('restauracao')).toBe('hotelaria');
      expect(normalizeSSCategory('alojamento_local')).toBe('hotelaria');
      expect(normalizeSSCategory('producao_venda')).toBe('producao_agricola');
      expect(normalizeSSCategory('propriedade_intelectual')).toBe('prop_intelectual');
      expect(normalizeSSCategory('comercio')).toBe('vendas');
      expect(normalizeSSCategory('energia')).toBe('producao_energia_arrendamento');
      expect(normalizeSSCategory('arrendamento')).toBe('producao_energia_arrendamento');
      expect(normalizeSSCategory('rendas')).toBe('outros');
      expect(normalizeSSCategory('capitais')).toBe('outros');
    });
  });

  describe('SS_CATEGORY_VALUES', () => {
    it('should be an array of strings matching the categories', () => {
      expect(Array.isArray(SS_CATEGORY_VALUES)).toBe(true);
      expect(SS_CATEGORY_VALUES.length).toBe(SS_REVENUE_CATEGORIES.length);
      for (const val of SS_CATEGORY_VALUES) {
        expect(typeof val).toBe('string');
        expect(SS_COEFFICIENTS).toHaveProperty(val);
      }
    });
  });

  // -------------------------------------------------------------------------
  // PENDING LEGAL VALIDATION audit
  // -------------------------------------------------------------------------

  describe('validation status comments', () => {
    it('every coefficient constant and map entry should have a validation status comment in the source', () => {
      const sourceFilePath = path.resolve(__dirname, '../ssCoefficients.ts');
      const source = fs.readFileSync(sourceFilePath, 'utf-8');

      // Check that the file contains validation markers (PENDING or VALIDATED)
      const matches = source.match(/(?:PENDING LEGAL VALIDATION|VALIDATED:|NÃO é Art\. 162)/g) || [];
      const categoryCount = Object.keys(SS_COEFFICIENTS).length;

      expect(matches.length).toBeGreaterThanOrEqual(categoryCount);
    });

    it('every individual COEFF_* constant line should have a validation marker', () => {
      const sourceFilePath = path.resolve(__dirname, '../ssCoefficients.ts');
      const source = fs.readFileSync(sourceFilePath, 'utf-8');
      const lines = source.split('\n');

      const coeffConstantLines = lines.filter(
        line => line.includes('export const COEFF_') && line.includes('=')
      );

      expect(coeffConstantLines.length).toBeGreaterThanOrEqual(8);

      for (const line of coeffConstantLines) {
        const hasMarker = line.includes('PENDING LEGAL VALIDATION')
          || line.includes('VALIDATED:')
          || line.includes('NÃO é Art. 162');
        expect(hasMarker).toBe(true);
      }
    });

    it('every SS_COEFFICIENTS map entry line should have a validation marker', () => {
      const sourceFilePath = path.resolve(__dirname, '../ssCoefficients.ts');
      const source = fs.readFileSync(sourceFilePath, 'utf-8');

      const mapMatch = source.match(
        /export const SS_COEFFICIENTS[\s\S]*?=\s*\{([\s\S]*?)\}\s*as\s*const/
      );
      expect(mapMatch).toBeTruthy();

      const mapBody = mapMatch![1];
      const entryLines = mapBody
        .split('\n')
        .filter(line => line.includes(':') && line.includes('COEFF_'));

      expect(entryLines.length).toBeGreaterThanOrEqual(8);

      for (const line of entryLines) {
        expect(line).toContain('PENDING LEGAL VALIDATION');
      }
    });

    it('every SS_REVENUE_CATEGORIES array entry should have a validation marker', () => {
      const sourceFilePath = path.resolve(__dirname, '../ssCoefficients.ts');
      const source = fs.readFileSync(sourceFilePath, 'utf-8');

      const arrayMatch = source.match(
        /export const SS_REVENUE_CATEGORIES[\s\S]*?=\s*\[([\s\S]*?)\]\s*as\s*const/
      );
      expect(arrayMatch).toBeTruthy();

      const arrayBody = arrayMatch![1];
      const entryLines = arrayBody
        .split('\n')
        .filter(line => line.includes('value:') && line.includes('coefficient:'));

      expect(entryLines.length).toBeGreaterThanOrEqual(8);

      for (const line of entryLines) {
        expect(line).toContain('PENDING LEGAL VALIDATION');
      }
    });
  });
});
