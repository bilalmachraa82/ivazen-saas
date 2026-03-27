import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://dmprkdvkzzjtixlatnlx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcHJrZHZrenpqdGl4bGF0bmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0NDc1NiwiZXhwIjoyMDg3MDIwNzU2fQ.N1NlcwgzsJ7ZZ-xpN29Xvr79vUZMUaY5QZFWjZHNWIY',
  { auth: { persistSession: false } }
);

// Adélia's ID (accountant)
const ADELIA_ID = '19e06b6c-7b8f-4281-ac1c-1d39ab39192c';

// 1. Find the CORRECT Rafael Paisano (the one mentioned in the PDF)
console.log('=== RAFAEL PAISANO ===');
const { data: rafaels } = await supabase.from('profiles')
  .select('id, full_name, nif, email, company_name')
  .ilike('full_name', '%Paisano%');
console.log('All Paisano profiles:', JSON.stringify(rafaels, null, 2));

// For each Paisano, check:
for (const r of rafaels || []) {
  console.log(`\n--- ${r.full_name} (${r.id}) NIF:${r.nif} ---`);

  // Check at_credentials
  const { data: creds } = await supabase.from('at_credentials')
    .select('*').eq('client_id', r.id);
  console.log(`at_credentials: ${creds?.length || 0}`, creds?.length ? JSON.stringify(creds[0]) : '');

  // Check accountant_at_config
  const { data: atCfg } = await supabase.from('accountant_at_config')
    .select('*').eq('client_id', r.id);
  console.log(`accountant_at_config: ${atCfg?.length || 0}`, atCfg?.length ? JSON.stringify(atCfg[0]) : '');

  // Check sales_invoices count
  const { count } = await supabase.from('sales_invoices')
    .select('*', { count: 'exact', head: true }).eq('client_id', r.id);
  console.log(`sales_invoices: ${count}`);

  // Check if linked to Adélia
  const { data: link } = await supabase.from('accountant_clients')
    .select('*').eq('client_id', r.id);
  console.log(`accountant_clients link: ${link?.length || 0}`, link?.length ? JSON.stringify(link[0]) : '');
}

// 2. Maria Tereza Silva
console.log('\n\n=== MARIA TEREZA SILVA ===');
const MARIA_ID = '75e5b973-6b8f-47ba-a1bb-c6988eed86e1';
const { data: mariaCreds } = await supabase.from('at_credentials')
  .select('*').eq('client_id', MARIA_ID);
console.log('at_credentials:', JSON.stringify(mariaCreds, null, 2));

const { data: mariaAtCfg } = await supabase.from('accountant_at_config')
  .select('*').eq('client_id', MARIA_ID);
console.log('accountant_at_config:', JSON.stringify(mariaAtCfg, null, 2));

const { data: mariaLink } = await supabase.from('accountant_clients')
  .select('*').eq('client_id', MARIA_ID);
console.log('accountant_clients:', JSON.stringify(mariaLink, null, 2));

// Check by NIF in at_credentials (maybe client_id is wrong)
const { data: mariaNifCreds } = await supabase.from('at_credentials')
  .select('*').eq('nif', '188551069');
console.log('at_credentials by NIF 188551069:', JSON.stringify(mariaNifCreds, null, 2));

// 3. Check ALL accountant_at_config for Adélia to see which clients are configured
console.log('\n\n=== ADÉLIA ACCOUNTANT_AT_CONFIG (first 30) ===');
const { data: allAtConfig } = await supabase.from('accountant_at_config')
  .select('id, client_id, nif, created_at, updated_at')
  .eq('accountant_id', ADELIA_ID)
  .limit(30);
console.log(`Total configs: ${allAtConfig?.length || 0}`);
// Also count total
const { count: totalConfigs } = await supabase.from('accountant_at_config')
  .select('*', { count: 'exact', head: true })
  .eq('accountant_id', ADELIA_ID);
console.log(`Total configs (count): ${totalConfigs}`);

// 4. Check at_credentials table structure
console.log('\n\n=== AT_CREDENTIALS SAMPLE ===');
const { data: sampleCreds } = await supabase.from('at_credentials')
  .select('id, client_id, nif, sync_enabled, created_at')
  .limit(3);
console.log(JSON.stringify(sampleCreds, null, 2));

// 5. Total credentials
const { count: totalCreds } = await supabase.from('at_credentials')
  .select('*', { count: 'exact', head: true });
console.log(`\nTotal at_credentials rows: ${totalCreds}`);

// 6. Check if accountant_id field exists on at_credentials
const { data: adeliaCreds } = await supabase.from('at_credentials')
  .select('id, client_id, nif')
  .limit(1);
console.log('Sample credential columns:', Object.keys(adeliaCreds?.[0] || {}));

// 7. Check at_sync_logs for Rafael's NIF directly
console.log('\n\n=== AT SYNC LOGS BY NIF ===');
for (const r of rafaels || []) {
  if (!r.nif) continue;
  const { data: logs } = await supabase.from('at_sync_logs')
    .select('client_id, sync_type, status, started_at, records_synced, error_message')
    .eq('client_id', r.id)
    .order('started_at', { ascending: false })
    .limit(3);
  console.log(`${r.full_name} (${r.nif}): ${logs?.length || 0} logs`);
  (logs || []).forEach(l => console.log(`  ${l.started_at} ${l.status} ${l.records_synced} ${l.error_message || ''}`));
}
