#!/usr/bin/env node
/**
 * Test Recibos Verdes Sync
 *
 * Tests the full flow:
 * 1. Check AT credentials exist
 * 2. Call sync-recibos-verdes edge function
 * 3. Verify sales_invoices with document_type 'FR'
 *
 * Usage:
 *   node scripts/migration/test-recibos-sync.mjs [--direct]
 *
 * Options:
 *   --direct  Test the AT connector directly (bypasses edge function)
 */
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

const BASE = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const AT_CONNECTOR_URL = process.env.AT_CONNECTOR_URL;
const AT_CONNECTOR_TOKEN = process.env.AT_CONNECTOR_TOKEN;

if (!BASE || !KEY) { console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1); }

const supabase = createClient(BASE, KEY);
const headers = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const CLIENT_ID = '5a994a12-8364-4320-ac35-e93f81edcf10';
const isDirect = process.argv.includes('--direct');

async function run() {
  // Step 1: Check credentials
  console.log('=== STEP 1: Check AT credentials ===\n');

  const { data: creds } = await supabase
    .from('at_credentials')
    .select('portal_nif, portal_password_encrypted, encrypted_password, last_sync_status, last_sync_at')
    .eq('client_id', CLIENT_ID)
    .limit(1);

  if (!creds || creds.length === 0) {
    console.log('NO credentials found. Run test-vendas-sync.mjs with password first.');
    return;
  }

  const c = creds[0];
  console.log('  portal_nif:', c.portal_nif || 'NULL');
  console.log('  has portal_password_encrypted:', !!c.portal_password_encrypted);
  console.log('  has encrypted_password:', !!c.encrypted_password);
  console.log('  last_sync_status:', c.last_sync_status || 'N/A');
  console.log('  last_sync_at:', c.last_sync_at || 'never');

  // Step 2: Test sync
  if (isDirect && AT_CONNECTOR_URL && AT_CONNECTOR_TOKEN) {
    console.log('\n=== STEP 2: Direct AT connector test ===\n');

    // We can't decrypt the password from here, but we can test if the endpoint exists
    const healthResp = await fetch(`${AT_CONNECTOR_URL}/health`, {
      headers: { 'Authorization': `Bearer ${AT_CONNECTOR_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const healthData = await healthResp.json();
    console.log('Connector health:', healthData.status, '| Version:', healthData.version);
    console.log('Note: Direct test requires plaintext password. Use edge function instead.\n');
  }

  console.log('\n=== STEP 2: Call sync-recibos-verdes edge function ===\n');

  try {
    const syncResp = await fetch(`${BASE}/functions/v1/sync-recibos-verdes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: CLIENT_ID,
        startDate: '2025-01-01',
        endDate: '2026-03-07',
        source: 'manual',
        force: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    const syncText = await syncResp.text();
    console.log(`Sync HTTP ${syncResp.status}:`);
    try {
      const syncData = JSON.parse(syncText);
      console.log(JSON.stringify(syncData, null, 2));

      if (syncData.success && syncData.inserted > 0) {
        console.log(`\nSUCCESS: ${syncData.inserted} recibos verdes imported!`);
      } else if (syncData.reasonCode === 'AT_EMPTY_LIST') {
        console.log('\nAT returned empty list — no recibos verdes in this period');
      } else if (syncData.reasonCode === 'AT_AUTH_FAILED') {
        console.log('\nAuth failed — credentials missing or incorrect');
      } else if (syncData.reasonCode === 'AT_TIME_WINDOW') {
        console.log('\nOutside AT time window (use force: true with service-role)');
      } else {
        console.log('\nResult:', syncData.reasonCode || syncData.error || 'unknown');
      }
    } catch {
      console.log(syncText.slice(0, 1000));
    }
  } catch (err) {
    console.log('Edge function call failed:', err.message);
    console.log('\nNote: sync-recibos-verdes edge function may need to be deployed first:');
    console.log('  supabase functions deploy sync-recibos-verdes');
  }

  // Step 3: Check sales_invoices for FR documents
  console.log('\n=== STEP 3: Check recibos verdes (FR) in sales_invoices ===\n');

  const { count: frCount } = await supabase
    .from('sales_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', CLIENT_ID)
    .eq('document_type', 'FR');

  console.log(`Recibos verdes (FR) for client: ${frCount || 0}`);

  if (frCount > 0) {
    const { data: sample } = await supabase
      .from('sales_invoices')
      .select('document_date, document_type, total_amount, customer_nif, customer_name, status')
      .eq('client_id', CLIENT_ID)
      .eq('document_type', 'FR')
      .order('document_date', { ascending: false })
      .limit(5);

    console.log('Latest 5 recibos verdes:');
    (sample || []).forEach(s => {
      console.log(`  ${s.document_date} | ${s.document_type} | €${Number(s.total_amount).toFixed(2)} | ${s.customer_nif || 'N/A'} | ${s.customer_name || 'N/A'} | ${s.status}`);
    });
  }

  // Also check total sales invoices
  const { count: totalSales } = await supabase
    .from('sales_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', CLIENT_ID);

  console.log(`\nTotal sales invoices for client: ${totalSales || 0}`);
}

run().catch(e => console.error('Fatal:', e));
