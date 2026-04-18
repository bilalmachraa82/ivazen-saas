#!/usr/bin/env node
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
const BILAL = '5a994a12-8364-4320-ac35-e93f81edcf10';
const deadline = Date.now() + 10 * 60 * 1000;
let last = '';
while (Date.now() < deadline) {
  const [{ data: job }, { count: pending }, { count: processing }, { count: completed }] = await Promise.all([
    s
      .from('at_sync_jobs')
      .select('id, status, fiscal_year, retry_count, started_at, completed_at, error_message')
      .eq('client_id', BILAL)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    s.from('at_sync_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    s.from('at_sync_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
    s.from('at_sync_jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', new Date(Date.now() - 3600 * 1000).toISOString()),
  ]);
  const line = `[${new Date().toISOString().slice(11, 19)}] queue pending=${pending} processing=${processing} completed_last_hour=${completed} | bilal ${job?.status} err=${(job?.error_message ?? '').slice(0, 60)}`;
  if (line !== last) {
    console.log(line);
    last = line;
  }
  if (job?.status === 'completed' || job?.status === 'error' || job?.status === 'failed') break;
  await new Promise((r) => setTimeout(r, 10000));
}

const { data: hist } = await s
  .from('at_sync_history')
  .select('sync_type, status, invoices_synced, invoices_returned_by_at, reason_code, error_message, completed_at')
  .eq('client_id', BILAL)
  .order('id', { ascending: false })
  .limit(5);
console.log('\nhistory:', JSON.stringify(hist, null, 2));
