#!/usr/bin/env node
/**
 * Fix Profiles: Re-import real profile data from CSV
 *
 * Problem: supabase.auth.admin.createUser() auto-creates profiles with full_name=email.
 * The original migration used ignoreDuplicates:true which SKIPPED the real CSV data.
 * This script uses .update() to overwrite the email-based names with real data.
 *
 * Also deletes the duplicate bilal.machra@gmail.com (single-a) account.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/migration/fix-profiles.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const SUPABASE_URL = "https://dmprkdvkzzjtixlatnlx.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" },
});

// Duplicate user to delete (bilal.machra@gmail.com — single 'a')
const DUPLICATE_USER_ID = "6149d5ca-27c3-467a-b423-8d26b339c5e2";

// ─── CSV Parser (from run-migration.mjs) ─────────────────

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

function parseCSV(csvText) {
  const lines = csvText.split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };

  let headerLine = lines[0];
  if (headerLine.charCodeAt(0) === 0xfeff) headerLine = headerLine.slice(1);

  const headers = parseCSVLine(headerLine);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      let val = values[j];
      if (val === "" || val === "NULL" || val === "null") {
        row[headers[j]] = null;
      } else if (val === "true") {
        row[headers[j]] = true;
      } else if (val === "false") {
        row[headers[j]] = false;
      } else {
        row[headers[j]] = val;
      }
    }
    rows.push(row);
  }

  return { headers, rows };
}

// ─── Load ID Mappings ────────────────────────────────────

function loadIdMappings(path) {
  const text = readFileSync(path, "utf-8");
  const map = new Map();

  for (const line of text.split("\n")) {
    // Format: "old_uuid → new_uuid"
    const match = line.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*→\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/
    );
    if (match) {
      map.set(match[1], match[2]);
    }
  }

  return map;
}

// ─── Fields to update ────────────────────────────────────

const NUMERIC_FIELDS = new Set([
  "other_employment_salary",
  "ss_contribution_rate",
  "taxable_profit",
]);

const UPDATE_FIELDS = [
  "full_name",
  "company_name",
  "nif",
  "niss",
  "address",
  "phone",
  "accountant_id",
  "vat_regime",
  "worker_type",
  "accounting_regime",
  "activity_description",
  "cae",
  "at_contact_email",
  "has_accountant_ss",
  "has_other_employment",
  "is_first_year",
  "last_ss_declaration",
  "other_employment_salary",
  "ss_contribution_rate",
  "taxable_profit",
];

// ─── Task 1: Fix Profiles ────────────────────────────────

async function fixProfiles(csvDir, idMapping) {
  console.log("\n══════════════════════════════════════════");
  console.log("  TASK 1: Re-import profiles from CSV");
  console.log("══════════════════════════════════════════\n");

  const csvPath = join(csvDir, "profiles.csv");
  const csvText = readFileSync(csvPath, "utf-8");
  const { headers, rows } = parseCSV(csvText);

  console.log(`  Parsed ${rows.length} profile rows from CSV`);
  console.log(`  ID mappings loaded: ${idMapping.size}\n`);

  let updated = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const oldId = row.id;
    const newId = idMapping.get(oldId) || oldId;

    // Skip the duplicate user — will be deleted in Task 2
    if (newId === DUPLICATE_USER_ID) {
      console.log(`  SKIP: ${row.email} (duplicate, will be deleted)`);
      skipped++;
      continue;
    }

    // Remap accountant_id
    if (row.accountant_id) {
      row.accountant_id = idMapping.get(row.accountant_id) || row.accountant_id;
    }

    // Build update payload with only fields that exist in the CSV
    const payload = {};
    for (const field of UPDATE_FIELDS) {
      if (!(field in row)) continue;

      let value = row[field];

      // Convert numeric fields
      if (NUMERIC_FIELDS.has(field) && value !== null) {
        value = parseFloat(value);
        if (isNaN(value)) value = null;
      }

      payload[field] = value;
    }

    // Skip if no meaningful data to update
    if (Object.values(payload).every((v) => v === null || v === undefined)) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", newId);

    if (error) {
      console.error(`  ERROR [${row.email}]: ${error.message}`);
      errors++;
    } else {
      const name = payload.full_name || payload.company_name || "(no name)";
      if (updated < 10 || updated % 50 === 0) {
        console.log(`  OK: ${row.email} → "${name}"`);
      }
      updated++;
    }
  }

  console.log(`\n  Summary: ${updated} updated, ${skipped} skipped, ${errors} errors`);
  return { updated, skipped, errors };
}

// ─── Task 2: Delete Duplicate User ───────────────────────

async function deleteDuplicateUser() {
  console.log("\n══════════════════════════════════════════");
  console.log("  TASK 2: Delete bilal.machra@gmail.com");
  console.log("══════════════════════════════════════════\n");

  const userId = DUPLICATE_USER_ID;
  console.log(`  Target: ${userId}\n`);

  // 1. Delete user_roles
  const { error: rolesErr, count: rolesCount } = await supabase
    .from("user_roles")
    .delete({ count: "exact" })
    .eq("user_id", userId);
  console.log(`  user_roles: ${rolesErr ? `ERROR: ${rolesErr.message}` : `${rolesCount ?? 0} deleted`}`);

  // 2. Delete client_accountants (as client or accountant)
  const { error: caClientErr, count: caClientCount } = await supabase
    .from("client_accountants")
    .delete({ count: "exact" })
    .eq("client_id", userId);
  console.log(`  client_accountants (as client): ${caClientErr ? `ERROR: ${caClientErr.message}` : `${caClientCount ?? 0} deleted`}`);

  const { error: caAcctErr, count: caAcctCount } = await supabase
    .from("client_accountants")
    .delete({ count: "exact" })
    .eq("accountant_id", userId);
  console.log(`  client_accountants (as accountant): ${caAcctErr ? `ERROR: ${caAcctErr.message}` : `${caAcctCount ?? 0} deleted`}`);

  // 2b. Reassign profiles that reference this user as accountant_id
  const CORRECT_BILAL_ID = "5a994a12-8364-4320-ac35-e93f81edcf10";
  const { error: reassignErr, count: reassignCount } = await supabase
    .from("profiles")
    .update({ accountant_id: CORRECT_BILAL_ID }, { count: "exact" })
    .eq("accountant_id", userId);
  console.log(`  profiles accountant_id reassigned: ${reassignErr ? `ERROR: ${reassignErr.message}` : `${reassignCount ?? 0} updated`}`);

  // 3. Delete profile
  const { error: profileErr } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);
  console.log(`  profiles: ${profileErr ? `ERROR: ${profileErr.message}` : "deleted"}`);

  // 4. Delete auth user
  const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
  console.log(`  auth.users: ${authErr ? `ERROR: ${authErr.message}` : "deleted"}`);

  if (!rolesErr && !caClientErr && !caAcctErr && !profileErr && !authErr) {
    console.log("\n  User fully removed.");
  } else {
    console.log("\n  Some deletions had errors — check above.");
  }
}

// ─── Task 3: Verify ─────────────────────────────────────

async function verify() {
  console.log("\n══════════════════════════════════════════");
  console.log("  TASK 3: Verification");
  console.log("══════════════════════════════════════════\n");

  // Check profiles with real names vs email-as-name
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, company_name, nif")
    .limit(500);

  if (profErr) {
    console.error(`  Error fetching profiles: ${profErr.message}`);
    return;
  }

  let withRealName = 0;
  let stillEmailName = 0;
  const emailNameSamples = [];

  for (const p of profiles) {
    const name = p.full_name || "";
    const isEmailName = name.includes("@") || name === "";
    if (isEmailName) {
      stillEmailName++;
      if (emailNameSamples.length < 5) emailNameSamples.push(p.email);
    } else {
      withRealName++;
    }
  }

  console.log(`  Profiles with real names: ${withRealName}`);
  console.log(`  Profiles still showing email: ${stillEmailName}`);
  if (emailNameSamples.length > 0) {
    console.log(`  Sample email-named profiles: ${emailNameSamples.join(", ")}`);
  }

  // Check key users
  console.log("\n  Key user checks:");

  // bilal.machraa@gmail.com (admin)
  const { data: bilal } = await supabase
    .from("profiles")
    .select("id, email, full_name, nif")
    .eq("id", "5a994a12-8364-4320-ac35-e93f81edcf10")
    .single();
  console.log(`  bilal.machraa: ${bilal ? `name="${bilal.full_name}", nif=${bilal.nif}` : "NOT FOUND"}`);

  // Verify duplicate is gone
  const { data: dup } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", DUPLICATE_USER_ID)
    .single();
  console.log(`  bilal.machra (duplicate): ${dup ? "STILL EXISTS!" : "deleted (good)"}`);

  // Check an accountant (adelia.gaspar)
  const { data: adelia } = await supabase
    .from("profiles")
    .select("id, email, full_name, company_name")
    .ilike("email", "%adelia.gaspar%")
    .single();
  if (adelia) {
    console.log(`  adelia.gaspar: name="${adelia.full_name}", company="${adelia.company_name}"`);

    // Check how many clients she has
    const { count: clientCount } = await supabase
      .from("client_accountants")
      .select("*", { count: "exact", head: true })
      .eq("accountant_id", adelia.id);
    console.log(`  adelia.gaspar clients: ${clientCount ?? "unknown"}`);
  }

  // Total counts
  const { count: totalProfiles } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });
  const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  console.log(`\n  Total profiles: ${totalProfiles}`);
  console.log(`  Total auth users: ${allUsers?.users?.length ?? "unknown"}`);
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const baseDir = join(process.cwd(), "scripts/migration");
  const csvDir = join(baseDir, "csv");
  const mappingsPath = "/tmp/id_mappings.txt";

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  IVAzen — Fix Profiles & Cleanup         ║");
  console.log("╚══════════════════════════════════════════╝");

  // Load ID mappings
  const idMapping = loadIdMappings(mappingsPath);
  console.log(`\n  Loaded ${idMapping.size} ID mappings from ${mappingsPath}`);

  // Task 1: Fix profiles
  await fixProfiles(csvDir, idMapping);

  // Task 2: Delete duplicate user
  await deleteDuplicateUser();

  // Task 3: Verify
  await verify();

  console.log("\n  Done! Check the output above for any issues.");
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});
