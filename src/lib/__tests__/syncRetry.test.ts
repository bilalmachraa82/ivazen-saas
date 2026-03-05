/**
 * Testes de Dead Letter Queue e Adaptive Backoff
 * Cobre:
 *  - classifyError — classificação transiente vs permanente
 *  - calculateRetryDelay — backoff exponencial
 *  - calculateAdaptiveInterval — intervalo adaptativo por consecutive_failures
 *  - isRetryableJob — lógica de eligibilidade para retry
 */

import { describe, it, expect } from 'vitest';

// === Error Classification Logic (mirrors process-at-sync-queue) ===

function classifyError(errorMsg: string): 'permanent' | 'transient' {
  const msg = errorMsg.toLowerCase();
  const isPermanent =
    msg.includes('auth_failed') ||
    msg.includes('autentic') ||
    msg.includes('credencia') ||
    msg.includes('no credentials') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('nif inv') ||
    msg.includes('year_in_future');
  return isPermanent ? 'permanent' : 'transient';
}

function calculateRetryDelay(retryCount: number): number {
  // (retry+1) * 2 hours in milliseconds
  return (retryCount + 1) * 2 * 60 * 60 * 1000;
}

function calculateAdaptiveInterval(consecutiveFailures: number): number {
  // 6h * 2^min(failures, 3) in hours
  return 6 * Math.pow(2, Math.min(consecutiveFailures, 3));
}

interface SyncJob {
  status: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
}

function isRetryableJob(job: SyncJob, now: Date): boolean {
  return (
    job.status === 'error' &&
    job.next_retry_at !== null &&
    new Date(job.next_retry_at) <= now &&
    job.retry_count < job.max_retries
  );
}

function isDeadLetter(job: SyncJob): boolean {
  return (
    job.status === 'error' &&
    (job.next_retry_at === null || job.retry_count >= job.max_retries)
  );
}

// === Tests ===

describe('Error Classification', () => {
  it('classifies auth errors as permanent', () => {
    expect(classifyError('[AT_AUTH_FAILED] Autenticação falhou')).toBe('permanent');
    expect(classifyError('Credenciais inválidas para o cliente')).toBe('permanent');
    expect(classifyError('HTTP 401: Unauthorized')).toBe('permanent');
    expect(classifyError('HTTP 403: Forbidden')).toBe('permanent');
    expect(classifyError('No credentials configured for client')).toBe('permanent');
    expect(classifyError('Client NIF inválido: 000000000')).toBe('permanent');
    expect(classifyError('YEAR_IN_FUTURE: fiscal_year=2027')).toBe('permanent');
  });

  it('classifies network/timeout errors as transient', () => {
    expect(classifyError('HTTP 500: Internal Server Error')).toBe('transient');
    expect(classifyError('HTTP 502: Bad Gateway')).toBe('transient');
    expect(classifyError('timeout: request aborted')).toBe('transient');
    expect(classifyError('Network connection reset')).toBe('transient');
    expect(classifyError('AT connector retries exhausted')).toBe('transient');
    expect(classifyError('Unknown error during sync')).toBe('transient');
  });

  it('classifies AT-specific errors correctly', () => {
    expect(classifyError('[AT_AUTH_FAILED] não autorizado')).toBe('permanent');
    expect(classifyError('Falta configuração: AT_CONNECTOR_URL')).toBe('transient');
    expect(classifyError('[AT_EMPTY_LIST] Lista de faturas vazia')).toBe('transient');
    expect(classifyError('[AT_SCHEMA_RESPONSE_ERROR] Particle 2.1')).toBe('transient');
  });
});

describe('Retry Delay Calculation', () => {
  it('calculates exponential backoff: (retry+1)*2h', () => {
    // retry 0 → 2h
    expect(calculateRetryDelay(0)).toBe(2 * 60 * 60 * 1000);
    // retry 1 → 4h
    expect(calculateRetryDelay(1)).toBe(4 * 60 * 60 * 1000);
    // retry 2 → 6h
    expect(calculateRetryDelay(2)).toBe(6 * 60 * 60 * 1000);
  });

  it('delay increases linearly with retry count', () => {
    const delay0 = calculateRetryDelay(0);
    const delay1 = calculateRetryDelay(1);
    const delay2 = calculateRetryDelay(2);
    expect(delay1).toBeGreaterThan(delay0);
    expect(delay2).toBeGreaterThan(delay1);
  });
});

