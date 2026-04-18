#!/usr/bin/env node
// Fire the scheduled AT-sync RPC in force mode. The scheduler enqueues jobs
// for all eligible credentials (Bilal included), process-at-sync-queue drains
// them, and the new quarter-boundary fix is exercised end-to-end.

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

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const BILAL = '5a994a12-8364-4320-ac35-e93f81edcf10';

console.log('▶ run_scheduled_at_sync(force=>true)');
const { data, error } = await supabase.rpc('run_scheduled_at_sync', { p_force: true });
if (error) {
  console.error('rpc error:', error.message);
  process.exit(1);
}
console.log('rpc result:', JSON.stringify(data, null, 2));

console.log('\n▶ Poll Bilal jobs + history (up to 240s)');
const deadline = Date.now() + 240_000;
let lastPrint = 0;
while (Date.now() < deadline) {
  const [{ data: jobs }, { data: hist }] = await Promise.all([
    supabase
      .from('at_sync_jobs')
      .select('id, status, fiscal_year, retry_count, started_at, completed_at, error_message')
      .eq('client_id', BILAL)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('at_sync_history')
      .select('sync_type, status, invoices_synced, invoices_returned_by_at, reason_code, error_message, completed_at')
      .eq('client_id', BILAL)
      .order('id', { ascending: false })
      .limit(3),
  ]);
  const now = Date.now();
  if (now - lastPrint > 8000) {
    lastPrint = now;
    console.log(`\n[+${Math.floor((now - (deadline - 240_000)) / 1000)}s]`);
    console.log('jobs:', JSON.stringify(jobs, null, 2));
    console.log('history:', JSON.stringify(hist, null, 2));
  }
  const stillRunning = (jobs ?? []).some((j) => j.status === 'pending' || j.status === 'processing');
  if (!stillRunning && (jobs ?? []).length > 0) break;
  await new Promise((r) => setTimeout(r, 5000));
}
