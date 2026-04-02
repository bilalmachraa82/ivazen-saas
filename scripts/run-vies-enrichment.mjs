#!/usr/bin/env node
/**
 * VIES Enrichment Script
 *
 * Enriches supplier_directory with business names from the EU VIES REST API.
 * FREE — no API key needed. VIES is a public EU service.
 *
 * Usage:
 *   node scripts/run-vies-enrichment.mjs                # Default: 50 NIFs
 *   node scripts/run-vies-enrichment.mjs --limit=10     # Test with 10
 *   node scripts/run-vies-enrichment.mjs --dry-run      # Preview only
 *   node scripts/run-vies-enrichment.mjs --limit=200    # Larger batch
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^(\w+)=["']?(.+?)["']?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* no .env file */ }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(getArg('limit') || '50') || 50;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ------------------------------------------------------------------ */
/*  VIES helpers                                                       */
/* ------------------------------------------------------------------ */

function isBusinessNif(nif) {
  if (!/^\d{9}$/.test(nif)) return false;
  return ['5', '6', '7'].includes(nif[0]) && nif !== '999999990';
}

function parseViesResponse(data) {
  if (!data.isValid || data.name === '---' || !data.name) {
    return { name: null, city: null, valid: false };
  }

  let city = null;
  if (data.address) {
    const lines = data.address.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const match = lastLine.match(/\d{4}-\d{3}\s+(.+)/);
      city = match ? match[1].trim() : null;
    }
  }

  return { name: data.name, city, valid: true };
}

async function callVies(nif) {
  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/PT/vat/${nif}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { error: `HTTP ${resp.status}` };
    }

    const data = await resp.json();
    return parseViesResponse(data);
  } catch (err) {
    clearTimeout(timeout);
    return { error: err.message };
  }
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n=== VIES Enrichment ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  console.log(`Limit: ${LIMIT} NIFs\n`);

  // Step 1: Get distinct business NIFs from invoices + sales_invoices
  // Only fetch NIFs where supplier_name IS NULL (the ones that need enrichment).
  // Paginate with steps of 10,000 to avoid the default 1000-row PostgREST cap.
  console.log('Fetching NIFs from invoices...');
  const allNifs = new Set();
  const PAGE = 10000;

  for (let offset = 0; ; offset += PAGE) {
    const { data: invRows, error: invErr } = await supabase
      .from('invoices')
      .select('supplier_nif')
      .is('supplier_name', null)
      .not('supplier_nif', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (invErr) { console.error('invoices query error:', invErr); break; }
    if (!invRows || invRows.length === 0) break;
    for (const row of invRows) {
      if (row.supplier_nif && isBusinessNif(row.supplier_nif)) allNifs.add(row.supplier_nif);
    }
    if (invRows.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data: salesRows, error: salesErr } = await supabase
      .from('sales_invoices')
      .select('supplier_nif')
      .not('supplier_nif', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (salesErr) { console.error('sales_invoices query error:', salesErr); break; }
    if (!salesRows || salesRows.length === 0) break;
    for (const row of salesRows) {
      if (row.supplier_nif && isBusinessNif(row.supplier_nif)) allNifs.add(row.supplier_nif);
    }
    if (salesRows.length < PAGE) break;
  }

  const uniqueNifs = Array.from(allNifs);
  console.log(`Total distinct business NIFs: ${uniqueNifs.length}`);

  // Step 2: Filter out already-enriched NIFs
  console.log('Checking supplier_directory for existing enrichment...');
  const enrichedNifs = new Set();

  for (let i = 0; i < uniqueNifs.length; i += 100) {
    const batch = uniqueNifs.slice(i, i + 100);
    const { data: dirRows } = await supabase
      .from('supplier_directory')
      .select('nif, name, source')
      .in('nif', batch);

    for (const row of (dirRows || [])) {
      const reliableSource = ['vies', 'nif_pt', 'manual'].includes(row.source);
      const hasRealName = row.name && row.name !== row.nif && !/^\d{9}$/.test(row.name);

      if (reliableSource && hasRealName) {
        enrichedNifs.add(row.nif);
      }
      // Also skip NIFs we already tried via VIES and got nothing
      if (row.source === 'vies_not_found') {
        enrichedNifs.add(row.nif);
      }
    }
  }

  const nifsToEnrich = uniqueNifs
    .filter(nif => !enrichedNifs.has(nif))
    .slice(0, LIMIT);

  console.log(`Already enriched (reliable source): ${enrichedNifs.size}`);
  console.log(`To process: ${nifsToEnrich.length}`);
  console.log(`Estimated time: ~${nifsToEnrich.length} seconds (1 req/sec)\n`);

  if (nifsToEnrich.length === 0) {
    console.log('Nothing to do! All business NIFs already enriched.');
    return;
  }

  if (DRY_RUN) {
    console.log('NIFs that would be queried:');
    for (const nif of nifsToEnrich) {
      console.log(`  ${nif}`);
    }
    return;
  }

  // Step 3: Call VIES for each NIF
  let enriched = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (let i = 0; i < nifsToEnrich.length; i++) {
    const nif = nifsToEnrich[i];
    process.stdout.write(`[${i + 1}/${nifsToEnrich.length}] NIF ${nif} ... `);

    const result = await callVies(nif);

    if (result.error) {
      console.log(`ERR: ${result.error}`);
      errorCount++;

      // If rate limited (429), wait longer and retry
      if (result.error.includes('429')) {
        console.log('  Rate limited — waiting 30s...');
        await sleep(30000);
        i--; // Retry
        continue;
      }

      await sleep(1000);
      continue;
    }

    if (result.valid && result.name) {
      console.log(`OK: ${result.name}${result.city ? ` (${result.city})` : ''}`);
      enriched++;

      // Upsert into supplier_directory
      const { error: upsertErr } = await supabase
        .from('supplier_directory')
        .upsert({
          nif,
          name: result.name,
          city: result.city,
          source: 'vies',
          confidence: 90,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'nif' });

      if (upsertErr) {
        console.error(`  supplier_directory upsert error: ${upsertErr.message}`);
      }

      // Propagate to invoices
      const { count: invCount } = await supabase
        .from('invoices')
        .update({ supplier_name: result.name }, { count: 'exact' })
        .eq('supplier_nif', nif)
        .or('supplier_name.is.null,supplier_name.eq.');

      // Propagate to sales_invoices
      const { count: salesCount } = await supabase
        .from('sales_invoices')
        .update({ supplier_name: result.name }, { count: 'exact' })
        .eq('supplier_nif', nif)
        .or('supplier_name.is.null,supplier_name.eq.');

      const updated = (invCount || 0) + (salesCount || 0);
      if (updated > 0) {
        console.log(`  -> Updated ${updated} invoice(s)`);
      }
    } else {
      console.log('NOT FOUND (invalid or no name)');
      notFoundCount++;

      // Mark as vies_not_found so we don't retry
      await supabase
        .from('supplier_directory')
        .upsert({
          nif,
          name: nif, // placeholder
          source: 'vies_not_found',
          confidence: 10,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'nif' });
    }

    // 1 second delay between calls
    if (i < nifsToEnrich.length - 1) {
      await sleep(1000);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Enriched:  ${enriched}`);
  console.log(`Not found: ${notFoundCount}`);
  console.log(`Errors:    ${errorCount}`);
  console.log(`Total business NIFs: ${uniqueNifs.length}`);
  console.log(`Already enriched: ${enrichedNifs.size}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
