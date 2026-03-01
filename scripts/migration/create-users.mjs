#!/usr/bin/env node
/**
 * Create users with preserved UUIDs from Lovable Cloud
 *
 * Usage:
 *   1. Export user list from Lovable Cloud > Users tab
 *   2. Create a users.json file in scripts/migration/ with format:
 *      [
 *        { "id": "uuid-from-lovable", "email": "user@example.com" },
 *        { "id": "uuid-from-lovable", "email": "other@example.com" }
 *      ]
 *   3. Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migration/create-users.mjs
 *
 * Each user gets a temporary password and should reset via email.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const usersPath = join(process.cwd(), "scripts/migration/users.json");

  if (!existsSync(usersPath)) {
    console.error("users.json not found at:", usersPath);
    console.error("\nCreate it with this format:");
    console.error(JSON.stringify([
      { id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", email: "user@example.com" },
    ], null, 2));
    process.exit(1);
  }

  const users = JSON.parse(readFileSync(usersPath, "utf-8"));
  console.log(`Creating ${users.length} users with preserved UUIDs...\n`);

  const tempPassword = "IVAzen-Temp-2026!";
  let created = 0;
  let errors = 0;

  for (const user of users) {
    if (!user.id || !user.email) {
      console.error(`  SKIP: Missing id or email:`, user);
      errors++;
      continue;
    }

    // Use admin API to create user with specific UUID
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: tempPassword,
      email_confirm: true, // skip email verification
      user_metadata: {
        migrated_from: "lovable_cloud",
        migration_date: new Date().toISOString(),
      },
    });

    if (error) {
      // Check if user already exists
      if (error.message.includes("already been registered")) {
        console.log(`  EXISTS: ${user.email} — already in new project`);

        // Check if the ID matches
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u) => u.email === user.email);
        if (existing && existing.id !== user.id) {
          console.warn(`  WARNING: ${user.email} has DIFFERENT ID!`);
          console.warn(`    Old: ${user.id}`);
          console.warn(`    New: ${existing.id}`);
          console.warn(`    You'll need to update all tables with the new ID.`);
        }
      } else {
        console.error(`  ERROR: ${user.email}:`, error.message);
        errors++;
      }
      continue;
    }

    // If created with different ID, we need to note the mapping
    if (data.user && data.user.id !== user.id) {
      console.warn(`  CREATED: ${user.email} but with NEW ID (mapping needed):`);
      console.warn(`    Old: ${user.id} → New: ${data.user.id}`);
    } else {
      console.log(`  OK: ${user.email} (${user.id})`);
    }
    created++;
  }

  console.log(`\n========== USER CREATION SUMMARY ==========`);
  console.log(`  Created: ${created}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${users.length}`);
  console.log(`\n  Temporary password: ${tempPassword}`);
  console.log(`  Users should change their password after first login.`);
  console.log(`\n  To send password reset emails to ALL users:`);
  console.log(`  node -e "/* see script below */"`);

  // Note about ID preservation
  console.log(`\n  IMPORTANT: Supabase admin.createUser does NOT allow specifying the UUID.`);
  console.log(`  If user IDs changed, you'll need to run ID mapping queries.`);
  console.log(`  The import-csvs.mjs script handles data with the ORIGINAL IDs.`);
  console.log(`  After import, run the id-mapping SQL to update references.`);
}

main().catch(console.error);
