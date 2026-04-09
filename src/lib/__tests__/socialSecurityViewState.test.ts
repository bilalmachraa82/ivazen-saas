import { describe, expect, it } from 'vitest';

import {
  getVisibleSSRevenueCategories,
  shouldShowSSDeadlineAlert,
} from '@/lib/socialSecurityViewState';

describe('socialSecurityViewState', () => {
  it('keeps the detected category visible even when the monthly total is still zero', () => {
    const categories = getVisibleSSRevenueCategories(
      {
        '2026-01': {},
        '2026-02': {},
        '2026-03': {},
      },
      'prestacao_servicos',
    );

    expect(categories.map((category) => category.value)).toContain('prestacao_servicos');
  });

  it('shows the deadline alert only when the quarter is not locked as submitted', () => {
    expect(
      shouldShowSSDeadlineAlert({
        isDeadlineMonth: true,
        isSubmittedQuarterLocked: false,
      }),
    ).toBe(true);

    expect(
      shouldShowSSDeadlineAlert({
        isDeadlineMonth: true,
        isSubmittedQuarterLocked: true,
      }),
    ).toBe(false);
  });
});
