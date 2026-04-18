#!/usr/bin/env node
// Emits a line only when queue state or Majda/Helene job status changes.
// Terminates with QUEUE_DRAINED when the queue is empty.

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
const MAJDA = '918dde3c-b33d-4e65-94df-53a0a3a79c38';
const HELENE = 'af826459-7260-4b3c-9b97-08077299e356';
let lastSnapshot = '';
while (true) {
  const [{ count: pending }, { count: processing }, majdaJob, heleneJob] = await Promise.all([
    s.from('at_sync_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    s.from('at_sync_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
    s.from('at_sync_jobs').select('status').eq('client_id', MAJDA).order('created_at', { ascending: false }).limit(1).single(),
    s.from('at_sync_jobs').select('status').eq('client_id', HELENE).order('created_at', { ascending: false }).limit(1).single(),
  ]);
  const bucket = pending > 100 ? 'over100' : pending > 50 ? 'over50' : pending > 10 ? 'over10' : `exact${pending}`;
  const snap = `bucket=${bucket} proc=${processing} majda=${majdaJob.data?.status} helene=${heleneJob.data?.status}`;
  if (snap !== lastSnapshot) {
    console.log(`[${new Date().toISOString().slice(11, 19)}] queue pending=${pending} processing=${processing} majda=${majdaJob.data?.status ?? '?'} helene=${heleneJob.data?.status ?? '?'}`);
    lastSnapshot = snap;
  }
  if (pending === 0 && processing === 0 && majdaJob.data?.status !== 'pending' && heleneJob.data?.status !== 'pending') {
    const { count: mc } = await s
      .from('sales_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', MAJDA)
      .gte('document_date', '2026-01-01')
      .lte('document_date', '2026-03-31');
    const { count: hc } = await s
      .from('sales_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', HELENE)
      .gte('document_date', '2026-01-01')
      .lte('document_date', '2026-03-31');
    console.log(`QUEUE_DRAINED majda_vendas_2026q1=${mc} helene_vendas_2026q1=${hc}`);
    break;
  }
  await new Promise((r) => setTimeout(r, 30000));
}
