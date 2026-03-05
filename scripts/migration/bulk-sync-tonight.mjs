#!/usr/bin/env node
/**
 * Bulk AT Sync — overnight batch
 * Syncs ALL clients with valid credentials using force+service-role.
 * Rate-limited to avoid overloading the AT connector.
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
const CONCURRENCY = parseInt(process.env.SYNC_CONCURRENCY || '3'); // parallel syncs
const DELAY_MS = parseInt(process.env.SYNC_DELAY_MS || '2000'); // delay between batches
const YEAR = parseInt(process.env.SYNC_YEAR || '2025');
const TYPE = process.env.SYNC_TYPE || 'ambos'; // compras, vendas, ambos

const h = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const restH = { apikey: KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getAllCredentials() {
  const r = await fetch(
    `${BASE}/rest/v1/at_credentials?select=client_id,accountant_id,portal_nif,last_sync_status&portal_nif=neq.&portal_password_encrypted=neq.&order=last_sync_status.asc.nullsfirst&limit=500`,
    { headers: restH }
  );
  if (!r.ok) throw new Error(`Failed to fetch credentials: ${r.status}`);
  return r.json();
}

async function syncClient(clientId, accountantId, year) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const r = await fetch(`${BASE}/functions/v1/sync-efatura`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      clientId,
      accountantId,
      type: TYPE,
      startDate,
      endDate,
      source: 'manual',
      force: true,
    }),
  });

  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text.substring(0, 200) };
  }
}

async function main() {
  console.log('=== BULK AT SYNC ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Year: ${YEAR} | Type: ${TYPE} | Concurrency: ${CONCURRENCY} | Delay: ${DELAY_MS}ms`);

  const creds = await getAllCredentials();
  console.log(`\nTotal credentials: ${creds.length}`);

  // Filter: prioritize never-synced, then partial, then success (for refresh)
  const toSync = creds.filter(c => {
    const s = c.last_sync_status;
    return !s || s === 'never' || s === 'partial' || s === 'error';
  });
  console.log(`To sync (never/partial/error): ${toSync.length}`);

  const stats = {
    total: toSync.length,
    success: 0,
    partial: 0,
    error: 0,
    empty: 0,
    timeWindow: 0,
    inserted: 0,
    skipped: 0,
  };

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toSync.length; i += CONCURRENCY) {
    const batch = toSync.slice(i, i + CONCURRENCY);
    const batchNum = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(toSync.length / CONCURRENCY);

    console.log(`\n--- Batch ${batchNum}/${totalBatches} (${batch.length} clients) ---`);

    const results = await Promise.allSettled(
      batch.map(async (cred) => {
        const start = Date.now();
        const result = await syncClient(cred.client_id, cred.accountant_id, YEAR);
        const elapsed = Date.now() - start;
        return { cred, result, elapsed };
      })
    );

    for (const r of results) {
      if (r.status === 'rejected') {
        stats.error++;
        console.log(`  EXCEPTION: ${r.reason}`);
        continue;
      }

      const { cred, result, elapsed } = r.value;
      const nif = cred.portal_nif;
      const status = result.status || (result.success ? 'ok' : 'fail');
      const inserted = result.inserted || 0;
      const skipped = result.skipped || 0;
      const reason = result.reasonCode || '';

      stats.inserted += inserted;
      stats.skipped += skipped;

      if (result.success && reason === 'AT_EMPTY_LIST') {
        stats.empty++;
        console.log(`  ${nif} → EMPTY (${elapsed}ms)`);
      } else if (result.success) {
        if (status === 'partial') stats.partial++;
        else stats.success++;
        console.log(`  ${nif} → ${status.toUpperCase()} +${inserted} ins, ${skipped} skip (${elapsed}ms)`);
      } else if (reason === 'AT_TIME_WINDOW') {
        stats.timeWindow++;
        console.log(`  ${nif} → TIME_WINDOW — aborting, outside AT hours`);
      } else {
        stats.error++;
        const err = (result.error || result.message || '').substring(0, 80);
        console.log(`  ${nif} → ERROR [${reason}]: ${err} (${elapsed}ms)`);
      }
    }

    // Abort if we hit time window
    if (stats.timeWindow > 0) {
      console.log('\n⚠️  HIT TIME WINDOW — aborting remaining syncs');
      break;
    }

    // Rate limit between batches
    if (i + CONCURRENCY < toSync.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nTotal invoices imported: ${stats.inserted}`);
  console.log(`Total skipped (dedup): ${stats.skipped}`);
  console.log(`Success rate: ${((stats.success + stats.partial + stats.empty) / stats.total * 100).toFixed(1)}%`);
  console.log(`\nFinished: ${new Date().toISOString()}`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
