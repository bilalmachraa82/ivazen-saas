#!/usr/bin/env node
// Confirms the new edge-function code is serving traffic by looking for
// at_sync_history rows written AFTER the deploy cutoff that populate the
// new `invoices_returned_by_at` column. Also surfaces any `partial` runs
// with the new reason_code, which proves the silent-success kill landed.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
    }),
);
const s = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const DEPLOY_CUTOFF = '2026-04-18T01:25:00Z'; // slightly before the functions deploy

console.log('▶ Rows with non-null invoices_returned_by_at since deploy');
const { data: newCols, error: e1 } = await s
  .from('at_sync_history')
  .select('id, client_id, sync_type, status, reason_code, invoices_synced, invoices_returned_by_at, completed_at')
  .not('invoices_returned_by_at', 'is', null)
  .gte('completed_at', DEPLOY_CUTOFF)
  .order('id', { ascending: false })
  .limit(10);
if (e1) console.error('e1:', e1.message);
console.log(`count=${newCols?.length ?? 0}`);
for (const r of newCols ?? []) {
  console.log(
    `  ${r.completed_at?.slice(11, 19)} ${r.sync_type} status=${r.status} synced=${r.invoices_synced} at_returned=${r.invoices_returned_by_at} reason=${r.reason_code ?? '—'}`,
  );
}

console.log('\n▶ status=partial with AT_ZERO_RESULTS_SUSPICIOUS since deploy');
const { data: partial } = await s
  .from('at_sync_history')
  .select('client_id, sync_type, completed_at, invoices_returned_by_at, reason_code')
  .eq('status', 'partial')
  .eq('reason_code', 'AT_ZERO_RESULTS_SUSPICIOUS')
  .gte('completed_at', DEPLOY_CUTOFF)
  .limit(5);
console.log(`count=${partial?.length ?? 0}`);
for (const r of partial ?? []) {
  console.log(`  client=${r.client_id} ${r.sync_type} completed=${r.completed_at?.slice(11, 19)}`);
}

console.log('\n▶ Queue snapshot');
const { count: pending } = await s
  .from('at_sync_jobs')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'pending');
const { count: processing } = await s
  .from('at_sync_jobs')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'processing');
const { count: completedHour } = await s
  .from('at_sync_jobs')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'completed')
  .gte('completed_at', new Date(Date.now() - 3600 * 1000).toISOString());
console.log(`  pending=${pending} processing=${processing} completed_1h=${completedHour}`);
