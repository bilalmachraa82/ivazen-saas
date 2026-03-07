#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envContent = readFileSync(resolve(__dirname, '../../.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const CID = '5a994a12-8364-4320-ac35-e93f81edcf10';

const { data, error } = await sb.from('at_credentials')
  .select('*')
  .eq('client_id', CID)
  .maybeSingle();

if (error) console.log('ERROR:', error.message);
if (!data) { console.log('NO ROW FOUND'); process.exit(0); }

const keys = Object.keys(data);
console.log('Columns:', keys.join(', '));
const summary = {};
for (const k of keys) {
  const v = data[k];
  if (v === null || v === undefined) summary[k] = null;
  else if (typeof v === 'string' && v.length > 30) summary[k] = v.slice(0, 20) + '...[' + v.length + ' chars]';
  else summary[k] = v;
}
console.log(JSON.stringify(summary, null, 2));
