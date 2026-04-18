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

const targets = [
  { name: 'Bilal', id: '5a994a12-8364-4320-ac35-e93f81edcf10' },
  { name: 'Majda', id: '918dde3c-b33d-4e65-94df-53a0a3a79c38' },
  { name: 'Helene', id: 'af826459-7260-4b3c-9b97-08077299e356' },
];

for (const t of targets) {
  const { count: q1 } = await s
    .from('sales_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', t.id)
    .gte('document_date', '2026-01-01')
    .lte('document_date', '2026-03-31');
  const { count: q2 } = await s
    .from('sales_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', t.id)
    .gte('document_date', '2026-04-01')
    .lte('document_date', '2026-06-30');
  const { count: last7d } = await s
    .from('sales_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', t.id)
    .gte('document_date', new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10));
  const { data: hist } = await s
    .from('at_sync_history')
    .select('sync_type, status, records_imported, invoices_returned_by_at, reason_code')
    .eq('client_id', t.id)
    .order('created_at', { ascending: false })
    .limit(2);
  console.log(
    `${t.name}: Q1=${q1} Q2=${q2} last7d=${last7d} latest_history=[${(hist ?? [])
      .map((r) => `${r.sync_type}:${r.status}/${r.reason_code ?? '—'}/returned=${r.invoices_returned_by_at ?? 'NULL'}`)
      .join(', ')}]`,
  );
}
