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
const s = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const { data: runs } = await s
  .from('at_sync_automation_runs')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(3);
console.log('runs:', JSON.stringify(runs, null, 2));
const { count: pendingCount } = await s
  .from('at_sync_jobs')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'pending');
const { count: processingCount } = await s
  .from('at_sync_jobs')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'processing');
console.log('pending=', pendingCount, 'processing=', processingCount);
