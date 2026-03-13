import { describe, it, expect } from 'vitest';
import { computeClientReadiness, ClientReadinessInput } from '../clientReadiness';

/** Helper — builds a full input with defaults */
function input(overrides: Partial<ClientReadinessInput>): ClientReadinessInput {
  return {
    hasCredentials: true,
    invoiceCount: 0,
    salesCount: 0,
    withholdingsCount: 0,
    lastSyncStatus: null,
    lastSyncError: null,
    ...overrides,
  };
}

describe('computeClientReadiness', () => {
  // ── ready ──
  it('returns ready when has invoices and no errors', () => {
    expect(computeClientReadiness(input({
      invoiceCount: 50, lastSyncStatus: 'success',
    }))).toBe('ready');
  });

  it('returns ready when has only sales (vendas)', () => {
    expect(computeClientReadiness(input({
      salesCount: 12, lastSyncStatus: 'success',
    }))).toBe('ready');
  });

  it('returns ready when has only withholdings (retenções)', () => {
    expect(computeClientReadiness(input({
      withholdingsCount: 5, lastSyncStatus: 'success',
    }))).toBe('ready');
  });

  it('returns ready when has data and credentials but never synced (CSV import)', () => {
    expect(computeClientReadiness(input({
      invoiceCount: 10, lastSyncStatus: 'never',
    }))).toBe('ready');
  });

  it('returns ready when has sales but never synced', () => {
    expect(computeClientReadiness(input({
      salesCount: 3, lastSyncStatus: 'never',
    }))).toBe('ready');
  });

  // ── partial ──
  it('returns partial when has data but no credentials', () => {
    expect(computeClientReadiness(input({
      hasCredentials: false, invoiceCount: 25,
    }))).toBe('partial');
  });

  it('returns partial when has sales but no credentials', () => {
    expect(computeClientReadiness(input({
      hasCredentials: false, salesCount: 8,
    }))).toBe('partial');
  });

  it('returns partial when has data but auth error', () => {
    expect(computeClientReadiness(input({
      invoiceCount: 30, lastSyncStatus: 'error',
      lastSyncError: 'Auth failed: invalid credentials',
    }))).toBe('partial');
  });

  it('returns partial when has withholdings but sync error', () => {
    expect(computeClientReadiness(input({
      withholdingsCount: 10, lastSyncStatus: 'error',
      lastSyncError: 'timeout',
    }))).toBe('partial');
  });

  // ── no_credentials ──
  it('returns no_credentials when no creds and no data', () => {
    expect(computeClientReadiness(input({
      hasCredentials: false,
    }))).toBe('no_credentials');
  });

  // ── blocked ──
  it('returns blocked when auth error and no data', () => {
    expect(computeClientReadiness(input({
      lastSyncStatus: 'error',
      lastSyncError: 'Auth failed: 401',
    }))).toBe('blocked');
  });

  it('returns blocked when sync error and no data at all', () => {
    expect(computeClientReadiness(input({
      lastSyncStatus: 'error',
      lastSyncError: 'SOAP fault',
    }))).toBe('blocked');
  });

  it('detects certificate errors as auth errors', () => {
    expect(computeClientReadiness(input({
      lastSyncStatus: 'error',
      lastSyncError: 'Certificate validation failed',
    }))).toBe('blocked');
  });

  // ── needs_import ──
  it('returns needs_import when has credentials but never synced and no data', () => {
    expect(computeClientReadiness(input({
      lastSyncStatus: 'never',
    }))).toBe('needs_import');
  });

  it('returns needs_import when has credentials, null status, no data', () => {
    expect(computeClientReadiness(input({}))).toBe('needs_import');
  });

  // ── no_data ──
  it('returns no_data when synced successfully but zero documents', () => {
    expect(computeClientReadiness(input({
      lastSyncStatus: 'success',
    }))).toBe('no_data');
  });

  it('returns no_data when partial sync but zero documents', () => {
    expect(computeClientReadiness(input({
      lastSyncStatus: 'partial',
    }))).toBe('no_data');
  });

  // ── mixed signals ──
  it('returns ready when zero invoices but has sales + withholdings', () => {
    expect(computeClientReadiness(input({
      invoiceCount: 0, salesCount: 5, withholdingsCount: 20,
      lastSyncStatus: 'success',
    }))).toBe('ready');
  });

  it('returns partial when has withholdings + no creds', () => {
    expect(computeClientReadiness(input({
      hasCredentials: false, withholdingsCount: 100,
    }))).toBe('partial');
  });
});
