#!/usr/bin/env node
/**
 * Bulk Classification Script — IVAzen
 *
 * Phase 1 (Rules, free): Applies classification_rules locally to ALL 138K pending invoices.
 *   - Downloads all rules once, processes invoices in pages of 500
 *   - Batch-updates results (no edge function overhead)
 * Phase 2 (AI): Calls nightly-classify edge function in a loop until no more pending
 *   - Each call handles 30 AI invoices + 500ms gaps = ~15s per call
 *   - Runs up to MAX_AI_ROUNDS rounds with delay between
 *
 * Usage:
 *   node scripts/bulk-classify.mjs                   # Phase 1 (rules) + Phase 2 (AI)
 *   node scripts/bulk-classify.mjs --rules-only       # Phase 1 only (free, fast)
 *   node scripts/bulk-classify.mjs --ai-only          # Phase 2 only
 *   node scripts/bulk-classify.mjs --ai-rounds=50     # Override AI rounds (default 200)
 *   node scripts/bulk-classify.mjs --dry-run          # Preview counts only
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
let env = {};
try {
  const raw = readFileSync('.env', 'utf8');
  raw.split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
} catch {}

const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const RULES_ONLY = args.includes('--rules-only');
const AI_ONLY = args.includes('--ai-only');
const DRY_RUN = args.includes('--dry-run');
const MAX_AI_ROUNDS = parseInt(args.find(a => a.startsWith('--ai-rounds='))?.split('=')[1] || '200');

const PAGE_SIZE = 500;   // invoices per page
const UPDATE_BATCH = 100; // bulk update batch size

const SAFE_GLOBAL_NIFS = new Set([
  '503504564', '504172577', '503207430', '509534401', '513445311', '509846830', '510329490',
  '504812578', '504075156', '500077568', '503474705',
  '504453513', '500019020', '502530830', '505280740', '517424334',
]);

function normalizeNif(raw) {
  const s = (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  if (/^PT\d{9}$/.test(s)) return s.slice(2);
  if (/^\d{9}$/.test(s)) return s;
  if (/^[A-Z]{2}[A-Z0-9]{2,}$/.test(s)) return s;
  return null;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── PHASE 1: Rules ─────────────────────────────────────────────────────────

async function runRulesPhase() {
  console.log('\n=== PHASE 1: Rules-based classification ===');

  // 1. Load ALL rules once
  console.log('Loading all classification rules...');
  const { data: rulesRaw, error: rulesErr } = await supabase
    .from('classification_rules')
    .select('id, supplier_nif, client_id, classification, dp_field, deductibility, confidence, usage_count, is_global')
    .gte('confidence', 70);

  if (rulesErr) throw new Error(`Failed to load rules: ${rulesErr.message}`);
  const allRules = rulesRaw || [];
  console.log(`Loaded ${allRules.length} rules`);

  // Index rules: key = `${clientId}::${nif}` → best rule
  const clientRuleMap = new Map(); // `${clientId}::${nif}` → rule
  const globalRuleMap = new Map(); // nif → rule
  const crossClientMap = new Map(); // nif → rule (SAFE_GLOBAL_NIFS only, confidence>=70)

  for (const rule of allRules) {
    const nif = rule.supplier_nif;
    if (!nif) continue;

    if (rule.is_global && rule.confidence >= 85) {
      // Global rule: best confidence wins
      const existing = globalRuleMap.get(nif);
      if (!existing || rule.confidence > existing.confidence) {
        globalRuleMap.set(nif, rule);
      }
    } else if (rule.client_id) {
      const key = `${rule.client_id}::${nif}`;
      const existing = clientRuleMap.get(key);
      if (!existing || rule.usage_count > existing.usage_count || rule.confidence > existing.confidence) {
        clientRuleMap.set(key, rule);
      }
    }

    // Cross-client for SAFE NIFs
    if (SAFE_GLOBAL_NIFS.has(nif) && rule.confidence >= 70) {
      const existing = crossClientMap.get(nif);
      if (!existing || rule.usage_count > existing.usage_count) {
        crossClientMap.set(nif, rule);
      }
    }
  }

  console.log(`Rules indexed: ${clientRuleMap.size} client-specific, ${globalRuleMap.size} global, ${crossClientMap.size} cross-client`);

  // 2. Process pending invoices page by page
  let totalProcessed = 0;
  let totalApplied = 0;
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: invoices, error: fetchErr } = await supabase
      .from('invoices')
      .select('id, supplier_nif, client_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(from, to);

    if (fetchErr) throw new Error(`Fetch error page ${page}: ${fetchErr.message}`);
    if (!invoices || invoices.length === 0) break;

    totalProcessed += invoices.length;

    // Match rules
    const updates = [];
    const ruleUsageCounts = new Map(); // rule.id → increment

    for (const inv of invoices) {
      const nif = normalizeNif(inv.supplier_nif);
      if (!nif) continue;

      let rule = null;

      // 1. Client-specific rule
      if (inv.client_id) {
        rule = clientRuleMap.get(`${inv.client_id}::${nif}`) || null;
      }
      // 2. Global rule
      if (!rule) rule = globalRuleMap.get(nif) || null;
      // 3. Cross-client for safe NIFs
      if (!rule && SAFE_GLOBAL_NIFS.has(nif)) {
        rule = crossClientMap.get(nif) || null;
      }

      if (!rule) continue;

      updates.push({
        id: inv.id,
        ai_classification: rule.classification,
        ai_deductibility: rule.deductibility,
        ai_dp_field: rule.dp_field,
        ai_confidence: rule.confidence,
        status: 'classified',
      });
      ruleUsageCounts.set(rule.id, (ruleUsageCounts.get(rule.id) || 0) + 1);
    }

    if (DRY_RUN) {
      console.log(`  Page ${page + 1}: ${invoices.length} fetched, ${updates.length} would be classified by rules`);
    } else if (updates.length > 0) {
      // Batch update in chunks
      let batchApplied = 0;
      for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
        const chunk = updates.slice(i, i + UPDATE_BATCH);
        for (const upd of chunk) {
          const { error: updErr } = await supabase
            .from('invoices')
            .update({
              ai_classification: upd.ai_classification,
              ai_deductibility: upd.ai_deductibility,
              ai_dp_field: upd.ai_dp_field,
              ai_confidence: upd.ai_confidence,
              status: upd.status,
            })
            .eq('id', upd.id)
            .eq('status', 'pending'); // safety: only update still-pending
          if (!updErr) batchApplied++;
        }
      }
      totalApplied += batchApplied;

      // Increment rule usage counts (best-effort, non-blocking)
      for (const [ruleId, inc] of ruleUsageCounts) {
        supabase.rpc('increment_rule_usage', { rule_id: ruleId, amount: inc })
          .then(() => {}).catch(() => {}); // fire and forget
      }

      console.log(`  Page ${page + 1}: ${invoices.length} fetched, ${batchApplied} classified by rules`);
    } else {
      console.log(`  Page ${page + 1}: ${invoices.length} fetched, 0 rules matched`);
    }

    if (invoices.length < PAGE_SIZE) break;
    page++;
    await sleep(200); // gentle pause between pages
  }

  console.log(`\nPhase 1 complete: ${totalProcessed} processed, ${totalApplied} classified by rules`);
  return { processed: totalProcessed, applied: totalApplied };
}

// ─── PHASE 2: AI ─────────────────────────────────────────────────────────────

async function runAIPhase() {
  console.log('\n=== PHASE 2: AI classification (nightly-classify loop) ===');

  let totalAIClassified = 0;
  let round = 0;

  for (round = 0; round < MAX_AI_ROUNDS; round++) {
    // Check how many pending remain
    const { count, error: countErr } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countErr) {
      console.error(`Count error: ${countErr.message}`);
      break;
    }

    if ((count || 0) === 0) {
      console.log('All invoices classified!');
      break;
    }

    console.log(`Round ${round + 1}/${MAX_AI_ROUNDS}: ${count} pending remain...`);

    if (DRY_RUN) {
      console.log('  [DRY RUN] Would call nightly-classify');
      break;
    }

    // Call nightly-classify (30 AI invoices per call)
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/nightly-classify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rules_batch_size: 0, ai_batch_size: 30, sales_batch_size: 0 }),
    });

    if (resp.status === 429) {
      console.log('  Rate limited — waiting 60s...');
      await sleep(60000);
      continue;
    }

    if (!resp.ok) {
      console.error(`  HTTP ${resp.status}`);
      await sleep(5000);
      continue;
    }

    const result = await resp.json().catch(() => ({}));
    const classified = result.ai_classified || 0;
    totalAIClassified += classified;

    console.log(`  AI classified: ${classified} | total so far: ${totalAIClassified}`);

    if (classified === 0) {
      // No more to classify or AI refused all
      const remaining = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      if ((remaining.count || 0) === 0) break;
      console.log('  No AI progress this round, waiting 10s...');
      await sleep(10000);
    } else {
      await sleep(2000); // 2s between rounds
    }
  }

  console.log(`\nPhase 2 complete: ${totalAIClassified} AI classified over ${round} rounds`);
  return { aiClassified: totalAIClassified, rounds: round };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== IVAzen Bulk Classification ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : RULES_ONLY ? 'rules-only' : AI_ONLY ? 'ai-only' : 'full'}`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Check initial state
  const { count: initialPending } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`\nInitial pending invoices: ${initialPending}`);

  if (initialPending === 0) {
    console.log('Nothing to do — all invoices classified!');
    return;
  }

  let rulesResult = null;
  let aiResult = null;

  if (!AI_ONLY) {
    rulesResult = await runRulesPhase();
  }

  if (!RULES_ONLY) {
    aiResult = await runAIPhase();
  }

  // Final summary
  const { count: finalPending } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const classified = (initialPending || 0) - (finalPending || 0);

  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Started with:  ${initialPending} pending`);
  console.log(`Classified:    ${classified}`);
  console.log(`Remaining:     ${finalPending}`);
  if (rulesResult) console.log(`  By rules:    ${rulesResult.applied}`);
  if (aiResult)    console.log(`  By AI:       ${aiResult.aiClassified}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
