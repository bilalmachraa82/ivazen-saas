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
let prev;
while (true) {
  const { data: job } = await s
    .from('at_sync_jobs')
    .select('status, started_at, completed_at, error_message')
    .eq('client_id', BILAL)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  const { count: pending } = await s
    .from('at_sync_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  const status = job?.status ?? 'missing';
  const line = `bilal=${status} queue_pending=${pending}`;
  if (line !== prev) {
    console.log(
      `[${new Date().toISOString().slice(11, 19)}] ${line} ${
        job?.error_message ? 'err=' + String(job.error_message).slice(0, 80) : ''
      }`,
    );
    prev = line;
  }
  if (status === 'completed' || status === 'error' || status === 'failed') {
    const { data: hist } = await s
      .from('at_sync_history')
      .select('sync_type, status, records_imported, invoices_returned_by_at, reason_code, error_message')
      .eq('client_id', BILAL)
      .order('id', { ascending: false })
      .limit(3);
    console.log('DONE history=' + JSON.stringify(hist));
    const { count: c } = await s
      .from('sales_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', BILAL)
      .gte('document_date', '2026-01-01')
      .lte('document_date', '2026-12-31');
    console.log('DONE vendas_2026_count=' + c);
    break;
  }
  await new Promise((r) => setTimeout(r, 15000));
}
