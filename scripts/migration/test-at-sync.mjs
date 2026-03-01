#!/usr/bin/env node
/**
 * Test AT Sync — verify re-encrypted credentials work
 *
 * This script:
 * 1. Lists all clients with at_credentials
 * 2. Triggers sync-efatura for each (small date range to be fast)
 * 3. Reports which ones succeed/fail
 *
 * Usage: node scripts/migration/test-at-sync.mjs
 *
 * Environment: reads from .env (VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found */ }

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
};

// ── Step 1: List all clients with credentials ────────────────────────────

console.log('\n🔍 Fetching all clients with AT credentials...\n');

const credsResp = await fetch(
  `${URL}/rest/v1/at_credentials?select=client_id,portal_nif,last_sync_status,last_sync_error,accountant_id&order=portal_nif.asc`,
  { headers }
);

if (!credsResp.ok) {
  console.error('Failed to fetch credentials:', credsResp.status, await credsResp.text());
  process.exit(1);
}

const allCreds = await credsResp.json();
console.log(`📋 Found ${allCreds.length} clients with credentials\n`);

// ── Step 2: Sync each client (small date range: last 7 days) ─────────────

// Use a narrow date range to minimize AT load and speed up the test
const now = new Date();
const endDate = now.toISOString().slice(0, 10);
const startDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

const CONCURRENCY = 3; // Parallel requests to avoid overloading AT
const DELAY_BETWEEN_BATCHES_MS = 2000; // 2s between batches

const results = [];
let processed = 0;

async function syncClient(cred) {
  const { client_id, portal_nif } = cred;
  const startTime = Date.now();

  try {
    const resp = await fetch(`${URL}/functions/v1/sync-efatura`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: client_id,
        environment: 'production',
        type: 'compras',
        startDate,
        endDate,
      }),
    });

    const elapsed = Date.now() - startTime;
    const body = await resp.json().catch(() => ({ error: 'Invalid JSON response' }));

    const entry = {
      nif: portal_nif,
      clientId: client_id,
      httpStatus: resp.status,
      success: body.success === true || (resp.ok && !body.error),
      reasonCode: body.reasonCode || null,
      error: body.error || null,
      compras: body.compras || null,
      vendas: body.vendas || null,
      elapsed,
    };

    results.push(entry);
    processed++;

    // Progress indicator
    const icon = entry.success ? '✅' : (entry.reasonCode === 'AT_EMPTY_LIST' ? '📭' : '❌');
    const detail = entry.success
      ? `compras=${body.compras?.inserted ?? 0}/${body.compras?.total ?? 0}`
      : (entry.reasonCode || entry.error || `HTTP ${resp.status}`);
    process.stdout.write(`  ${icon} [${processed}/${allCreds.length}] NIF ${portal_nif} — ${detail} (${elapsed}ms)\n`);

    return entry;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const entry = {
      nif: portal_nif,
      clientId: client_id,
      httpStatus: 0,
      success: false,
      reasonCode: 'NETWORK_ERROR',
      error: err.message,
      elapsed,
    };
    results.push(entry);
    processed++;
    process.stdout.write(`  ❌ [${processed}/${allCreds.length}] NIF ${portal_nif} — NETWORK: ${err.message}\n`);
    return entry;
  }
}

console.log(`🔄 Testing sync for ${allCreds.length} clients (${startDate} → ${endDate})\n`);
console.log(`   Concurrency: ${CONCURRENCY}, delay between batches: ${DELAY_BETWEEN_BATCHES_MS}ms\n`);

// Process in batches
for (let i = 0; i < allCreds.length; i += CONCURRENCY) {
  const batch = allCreds.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(syncClient));

  // Rate limiting between batches
  if (i + CONCURRENCY < allCreds.length) {
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
  }
}

// ── Step 3: Summary ──────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════');

const succeeded = results.filter(r => r.success);
const emptyList = results.filter(r => r.reasonCode === 'AT_EMPTY_LIST');
const authFailed = results.filter(r => r.reasonCode === 'AT_AUTH_FAILED' || (r.error && r.error.toLowerCase().includes('auth')));
const invalidNif = results.filter(r => r.reasonCode === 'INVALID_CLIENT_NIF');
const decryptFailed = results.filter(r => r.error && r.error.toLowerCase().includes('decrypt'));
const otherErrors = results.filter(r => !r.success && !emptyList.includes(r) && !authFailed.includes(r) && !invalidNif.includes(r) && !decryptFailed.includes(r));

console.log(`✅ Sync OK:           ${succeeded.length}`);
console.log(`📭 Empty (no data):   ${emptyList.length}`);
console.log(`🔑 Auth failed:       ${authFailed.length}`);
console.log(`🔐 Decrypt failed:    ${decryptFailed.length}`);
console.log(`❓ Invalid NIF:       ${invalidNif.length}`);
console.log(`❌ Other errors:      ${otherErrors.length}`);
console.log(`📊 Total:             ${results.length}`);
console.log('═══════════════════════════════════════════════════════\n');

// Key metric: if decrypt failures are 0, the re-encryption worked
if (decryptFailed.length === 0) {
  console.log('🎉 ZERO decrypt failures — credential re-encryption is working!\n');
} else {
  console.log('⚠️  DECRYPT FAILURES DETECTED — re-encryption may have issues:\n');
  for (const r of decryptFailed) {
    console.log(`   NIF ${r.nif}: ${r.error}`);
  }
  console.log('');
}

// Show auth failures (these are AT portal rejections, not our problem)
if (authFailed.length > 0) {
  console.log('🔑 Auth failures (AT portal rejected the password):');
  for (const r of authFailed) {
    console.log(`   NIF ${r.nif}: ${r.error || r.reasonCode}`);
  }
  console.log('');
}

// Show other errors
if (otherErrors.length > 0) {
  console.log('❌ Other errors:');
  for (const r of otherErrors) {
    console.log(`   NIF ${r.nif}: [${r.reasonCode || 'HTTP ' + r.httpStatus}] ${r.error}`);
  }
  console.log('');
}

// Timing stats
const totalElapsed = results.reduce((sum, r) => sum + r.elapsed, 0);
const avgElapsed = Math.round(totalElapsed / results.length);
console.log(`⏱️  Avg response time: ${avgElapsed}ms`);
console.log(`⏱️  Total wall time: ~${Math.round(totalElapsed / 1000 / CONCURRENCY)}s\n`);
