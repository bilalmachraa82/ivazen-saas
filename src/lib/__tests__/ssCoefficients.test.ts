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
  COEFF_PRESTACAO_SERVICOS,
  COEFF_VENDAS,
  COEFF_HOTELARIA,
  COEFF_PRODUCAO_AGRICOLA,
  COEFF_RENDAS,
  COEFF_CAPITAIS,
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
      expect(Object.keys(SS_COEFFICIENTS).length).toBeGreaterThanOrEqual(9);
    });

    it('should have a coefficient for every expected category', () => {
      const expectedCategories = [
        'prestacao_servicos',
        'vendas',
        'hotelaria',
        'producao_agricola',
        'rendas',
        'capitais',
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
      expect(SS_REVENUE_CATEGORIES.length).toBeGreaterThanOrEqual(9);
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

    it('hotelaria should be 0.15 (conservative)', () => {
      expect(COEFF_HOTELARIA).toBe(0.15);
      expect(SS_COEFFICIENTS.hotelaria).toBe(0.15);
    });

    it('producao_agricola should be 0.20', () => {
      expect(COEFF_PRODUCAO_AGRICOLA).toBe(0.20);
      expect(SS_COEFFICIENTS.producao_agricola).toBe(0.20);
    });

    it('rendas should be 0.95', () => {
      expect(COEFF_RENDAS).toBe(0.95);
      expect(SS_COEFFICIENTS.rendas).toBe(0.95);
    });

    it('capitais should be 0.95', () => {
      expect(COEFF_CAPITAIS).toBe(0.95);
      expect(SS_COEFFICIENTS.capitais).toBe(0.95);
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
      expect(getSSCoefficient('hotelaria')).toBe(0.15);
      expect(getSSCoefficient('rendas')).toBe(0.95);
    });

    it('should return the default coefficient for unknown categories', () => {
      expect(getSSCoefficient('unknown_category')).toBe(SS_DEFAULT_COEFFICIENT);
      expect(getSSCoefficient('')).toBe(SS_DEFAULT_COEFFICIENT);
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

  describe('PENDING LEGAL VALIDATION comments', () => {
    it('every coefficient constant and map entry should have a PENDING LEGAL VALIDATION comment in the source', () => {
      // Read the source file and check that the comment appears for each entry
      const sourceFilePath = path.resolve(__dirname, '../ssCoefficients.ts');
      const source = fs.readFileSync(sourceFilePath, 'utf-8');

      // Check that the file contains at least as many PENDING LEGAL VALIDATION
      // markers as there are categories
      const matches = source.match(/PENDING LEGAL VALIDATION/g) || [];
      const categoryCount = Object.keys(SS_COEFFICIENTS).length;

      // We expect at least: 9 individual constants + 9 map entries + 9 array entries + 1 default = 28
      // But at minimum, each category should have at least 1 marker per definition site
      expect(matches.length).toBeGreaterThanOrEqual(categoryCount);
    });

    it('every individual COEFF_* constant line should have the PENDING marker', () => {
      const sourceFilePath = path.resolve(__dirname, '../ssCoefficients.ts');
      const source = fs.readFileSync(sourceFilePath, 'utf-8');
      const lines = source.split('\n');

      const coeffConstantLines = lines.filter(
        line => line.includes('export const COEFF_') && line.includes('=')
      );

      expect(coeffConstantLines.length).toBeGreaterThanOrEqual(9);

      for (const line of coeffConstantLines) {
        expect(line).toContain('PENDING LEGAL VALIDATION');
      }
    });

    it('every SS_COEFFICIENTS map entry line should have the PENDING marker', () => {
      const sourceFilePath = path.resolve(__dirname, '../ssCoefficients.ts');
      const source = fs.readFileSync(sourceFilePath, 'utf-8');

      // Extract the block between "SS_COEFFICIENTS" and the closing "} as const;"
      const mapMatch = source.match(
        /export const SS_COEFFICIENTS[\s\S]*?=\s*\{([\s\S]*?)\}\s*as\s*const/
      );
      expect(mapMatch).toBeTruthy();

      const mapBody = mapMatch![1];
      const entryLines = mapBody
        .split('\n')
        .filter(line => line.includes(':') && line.includes('COEFF_'));

      expect(entryLines.length).toBeGreaterThanOrEqual(9);

      for (const line of entryLines) {
        expect(line).toContain('PENDING LEGAL VALIDATION');
      }
    });

    it('every SS_REVENUE_CATEGORIES array entry should have the PENDING marker', () => {
      const sourceFilePath = path.resolve(__dirname, '../ssCoefficients.ts');
      const source = fs.readFileSync(sourceFilePath, 'utf-8');

      // Extract the array body
      const arrayMatch = source.match(
        /export const SS_REVENUE_CATEGORIES[\s\S]*?=\s*\[([\s\S]*?)\]\s*as\s*const/
      );
      expect(arrayMatch).toBeTruthy();

      const arrayBody = arrayMatch![1];
      const entryLines = arrayBody
        .split('\n')
        .filter(line => line.includes('value:') && line.includes('coefficient:'));

      expect(entryLines.length).toBeGreaterThanOrEqual(9);

      for (const line of entryLines) {
        expect(line).toContain('PENDING LEGAL VALIDATION');
      }
    });
  });
});
