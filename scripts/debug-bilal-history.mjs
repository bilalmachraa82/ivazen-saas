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

// Select * to see all columns for the latest row — confirms column exists.
const { data: rows, error } = await s
  .from('at_sync_history')
  .select('*')
  .eq('client_id', BILAL)
  .order('id', { ascending: false })
  .limit(2);
if (error) console.log('ERR:', error.message);
for (const r of rows ?? []) {
  console.log('---row---');
  console.log(JSON.stringify(r, null, 2));
}

// One of the working partial rows for comparison:
const { data: working } = await s
  .from('at_sync_history')
  .select('*')
  .eq('status', 'partial')
  .eq('reason_code', 'AT_ZERO_RESULTS_SUSPICIOUS')
  .limit(1);
console.log('\n--- working partial row (another client) ---');
console.log(JSON.stringify(working?.[0], null, 2));
