import type { RecentImportWindow } from '@/lib/recentImports';

export interface SalesValidationSearchFilters {
  status: string;
  recentWindow: RecentImportWindow;
}

export function parseSalesValidationSearchParams(
  searchParams: URLSearchParams,
): SalesValidationSearchFilters {
  const recent = searchParams.get('recent');

  return {
    status: searchParams.get('status') || 'all',
    recentWindow: recent === '24h' || recent === '7d' ? recent : 'all',
  };
}

export function buildSalesValidationSearchParams({
  status,
  recentWindow,
}: SalesValidationSearchFilters): URLSearchParams {
  const nextParams = new URLSearchParams();

  if (status !== 'all') {
    nextParams.set('status', status);
  }

  if (recentWindow !== 'all') {
    nextParams.set('recent', recentWindow);
  }

  return nextParams;
}
