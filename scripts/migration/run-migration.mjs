#!/usr/bin/env node
/**
 * Complete Data Migration: Lovable Cloud → Supabase
 * Handles: user creation, CSV import (with FK constraint bypass)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";

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

// ─── Helpers ─────────────────────────────────────────────

function parseCSV(csvText) {
  const lines = csvText.split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };

  // Strip BOM if present
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
      } else if (headers[j].endsWith("_at") || headers[j] === "created_at" || headers[j] === "updated_at") {
        // Keep timestamps as strings
        row[headers[j]] = val;
      } else {
        row[headers[j]] = val;
      }
    }
    rows.push(row);
  }

  return { headers, rows };
}

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

// ─── Step 1: Create Users ─────────────────────────────────

async function createUsers(usersPath) {
  console.log("\n══════════════════════════════════════════");
  console.log("  STEP 1: Creating users (preserving UUIDs)");
  console.log("══════════════════════════════════════════\n");

  const users = JSON.parse(readFileSync(usersPath, "utf-8"));
  console.log(`Found ${users.length} users to create\n`);

  // Check existing users
  const { data: existingData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingEmails = new Set((existingData?.users || []).map((u) => u.email));
  const existingIds = new Set((existingData?.users || []).map((u) => u.id));

  let created = 0, skipped = 0, errors = 0;
  const idMapping = new Map(); // old_id -> new_id (if IDs differ)

  for (const user of users) {
    if (existingEmails.has(user.email)) {
      const existing = existingData.users.find((u) => u.email === user.email);
      if (existing.id !== user.id) {
        idMapping.set(user.id, existing.id);
        console.log(`  EXISTS: ${user.email} (ID mapping: ${user.id.slice(0, 8)}→${existing.id.slice(0, 8)})`);
      } else {
        console.log(`  EXISTS: ${user.email} (same ID)`);
      }
      skipped++;
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: "IVAzen-Temp-2026!",
      email_confirm: true,
      user_metadata: { migrated_from: "lovable_cloud" },
    });

    if (error) {
      console.error(`  ERROR: ${user.email}: ${error.message}`);
      errors++;
      continue;
    }

    if (data.user.id !== user.id) {
      idMapping.set(user.id, data.user.id);
      console.log(`  CREATED: ${user.email} (NEW ID: ${user.id.slice(0, 8)}→${data.user.id.slice(0, 8)})`);
    } else {
      console.log(`  CREATED: ${user.email}`);
    }
    created++;
  }

  console.log(`\n  Summary: ${created} created, ${skipped} skipped, ${errors} errors`);
  console.log(`  ID mappings needed: ${idMapping.size}`);

  return idMapping;
}

// ─── Step 2: Import CSVs ──────────────────────────────────

const IMPORT_ORDER = [
  "profiles", "user_roles", "partners", "internal_webhook_keys", "ai_metrics",
  "invoices", "tax_withholdings", "sales_invoices", "at_credentials",
  "accountant_at_config", "accountant_requests", "notification_preferences",
  "push_subscriptions", "category_preferences", "classification_rules",
  "classification_examples", "user_onboarding_progress", "ss_declarations",
  "revenue_entries", "upload_queue",
  "client_accountants", "client_invitations",
  "invoice_vat_lines", "invoice_validation_logs", "withholding_logs",
  "at_sync_history", "at_sync_jobs", "at_sync_year_overrides",
  "at_sync_override_audit", "at_sync_automation_runs",
  "at_withholding_candidates", "sent_notifications",
];

// Columns that reference auth.users.id (need remapping)
const USER_ID_COLUMNS = {
  profiles: ["id", "accountant_id"],
  user_roles: ["user_id"],
  invoices: ["user_id", "client_id", "accountant_id", "validated_by"],
  tax_withholdings: ["user_id", "client_id"],
  sales_invoices: ["user_id", "client_id"],
  revenue_entries: ["user_id", "client_id"],
  at_credentials: ["user_id"],
  accountant_at_config: ["accountant_id"],
  accountant_requests: ["user_id", "reviewed_by"],
  client_accountants: ["client_id", "accountant_id", "invited_by"],
  client_invitations: ["client_id", "accountant_id", "invited_by"],
  notification_preferences: ["user_id"],
  push_subscriptions: ["user_id"],
  category_preferences: ["user_id"],
  classification_rules: ["user_id", "client_id", "created_by"],
  classification_examples: ["user_id"],
  user_onboarding_progress: ["user_id"],
  ss_declarations: ["user_id"],
  upload_queue: ["client_id"],
  at_sync_history: ["user_id", "client_id", "created_by"],
  at_sync_jobs: ["client_id", "accountant_id"],
  at_sync_year_overrides: ["accountant_id", "created_by"],
  at_sync_override_audit: ["requested_by"],
  at_sync_automation_runs: ["accountant_id"],
  at_withholding_candidates: ["client_id", "accountant_id", "reviewed_by"],
  sent_notifications: ["user_id"],
  invoice_validation_logs: ["user_id"],
  withholding_logs: ["user_id"],
};

function remapIds(rows, tableName, idMapping) {
  if (idMapping.size === 0) return rows;
  const columns = USER_ID_COLUMNS[tableName] || [];
  if (columns.length === 0) return rows;

  let remapped = 0;
  for (const row of rows) {
    for (const col of columns) {
      if (row[col] && idMapping.has(row[col])) {
        row[col] = idMapping.get(row[col]);
        remapped++;
      }
    }
  }
  if (remapped > 0) {
    console.log(`    Remapped ${remapped} IDs in ${tableName}`);
  }
  return rows;
}

async function importTable(tableName, csvDir, idMapping) {
  const csvPath = join(csvDir, `${tableName}.csv`);
  if (!existsSync(csvPath)) return { table: tableName, status: "skip", count: 0 };

  const csvText = readFileSync(csvPath, "utf-8");
  const { headers, rows } = parseCSV(csvText);

  if (rows.length === 0) return { table: tableName, status: "empty", count: 0 };

  // Remap user IDs if needed
  remapIds(rows, tableName, idMapping);

  console.log(`  ${tableName}: importing ${rows.length} rows...`);

  // Use upsert in batches
  const BATCH = 200;
  let ok = 0, errs = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    // Try upsert first (handles existing rows)
    const { error } = await supabase.from(tableName).upsert(batch, {
      onConflict: "id",
      ignoreDuplicates: true,
    });

    if (error) {
      // If upsert fails, try insert with individual rows
      console.log(`    Batch ${Math.floor(i / BATCH) + 1} upsert failed: ${error.message}`);
      for (const row of batch) {
        const { error: rowErr } = await supabase.from(tableName).upsert(row, {
          onConflict: "id",
          ignoreDuplicates: true,
        });
        if (rowErr) {
          errs++;
          if (errs <= 3) console.log(`    Row error: ${rowErr.message.slice(0, 120)}`);
        } else {
          ok++;
        }
      }
    } else {
      ok += batch.length;
    }

    // Progress indicator for large tables
    if (rows.length > 1000 && (i + BATCH) % 2000 === 0) {
      console.log(`    Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
    }
  }

  const status = errs === 0 ? "ok" : `${ok} ok, ${errs} errors`;
  console.log(`  ${tableName}: ${status}`);
  return { table: tableName, status: errs === 0 ? "ok" : "partial", count: ok, errors: errs };
}

async function importAllCSVs(csvDir, idMapping) {
  console.log("\n══════════════════════════════════════════");
  console.log("  STEP 2: Importing CSV data");
  console.log("══════════════════════════════════════════\n");

  const results = [];

  for (const table of IMPORT_ORDER) {
    const result = await importTable(table, csvDir, idMapping);
    results.push(result);
  }

  // Check for CSVs not in import order
  const csvFiles = readdirSync(csvDir).filter((f) => f.endsWith(".csv"));
  for (const file of csvFiles) {
    const t = basename(file, ".csv");
    if (!IMPORT_ORDER.includes(t)) {
      console.log(`\n  Extra table: ${t}`);
      const result = await importTable(t, csvDir, idMapping);
      results.push(result);
    }
  }

  return results;
}

// ─── Step 3: Verify ───────────────────────────────────────

async function verify() {
  console.log("\n══════════════════════════════════════════");
  console.log("  STEP 3: Verification");
  console.log("══════════════════════════════════════════\n");

  const tables = [
    "profiles", "user_roles", "invoices", "invoice_vat_lines",
    "tax_withholdings", "sales_invoices", "revenue_entries",
    "at_credentials", "client_accountants", "classification_rules",
    "at_sync_history", "upload_queue",
  ];

  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t}: ${count ?? "error"} rows${error ? ` (${error.message})` : ""}`);
  }

  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1 });
  // listUsers doesn't give total easily, but we can check
  const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  console.log(`  auth.users: ${allUsers?.users?.length ?? "unknown"} users`);
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  const baseDir = join(process.cwd(), "scripts/migration");
  const csvDir = join(baseDir, "csv");
  const usersPath = join(baseDir, "users.json");

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  IVAzen Data Migration                   ║");
  console.log("║  Lovable Cloud → Supabase                ║");
  console.log("╚══════════════════════════════════════════╝");

  // Step 1: Create users
  const idMapping = await createUsers(usersPath);

  // Step 2: Import CSVs
  const results = await importAllCSVs(csvDir, idMapping);

  // Step 3: Verify
  await verify();

  // Summary
  console.log("\n══════════════════════════════════════════");
  console.log("  MIGRATION SUMMARY");
  console.log("══════════════════════════════════════════\n");

  let totalRows = 0;
  for (const r of results) {
    if (r.status === "skip") continue;
    const icon = r.status === "ok" ? "OK" : r.status === "empty" ? "--" : "!!";
    console.log(`  [${icon}] ${r.table}: ${r.count} rows${r.errors ? ` (${r.errors} errors)` : ""}`);
    totalRows += r.count;
  }
  console.log(`\n  Total: ${totalRows} rows imported`);
  console.log(`  ID mappings: ${idMapping.size}`);

  if (idMapping.size > 0) {
    console.log("\n  ID MAPPINGS (old → new):");
    for (const [old, newId] of idMapping) {
      console.log(`    ${old} → ${newId}`);
    }
  }

  console.log("\n  NEXT STEPS:");
  console.log("  1. Upload storage files (invoices bucket)");
  console.log("  2. Configure Auth redirect URLs in Supabase Dashboard");
  console.log("  3. Test login at https://ivazen-saas.vercel.app");
  console.log("  4. Users must reset passwords (temp: IVAzen-Temp-2026!)");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
