import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://dmprkdvkzzjtixlatnlx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcHJrZHZrenpqdGl4bGF0bmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0NDc1NiwiZXhwIjoyMDg3MDIwNzU2fQ.N1NlcwgzsJ7ZZ-xpN29Xvr79vUZMUaY5QZFWjZHNWIY',
  { auth: { persistSession: false } }
);

const REAL_ADELIA = '139245bb-9749-49c6-8679-18ea7c5b1401';
const RAFAEL_ID = 'f1c74244-ccbc-4140-9224-9df9472a345c';
const MARIA_ID = '75e5b973-6b8f-47ba-a1bb-c6988eed86e1';

async function main() {
  // 1. Get at_credentials with SELECT * for Rafael
  console.log('=== at_credentials SELECT * for Rafael ===');
  const { data: rafCred, error: rafErr } = await supabase.from('at_credentials')
    .select('*').eq('client_id', RAFAEL_ID);
  if (rafErr) console.log('ERROR:', rafErr.message, rafErr.details);
  if (rafCred?.length) {
    console.log('Columns:', Object.keys(rafCred[0]).join(', '));
    const c = rafCred[0];
    // Print non-encrypted fields
    for (const [k, v] of Object.entries(c)) {
      if (typeof v === 'string' && v.length > 100) continue; // skip encrypted
      console.log(`  ${k}: ${v}`);
    }
  } else {
    console.log('No rows found. Error:', rafErr);
  }

  // 2. Get at_credentials for Maria
  console.log('\n=== at_credentials SELECT * for Maria ===');
  const { data: mariaCred, error: mariaErr } = await supabase.from('at_credentials')
    .select('*').eq('client_id', MARIA_ID);
  if (mariaErr) console.log('ERROR:', mariaErr.message);
  if (mariaCred?.length) {
    const c = mariaCred[0];
    for (const [k, v] of Object.entries(c)) {
      if (typeof v === 'string' && v.length > 100) continue;
      console.log(`  ${k}: ${v}`);
    }
  } else {
    console.log('No rows. Trying by NIF...');
    const { data: byNif } = await supabase.from('at_credentials')
      .select('client_id, nif, sync_enabled, accountant_id')
      .eq('nif', '188551069');
    console.log('By NIF 188551069:', JSON.stringify(byNif));

    // Broader search: select * limit 3 to see table structure
    console.log('\nSample at_credentials (first 2):');
    const { data: sample } = await supabase.from('at_credentials')
      .select('*').limit(2);
    if (sample?.length) {
      console.log('Columns:', Object.keys(sample[0]).join(', '));
    }
  }

  // 3. Check what tables exist for accountant-client relationships
  console.log('\n=== Accountant-client relationship tables ===');

  // Try different possible table names
  const tables = ['accountant_clients', 'accountant_client_links', 'client_accountant', 'client_links'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`✓ ${t} EXISTS — columns: ${data?.length ? Object.keys(data[0]).join(', ') : '(empty)'}`);
    } else {
      console.log(`✗ ${t}: ${error.message.slice(0, 80)}`);
    }
  }

  // 4. How does the app determine which clients belong to an accountant?
  // Check useAccountant or useClientManagement hooks
  // Let's query using the real Adélia ID and check RLS
  console.log('\n=== Clients visible via at_credentials.accountant_id ===');
  const { data: adeliaClientsViaAT, error: atErr } = await supabase.from('at_credentials')
    .select('client_id, nif, sync_enabled')
    .eq('accountant_id', REAL_ADELIA)
    .limit(10);
  console.log(`Adélia clients via at_credentials: ${adeliaClientsViaAT?.length || 0}`);
  if (atErr) console.log('Error:', atErr.message);

  // Get profiles for those client_ids
  if (adeliaClientsViaAT?.length) {
    const clientIds = adeliaClientsViaAT.map(c => c.client_id);
    const { data: clientProfiles } = await supabase.from('profiles')
      .select('id, full_name, nif')
      .in('id', clientIds);
    console.log('\nPrimeiros 10 clientes da Adélia:');
    for (const p of clientProfiles || []) {
      console.log(`  ${p.id} | ${p.full_name} | NIF:${p.nif}`);
    }

    // Check if Rafael is in this list
    const rafaelInList = clientIds.includes(RAFAEL_ID);
    const mariaInList = clientIds.includes(MARIA_ID);
    console.log(`\nRafael nos clientes da Adélia: ${rafaelInList}`);
    console.log(`Maria nos clientes da Adélia: ${mariaInList}`);
  }

  // 5. Check invoices table structure (user_id vs client_id)
  console.log('\n=== invoices table columns ===');
  const { data: invSample, error: invErr } = await supabase.from('invoices')
    .select('*').limit(1);
  if (invErr) console.log('Error:', invErr.message);
  if (invSample?.length) {
    const cols = Object.keys(invSample[0]);
    console.log('Columns:', cols.join(', '));
    const idCols = cols.filter(c => c.includes('user') || c.includes('client') || c.includes('owner'));
    console.log('ID columns:', idCols.join(', '));
  }

  // 6. Rafael purchases with correct column
  console.log('\n=== Rafael purchases ===');
  const { count: rafP1 } = await supabase.from('invoices')
    .select('*', { count: 'exact', head: true }).eq('user_id', RAFAEL_ID);
  const { count: rafP2 } = await supabase.from('invoices')
    .select('*', { count: 'exact', head: true }).eq('client_id', RAFAEL_ID);
  console.log(`invoices where user_id=Rafael: ${rafP1}`);
  console.log(`invoices where client_id=Rafael: ${rafP2}`);

  // 7. Total at_credentials count and check if Rafael/Maria are really in there
  console.log('\n=== Full at_credentials search for Rafael/Maria NIFs ===');
  const { data: allCreds } = await supabase.from('at_credentials')
    .select('client_id, nif')
    .in('nif', ['211655864', '188551069']);
  console.log('Credentials by NIF:', JSON.stringify(allCreds));

  // Also search client_id directly from ALL creds
  const { data: allCredClients } = await supabase.from('at_credentials')
    .select('client_id, nif')
    .in('client_id', [RAFAEL_ID, MARIA_ID]);
  console.log('Credentials by client_id:', JSON.stringify(allCredClients));

  // 8. Check sync-efatura logs via edge function with verbose
  console.log('\n=== Calling sync-efatura for Rafael with more detail ===');
  try {
    const resp = await fetch(`https://dmprkdvkzzjtixlatnlx.supabase.co/functions/v1/sync-efatura`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabase.supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: RAFAEL_ID,
        source: 'manual',
        force: true
      })
    });
    const text = await resp.text();
    console.log(`Status: ${resp.status}`);
    console.log(`Body: ${text.slice(0, 500)}`);
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}

main().catch(console.error);
