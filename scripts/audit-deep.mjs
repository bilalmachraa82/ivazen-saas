/**
 * audit-deep.mjs — Deep audit of AT credential chain
 * Investigating: who is accountant 139245bb? Why no sales for Maria Tereza?
 * Why only 12 sales for Rafael? What's the actual sync status?
 */
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://dmprkdvkzzjtixlatnlx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcHJrZHZrenpqdGl4bGF0bmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0NDc1NiwiZXhwIjoyMDg3MDIwNzU2fQ.N1NlcwgzsJ7ZZ-xpN29Xvr79vUZMUaY5QZFWjZHNWIY',
  { auth: { persistSession: false } }
);

const ADELIA_ID = '19e06b6c-7b8f-4281-ac1c-1d39ab39192c';
const MYSTERY_ACCOUNTANT = '139245bb-9749-49c6-8679-18ea7c5b1401';
const RAFAEL_ID = 'f1c74244-ccbc-4140-9224-9df9472a345c';
const MARIA_ID = '75e5b973-6b8f-47ba-a1bb-c6988eed86e1';
const SEP = '─'.repeat(60);

async function main() {
  // ── 1. Who is accountant 139245bb? ──
  console.log(SEP);
  console.log('1. Quem é o accountant_id 139245bb?');
  console.log(SEP);
  const { data: mystery } = await supabase.from('profiles')
    .select('id, full_name, company_name, email, nif')
    .eq('id', MYSTERY_ACCOUNTANT);
  console.log(JSON.stringify(mystery, null, 2));

  // Check their role
  const { data: roles } = await supabase.from('user_roles')
    .select('*').eq('user_id', MYSTERY_ACCOUNTANT);
  console.log('Roles:', JSON.stringify(roles));

  // Is this Adélia's old ID?
  const { data: adelia } = await supabase.from('profiles')
    .select('id, full_name, email, nif')
    .eq('id', ADELIA_ID);
  console.log('\nAdélia actual:', JSON.stringify(adelia));

  // How many at_credentials are linked to this mystery accountant?
  const { count: mysteryCreds } = await supabase.from('at_credentials')
    .select('*', { count: 'exact', head: true })
    .eq('accountant_id', MYSTERY_ACCOUNTANT);
  console.log(`\nat_credentials com accountant_id=139245bb: ${mysteryCreds}`);

  const { count: adeliaCreds } = await supabase.from('at_credentials')
    .select('*', { count: 'exact', head: true })
    .eq('accountant_id', ADELIA_ID);
  console.log(`at_credentials com accountant_id=Adélia: ${adeliaCreds}`);

  // ── 2. accountant_clients: quem está ligado à Adélia? ──
  console.log('\n' + SEP);
  console.log('2. accountant_clients: clientes da Adélia vs mystery');
  console.log(SEP);

  const { count: adeliaClients } = await supabase.from('accountant_clients')
    .select('*', { count: 'exact', head: true })
    .eq('accountant_id', ADELIA_ID);
  console.log(`Clientes ligados à Adélia: ${adeliaClients}`);

  const { count: mysteryClients } = await supabase.from('accountant_clients')
    .select('*', { count: 'exact', head: true })
    .eq('accountant_id', MYSTERY_ACCOUNTANT);
  console.log(`Clientes ligados ao mystery: ${mysteryClients}`);

  // Check if Rafael/Maria are linked to ANYONE
  const { data: rafaelLinks } = await supabase.from('accountant_clients')
    .select('accountant_id, status, created_at')
    .eq('client_id', RAFAEL_ID);
  console.log(`\nRafael accountant_clients:`, JSON.stringify(rafaelLinks));

  const { data: mariaLinks } = await supabase.from('accountant_clients')
    .select('accountant_id, status, created_at')
    .eq('client_id', MARIA_ID);
  console.log(`Maria accountant_clients:`, JSON.stringify(mariaLinks));

  // ── 3. Rafael: vendas detalhadas ──
  console.log('\n' + SEP);
  console.log('3. Rafael: 12 sales_invoices — detalhe');
  console.log(SEP);

  const { data: rafaelSales } = await supabase.from('sales_invoices')
    .select('fiscal_period, document_date, document_number, total_amount, customer_nif, document_type, status, created_at')
    .eq('client_id', RAFAEL_ID)
    .order('document_date', { ascending: false });
  console.log(`Total: ${rafaelSales?.length}`);
  for (const s of rafaelSales || []) {
    console.log(`  ${s.document_date} | ${s.fiscal_period} | ${s.document_number} | ${s.total_amount}€ | type:${s.document_type} | st:${s.status} | created:${s.created_at?.slice(0,10)}`);
  }

  // Check invoices (purchases) for Rafael
  const { count: rafaelPurchases } = await supabase.from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', RAFAEL_ID);
  console.log(`\nRafael invoices (purchases): ${rafaelPurchases}`);

  // ── 4. Maria Tereza: qualquer dado? ──
  console.log('\n' + SEP);
  console.log('4. Maria Tereza: dados existentes');
  console.log(SEP);

  const { count: mariaSales } = await supabase.from('sales_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', MARIA_ID);
  console.log(`sales_invoices: ${mariaSales}`);

  const { count: mariaPurchases } = await supabase.from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', MARIA_ID);
  console.log(`invoices (purchases): ${mariaPurchases}`);

  // ── 5. AT sync history for these clients ──
  console.log('\n' + SEP);
  console.log('5. at_sync_history (auditoria detalhada)');
  console.log(SEP);

  for (const [name, id] of [['Rafael', RAFAEL_ID], ['Maria', MARIA_ID]]) {
    const { data: history } = await supabase.from('at_sync_history')
      .select('sync_type, status, credential_source, started_at, records_synced, error_message, metadata')
      .eq('client_id', id)
      .order('started_at', { ascending: false })
      .limit(5);
    console.log(`\n${name} (${id}):`);
    if (!history || history.length === 0) {
      console.log('  Sem registos em at_sync_history');
      // Try at_sync_logs
      const { data: logs } = await supabase.from('at_sync_logs')
        .select('*')
        .eq('client_id', id)
        .order('started_at', { ascending: false })
        .limit(5);
      if (logs?.length) {
        console.log('  at_sync_logs:');
        logs.forEach(l => console.log(`  ${l.started_at} ${l.sync_type} ${l.status} recs:${l.records_synced} err:${l.error_message || '-'}`));
      } else {
        console.log('  Sem registos em at_sync_logs também');
      }
    } else {
      history.forEach(h => {
        console.log(`  ${h.started_at?.slice(0,16)} | ${h.sync_type} | ${h.status} | cred:${h.credential_source} | recs:${h.records_synced}`);
        if (h.error_message) console.log(`    err: ${h.error_message.slice(0, 100)}`);
      });
    }
  }

  // ── 6. Check Rafael's at_credentials details (sync dates) ──
  console.log('\n' + SEP);
  console.log('6. at_credentials detalhes para Rafael e Maria');
  console.log(SEP);

  for (const [name, id] of [['Rafael', RAFAEL_ID], ['Maria', MARIA_ID]]) {
    const { data: cred } = await supabase.from('at_credentials')
      .select('id, client_id, accountant_id, nif, sync_enabled, last_sync_at, last_sync_status, created_at, updated_at, consecutive_failures, next_sync_after, portal_nif')
      .eq('client_id', id)
      .single();
    console.log(`\n${name}:`);
    if (cred) {
      console.log(`  nif: ${cred.nif}`);
      console.log(`  portal_nif: ${cred.portal_nif}`);
      console.log(`  sync_enabled: ${cred.sync_enabled}`);
      console.log(`  last_sync_at: ${cred.last_sync_at}`);
      console.log(`  last_sync_status: ${cred.last_sync_status}`);
      console.log(`  consecutive_failures: ${cred.consecutive_failures}`);
      console.log(`  next_sync_after: ${cred.next_sync_after}`);
      console.log(`  accountant_id: ${cred.accountant_id}`);
      console.log(`  created: ${cred.created_at?.slice(0,10)} updated: ${cred.updated_at?.slice(0,10)}`);
    } else {
      console.log('  SEM CREDENCIAL');
    }
  }

  // ── 7. Quick check: does sync-efatura work for these? ──
  console.log('\n' + SEP);
  console.log('7. Tentativa de sync para Rafael (vendas)');
  console.log(SEP);

  // The sync-efatura function needs to be called with the correct parameters
  const { data: syncResult, error: syncErr } = await supabase.functions.invoke('sync-efatura', {
    body: {
      client_id: RAFAEL_ID,
      source: 'manual',
      force: true,
      direction: 'vendas'
    }
  });
  if (syncErr) {
    console.log(`  Erro: ${syncErr.message}`);
    console.log(`  Status: ${syncErr.status}`);
    // Try to get more details
    console.log(`  Details:`, JSON.stringify(syncErr).slice(0, 300));
  } else {
    console.log(`  Resultado:`, JSON.stringify(syncResult).slice(0, 500));
  }

  // Also try for Maria
  console.log('\n  Tentativa sync Maria Tereza (vendas):');
  const { data: syncMaria, error: syncMariaErr } = await supabase.functions.invoke('sync-efatura', {
    body: {
      client_id: MARIA_ID,
      source: 'manual',
      force: true,
      direction: 'vendas'
    }
  });
  if (syncMariaErr) {
    console.log(`  Erro: ${syncMariaErr.message}`);
  } else {
    console.log(`  Resultado:`, JSON.stringify(syncMaria).slice(0, 500));
  }

  // ── 8. Verify fix: does Adélia see these clients? ──
  console.log('\n' + SEP);
  console.log('8. RLS check: que clientes vê a Adélia?');
  console.log(SEP);

  // Count all clients linked to Adélia (both old and new ID)
  const { data: adeliaAllClients } = await supabase.from('accountant_clients')
    .select('client_id, status')
    .eq('accountant_id', ADELIA_ID)
    .limit(5);
  console.log(`Adélia (${ADELIA_ID}): ${adeliaAllClients?.length || 0} primeiros clientes`);

  const { data: mysteryAllClients } = await supabase.from('accountant_clients')
    .select('client_id, status')
    .eq('accountant_id', MYSTERY_ACCOUNTANT)
    .limit(5);
  console.log(`Mystery (${MYSTERY_ACCOUNTANT}): ${mysteryAllClients?.length || 0} primeiros clientes`);

  // Check if Rafael/Maria appear in accountant_clients with ANY accountant
  for (const [name, id] of [['Rafael', RAFAEL_ID], ['Maria', MARIA_ID]]) {
    const { data: allLinks } = await supabase.from('accountant_clients')
      .select('accountant_id, status, created_at')
      .eq('client_id', id);
    console.log(`\n${name} ligado a accountants:`, JSON.stringify(allLinks));
  }
}

main().catch(console.error);
