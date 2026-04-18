export interface DecideSyncStatusInput {
  atReturnedCount: number;
  hasPriorData: boolean;
}

export interface SyncStatusDecision {
  status: 'success' | 'partial' | 'error';
  reasonCode: string | null;
}

/**
 * Decide the status of an AT sync run from the raw SOAP result count
 * and whether the client has prior activity for this direction. A zero
 * count from AT is suspicious only when the client is known to have
 * historically issued invoices in this direction — otherwise it just
 * means "nothing to sync".
 */
export function decideSyncStatus({
  atReturnedCount,
  hasPriorData,
}: DecideSyncStatusInput): SyncStatusDecision {
  const safeCount = Math.max(0, Math.floor(atReturnedCount));
  if (safeCount === 0 && hasPriorData) {
    return { status: 'partial', reasonCode: 'AT_ZERO_RESULTS_SUSPICIOUS' };
  }
  return { status: 'success', reasonCode: null };
}
