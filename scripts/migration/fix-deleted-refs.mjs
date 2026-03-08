#!/usr/bin/env node
/**
 * Fix: test-v590-extraction.mjs accidentally deleted ALL TWs for ATSIRE01FR/61 and /78
 * without NIF filter. This deleted records for OTHER beneficiaries beyond 118298496.
 *
 * Strategy: Find all completed upload_queue items with these refs that carry the
 * extracted beneficiary/ref data we trust (SAVED, NEEDS_REVIEW, SKIPPED_DUPLICATE),
 * check if the target TW exists, and re-insert missing ones.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

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

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const h = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
const cid = '0ffd28d7-1ff0-4002-82fa-6ce9d7a47816';

const DRY_RUN = !process.argv.includes('--apply');
if (DRY_RUN) console.log('=== DRY RUN (use --apply to execute) ===\n');

// Find ALL relevant upload_queue items with ATSIRE01FR/61 or /78 in filename.
for (const refNum of ['61', '78']) {
  console.log(`\n══ ATSIRE01FR/${refNum} ══`);

  // Get all completed items for this ref that can prove the intended canonical row.
  const r1 = await fetch(
    `${url}/rest/v1/upload_queue?select=id,file_name,outcome_code,normalized_doc_ref,extracted_data&client_id=eq.${cid}&file_name=ilike.*ATSIRE01FR_${refNum}_*&outcome_code=in.(SAVED,NEEDS_REVIEW,SKIPPED_DUPLICATE)&limit=50`,
    { headers: h }
  );
  const items = await r1.json();
  console.log(`Upload queue items: ${items?.length || 0}`);

  for (const item of (items || [])) {
    const ed = item.extracted_data || {};
    const nif = ed.beneficiary_nif;
    const docRef = item.normalized_doc_ref || `ATSIRE01FR/${refNum}`;
    const irs = ed.withholding_amount || 0;
    const base = ed.gross_amount || 0;

    console.log(`  ${item.file_name}`);
    console.log(`    outcome=${item.outcome_code} nif=${nif} base=${base} irs=${irs} ref=${docRef}`);

    // Check if TW exists
    const r2 = await fetch(
      `${url}/rest/v1/tax_withholdings?select=id,beneficiary_nif,gross_amount,withholding_amount&client_id=eq.${cid}&beneficiary_nif=eq.${nif}&document_reference=eq.${docRef}&fiscal_year=eq.2025&limit=1`,
      { headers: h }
    );
    const existing = await r2.json();

    if (existing?.length > 0) {
      console.log(`    TW EXISTS: id=${existing[0].id} ✓`);
    } else if ((item.outcome_code === 'SAVED' || item.outcome_code === 'SKIPPED_DUPLICATE') && nif && base > 0) {
      console.log(`    TW MISSING — needs re-insert`);

      if (!DRY_RUN) {
        const insertData = {
          client_id: cid,
          beneficiary_nif: nif,
          beneficiary_name: ed.beneficiary_name || null,
          income_category: ed.income_category || 'B',
          gross_amount: base,
          exempt_amount: ed.exempt_amount || 0,
          dispensed_amount: ed.dispensed_amount || 0,
          withholding_rate: ed.withholding_rate || null,
          withholding_amount: irs,
          payment_date: ed.payment_date || '2025-12-31',
          document_reference: docRef,
          fiscal_year: 2025,
          location_code: 'C',
          status: 'draft',
        };

        const r3 = await fetch(`${url}/rest/v1/tax_withholdings`, {
          method: 'POST',
          headers: { ...h, 'Prefer': 'return=representation' },
          body: JSON.stringify(insertData),
        });
        const result = await r3.json();
        console.log(`    ${r3.ok ? 'INSERTED' : 'FAILED'}: ${r3.status} ${r3.ok ? 'id=' + result[0]?.id : JSON.stringify(result)}`);
      }
    } else {
      console.log(`    Skipped (outcome=${item.outcome_code}, nif=${nif}, base=${base})`);
    }
  }
}

// Also check: are there SAVED items with normalized_doc_ref matching these that we missed?
console.log('\n══ Cross-check: items with normalized_doc_ref ══');
for (const refNum of ['61', '78']) {
  const r = await fetch(
    `${url}/rest/v1/upload_queue?select=id,file_name,outcome_code,normalized_doc_ref,extracted_data&client_id=eq.${cid}&normalized_doc_ref=eq.ATSIRE01FR/${refNum}&outcome_code=eq.SAVED&limit=50`,
    { headers: h }
  );
  const items = await r.json();
  console.log(`  ATSIRE01FR/${refNum} via normalized_doc_ref: ${items?.length || 0} SAVED items`);
  for (const item of (items || [])) {
    const ed = item.extracted_data || {};
    console.log(`    ${item.file_name} nif=${ed.beneficiary_nif} irs=${ed.withholding_amount}`);
  }
}

if (DRY_RUN) console.log('\n=== Run with --apply to execute ===');
