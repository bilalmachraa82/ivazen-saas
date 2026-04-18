#!/usr/bin/env node
import { getSupabaseClient } from './_env.mjs';
const s = getSupabaseClient();

const TARGETS = [
  { name: 'Bilal', id: '5a994a12-8364-4320-ac35-e93f81edcf10' },
  { name: 'Helene', id: 'af826459-7260-4b3c-9b97-08077299e356' },
  { name: 'Majda', id: '918dde3c-b33d-4e65-94df-53a0a3a79c38' },
];

for (const t of TARGETS) {
  const { data: c } = await s
    .from('at_credentials')
    .select('portal_nif, portal_password_encrypted, encrypted_username, encrypted_password, subuser_id, environment, last_sync_status')
    .eq('client_id', t.id)
    .single();
  if (!c) {
    console.log(`${t.name}: NO CREDENTIAL`);
    continue;
  }
  const fmt = (v) => (v ? `set(len=${v.length})` : 'NULL');
  console.log(
    `${t.name}: portal_nif=${c.portal_nif ?? 'NULL'} portal_pwd=${fmt(c.portal_password_encrypted)} enc_user=${fmt(c.encrypted_username)} enc_pwd=${fmt(c.encrypted_password)} subuser=${c.subuser_id ?? 'NULL'} env=${c.environment} last_status=${c.last_sync_status}`,
  );
}
