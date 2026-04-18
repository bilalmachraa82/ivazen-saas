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

const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const BILAL_ID = '5a994a12-8364-4320-ac35-e93f81edcf10';

// 1. Get ALL vendas for Bilal, log any error
console.log('=== BILAL — Probe sales_invoices (select *) ===');
const { data: all, error: allErr, count } = await supabase
  .from('sales_invoices')
  .select('*', { count: 'exact' })
  .eq('client_id', BILAL_ID)
  .order('document_date', { ascending: false })
  .limit(200);
if (allErr) console.log('ERROR:', allErr.message);
console.log(`count=${count}, returned=${all?.length ?? 0}`);
if (all?.[0]) console.log('columns:', Object.keys(all[0]).join(', '));

console.log('\n=== BILAL — Vendas 2026 ===');
let count2026 = 0;
for (const v of all ?? []) {
  const d = v.document_date ?? '';
  if (d.startsWith('2026')) {
    count2026++;
    console.log(
      `  ${d} | ${v.document_type ?? '?'} ${v.document_number ?? '?'} | ATCUD ${v.atcud ?? '—'} | NIF ${v.customer_nif ?? '—'} | ${Number(v.total_amount ?? 0).toFixed(2)}€ | src=${v.source ?? v.import_source ?? '—'}`,
    );
  }
}
console.log(`total 2026 na BD: ${count2026}`);

// 2. Ground truth
const expected = [
  { doc: 'FR/22', atcud: 'JJ37MMGM-22', date: '2026-04-02', nif: '517984490', total: 1920.00 },
  { doc: 'FR/21', atcud: 'JJ37MMGM-21', date: '2026-04-01', nif: '510364284', total: 210.00 },
  { doc: 'FR/20', atcud: 'JJ37MMGM-20', date: '2026-03-30', nif: '503998680', total: 974.25 },
  { doc: 'FT/15', atcud: 'JJ3TVYDZ-15', date: '2026-02-27', nif: '510423140', total: 1500.00 },
  { doc: 'FT/14', atcud: 'JJ3TVYDZ-14', date: '2026-02-24', nif: '503952230', total: 1199.00 },
  { doc: 'FR/19', atcud: 'JJ37MMGM-19', date: '2026-02-23', nif: '0', total: 90.00 },
  { doc: 'FR/18', atcud: 'JJ37MMGM-18', date: '2026-01-08', nif: '510423140', total: 1100.00 },
];

console.log('\n=== Reconciliação por ATCUD / date+total ===');
const vendas2026 = (all ?? []).filter((v) => (v.document_date ?? '').startsWith('2026'));
const byAtcud = new Map(vendas2026.map((v) => [v.atcud, v]));
const byKey = new Map(
  vendas2026.map((v) => [`${v.document_date}|${Number(v.total_amount ?? 0).toFixed(2)}`, v]),
);
for (const e of expected) {
  const a = byAtcud.get(e.atcud);
  const d = byKey.get(`${e.date}|${e.total.toFixed(2)}`);
  const hit = a ?? d;
  console.log(
    `  ${e.date} ${e.doc} ${e.atcud} (${e.total.toFixed(2)}€): ${
      hit ? `MATCH doc=${hit.document_number} total=${Number(hit.total_amount).toFixed(2)}` : 'MISSING'
    }`,
  );
}

// 3. sync history
console.log('\n=== BILAL — at_sync_history (any columns) ===');
const { data: hist, error: histErr } = await supabase
  .from('at_sync_history')
  .select('*')
  .eq('client_id', BILAL_ID)
  .order('started_at', { ascending: false, nullsFirst: false })
  .limit(10);
if (histErr) console.log('ERROR:', histErr.message);
console.log(`returned=${hist?.length ?? 0}`);
if (hist?.[0]) console.log('columns:', Object.keys(hist[0]).join(', '));
for (const h of hist ?? []) {
  console.log(`  ${JSON.stringify({ ...h, error_message: (h.error_message ?? '').slice(0, 60) })}`);
}
