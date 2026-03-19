#!/usr/bin/env node
/**
 * Backfill: Classify pending purchase invoices
 *
 * Calls classify-invoice edge function one at a time (avoids WORKER_LIMIT).
 * Supports unique-NIF-first strategy for free-tier AI optimization.
 *
 * Usage:
 *   node scripts/migration/backfill-classify.mjs [options]
 *
 * Options:
 *   --limit=N          Max invoices to process (default: 100)
 *   --unique-first     Prioritize 1 invoice per unique NIF (for auto-learn)
 *   --daily-budget=N   Stop after N AI calls (for free tier, e.g. 900)
 *   --delay=N          Delay between calls in ms (default: 500)
 *   --rules-only       Only process invoices that already have rules (no AI)
 *   --client=UUID      Filter by specific client_id
 *   --dry-run          Show what would be processed without classifying
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const envPath = resolve(__dirname, '../../.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const BASE = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

if (!BASE || !KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(BASE, KEY);
const headers = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const hasFlag = (name) => args.includes(`--${name}`);

const limit = parseInt(getArg('limit') || '100');
const delayMs = parseInt(getArg('delay') || '500');
const dailyBudget = parseInt(getArg('daily-budget') || '0');
const uniqueFirst = hasFlag('unique-first');
const rulesOnly = hasFlag('rules-only');
const dryRun = hasFlag('dry-run');
const clientFilter = getArg('client') || null;

async function fetchPendingInvoices() {
  if (uniqueFirst) {
    // Strategy: Get 1 invoice per unique NIF that doesn't have a classification rule yet
    // Step 1: Get NIFs that already have rules
    const { data: existingRules } = await supabase
      .from('classification_rules')
      .select('supplier_nif')
      .gte('confidence', 70);

    const ruledNifs = new Set((existingRules || []).map(r => r.supplier_nif));

    // Step 2: Paginate through ALL pending invoices to find unique NIFs
    const PAGE_SIZE = 1000;
    const seenNifs = new Set();
    const uniqueInvoices = [];
    let offset = 0;
    let scanned = 0;

    console.log(`Scanning pending invoices for unique NIFs (${ruledNifs.size} NIFs already have rules)...`);

    while (uniqueInvoices.length < limit) {
      let query = supabase
        .from('invoices')
        .select('id, supplier_nif, supplier_name, client_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (clientFilter) query = query.eq('client_id', clientFilter);
      const { data: page, error } = await query;
      if (error) throw error;

      const rows = page || [];
      scanned += rows.length;

      for (const inv of rows) {
        const nif = inv.supplier_nif || 'UNKNOWN';
        if (!ruledNifs.has(nif) && !seenNifs.has(nif)) {
          seenNifs.add(nif);
          uniqueInvoices.push(inv);
          if (uniqueInvoices.length >= limit) break;
        }
      }

      offset += PAGE_SIZE;
      if (rows.length < PAGE_SIZE) break; // No more pages

      if (scanned % 10000 === 0) {
        console.log(`  ...scanned ${scanned} invoices, found ${uniqueInvoices.length} unique NIFs so far`);
      }
    }

    console.log(`Scanned ${scanned} invoices. Found ${uniqueInvoices.length} unique NIFs without rules.`);
    return uniqueInvoices.slice(0, limit);
  }

  if (rulesOnly) {
    // Only process invoices that have matching classification rules
    // Paginate through ruled NIFs in chunks of 200 (Supabase .in() limit)
    const { data: rules } = await supabase
      .from('classification_rules')
      .select('supplier_nif')
      .gte('confidence', 70);

    const ruledNifs = [...new Set((rules || []).map(r => r.supplier_nif))];
    if (ruledNifs.length === 0) {
      console.log('No classification rules found. Run without --rules-only first.');
      return [];
    }

    console.log(`Rules cover ${ruledNifs.length} unique NIFs. Fetching matching pending invoices...`);

    const NIF_BATCH = 200;
    const PAGE_SIZE = 1000;
    let allInvoices = [];

    for (let i = 0; i < ruledNifs.length; i += NIF_BATCH) {
      const nifChunk = ruledNifs.slice(i, i + NIF_BATCH);

      // Paginate within each NIF chunk (Supabase returns max 1000 per query)
      let offset = 0;
      while (allInvoices.length < limit) {
        let query = supabase
          .from('invoices')
          .select('id, supplier_nif, supplier_name, client_id')
          .eq('status', 'pending')
          .in('supplier_nif', nifChunk)
          .order('created_at', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (clientFilter) query = query.eq('client_id', clientFilter);
        const { data, error } = await query;
        if (error) throw error;

        const rows = data || [];
        allInvoices = allInvoices.concat(rows);
        offset += PAGE_SIZE;

        // No more rows in this chunk
        if (rows.length < PAGE_SIZE) break;
      }

      if (allInvoices.length >= limit) break;
    }

    console.log(`Found ${allInvoices.length} invoices covered by rules (limit: ${limit})`);
    return allInvoices.slice(0, limit);
  }

  // Default: fetch pending invoices
  let query = supabase
    .from('invoices')
    .select('id, supplier_nif, supplier_name, client_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (clientFilter) query = query.eq('client_id', clientFilter);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function classifyOne(invoiceId) {
  const response = await fetch(`${BASE}/functions/v1/classify-invoice`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ invoice_id: invoiceId }),
    signal: AbortSignal.timeout(60000),
  });

  const result = await response.json();
  return { ok: response.ok, status: response.status, ...result };
}

async function run() {
  console.log(`\n=== Backfill Purchase Invoice Classification ===`);
  console.log(`Limit: ${limit} | Delay: ${delayMs}ms | Unique-first: ${uniqueFirst} | Rules-only: ${rulesOnly}`);
  console.log(`Daily budget: ${dailyBudget || 'unlimited'} | Client: ${clientFilter || 'all'} | Dry-run: ${dryRun}`);

  const invoices = await fetchPendingInvoices();
  console.log(`Found ${invoices.length} invoices to process\n`);

  if (dryRun) {
    console.log('DRY RUN — no changes will be made');
    const nifCounts = {};
    invoices.forEach(inv => {
      const nif = inv.supplier_nif || 'UNKNOWN';
      nifCounts[nif] = (nifCounts[nif] || 0) + 1;
    });
    console.log(`Unique NIFs: ${Object.keys(nifCounts).length}`);
    console.log(`Top 10 NIFs:`, Object.entries(nifCounts).sort((a, b) => b[1] - a[1]).slice(0, 10));
    return;
  }

  if (invoices.length === 0) {
    console.log('No pending invoices to classify.');
    return;
  }

  let classified = 0;
  let aiCalls = 0;
  let ruleCalls = 0;
  let errors = 0;
  const startedAt = Date.now();

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    const start = Date.now();

    // Check daily AI budget
    if (dailyBudget > 0 && aiCalls >= dailyBudget) {
      console.log(`\n=== DAILY BUDGET REACHED (${aiCalls}/${dailyBudget} AI calls) ===`);
      console.log('Resume tomorrow. Rules created today will classify remaining invoices deterministically.');
      console.log(`Tip: Run with --rules-only to process invoices that now have rules.`);
      break;
    }

    try {
      const result = await classifyOne(inv.id);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (result.ok && result.success) {
        classified++;
        const source = result.source || '?';
        if (source === 'ai') aiCalls++;
        else ruleCalls++;

        const conf = result.classification?.confidence || '?';
        const cls = result.classification?.classification || '?';
        console.log(
          `[${i + 1}/${invoices.length}] OK ${source.padEnd(6)} | ${cls.padEnd(10)} ${String(conf).padStart(3)}% | NIF:${inv.supplier_nif || '?'} | ${elapsed}s`
        );
      } else if (result.status === 429) {
        console.log(`\n[${i + 1}] RATE LIMITED — waiting 60s then resuming...`);
        await new Promise(r => setTimeout(r, 60000));
        i--; // Retry this invoice
        continue;
      } else {
        errors++;
        console.log(`[${i + 1}/${invoices.length}] ERR: ${result.error || result.status} | ${elapsed}s`);
      }
    } catch (err) {
      errors++;
      console.log(`[${i + 1}/${invoices.length}] ERR: ${err.message}`);
    }

    // Delay between calls
    if (i < invoices.length - 1 && delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Count remaining
  const { count: remaining } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const totalElapsed = ((Date.now() - startedAt) / 1000).toFixed(0);

  console.log(`\n=== DONE (${totalElapsed}s) ===`);
  console.log(`Classified: ${classified} | AI: ${aiCalls} | Rules: ${ruleCalls} | Errors: ${errors}`);
  console.log(`Remaining pending: ${remaining}`);

  if (remaining > 0 && aiCalls > 0) {
    const rulesCreated = aiCalls; // Each AI call creates a rule for that NIF
    console.log(`\nNext step: Run with --rules-only to classify ${remaining} invoices using ${rulesCreated} new rules (zero AI cost).`);
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
