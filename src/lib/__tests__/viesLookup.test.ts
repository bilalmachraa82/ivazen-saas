import { describe, expect, it } from 'vitest';
import { isBusinessNif, parseViesResponse } from '../viesHelpers';

describe('VIES helpers', () => {
  describe('isBusinessNif', () => {
    it('accepts company NIFs (5xx prefix)', () => {
      expect(isBusinessNif('509442013')).toBe(true);
    });
    it('accepts public entity NIFs (6xx prefix)', () => {
      expect(isBusinessNif('600000001')).toBe(true);
    });
    it('accepts foreign NIFs (7xx prefix)', () => {
      expect(isBusinessNif('700000001')).toBe(true);
    });
    it('rejects individual NIFs (1xx, 2xx, 3xx)', () => {
      expect(isBusinessNif('123456789')).toBe(false);
      expect(isBusinessNif('234567890')).toBe(false);
    });
    it('rejects final consumer NIF', () => {
      expect(isBusinessNif('999999990')).toBe(false);
    });
    it('rejects invalid format', () => {
      expect(isBusinessNif('12345')).toBe(false);
      expect(isBusinessNif('abcdefghi')).toBe(false);
      expect(isBusinessNif('')).toBe(false);
    });
  });

  describe('parseViesResponse', () => {
    it('parses a valid VIES response with name and city', () => {
      const result = parseViesResponse({
        isValid: true,
        name: 'NEXPERIENCE, UNIPESSOAL, LDA',
        address: 'RUA DE SANTA CATARINA N 1232\nPORTO, 4000-457 PORTO',
      });
      expect(result).toEqual({
        name: 'NEXPERIENCE, UNIPESSOAL, LDA',
        city: 'PORTO',
        valid: true,
      });
    });

    it('returns null for invalid NIF', () => {
      const result = parseViesResponse({ isValid: false, name: '---', address: '' });
      expect(result).toEqual({ name: null, city: null, valid: false });
    });

    it('returns null name when name is empty', () => {
      const result = parseViesResponse({ isValid: true, name: '', address: '' });
      expect(result).toEqual({ name: null, city: null, valid: false });
    });

    it('extracts city from Portuguese postal code format', () => {
      const result = parseViesResponse({
        isValid: true,
        name: 'TEST LDA',
        address: 'RUA X\n1000-001 LISBOA',
      });
      expect(result.city).toBe('LISBOA');
    });

    it('handles address with no postal code', () => {
      const result = parseViesResponse({
        isValid: true,
        name: 'TEST LDA',
        address: 'SOME ADDRESS WITHOUT POSTAL CODE',
      });
      expect(result.city).toBeNull();
    });

    it('handles empty address', () => {
      const result = parseViesResponse({
        isValid: true,
        name: 'TEST LDA',
        address: '',
      });
      expect(result).toEqual({ name: 'TEST LDA', city: null, valid: true });
    });
  });
});
