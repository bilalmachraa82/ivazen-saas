import { SS_REVENUE_CATEGORIES } from '@/lib/ssCoefficients';
import type { MonthlyBreakdown } from '@/lib/ssMonthlyBreakdown';

export function getVisibleSSRevenueCategories(
  monthlyBreakdown: MonthlyBreakdown,
  detectedCategory?: string | null,
) {
  const monthKeys = Object.keys(monthlyBreakdown).sort();

  return SS_REVENUE_CATEGORIES.filter((category) =>
    category.value === detectedCategory
      || monthKeys.some((monthKey) => (monthlyBreakdown[monthKey]?.[category.value] ?? 0) > 0),
  );
}

export function shouldShowSSDeadlineAlert({
  isDeadlineMonth,
  isSubmittedQuarterLocked,
}: {
  isDeadlineMonth: boolean;
  isSubmittedQuarterLocked: boolean;
}) {
  return isDeadlineMonth && !isSubmittedQuarterLocked;
}
