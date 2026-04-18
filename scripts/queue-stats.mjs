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

for (const st of ['pending', 'processing', 'completed', 'error']) {
  const { count } = await s
    .from('at_sync_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', st)
    .gte('created_at', new Date(Date.now() - 3 * 3600 * 1000).toISOString());
  console.log(`last_3h status=${st}: ${count}`);
}

const { data: stuck } = await s
  .from('at_sync_jobs')
  .select('id, status, started_at, error_message, retry_count')
  .eq('status', 'processing')
  .order('started_at', { ascending: true })
  .limit(10);
console.log('\nprocessing (oldest first):');
for (const j of stuck ?? []) {
  const age = Math.round((Date.now() - new Date(j.started_at).getTime()) / 1000);
  console.log(`  ${j.id.slice(0, 8)} started ${age}s ago retry=${j.retry_count}`);
}

const { data: recentErr } = await s
  .from('at_sync_jobs')
  .select('error_message, completed_at')
  .eq('status', 'error')
  .order('completed_at', { ascending: false })
  .limit(5);
console.log('\nrecent errors:');
for (const j of recentErr ?? []) {
  console.log(`  ${j.completed_at?.slice(11, 19)} ${(j.error_message ?? '').slice(0, 80)}`);
}

// Position of Bilal in the queue
const BILAL = '5a994a12-8364-4320-ac35-e93f81edcf10';
const { data: bilalJob } = await s
  .from('at_sync_jobs')
  .select('id, created_at, status')
  .eq('client_id', BILAL)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
if (bilalJob?.status === 'pending') {
  const { count: ahead } = await s
    .from('at_sync_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('created_at', bilalJob.created_at);
  console.log(`\nBilal queue position: ${ahead} ahead (inclusive)`);
}
