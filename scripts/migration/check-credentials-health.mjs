#!/usr/bin/env node
/**
 * F2 — Credential Health Check Script
 * Read-only diagnostic. No mutations.
 * Checks encrypted credential integrity and classifies recent failures.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const envPath = resolve(__dirname, '../../.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"'))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const BASE = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function restQuery(table, params = '') {
  const r = await fetch(`${BASE}/rest/v1/${table}?${params}`, { headers: h });
  if (!r.ok) {
    console.error(`REST error for ${table}: ${r.status}`);
    return null;
  }
  return r.json();
}

console.log('=== F2 CREDENTIAL HEALTH CHECK ===');
console.log(`Timestamp: ${new Date().toISOString()}`);

// Get all credentials
const creds = await restQuery('at_credentials',
  'select=id,client_id,accountant_id,portal_nif,portal_password_encrypted,encrypted_username,encrypted_password,subuser_id,last_sync_status,last_sync_error,environment,consecutive_failures&limit=50000');

if (!creds) {
  console.error('Failed to fetch credentials');
  process.exit(1);
}

console.log(`\nTotal credentials: ${creds.length}`);

let healthy = 0;
let blankPassword = 0;
let blankNif = 0;
let likelyPlaintext = 0;
let properlyEncrypted = 0;
let missingUsername = 0;

for (const c of creds) {
  const pwd = c.encrypted_password || c.portal_password_encrypted || '';
  const nif = c.portal_nif || '';
  const username = c.subuser_id || c.encrypted_username || c.portal_nif || '';

  // Check password format (should be salt:iv:ciphertext)
  const parts = pwd.split(':');
  const isEncrypted = parts.length === 3 && parts.every(p => p.length > 0);

  if (!pwd || pwd.trim() === '') {
    blankPassword++;
  } else if (!isEncrypted) {
    likelyPlaintext++;
  } else {
    properlyEncrypted++;
  }

  if (!nif || nif.trim() === '') {
    blankNif++;
  }

  if (!username || username.trim() === '') {
    missingUsername++;
  }

  if (isEncrypted && (nif || username)) {
    healthy++;
  }
}

console.log(JSON.stringify({
  total: creds.length,
  healthy,
  properly_encrypted: properlyEncrypted,
  blank_password: blankPassword,
  blank_nif: blankNif,
  likely_plaintext: likelyPlaintext,
  missing_username: missingUsername,
}, null, 2));

// Classify recent failures (7d)
console.log('\n--- Recent Error Classification ---');
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const errors = await restQuery('at_sync_history',
  `select=reason_code,error_message,created_at,client_id,metadata&status=eq.error&created_at=gte.${sevenDaysAgo}&order=created_at.desc&limit=1000`);

if (errors) {
  const classified = {
    time_window: 0,       // F1 will fix these
    decrypt_failed: 0,    // Encryption key mismatch
    credentials_invalid: 0, // Wrong password/username at AT portal
    connector_down: 0,    // Connector unreachable
    schema_error: 0,      // AT response parsing failure
    unknown: 0,
  };

  for (const e of errors) {
    const msg = (e.error_message || '').toLowerCase();
    const reason = e.reason_code || '';

    // Check timestamp for time window
    const d = new Date(e.created_at);
    const utcHour = d.getUTCHours();
    const utcMin = d.getUTCMinutes();
    const timeVal = utcHour * 60 + utcMin;
    const inWindow = (timeVal >= 360 && timeVal <= 375) || (timeVal >= 1170 && timeVal <= 1185);

    if (reason === 'AT_TIME_WINDOW') {
      classified.time_window++;
    } else if (msg.includes('decrypt') || msg.includes('encryption') || msg.includes('keys')) {
      classified.decrypt_failed++;
    } else if (reason === 'AT_AUTH_FAILED' && !inWindow) {
      // Auth failed OUTSIDE window = likely time window issue (pre-F1)
      classified.time_window++;
    } else if (reason === 'AT_AUTH_FAILED' && inWindow) {
      // Auth failed INSIDE window = likely real credential issue
      if (msg.includes('sem credenciais') || msg.includes('no usable') || msg.includes('no credentials')) {
        classified.decrypt_failed++;
      } else {
        classified.credentials_invalid++;
      }
    } else if (msg.includes('connector') || msg.includes('timeout') || msg.includes('network')) {
      classified.connector_down++;
    } else if (reason === 'AT_SCHEMA_RESPONSE_ERROR') {
      classified.schema_error++;
    } else {
      classified.unknown++;
    }
  }

  console.log(`Total errors in 7d: ${errors.length}`);
  console.log('Classification:', JSON.stringify(classified, null, 2));
  console.log(`\nF1 fix (time_window) will address: ${classified.time_window} errors (${(classified.time_window / errors.length * 100).toFixed(1)}%)`);
}

// Check for write path issues: credentials with blank encrypted_password
// that ALSO have at least one sync attempt
console.log('\n--- Write Path Placeholder Check ---');
const blankPwdWithSyncAttempt = creds.filter(c => {
  const pwd = c.encrypted_password || c.portal_password_encrypted || '';
  return pwd.trim() === '' && c.last_sync_status !== 'never' && c.last_sync_status !== null;
});
console.log(`Credentials with blank password AND sync attempt: ${blankPwdWithSyncAttempt.length}`);
if (blankPwdWithSyncAttempt.length > 0) {
  console.log('Sample:', blankPwdWithSyncAttempt.slice(0, 5).map(c => ({
    client_id: c.client_id,
    last_sync_status: c.last_sync_status,
    last_sync_error: c.last_sync_error?.substring(0, 100),
  })));
}

console.log('\n=== F2 CREDENTIAL HEALTH CHECK COMPLETE ===');
