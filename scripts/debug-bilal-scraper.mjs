#!/usr/bin/env node
// Pulls Bilal's 5 most recent at_sync_history rows with FULL metadata
// so we can see which endpoint the Playwright scraper hit, what params,
// what it returned, and which source (SOAP/SIRE/scraper) delivered the
// 4 invoices already in the DB.

import { getSupabaseClient } from './_env.mjs';
const s = getSupabaseClient();

const BILAL = '5a994a12-8364-4320-ac35-e93f81edcf10';

// 1. History — full metadata blob
const { data: hist } = await s
  .from('at_sync_history')
  .select('id, created_at, sync_type, start_date, end_date, status, reason_code, records_imported, records_skipped, invoices_returned_by_at, error_message, metadata')
  .eq('client_id', BILAL)
  .order('created_at', { ascending: false })
  .limit(5);

for (const r of hist ?? []) {
  console.log('\n========================================');
  console.log(`id=${r.id} created=${r.created_at} range=${r.start_date}..${r.end_date}`);
  console.log(`type=${r.sync_type} status=${r.status} reason=${r.reason_code ?? '—'}`);
  console.log(`imported=${r.records_imported} skipped=${r.records_skipped} returned_by_at=${r.invoices_returned_by_at ?? 'NULL'}`);
  if (r.error_message) console.log(`err=${r.error_message}`);
  const m = r.metadata ?? {};
  console.log(`method=${m.method} cred_source=${m.credentialSource} username_kind=${m.usernameKind}`);
  if (m.directions) {
    for (const [dir, info] of Object.entries(m.directions)) {
      console.log(`  [${dir}]`);
      const j = JSON.stringify(info, null, 4);
      j.split('\n').forEach((l) => console.log('    ' + l));
    }
  }
}

// 2. Existing 4 stored invoices — what's their import_source?
console.log('\n\n=== Stored vendas — import_source distribution ===');
const { data: stored } = await s
  .from('sales_invoices')
  .select('document_date, document_type, document_number, atcud, import_source, created_at')
  .eq('client_id', BILAL)
  .gte('document_date', '2026-01-01')
  .order('document_date', { ascending: true });
for (const v of stored ?? []) {
  console.log(`  ${v.document_date} ${v.document_type} ${v.document_number} ATCUD=${v.atcud} src=${v.import_source} created=${v.created_at?.slice(0, 19)}`);
}

// 3. Credential state
console.log('\n=== at_credentials (safe fields) ===');
const { data: cred } = await s
  .from('at_credentials')
  .select('portal_nif, environment, subuser_id, last_sync_at, last_sync_status, last_sync_error, consecutive_failures, encrypted_username, encrypted_password')
  .eq('client_id', BILAL)
  .single();
if (cred) {
  console.log(`portal_nif=${cred.portal_nif} env=${cred.environment} subuser_id=${cred.subuser_id ?? 'null'}`);
  console.log(`last_status=${cred.last_sync_status} consecutive_failures=${cred.consecutive_failures}`);
  console.log(`encrypted_username_shape=${cred.encrypted_username ? `len=${cred.encrypted_username.length}` : 'null'} encrypted_password_shape=${cred.encrypted_password ? `len=${cred.encrypted_password.length}` : 'null'}`);
}
