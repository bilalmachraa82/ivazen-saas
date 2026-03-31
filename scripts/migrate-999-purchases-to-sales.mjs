#!/usr/bin/env node
/**
 * Migrate Maria Teresa's NIF 999999990 "purchases" to sales_invoices.
 *
 * These are Fatura-Recibo (FR) documents issued by Maria Teresa to
 * consumidor final (NIF 999999990). The AT sync incorrectly imported
 * them as purchases. This script:
 *   1. Reads the 26 invoices from `invoices` where supplier_nif = 999999990
 *   2. Inserts them into `sales_invoices` (de-duping by document_number)
 *   3. Deletes the originals from `invoices`
 *
 * Usage: node scripts/migrate-999-purchases-to-sales.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Simple .env parser (no dotenv dependency)
function loadEnv(path) {
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* file not found, skip */ }
}
loadEnv(".env.local");
loadEnv(".env");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes("--dry-run");

const MARIA_TEREZA_CLIENT_ID = "75e5b973-6b8f-47ba-a1bb-c6988eed86e1";
const MARIA_TEREZA_NIF = "188551069";

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Client: Maria Tereza (${MARIA_TEREZA_CLIENT_ID})`);

  // 1. Fetch the suspicious purchases
  const { data: purchases, error: fetchErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_id", MARIA_TEREZA_CLIENT_ID)
    .eq("supplier_nif", "999999990");

  if (fetchErr) {
    console.error("Failed to fetch purchases:", fetchErr);
    process.exit(1);
  }

  console.log(`Found ${purchases.length} purchases with supplier_nif=999999990`);

  if (purchases.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  // 2. Check for existing sales_invoices with same document_number to avoid dupes
  const docNumbers = purchases
    .map((p) => p.document_number)
    .filter(Boolean);

  let existingSales = [];
  if (docNumbers.length > 0) {
    const { data } = await supabase
      .from("sales_invoices")
      .select("document_number")
      .eq("client_id", MARIA_TEREZA_CLIENT_ID)
      .in("document_number", docNumbers);
    existingSales = (data || []).map((r) => r.document_number);
  }

  console.log(
    `Existing sales with matching doc numbers: ${existingSales.length}`
  );

  // 3. Build sales_invoices rows
  const toInsert = [];
  const toDelete = [];
  const skipped = [];

  for (const inv of purchases) {
    if (existingSales.includes(inv.document_number)) {
      skipped.push(inv.id);
      toDelete.push(inv.id); // Still delete the purchase even if sale exists
      console.log(
        `  SKIP (dupe): ${inv.document_number} — already in sales_invoices`
      );
      continue;
    }

    // In these invoices, the "supplier" is actually the customer (consumidor final)
    // and the real supplier/emitter is Maria Teresa herself
    const salesRow = {
      client_id: inv.client_id,
      supplier_nif: MARIA_TEREZA_NIF, // The emitter is Maria Teresa
      customer_nif: inv.supplier_nif, // 999999990 = consumidor final
      customer_name: inv.supplier_name || "Consumidor Final",
      document_number: inv.document_number,
      document_type: inv.document_type || "FR",
      document_date: inv.document_date,
      fiscal_period: inv.fiscal_period,
      fiscal_region: inv.fiscal_region,
      atcud: inv.atcud,
      total_amount: inv.total_amount,
      total_vat: inv.total_vat,
      base_reduced: inv.base_reduced,
      base_intermediate: inv.base_intermediate,
      base_standard: inv.base_standard,
      base_exempt: inv.base_exempt,
      vat_reduced: inv.vat_reduced,
      vat_intermediate: inv.vat_intermediate,
      vat_standard: inv.vat_standard,
      image_path: inv.image_path || "migrated-from-purchases",
      import_source: "migration_999_fix",
      status: "validated", // These came from AT, they're real
      revenue_category: "prestacao_servicos", // FR = prestacao de servicos
      notes: `Migrated from purchases (id: ${inv.id}). Originally imported as purchase with supplier_nif=999999990.`,
    };

    toInsert.push(salesRow);
    toDelete.push(inv.id);
    console.log(
      `  MIGRATE: ${inv.document_number || "no-num"} | ${inv.document_date} | €${inv.total_amount}`
    );
  }

  console.log(`\nSummary:`);
  console.log(`  To insert into sales_invoices: ${toInsert.length}`);
  console.log(`  To delete from invoices: ${toDelete.length}`);
  console.log(`  Skipped (already in sales): ${skipped.length}`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No changes made.");
    return;
  }

  // 4. Insert into sales_invoices
  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase
      .from("sales_invoices")
      .insert(toInsert);

    if (insertErr) {
      console.error("Failed to insert sales_invoices:", insertErr);
      process.exit(1);
    }
    console.log(`\nInserted ${toInsert.length} rows into sales_invoices`);
  }

  // 5. Delete from invoices
  if (toDelete.length > 0) {
    const { error: deleteErr } = await supabase
      .from("invoices")
      .delete()
      .in("id", toDelete);

    if (deleteErr) {
      console.error("Failed to delete from invoices:", deleteErr);
      console.error(
        "WARNING: Sales were already inserted! Manual cleanup needed."
      );
      process.exit(1);
    }
    console.log(`Deleted ${toDelete.length} rows from invoices`);
  }

  console.log("\nDone. Verify in the app:");
  console.log("  1. Maria Teresa > Compras: no more 999999990 invoices");
  console.log("  2. Maria Teresa > Vendas: new FR invoices should appear");
  console.log("  3. Maria Teresa > Seguranca Social: revenue should update");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
