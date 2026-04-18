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

const cutoff = '2026-04-18T01:30:00Z';
const { data } = await s
  .from('at_sync_history')
  .select('client_id, start_date, end_date, status, records_skipped, invoices_returned_by_at, reason_code, completed_at')
  .gte('completed_at', cutoff)
  .order('completed_at', { ascending: true })
  .limit(30);
console.log(`rows post-deploy: ${data?.length ?? 0}\n`);

const distinctEndDates = {};
for (const r of data ?? []) {
  distinctEndDates[r.end_date] = (distinctEndDates[r.end_date] ?? 0) + 1;
}
console.log('end_date distribution:', distinctEndDates);

console.log('\nsample rows:');
for (const r of (data ?? []).slice(0, 10)) {
  console.log(
    `  ${r.completed_at?.slice(11, 19)} client=${r.client_id.slice(0, 8)} ${r.start_date}→${r.end_date} status=${r.status} reason=${r.reason_code ?? '—'} returned_by_at=${r.invoices_returned_by_at ?? 'NULL'}`,
  );
}
