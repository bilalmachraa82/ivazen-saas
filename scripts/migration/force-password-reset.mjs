#!/usr/bin/env node
/**
 * Force password reset for all migrated users.
 *
 * Invalidates the shared temporary password (IVAzen-Temp-2026!) by:
 * 1. Setting each user's password to a unique random string
 * 2. Optionally sending a recovery email so users can set their own password
 *
 * Usage:
 *   node scripts/migration/force-password-reset.mjs              # dry-run (default)
 *   node scripts/migration/force-password-reset.mjs --apply       # reset passwords
 *   node scripts/migration/force-password-reset.mjs --apply --send-email  # reset + send recovery email
 *
 * Environment variables (from .env):
 *   VITE_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_KEY  — Supabase service role key
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

// ── Load .env ──────────────────────────────────────────────
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

// ── Config ─────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = !process.argv.includes('--apply');
const SEND_EMAIL = process.argv.includes('--send-email');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const ADMIN_API = `${SUPABASE_URL}/auth/v1/admin`;
const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// ── Helpers ────────────────────────────────────────────────
function generatePassword() {
  return randomBytes(24).toString('base64url'); // 32-char random password
}

async function fetchAllUsers() {
  const allUsers = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(`${ADMIN_API}/users?page=${page}&per_page=${perPage}`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to list users (page ${page}): ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const users = data.users || [];
    allUsers.push(...users);
    if (users.length < perPage) break;
    page++;
  }
  return allUsers;
}

async function updatePassword(userId, newPassword) {
  const res = await fetch(`${ADMIN_API}/users/${userId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password: newPassword }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update ${userId}: ${res.status} ${text}`);
  }
  return res.json();
}

async function sendRecoveryEmail(email) {
  const res = await fetch(`${ADMIN_API}/generate_link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'recovery',
      email,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send recovery to ${email}: ${res.status} ${text}`);
  }
  return res.json();
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  console.log(`\n🔑 Force Password Reset for Migrated Users`);
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (use --apply to execute)' : 'LIVE'}`);
  console.log(`   Send recovery email: ${SEND_EMAIL ? 'YES' : 'NO (use --send-email to enable)'}\n`);

  // Fetch all users
  console.log('Fetching users...');
  const users = await fetchAllUsers();
  console.log(`Found ${users.length} total users\n`);

  // Skip admin/system accounts — only target email provider accounts
  const targets = users.filter(u => {
    const providers = u.app_metadata?.providers || [];
    return providers.includes('email');
  });

  console.log(`Targeting ${targets.length} email-provider users for password reset`);

  // Exclude the super admin from forced reset
  const SUPER_ADMIN = 'bilal.machraa@gmail.com';
  const toReset = targets.filter(u => u.email !== SUPER_ADMIN);
  console.log(`Excluding super admin (${SUPER_ADMIN}): ${toReset.length} users to reset\n`);

  if (DRY_RUN) {
    console.log('--- DRY-RUN: No changes will be made ---');
    console.log(`Sample users (first 10):`);
    for (const u of toReset.slice(0, 10)) {
      console.log(`  ${u.email} (${u.id})`);
    }
    if (toReset.length > 10) {
      console.log(`  ... and ${toReset.length - 10} more`);
    }
    console.log(`\nRun with --apply to execute password resets.`);
    return;
  }

  // Apply password resets
  let successCount = 0;
  let failCount = 0;
  let emailCount = 0;
  const errors = [];

  for (let i = 0; i < toReset.length; i++) {
    const user = toReset[i];
    const newPwd = generatePassword();

    try {
      await updatePassword(user.id, newPwd);
      successCount++;

      if (SEND_EMAIL && user.email) {
        try {
          await sendRecoveryEmail(user.email);
          emailCount++;
        } catch (emailErr) {
          errors.push(`Email failed for ${user.email}: ${emailErr.message}`);
        }
      }

      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${toReset.length} (${successCount} ok, ${failCount} failed)`);
      }
    } catch (err) {
      failCount++;
      errors.push(`${user.email}: ${err.message}`);
    }

    // Rate limit: ~10 req/s
    if ((i + 1) % 10 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Passwords reset: ${successCount}/${toReset.length}`);
  console.log(`Failed: ${failCount}`);
  if (SEND_EMAIL) console.log(`Recovery emails sent: ${emailCount}`);

  if (errors.length > 0) {
    console.log(`\nErrors:`);
    for (const e of errors) console.log(`  - ${e}`);
  }

  console.log(`\nDone. Temporary password "IVAzen-Temp-2026!" is now invalid for all reset users.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
