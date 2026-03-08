#!/usr/bin/env node
/**
 * Audit ATSIRE01FR/61 recovery and historical cleanup side-effects.
 *
 * This started as a deep-dive for NIF 118298496, but it now also checks whether
 * remaining /61 gaps came from missing uploads or from cleanup / dedupe logic.
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
const h = { 'apikey': key, 'Authorization': `Bearer ${key}` };
const cid = '0ffd28d7-1ff0-4002-82fa-6ce9d7a47816';

// 1. Upload queue item
console.log('══ 1. UPLOAD QUEUE ══');
const r1 = await fetch(
  `${url}/rest/v1/upload_queue?select=id,file_name,status,outcome_code,normalized_doc_ref,fiscal_year,confidence,warnings,error_message,extracted_data,processed_at,created_at&client_id=eq.${cid}&file_name=ilike.*ATSIRE01FR_61_1673*&limit=1`,
  { headers: h }
);
const uq = (await r1.json())?.[0];
if (!uq) { console.log('NOT FOUND'); process.exit(1); }
const ed = uq.extracted_data || {};
console.log(`  id: ${uq.id}`);
console.log(`  file: ${uq.file_name}`);
console.log(`  status: ${uq.status} | outcome: ${uq.outcome_code}`);
console.log(`  normalized_doc_ref: ${uq.normalized_doc_ref}`);
console.log(`  fiscal_year: ${uq.fiscal_year}`);
console.log(`  confidence: ${uq.confidence}`);
console.log(`  processed_at: ${uq.processed_at}`);
console.log(`  warnings: ${JSON.stringify(uq.warnings)}`);
console.log(`  error_message: ${uq.error_message}`);
console.log(`  extracted_data:`);
console.log(`    beneficiary_nif: ${ed.beneficiary_nif}`);
console.log(`    beneficiary_name: ${ed.beneficiary_name}`);
console.log(`    payer_nif: ${ed.payer_nif}`);
console.log(`    gross_amount: ${ed.gross_amount}`);
console.log(`    withholding_amount: ${ed.withholding_amount}`);
console.log(`    withholding_rate: ${ed.withholding_rate}`);
console.log(`    withholding_status: ${ed.withholding_status}`);
console.log(`    document_reference: ${ed.document_reference}`);
console.log(`    payment_date: ${ed.payment_date}`);
console.log(`    income_category: ${ed.income_category}`);

// 2. Tax withholdings — search by multiple criteria
console.log('\n══ 2. TAX WITHHOLDINGS SEARCH ══');

// By NIF + normalized ref
const r2a = await fetch(
  `${url}/rest/v1/tax_withholdings?select=id,beneficiary_nif,document_reference,gross_amount,withholding_amount,created_at&client_id=eq.${cid}&beneficiary_nif=eq.118298496&document_reference=eq.ATSIRE01FR/61&fiscal_year=eq.2025`,
  { headers: h }
);
const tw_exact = await r2a.json();
console.log(`  By NIF=118298496 + ref=ATSIRE01FR/61: ${tw_exact?.length || 0}`);
for (const t of (tw_exact || [])) console.log(`    id=${t.id} base=${t.gross_amount} irs=${t.withholding_amount} created=${t.created_at}`);

// By ref only (any NIF)
const r2b = await fetch(
  `${url}/rest/v1/tax_withholdings?select=id,beneficiary_nif,document_reference,gross_amount,withholding_amount&client_id=eq.${cid}&document_reference=eq.ATSIRE01FR/61&fiscal_year=eq.2025`,
  { headers: h }
);
const tw_ref = await r2b.json();
console.log(`  By ref=ATSIRE01FR/61 (any NIF): ${tw_ref?.length || 0}`);
for (const t of (tw_ref || [])) console.log(`    nif=${t.beneficiary_nif} base=${t.gross_amount} irs=${t.withholding_amount}`);

// By NIF only - count irs>0
const r2c = await fetch(
  `${url}/rest/v1/tax_withholdings?select=id&client_id=eq.${cid}&beneficiary_nif=eq.118298496&fiscal_year=eq.2025&withholding_amount=gt.0`,
  { headers: { ...h, 'Prefer': 'count=exact', 'Range': '0-0' } }
);
console.log(`  By NIF=118298496 (irs>0): ${r2c.headers.get('content-range')}`);

// 3. Check if the normalized_doc_ref matches what dedupe would use
console.log('\n══ 3. DEDUPE ANALYSIS ══');
console.log(`  upload_queue normalized_doc_ref: "${uq.normalized_doc_ref}"`);
console.log(`  AI document_reference: "${ed.document_reference}"`);

// The dedupe query uses: client_id + beneficiary_nif + document_reference + fiscal_year
// document_reference in TW comes from resolveCanonicalReference()
// For this file: ATSIRE01FR_61 in filename → ATSIRE01FR/61
// But the AI returned "FR ATSIRE01FR/61" — does normalizeDocumentReference strip "FR "?
const aiRef = ed.document_reference || '';
console.log(`  AI ref after prefix strip would be: "${aiRef.replace(/^(FRI |FTI |RGI |FR |FT |RG |NC |ND |R |F )/, '')}"`);

// 4. Check what the convergence report sees
console.log('\n══ 4. CONVERGENCE CHECK for NIF 118298496 ══');
const atCsvPath = '/Users/bilal/Programaçao/ivazen-saas/output/spreadsheet/CAAD_508840309_modelo10_beneficiarios_2025.csv';
const atCsv = readFileSync(atCsvPath, 'utf-8').replace(/^\uFEFF/, '');
const atLines = atCsv.split('\n').filter(l => l.trim());
let atDocs = 0, atBase = 0, atIrs = 0;
for (let i = 1; i < atLines.length; i++) {
  const cols = atLines[i].split(',');
  if (cols[0] === '118298496') {
    atDocs += parseInt(cols[2]);
    atBase += parseFloat(cols[3]);
    atIrs += parseFloat(cols[5]);
  }
}
console.log(`  AT: ${atDocs} docs, base=${atBase.toFixed(2)}, irs=${atIrs.toFixed(2)}`);

let ocrDocs = [];
let offset = 0;
while (true) {
  const r = await fetch(
    `${url}/rest/v1/tax_withholdings?select=document_reference,gross_amount,withholding_amount&client_id=eq.${cid}&fiscal_year=eq.2025&beneficiary_nif=eq.118298496&withholding_amount=gt.0&order=document_reference&offset=${offset}&limit=200`,
    { headers: h }
  );
  const page = await r.json();
  if (!Array.isArray(page) || page.length === 0) break;
  ocrDocs.push(...page);
  offset += page.length;
  if (page.length < 200) break;
}
const ocrIrs = ocrDocs.reduce((s,d) => s + d.withholding_amount, 0);
const ocrBase = ocrDocs.reduce((s,d) => s + d.gross_amount, 0);
console.log(`  OCR (irs>0): ${ocrDocs.length} docs, base=${ocrBase.toFixed(2)}, irs=${ocrIrs.toFixed(2)}`);
console.log(`  Delta: ${Math.abs(ocrIrs - atIrs).toFixed(2)} EUR IRS, ${Math.abs(ocrDocs.length - atDocs)} docs`);

// 5. Also audit historical /61 mismatches for other NIFs.
for (const nif of ['103595503', '142340391']) {
  console.log(`\n══ 5. MISMATCH NIF ${nif} ══`);

  // Look at every completed upload for the NIF, not only SAVED.
  // The historical false conclusion here was caused by ignoring
  // SKIPPED_DUPLICATE rows that still prove the file was uploaded.
  const r_uq = await fetch(
    `${url}/rest/v1/upload_queue?select=id,file_name,outcome_code,normalized_doc_ref,extracted_data&client_id=eq.${cid}&status=eq.completed&extracted_data->>beneficiary_nif=eq.${nif}&limit=100`,
    { headers: h }
  );
  const uqItems = await r_uq.json();

  let missingCount = 0;
  const outcomeCounts = {};
  for (const item of (uqItems || [])) {
    outcomeCounts[item.outcome_code || 'null'] = (outcomeCounts[item.outcome_code || 'null'] || 0) + 1;
    const ied = item.extracted_data || {};
    const ref = item.normalized_doc_ref || ied.document_reference;
    if (item.outcome_code !== 'SAVED' && item.outcome_code !== 'SKIPPED_DUPLICATE') {
      continue;
    }
    // Check if TW exists
    const r_tw = await fetch(
      `${url}/rest/v1/tax_withholdings?select=id&client_id=eq.${cid}&beneficiary_nif=eq.${nif}&document_reference=eq.${ref}&fiscal_year=eq.2025&limit=1`,
      { headers: h }
    );
    const tw = await r_tw.json();
    if (!tw?.length) {
      missingCount++;
      console.log(`  DRIFT: ${item.file_name} → SAVED, ref=${ref}, irs=${ied.withholding_amount} — NO TW`);
    }
  }
  console.log(`  Completed upload outcomes: ${JSON.stringify(outcomeCounts)}`);
  if (missingCount === 0) {
    console.log('  No drift found among uploaded / completed items for this NIF');
    // Check AT vs OCR doc count
    let at_d = 0;
    for (let i = 1; i < atLines.length; i++) {
      const cols = atLines[i].split(',');
      if (cols[0] === nif) at_d += parseInt(cols[2]);
    }
    const r_tw_count = await fetch(
      `${url}/rest/v1/tax_withholdings?select=id&client_id=eq.${cid}&beneficiary_nif=eq.${nif}&fiscal_year=eq.2025&withholding_amount=gt.0`,
      { headers: { ...h, 'Prefer': 'count=exact', 'Range': '0-0' } }
    );
    console.log(`  AT: ${at_d} docs, OCR: ${r_tw_count.headers.get('content-range')}`);
    console.log('  → If a gap remains, inspect cleanup / duplicate handling before concluding missing input');
  }
}
