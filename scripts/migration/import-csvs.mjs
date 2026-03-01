#!/usr/bin/env node
/**
 * Automated CSV Import Script for Lovable → Supabase Migration
 *
 * Usage:
 *   1. Export all tables as CSV from Lovable Cloud > Database
 *   2. Place CSV files in scripts/migration/csv/ folder
 *   3. Name each file exactly as the table name: profiles.csv, invoices.csv, etc.
 *   4. Run: node scripts/migration/import-csvs.mjs
 *
 * Prerequisites:
 *   - Run 01-disable-constraints.sql FIRST in Supabase SQL Editor
 *   - Run 02-create-users.sql FIRST to create auth.users
 *   - Set env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  console.error("Example: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migration/import-csvs.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Import order (respects foreign keys)
const IMPORT_ORDER = [
  // Tier 1: Root tables
  "profiles",
  "user_roles",
  "partners",
  "internal_webhook_keys",
  "ai_metrics",
  // Tier 2: Core data
  "invoices",
  "tax_withholdings",
  "sales_invoices",
  "at_credentials",
  "accountant_at_config",
  "accountant_requests",
  "notification_preferences",
  "push_subscriptions",
  "category_preferences",
  "classification_rules",
  "classification_examples",
  "user_onboarding_progress",
  "ss_declarations",
  "revenue_entries",
  "upload_queue",
  // Tier 3: Relationship tables
  "client_accountants",
  "client_invitations",
  // Tier 4: Dependent tables
  "invoice_vat_lines",
  "invoice_validation_logs",
  "withholding_logs",
  "at_sync_history",
  "at_sync_jobs",
  "at_sync_year_overrides",
  "at_sync_override_audit",
  "at_sync_automation_runs",
  "at_withholding_candidates",
  "sent_notifications",
];

function parseCSV(csvText) {
  const lines = csvText.split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length !== headers.length) {
      console.warn(`  Skipping row ${i}: column count mismatch (${values.length} vs ${headers.length})`);
      continue;
    }

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      let val = values[j];
      // Handle NULL values
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

  return rows;
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
          i++; // skip escaped quote
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
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

async function importTable(tableName, csvDir) {
  const csvPath = join(csvDir, `${tableName}.csv`);

  if (!existsSync(csvPath)) {
    console.log(`  SKIP: ${tableName}.csv not found`);
    return { table: tableName, status: "skipped", count: 0 };
  }

  const csvText = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(csvText);

  if (rows.length === 0) {
    console.log(`  SKIP: ${tableName}.csv is empty`);
    return { table: tableName, status: "empty", count: 0 };
  }

  console.log(`  Importing ${tableName}: ${rows.length} rows...`);

  // Import in batches of 500
  const BATCH_SIZE = 500;
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(tableName).upsert(batch, {
      onConflict: "id",
      ignoreDuplicates: true,
    });

    if (error) {
      console.error(`  ERROR on ${tableName} (batch ${i / BATCH_SIZE + 1}):`, error.message);
      // Try inserting one by one to find the problematic row
      for (const row of batch) {
        const { error: rowError } = await supabase.from(tableName).upsert(row, {
          onConflict: "id",
          ignoreDuplicates: true,
        });
        if (rowError) {
          console.error(`    Row error:`, rowError.message, JSON.stringify(row).substring(0, 100));
        } else {
          imported++;
        }
      }
    } else {
      imported += batch.length;
    }
  }

  console.log(`  OK: ${tableName} — ${imported}/${rows.length} rows imported`);
  return { table: tableName, status: "ok", count: imported };
}

async function main() {
  const csvDir = join(process.cwd(), "scripts/migration/csv");

  if (!existsSync(csvDir)) {
    console.error(`CSV directory not found: ${csvDir}`);
    console.error("Create it and place your exported CSVs there:");
    console.error("  mkdir -p scripts/migration/csv");
    console.error("  # Then export tables from Lovable Cloud and place CSVs here");
    process.exit(1);
  }

  const availableFiles = readdirSync(csvDir).filter((f) => f.endsWith(".csv"));
  console.log(`\nFound ${availableFiles.length} CSV files in ${csvDir}:`);
  availableFiles.forEach((f) => console.log(`  - ${f}`));

  console.log(`\nStarting import (${IMPORT_ORDER.length} tables in dependency order)...\n`);

  const results = [];
  for (const table of IMPORT_ORDER) {
    const result = await importTable(table, csvDir);
    results.push(result);
  }

  // Check for CSVs that weren't in the import order
  for (const file of availableFiles) {
    const tableName = basename(file, ".csv");
    if (!IMPORT_ORDER.includes(tableName)) {
      console.log(`\n  WARNING: ${file} not in import order — importing now...`);
      const result = await importTable(tableName, csvDir);
      results.push(result);
    }
  }

  console.log("\n========== MIGRATION SUMMARY ==========");
  let totalRows = 0;
  for (const r of results) {
    const icon = r.status === "ok" ? "OK" : r.status === "skipped" ? "SKIP" : "EMPTY";
    console.log(`  [${icon}] ${r.table}: ${r.count} rows`);
    totalRows += r.count;
  }
  console.log(`\nTotal: ${totalRows} rows imported across ${results.filter((r) => r.status === "ok").length} tables`);
  console.log("\nNEXT STEPS:");
  console.log("  1. Run 03-re-enable-constraints.sql in SQL Editor");
  console.log("  2. Migrate storage files (invoices bucket)");
  console.log("  3. Send password reset emails to all users");
}

main().catch(console.error);
