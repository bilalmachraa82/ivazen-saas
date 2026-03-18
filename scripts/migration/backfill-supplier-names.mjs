#!/usr/bin/env node
/**
 * Backfill supplier_name for invoices that have a NIF but no name.
 * Uses data from other invoices, classification_rules, and classification_examples.
 *
 * Usage: node scripts/migration/backfill-supplier-names.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env manually (no dotenv dependency)
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^(\w+)=["']?(.+?)["']?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== Backfill Supplier Names ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // Step 1: Find all invoices missing supplier_name
  const { data: missing, error: missErr } = await supabase
    .from('invoices')
    .select('id, supplier_nif')
    .or('supplier_name.is.null,supplier_name.eq.')
    .not('supplier_nif', 'is', null)
    .neq('supplier_nif', 'AT');

  if (missErr) { console.error('Query error:', missErr); return; }
  console.log(`Found ${missing.length} invoices without supplier_name\n`);

  if (missing.length === 0) { console.log('Nothing to do!'); return; }

  // Step 2: Get unique NIFs
  const uniqueNifs = [...new Set(missing.map(i => i.supplier_nif))];
  console.log(`Unique NIFs to look up: ${uniqueNifs.length}\n`);

  // Step 3: Build name lookup map from multiple sources
  const nameMap = new Map();

  // Source 1: invoices that DO have names
  for (let i = 0; i < uniqueNifs.length; i += 50) {
    const batch = uniqueNifs.slice(i, i + 50);
    const { data: named } = await supabase
      .from('invoices')
      .select('supplier_nif, supplier_name')
      .in('supplier_nif', batch)
      .not('supplier_name', 'is', null)
      .neq('supplier_name', '')
      .neq('supplier_name', 'N/A')
      .limit(500);
    for (const r of (named || [])) {
      if (!nameMap.has(r.supplier_nif)) nameMap.set(r.supplier_nif, r.supplier_name);
    }
  }
  console.log(`Names from invoices: ${nameMap.size}`);

  // Source 2: classification_rules
  for (let i = 0; i < uniqueNifs.length; i += 50) {
    const batch = uniqueNifs.slice(i, i + 50).filter(n => !nameMap.has(n));
    if (batch.length === 0) continue;
    const { data: rules } = await supabase
      .from('classification_rules')
      .select('supplier_nif, supplier_name_pattern')
      .in('supplier_nif', batch)
      .not('supplier_name_pattern', 'is', null);
    for (const r of (rules || [])) {
      if (!nameMap.has(r.supplier_nif)) nameMap.set(r.supplier_nif, r.supplier_name_pattern);
    }
  }
  console.log(`Names after rules: ${nameMap.size}`);

  // Source 3: classification_examples
  for (let i = 0; i < uniqueNifs.length; i += 50) {
    const batch = uniqueNifs.slice(i, i + 50).filter(n => !nameMap.has(n));
    if (batch.length === 0) continue;
    const { data: examples } = await supabase
      .from('classification_examples')
      .select('supplier_nif, supplier_name')
      .in('supplier_nif', batch)
      .not('supplier_name', 'is', null);
    for (const r of (examples || [])) {
      if (!nameMap.has(r.supplier_nif)) nameMap.set(r.supplier_nif, r.supplier_name);
    }
  }
  console.log(`Names after examples: ${nameMap.size}`);

  // Step 4: Update invoices
  let updated = 0;
  let notFound = 0;
  const notFoundNifs = new Set();

  for (const inv of missing) {
    const name = nameMap.get(inv.supplier_nif);
    if (!name) {
      notFound++;
      notFoundNifs.add(inv.supplier_nif);
      continue;
    }

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('invoices')
        .update({ supplier_name: name })
        .eq('id', inv.id);
      if (error) {
        console.error(`  Error updating ${inv.id}:`, error.message);
        continue;
      }
    }
    updated++;
  }

  console.log(`\n=== Results ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Not found: ${notFound} (${notFoundNifs.size} unique NIFs)`);

  if (notFoundNifs.size > 0 && notFoundNifs.size <= 20) {
    console.log(`\nNIFs without known name:`);
    for (const nif of notFoundNifs) {
      console.log(`  - ${nif}`);
    }
  } else if (notFoundNifs.size > 20) {
    console.log(`\nTop 20 NIFs without known name:`);
    [...notFoundNifs].slice(0, 20).forEach(nif => console.log(`  - ${nif}`));
  }
}

main().catch(console.error);
