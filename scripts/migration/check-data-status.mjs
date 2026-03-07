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

async function run() {
  const queries = await Promise.all([
    sb.from('sales_invoices').select('id', {count:'exact',head:true}).eq('client_id', CID).eq('document_type', 'FR'),
    sb.from('sales_invoices').select('id', {count:'exact',head:true}).eq('client_id', CID),
    sb.from('tax_withholdings').select('id', {count:'exact',head:true}).eq('client_id', CID),
    sb.from('invoices').select('id', {count:'exact',head:true}).eq('client_id', CID).eq('status', 'pending'),
    sb.from('invoices').select('id', {count:'exact',head:true}).eq('client_id', CID).eq('status', 'classified'),
    sb.from('invoices').select('id', {count:'exact',head:true}).eq('client_id', CID).eq('status', 'validated'),
    sb.from('ss_declarations').select('id', {count:'exact',head:true}).eq('client_id', CID),
    sb.from('revenue_entries').select('id', {count:'exact',head:true}).eq('client_id', CID),
    sb.from('at_withholding_candidates').select('id', {count:'exact',head:true}).eq('client_id', CID),
    sb.from('sales_invoices').select('id', {count:'exact',head:true}).eq('client_id', CID).not('revenue_category', 'is', null),
  ]);

  console.log(JSON.stringify({
    recibos_verdes_FR: queries[0].count || 0,
    total_sales: queries[1].count || 0,
    tax_withholdings: queries[2].count || 0,
    invoices_pending: queries[3].count || 0,
    invoices_classified: queries[4].count || 0,
    invoices_validated: queries[5].count || 0,
    ss_declarations: queries[6].count || 0,
    revenue_entries: queries[7].count || 0,
    withholding_candidates: queries[8].count || 0,
    sales_with_category: queries[9].count || 0,
  }, null, 2));
}

run().catch(e => console.error(e.message));
