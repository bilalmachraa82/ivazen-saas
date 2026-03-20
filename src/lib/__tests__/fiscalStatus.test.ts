import { describe, expect, it } from 'vitest';

import {
  applyFiscallyEffectivePurchaseFilter,
  getFiscallyEffectivePurchaseFilter,
  isFiscallyEffectivePurchase,
  isPurchasePendingReview,
} from '../fiscalStatus';

describe('fiscalStatus', () => {
  describe('isFiscallyEffectivePurchase()', () => {
    it('accepts manually validated purchases', () => {
      expect(isFiscallyEffectivePurchase({ status: 'validated' })).toBe(true);
    });

    it('rejects purchases excluded from accounting even when validated', () => {
      expect(
        isFiscallyEffectivePurchase({
          status: 'validated',
          accounting_excluded: true,
        }),
      ).toBe(false);
    });

    it('accepts classified purchases that do not require accountant validation', () => {
      expect(
        isFiscallyEffectivePurchase({
          status: 'classified',
          requires_accountant_validation: false,
        }),
      ).toBe(true);
    });

    it('rejects classified purchases that still require accountant validation', () => {
      expect(
        isFiscallyEffectivePurchase({
          status: 'classified',
          requires_accountant_validation: true,
        }),
      ).toBe(false);
      expect(
        isFiscallyEffectivePurchase({
          status: 'classified',
          requires_accountant_validation: null,
        }),
      ).toBe(false);
    });

    it('rejects pending and rejected purchases', () => {
      expect(isFiscallyEffectivePurchase({ status: 'pending' })).toBe(false);
      expect(isFiscallyEffectivePurchase({ status: 'rejected' })).toBe(false);
    });
  });

  describe('isPurchasePendingReview()', () => {
    it('marks pending and manually reviewable classified purchases as pending', () => {
      expect(isPurchasePendingReview({ status: 'pending' })).toBe(true);
      expect(
        isPurchasePendingReview({
          status: 'classified',
          requires_accountant_validation: true,
        }),
      ).toBe(true);
      expect(
        isPurchasePendingReview({
          status: 'classified',
          requires_accountant_validation: null,
        }),
      ).toBe(true);
    });

    it('does not mark auto-approved or validated purchases as pending review', () => {
      expect(
        isPurchasePendingReview({
          status: 'classified',
          requires_accountant_validation: false,
        }),
      ).toBe(false);
      expect(isPurchasePendingReview({ status: 'validated' })).toBe(false);
      expect(
        isPurchasePendingReview({
          status: 'pending',
          accounting_excluded: true,
        }),
      ).toBe(false);
    });
  });

  describe('purchase filter helpers', () => {
    it('exports the expected PostgREST filter', () => {
      expect(getFiscallyEffectivePurchaseFilter()).toBe(
        'and(accounting_excluded.eq.false,or(status.eq.validated,and(status.eq.classified,requires_accountant_validation.eq.false)))',
      );
    });

    it('applies the centralized query filter via .eq() + .or()', () => {
      const calls: string[] = [];
      const query = {
        eq(column: string, value: unknown) {
          calls.push(`eq:${column}:${String(value)}`);
          return this;
        },
        or(filters: string) {
          calls.push(filters);
          return this;
        },
      };

      expect(applyFiscallyEffectivePurchaseFilter(query)).toBe(query);
      expect(calls).toEqual([
        'eq:accounting_excluded:false',
        'status.eq.validated,and(status.eq.classified,requires_accountant_validation.eq.false)',
      ]);
    });
  });
});
