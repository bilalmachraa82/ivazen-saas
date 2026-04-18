#!/usr/bin/env node
// Quiet watcher: emits ONLY on (a) Bilal job status transition, (b) every
// 5 min heartbeat, or (c) terminal state with full reconciliation.

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

let lastStatus;
let lastHeartbeat = 0;

while (true) {
  const { data: job } = await s
    .from('at_sync_jobs')
    .select('status, started_at, completed_at, error_message')
    .eq('client_id', BILAL)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  const status = job?.status ?? 'missing';

  if (status !== lastStatus) {
    const { count: pending } = await s
      .from('at_sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    console.log(
      `STATUS CHANGE ${lastStatus ?? '?'} → ${status} (queue_pending=${pending})`,
    );
    lastStatus = status;
  } else if (Date.now() - lastHeartbeat > 5 * 60 * 1000) {
    const { count: pending } = await s
      .from('at_sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    console.log(`HEARTBEAT bilal=${status} queue_pending=${pending}`);
    lastHeartbeat = Date.now();
  }

  if (status === 'completed' || status === 'error' || status === 'failed') {
    const { data: hist } = await s
      .from('at_sync_history')
      .select('sync_type, status, records_imported, invoices_returned_by_at, reason_code, error_message')
      .eq('client_id', BILAL)
      .order('id', { ascending: false })
      .limit(3);
    const { count: vendas2026 } = await s
      .from('sales_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', BILAL)
      .gte('document_date', '2026-01-01')
      .lte('document_date', '2026-12-31');
    const { data: vendas } = await s
      .from('sales_invoices')
      .select('document_date, document_type, document_number, atcud, total_amount')
      .eq('client_id', BILAL)
      .gte('document_date', '2026-01-01')
      .order('document_date', { ascending: true });
    console.log('FINAL history=' + JSON.stringify(hist));
    console.log('FINAL vendas_2026_count=' + vendas2026);
    console.log('FINAL atcuds=' + (vendas ?? []).map((v) => v.atcud).join(','));
    break;
  }

  await new Promise((r) => setTimeout(r, 15000));
}