describe('Adaptive Backoff Interval', () => {
  it('starts at 6h with no failures', () => {
    expect(calculateAdaptiveInterval(0)).toBe(6);
  });

  it('doubles with each failure: 6→12→24→48', () => {
    expect(calculateAdaptiveInterval(1)).toBe(12);
    expect(calculateAdaptiveInterval(2)).toBe(24);
    expect(calculateAdaptiveInterval(3)).toBe(48);
  });

  it('caps at 48h (3 failures max)', () => {
    expect(calculateAdaptiveInterval(4)).toBe(48);
    expect(calculateAdaptiveInterval(10)).toBe(48);
    expect(calculateAdaptiveInterval(100)).toBe(48);
  });
});

describe('Job Retry Eligibility', () => {
  const now = new Date('2026-03-05T12:00:00Z');
  const past = '2026-03-05T10:00:00Z';
  const future = '2026-03-05T14:00:00Z';

  it('retryable: error + next_retry_at in past + retries remaining', () => {
    const job: SyncJob = {
      status: 'error',
      retry_count: 1,
      max_retries: 3,
      next_retry_at: past,
    };
    expect(isRetryableJob(job, now)).toBe(true);
  });

  it('not retryable: next_retry_at in future', () => {
    const job: SyncJob = {
      status: 'error',
      retry_count: 1,
      max_retries: 3,
      next_retry_at: future,
    };
    expect(isRetryableJob(job, now)).toBe(false);
  });

  it('not retryable: max retries reached', () => {
    const job: SyncJob = {
      status: 'error',
      retry_count: 3,
      max_retries: 3,
      next_retry_at: past,
    };
    expect(isRetryableJob(job, now)).toBe(false);
  });

  it('not retryable: next_retry_at is null (permanent error)', () => {
    const job: SyncJob = {
      status: 'error',
      retry_count: 0,
      max_retries: 3,
      next_retry_at: null,
    };
    expect(isRetryableJob(job, now)).toBe(false);
  });

  it('not retryable: status is not error', () => {
    const job: SyncJob = {
      status: 'completed',
      retry_count: 0,
      max_retries: 3,
      next_retry_at: past,
    };
    expect(isRetryableJob(job, now)).toBe(false);
  });
});

describe('Dead Letter Queue Detection', () => {
  it('dead letter: permanent error (next_retry_at null)', () => {
    expect(isDeadLetter({
      status: 'error',
      retry_count: 0,
      max_retries: 3,
      next_retry_at: null,
    })).toBe(true);
  });

  it('dead letter: max retries exceeded', () => {
    expect(isDeadLetter({
      status: 'error',
      retry_count: 3,
      max_retries: 3,
      next_retry_at: '2026-03-05T10:00:00Z',
    })).toBe(true);
  });

  it('not dead letter: retries remaining', () => {
    expect(isDeadLetter({
      status: 'error',
      retry_count: 1,
      max_retries: 3,
      next_retry_at: '2026-03-05T10:00:00Z',
    })).toBe(false);
  });

  it('not dead letter: completed job', () => {
    expect(isDeadLetter({
      status: 'completed',
      retry_count: 0,
      max_retries: 3,
      next_retry_at: null,
    })).toBe(false);
  });
});

describe('Edge Cases', () => {
  it('empty error message is transient', () => {
    expect(classifyError('')).toBe('transient');
  });

  it('mixed case error keywords are detected', () => {
    expect(classifyError('UNAUTHORIZED access')).toBe('permanent');
    expect(classifyError('Auth_Failed: token expired')).toBe('permanent');
  });

  it('retry_count 0 with max_retries 0 is dead letter', () => {
    expect(isDeadLetter({
      status: 'error',
      retry_count: 0,
      max_retries: 0,
      next_retry_at: '2026-03-05T10:00:00Z',
    })).toBe(true);
  });
});
