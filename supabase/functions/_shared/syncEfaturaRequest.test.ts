import { describe, expect, it } from 'vitest';
import { validateSyncEfaturaRequest } from './syncEfaturaRequest';

describe('validateSyncEfaturaRequest', () => {
  it('returns 400 for missing clientId before checking the AT time window', () => {
    const result = validateSyncEfaturaRequest({
      clientId: '',
      environment: undefined,
      source: 'manual',
      forceSync: false,
      isServiceRole: false,
      windowCheck: {
        isWithin: false,
        message: 'fora da janela',
        nextWindowStart: '19:00',
        nextWindowEnd: '06:00',
      },
    });

    expect(result).toEqual({
      status: 400,
      body: { error: 'clientId is required' },
    });
  });

  it('returns the AT time-window payload only after required params are present', () => {
    const result = validateSyncEfaturaRequest({
      clientId: 'client-1',
      environment: 'production',
      source: 'manual',
      forceSync: false,
      isServiceRole: false,
      windowCheck: {
        isWithin: false,
        message: 'fora da janela',
        nextWindowStart: '19:00',
        nextWindowEnd: '06:00',
      },
    });

    expect(result).toEqual({
      status: 200,
      body: {
        success: false,
        reasonCode: 'AT_TIME_WINDOW',
        error: 'fora da janela',
        nextWindowStart: '19:00',
        nextWindowEnd: '06:00',
      },
    });
  });

  it('allows force+service-role to bypass the AT time window', () => {
    const result = validateSyncEfaturaRequest({
      clientId: 'client-1',
      environment: 'production',
      source: 'manual',
      forceSync: true,
      isServiceRole: true,
      windowCheck: {
        isWithin: false,
        message: 'fora da janela',
        nextWindowStart: '19:00',
        nextWindowEnd: '06:00',
      },
    });

    expect(result).toBeNull();
  });

  it('blocks force without service-role outside the window', () => {
    const result = validateSyncEfaturaRequest({
      clientId: 'client-1',
      environment: 'production',
      source: 'manual',
      forceSync: true,
      isServiceRole: false,
      windowCheck: {
        isWithin: false,
        message: 'fora da janela',
      },
    });

    expect(result?.body.reasonCode).toBe('AT_TIME_WINDOW');
  });

  it('allows queue source to bypass the time window', () => {
    const result = validateSyncEfaturaRequest({
      clientId: 'client-1',
      environment: 'production',
      source: 'queue',
      forceSync: false,
      isServiceRole: false,
      windowCheck: {
        isWithin: false,
        message: 'fora da janela',
      },
    });

    expect(result).toBeNull();
  });

  it('returns null when inside the AT time window', () => {
    const result = validateSyncEfaturaRequest({
      clientId: 'client-1',
      environment: 'production',
      source: 'manual',
      forceSync: false,
      isServiceRole: false,
      windowCheck: {
        isWithin: true,
        message: 'dentro da janela',
      },
    });

    expect(result).toBeNull();
  });
});
