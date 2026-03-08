import { describe, it, expect } from 'vitest';
import {
  resolveTaxpayerKind,
  taxpayerKindLabel,
  taxpayerKindBadge,
  isObligationPrimary,
} from '../taxpayerKind';

describe('resolveTaxpayerKind', () => {
  describe('explicit taxpayer_kind takes precedence', () => {
    it('returns eni when explicitly set', () => {
      expect(resolveTaxpayerKind({ taxpayer_kind: 'eni', worker_type: null })).toBe('eni');
    });

    it('returns company when explicitly set', () => {
      expect(resolveTaxpayerKind({ taxpayer_kind: 'company' })).toBe('company');
    });

    it('returns mixed when explicitly set', () => {
      expect(resolveTaxpayerKind({ taxpayer_kind: 'mixed' })).toBe('mixed');
    });

    it('explicit value overrides worker_type inference', () => {
      expect(resolveTaxpayerKind({
        taxpayer_kind: 'company',
        worker_type: 'independent',
      })).toBe('company');
    });

    it('ignores invalid explicit values', () => {
      expect(resolveTaxpayerKind({ taxpayer_kind: 'invalid' })).toBeNull();
    });
  });

  describe('inference from worker_type', () => {
    it('independent → eni', () => {
      expect(resolveTaxpayerKind({ worker_type: 'independent' })).toBe('eni');
    });

    it('eni → eni', () => {
      expect(resolveTaxpayerKind({ worker_type: 'eni' })).toBe('eni');
    });

    it('eirl → eni', () => {
      expect(resolveTaxpayerKind({ worker_type: 'eirl' })).toBe('eni');
    });

    it('agricultural → eni', () => {
      expect(resolveTaxpayerKind({ worker_type: 'agricultural' })).toBe('eni');
    });

    it('eni-type with withholdings → mixed', () => {
      expect(resolveTaxpayerKind({
        worker_type: 'independent',
        has_withholdings: true,
      })).toBe('mixed');
    });

    it('eni-type with SS activity but no withholdings → eni', () => {
      expect(resolveTaxpayerKind({
        worker_type: 'eni',
        has_ss_activity: true,
      })).toBe('eni');
    });
  });

  describe('inference from data signals', () => {
    it('withholdings only → company', () => {
      expect(resolveTaxpayerKind({ has_withholdings: true })).toBe('company');
    });

    it('SS activity only → eni', () => {
      expect(resolveTaxpayerKind({ has_ss_activity: true })).toBe('eni');
    });

    it('both signals → mixed', () => {
      expect(resolveTaxpayerKind({
        has_withholdings: true,
        has_ss_activity: true,
      })).toBe('mixed');
    });
  });

  describe('no data → null', () => {
    it('empty input → null', () => {
      expect(resolveTaxpayerKind({})).toBeNull();
    });

    it('null fields → null', () => {
      expect(resolveTaxpayerKind({
        taxpayer_kind: null,
        worker_type: null,
      })).toBeNull();
    });

    it('false signals → null', () => {
      expect(resolveTaxpayerKind({
        has_withholdings: false,
        has_ss_activity: false,
      })).toBeNull();
    });
  });
});

describe('taxpayerKindLabel', () => {
  it('returns Portuguese labels', () => {
    expect(taxpayerKindLabel('eni')).toBe('ENI / Independente');
    expect(taxpayerKindLabel('company')).toBe('Empresa');
    expect(taxpayerKindLabel('mixed')).toBe('Misto');
    expect(taxpayerKindLabel(null)).toBe('Não definido');
  });
});

describe('taxpayerKindBadge', () => {
  it('returns short badge text', () => {
    expect(taxpayerKindBadge('eni')).toBe('ENI');
    expect(taxpayerKindBadge('company')).toBe('Empresa');
    expect(taxpayerKindBadge('mixed')).toBe('Misto');
    expect(taxpayerKindBadge(null)).toBe('');
  });
});

describe('isObligationPrimary', () => {
  it('IVA is always primary', () => {
    expect(isObligationPrimary('iva', 'eni')).toBe(true);
    expect(isObligationPrimary('iva', 'company')).toBe(true);
    expect(isObligationPrimary('iva', 'mixed')).toBe(true);
    expect(isObligationPrimary('iva', null)).toBe(true);
  });

  it('SS is primary for eni and mixed', () => {
    expect(isObligationPrimary('ss', 'eni')).toBe(true);
    expect(isObligationPrimary('ss', 'mixed')).toBe(true);
    expect(isObligationPrimary('ss', 'company')).toBe(false);
    expect(isObligationPrimary('ss', null)).toBe(true);
  });

  it('Modelo 10 is primary for company and mixed', () => {
    expect(isObligationPrimary('modelo10', 'company')).toBe(true);
    expect(isObligationPrimary('modelo10', 'mixed')).toBe(true);
    expect(isObligationPrimary('modelo10', 'eni')).toBe(false);
    expect(isObligationPrimary('modelo10', null)).toBe(true);
  });
});
