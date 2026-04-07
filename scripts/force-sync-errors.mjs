import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

let env = '';
try { env = readFileSync('.env', 'utf8'); } catch {}
env.split('\n').forEach(l => {
  const m = l.match(/^(\w+)=["']?(.+?)["']?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function callEdgeFunction(functionName, body) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: resp.status, text: text.slice(0, 500), json };
}

async function run() {
  const { data: creds } = await supabase.from('at_credentials')
    .select('id, client_id, portal_nif, last_sync_status, last_sync_error')
    .in('last_sync_status', ['error', 'failed', 'partial', 'partial_success']);

  console.log(`Found ${creds?.length || 0} credentials in error/partial status.`);

  for (const c of creds || []) {
    console.log(`\n=== Forcing sync-efatura for client ${c.client_id} (NIF: ${c.portal_nif}) ===`);
    const r1 = await callEdgeFunction('sync-efatura', {
      clientId: c.client_id,
      source: 'manual',
      force: true
    });
    console.log(`sync-efatura status: ${r1.status}`);

    console.log(`=== Forcing sync-recibos-verdes for client ${c.client_id} ===`);
    const r2 = await callEdgeFunction('sync-recibos-verdes', {
      clientId: c.client_id,
      source: 'manual',
      force: true
    });
    console.log(`sync-recibos-verdes status: ${r2.status}`);
  }
}
run();
