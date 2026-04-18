#!/usr/bin/env node
// Forces a sync-efatura run for a single client, bypassing the scheduler's
// backoff. Prints job progress until completion or timeout. Intended for
// on-demand validation after deploying the quarter-boundary fix.
//
// Usage:
//   node scripts/force-client-sales-sync.mjs --client-id <uuid> [--direction ambos|vendas|compras] [--timeout-ms 120000]

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function parseArgs(argv) {
  const out = { direction: 'ambos', timeoutMs: 120000 };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--client-id') out.clientId = value;
    else if (key === '--direction') out.direction = value;
    else if (key === '--timeout-ms') out.timeoutMs = Number(value);
  }
  if (!out.clientId) {
    console.error('Missing --client-id <uuid>');
    process.exit(1);
  }
  return out;
}

function loadEnv() {
  const raw = readFileSync('.env', 'utf8');
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [
          l.slice(0, i).trim(),
          l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`▶ Invoking sync-efatura for client=${args.clientId} direction=${args.direction}`);
  const started = Date.now();
  const { data, error } = await supabase.functions.invoke('sync-efatura', {
    body: { clientId: args.clientId, direction: args.direction },
  });
  if (error) {
    console.error('Invocation failed:', error.message ?? error);
    process.exit(1);
  }
  console.log(`◀ sync-efatura returned in ${Date.now() - started}ms`);
  console.log(JSON.stringify(data, null, 2));

  console.log('\n▶ Polling at_sync_history for the latest run…');
  const deadline = Date.now() + args.timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const { data: rows } = await supabase
      .from('at_sync_history')
      .select('sync_type, sync_year, status, invoices_synced, invoices_returned_by_at, reason_code, error_message')
      .eq('client_id', args.clientId)
      .order('id', { ascending: false })
      .limit(4);
    if (rows?.length) {
      last = rows;
      const stillRunning = rows.some((r) => r.status === 'running' || r.status === 'pending');
      if (!stillRunning) break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('Latest history rows:');
  for (const r of last ?? []) {
    console.log(`  ${r.sync_type} y=${r.sync_year} status=${r.status} synced=${r.invoices_synced ?? 0} at_returned=${r.invoices_returned_by_at ?? '?'} reason=${r.reason_code ?? '—'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
