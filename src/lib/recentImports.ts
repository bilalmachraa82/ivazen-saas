export type RecentImportWindow = 'all' | '24h' | '7d';

const RECENT_IMPORT_WINDOW_MS: Record<Exclude<RecentImportWindow, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export function getRecentImportCutoff(
  window: RecentImportWindow,
  now = new Date(),
): string | null {
  if (window === 'all') return null;
  return new Date(now.getTime() - RECENT_IMPORT_WINDOW_MS[window]).toISOString();
}

export function matchesRecentImportWindow(
  createdAt: string | null | undefined,
  window: RecentImportWindow,
  now = new Date(),
): boolean {
  if (window === 'all') return true;
  if (!createdAt) return false;

  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;

  const cutoff = now.getTime() - RECENT_IMPORT_WINDOW_MS[window];
  return createdAtMs >= cutoff;
}
