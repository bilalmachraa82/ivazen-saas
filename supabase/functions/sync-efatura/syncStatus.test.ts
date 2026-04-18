import { describe, expect, it } from 'vitest';
import { decideSyncStatus } from './syncStatus';

describe('decideSyncStatus', () => {
  it('returns success when AT returned at least one invoice', () => {
    expect(decideSyncStatus({ atReturnedCount: 1, hasPriorData: false }))
      .toEqual({ status: 'success', reasonCode: null });
  });

  it('returns success when AT returned zero and client has no prior data (first-timer / genuinely empty)', () => {
    expect(decideSyncStatus({ atReturnedCount: 0, hasPriorData: false }))
      .toEqual({ status: 'success', reasonCode: null });
  });

  it('returns partial with AT_ZERO_RESULTS_SUSPICIOUS when AT returned zero but client has prior data', () => {
    expect(decideSyncStatus({ atReturnedCount: 0, hasPriorData: true }))
      .toEqual({ status: 'partial', reasonCode: 'AT_ZERO_RESULTS_SUSPICIOUS' });
  });

  it('returns success when AT returned many and client has prior data', () => {
    expect(decideSyncStatus({ atReturnedCount: 42, hasPriorData: true }))
      .toEqual({ status: 'success', reasonCode: null });
  });

  it('treats negative counts defensively as zero', () => {
    expect(decideSyncStatus({ atReturnedCount: -1, hasPriorData: true }))
      .toEqual({ status: 'partial', reasonCode: 'AT_ZERO_RESULTS_SUSPICIOUS' });
  });
});
