#!/usr/bin/env node
/**
 * Generate password recovery links for accountant users.
 * Links can be sent manually (WhatsApp, email, etc.) without SMTP.
 *
 * Usage:
 *   node scripts/migration/generate-recovery-links.mjs                    # dry-run
 *   node scripts/migration/generate-recovery-links.mjs --apply            # generate links for all accountants
 *   node scripts/migration/generate-recovery-links.mjs --email someone@x  # single user
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, '../../.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env optional */ }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = 'https://ivazen.aitipro.com';
const DRY_RUN = !process.argv.includes('--apply');
const SINGLE_EMAIL = process.argv.includes('--email')
  ? process.argv[process.argv.indexOf('--email') + 1]
  : null;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function getAccountants() {
  // Get all users with accountant role
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_roles?select=user_id,role&role=eq.accountant`,
    { headers }
  );
  const roles = await res.json();
  const accountantIds = new Set(roles.map(r => r.user_id));

  // Get user details
  const allUsers = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`,
      { headers }
    );
    const data = await res.json();
    const users = data.users || [];
    allUsers.push(...users);
    if (users.length < 100) break;
    page++;
  }

  return allUsers.filter(u => accountantIds.has(u.id));
}

async function generateRecoveryLink(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'recovery',
      email,
      options: { redirect_to: `${SITE_URL}/settings` },
    }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.action_link;
}

async function main() {
  console.log(`\nPassword Recovery Link Generator`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}\n`);

  let targets;
  if (SINGLE_EMAIL) {
    targets = [{ email: SINGLE_EMAIL, id: 'single' }];
  } else {
    console.log('Fetching accountant users...');
    targets = await getAccountants();
    console.log(`Found ${targets.length} accountants\n`);
  }

  if (DRY_RUN && !SINGLE_EMAIL) {
    console.log('Accountants:');
    for (const u of targets) {
      console.log(`  ${u.email}`);
    }
    console.log(`\nRun with --apply to generate links, or --email user@x for one user.`);
    return;
  }

  console.log('Recovery Links (valid ~24h, share via WhatsApp/email):');
  console.log('='.repeat(80));

  for (const user of targets) {
    try {
      const link = await generateRecoveryLink(user.email);
      console.log(`\n${user.email}`);
      console.log(`  ${link}`);
    } catch (err) {
      console.error(`\nERROR ${user.email}: ${err.message}`);
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(80));
  console.log('Done. Send these links to the accountants.');
  console.log('After clicking, they will be asked to set a new password.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
