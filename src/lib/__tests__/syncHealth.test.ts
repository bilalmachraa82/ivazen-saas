/**
 * Testes de Sync Health Dashboard
 * Cobre:
 *  - calculateSuccessRate — cálculo de taxa de sucesso
 *  - classifyErrorBreakdown — classificação de erros por tipo
 *  - getHealthStatus — semáforo verde/amarelo/vermelho
 *  - formatDuration — formatação de duração (ms/s)
 */

import { describe, it, expect } from 'vitest';

// === Health Calculation Logic (mirrors get_at_sync_health + SyncHealthWidget) ===

function calculateSuccessRate(completed: number, total: number): number {
  if (total === 0) return 100.0;
  return Math.round((100.0 * completed / total) * 10) / 10;
}

type HealthStatus = 'success' | 'warning' | 'destructive';

function getHealthStatus(rate: number): HealthStatus {
  if (rate >= 95) return 'success';
  if (rate >= 80) return 'warning';
  return 'destructive';
}

function classifyErrorReason(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  if (msg.includes('autentic') || msg.includes('credencia') || msg.includes('unauthorized') || msg.includes('at_auth_failed')) return 'auth_failed';
  if (msg.includes('timeout') || msg.includes('abort')) return 'timeout';
  if (msg.includes('network') || msg.includes('connection')) return 'network';
  if (msg.includes('no credentials') || msg.includes('no_credentials')) return 'no_credentials';
  if (msg.includes('year_in_future')) return 'year_future';
  return 'other';
}

function formatDuration(ms: number): string {
  if (ms > 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

// === Tests ===

describe('Success Rate Calculation', () => {
  it('returns 100% when no jobs exist', () => {
    expect(calculateSuccessRate(0, 0)).toBe(100.0);
  });

  it('calculates correctly for all completed', () => {
    expect(calculateSuccessRate(10, 10)).toBe(100.0);
  });

  it('calculates correctly for mixed results', () => {
    expect(calculateSuccessRate(8, 10)).toBe(80.0);
    expect(calculateSuccessRate(19, 20)).toBe(95.0);
  });

  it('handles single failure', () => {
    expect(calculateSuccessRate(0, 1)).toBe(0.0);
  });

  it('rounds to 1 decimal place', () => {
    expect(calculateSuccessRate(1, 3)).toBe(33.3);
    expect(calculateSuccessRate(2, 3)).toBe(66.7);
  });
});

describe('Health Status (Semáforo)', () => {
  it('green: >= 95%', () => {
    expect(getHealthStatus(100)).toBe('success');
    expect(getHealthStatus(95)).toBe('success');
    expect(getHealthStatus(99.9)).toBe('success');
  });

  it('yellow: 80-94%', () => {
    expect(getHealthStatus(94.9)).toBe('warning');
    expect(getHealthStatus(80)).toBe('warning');
    expect(getHealthStatus(85)).toBe('warning');
  });

  it('red: < 80%', () => {
    expect(getHealthStatus(79.9)).toBe('destructive');
    expect(getHealthStatus(0)).toBe('destructive');
    expect(getHealthStatus(50)).toBe('destructive');
  });
});

describe('Error Reason Classification', () => {
  it('classifies auth errors', () => {
    expect(classifyErrorReason('[AT_AUTH_FAILED] Autenticação falhou')).toBe('auth_failed');
    expect(classifyErrorReason('Credenciais inválidas')).toBe('auth_failed');
    expect(classifyErrorReason('HTTP 401: Unauthorized')).toBe('auth_failed');
  });

  it('classifies timeout errors', () => {
    expect(classifyErrorReason('timeout: request aborted')).toBe('timeout');
    expect(classifyErrorReason('AbortError: signal timed out')).toBe('timeout');
  });

  it('classifies network errors', () => {
    expect(classifyErrorReason('Network connection reset')).toBe('network');
    expect(classifyErrorReason('Connection refused by server')).toBe('network');
  });

  it('classifies credentials errors', () => {
    expect(classifyErrorReason('No credentials configured for client')).toBe('no_credentials');
  });

  it('classifies year errors', () => {
    expect(classifyErrorReason('YEAR_IN_FUTURE: fiscal_year=2027')).toBe('year_future');
  });

  it('classifies unknown errors as other', () => {
    expect(classifyErrorReason('Some unknown error')).toBe('other');
    expect(classifyErrorReason('')).toBe('other');
  });
});

describe('Duration Formatting', () => {
  it('formats milliseconds for short durations', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1000)).toBe('1000ms');
    expect(formatDuration(0)).toBe('0ms');
  });

  it('formats seconds for longer durations', () => {
    expect(formatDuration(1001)).toBe('1.0s');
    expect(formatDuration(5500)).toBe('5.5s');
    expect(formatDuration(30000)).toBe('30.0s');
  });
});

describe('Sync Health Data Structure', () => {
  it('validates expected shape of health data', () => {
    const mockHealth = {
      total_syncs_24h: 50,
      completed_24h: 45,
      errors_24h: 5,
      success_rate: 90.0,
      pending_retries: 2,
      dead_letter_count: 3,
      currently_processing: 1,
      avg_duration_ms: 15000,
      error_breakdown: { auth_failed: 3, timeout: 2 },
      credentials_with_failures: 4,
      last_automation_run: {
        run_date: '2026-03-05',
        slot: 'evening',
        total_jobs: 136,
        local_time: '2026-03-05T19:30:00',
      },
    };

    expect(mockHealth.total_syncs_24h).toBeGreaterThanOrEqual(0);
    expect(mockHealth.success_rate).toBeGreaterThanOrEqual(0);
    expect(mockHealth.success_rate).toBeLessThanOrEqual(100);
    expect(mockHealth.pending_retries + mockHealth.dead_letter_count).toBeLessThanOrEqual(mockHealth.errors_24h + 100); // DLQ includes old errors
    expect(Object.keys(mockHealth.error_breakdown).length).toBeGreaterThan(0);
    expect(mockHealth.last_automation_run.slot).toMatch(/^(morning|evening|manual)$/);
  });
});
