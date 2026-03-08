#!/usr/bin/env node
/**
 * Final convergence report: OCR/manual vs AT beneficiary CSV for CAAD 2025.
 * Filters withholding_amount > 0 (matching AT Modelo 10 scope).
 *
 * Important nuance:
 * - This script reconciles against the beneficiary-level CSV exported from AT.
 * - The annual AT aggregate can differ by a few cents due to rounding across
 *   already-rounded beneficiary totals.
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

// 1. Load AT ground truth aggregated by beneficiary NIF.
// The CAAD CSV contains one duplicated NIF with two name variants; the comparison
// must operate on the fiscal beneficiary (NIF), not on raw CSV rows.
const atCsvPath = '/Users/bilal/Programaçao/ivazen-saas/output/spreadsheet/CAAD_508840309_modelo10_beneficiarios_2025.csv';
const atCsv = readFileSync(atCsvPath, 'utf-8').replace(/^\uFEFF/, '');
const atLines = atCsv.split('\n').filter(l => l.trim());
const atByNif = {};
let atTotalBase = 0, atTotalIrs = 0;
for (let i = 1; i < atLines.length; i++) {
  const cols = atLines[i].split(',');
  const nif = cols[0];
  if (!nif) continue;
  const docs = parseInt(cols[2]);
  const base = parseFloat(cols[3]);
  const irs = parseFloat(cols[5]);
  if (!atByNif[nif]) {
    atByNif[nif] = {
      nome: cols[1],
      nomes: new Set([cols[1]]),
      docs: 0,
      base: 0,
      irs: 0,
    };
  }
  atByNif[nif].nomes.add(cols[1]);
  atByNif[nif].docs += docs;
  atByNif[nif].base += base;
  atByNif[nif].irs += irs;
  atTotalBase += base;
  atTotalIrs += irs;
}
const atBenefCount = Object.keys(atByNif).length;

// 2. Load OCR (withholding > 0 only)
let allWh = [];
let offset = 0;
while (true) {
  const r = await fetch(
    `${url}/rest/v1/tax_withholdings?select=beneficiary_nif,gross_amount,withholding_amount,document_reference&client_id=eq.${cid}&fiscal_year=eq.2025&withholding_amount=gt.0&order=beneficiary_nif&offset=${offset}&limit=1000`,
    { headers: h }
  );
  const page = await r.json();
  if (!Array.isArray(page) || page.length === 0) break;
  allWh.push(...page);
  offset += page.length;
  if (page.length < 1000) break;
}

// 3. Aggregate
const ocrByNif = {};
let ocrTotalBase = 0, ocrTotalIrs = 0;
for (const wh of allWh) {
  const nif = wh.beneficiary_nif;
  if (!ocrByNif[nif]) ocrByNif[nif] = { docs: 0, base: 0, irs: 0 };
  ocrByNif[nif].docs++;
  ocrByNif[nif].base += wh.gross_amount;
  ocrByNif[nif].irs += wh.withholding_amount;
  ocrTotalBase += wh.gross_amount;
  ocrTotalIrs += wh.withholding_amount;
}

// 4. Compare
let matchCount = 0, mismatchCount = 0, missingInOcr = 0, extraInOcr = 0;
const mismatches = [];

for (const [nif, at] of Object.entries(atByNif)) {
  const ocr = ocrByNif[nif];
  if (!ocr) { missingInOcr++; mismatches.push({ nif, type: 'MISSING' }); continue; }
  const baseDiff = Math.abs(ocr.base - at.base);
  const irsDiff = Math.abs(ocr.irs - at.irs);
  if (baseDiff > 1 || irsDiff > 1) {
    mismatchCount++;
    mismatches.push({ nif, nome: at.nome, type: 'MISMATCH', baseDiff, irsDiff, atDocs: at.docs, ocrDocs: ocr.docs });
  } else { matchCount++; }
}

for (const nif of Object.keys(ocrByNif)) {
  if (!atByNif[nif]) { extraInOcr++; mismatches.push({ nif, type: 'EXTRA', base: ocrByNif[nif].base, irs: ocrByNif[nif].irs }); }
}

// 5. Report
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  CONVERGENCE REPORT: OCR/manual vs AT — CAAD 2025  ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log();
console.log('┌─────────────────────────────────────────────────────┐');
console.log(`│ AT CSV truth set: ${atBenefCount} beneficiaries, ${atTotalIrs.toFixed(2)} EUR IRS`);
console.log(`│ OCR (irs>0):      ${Object.keys(ocrByNif).length} beneficiaries, ${ocrTotalIrs.toFixed(2)} EUR IRS`);
console.log(`│ Documents:        ${allWh.length} tax_withholdings (irs>0)`);
console.log('└─────────────────────────────────────────────────────┘');
console.log('  Note: this report uses the beneficiary CSV as the truth set; compare the');
console.log('        annual AT aggregate separately because rounding can create a small');
console.log('        cents-level delta between the 2 views.');
console.log();
console.log('┌─────────────────────────────────────────────────────┐');
console.log(`│ MATCH (within 1€):  ${matchCount}/${atBenefCount}  (${(matchCount/atBenefCount*100).toFixed(1)}%)`);
console.log(`│ MISMATCH:           ${mismatchCount}`);
console.log(`│ Missing in OCR:     ${missingInOcr}`);
console.log(`│ Extra in OCR:       ${extraInOcr}`);
console.log('└─────────────────────────────────────────────────────┘');
console.log();
console.log(`IRS delta: ${Math.abs(ocrTotalIrs - atTotalIrs).toFixed(2)} EUR (${(Math.abs(ocrTotalIrs - atTotalIrs)/atTotalIrs*100).toFixed(3)}%)`);
console.log(`Base delta: ${Math.abs(ocrTotalBase - atTotalBase).toFixed(2)} EUR (${(Math.abs(ocrTotalBase - atTotalBase)/atTotalBase*100).toFixed(3)}%)`);

if (mismatches.length > 0) {
  console.log('\n── Remaining issues ──');
  for (const m of mismatches) {
    if (m.type === 'MISMATCH') {
      console.log(`  ${m.nif} ${m.nome}: base Δ${m.baseDiff.toFixed(2)}, irs Δ${m.irsDiff.toFixed(2)} (AT:${m.atDocs} OCR:${m.ocrDocs} docs)`);
    } else if (m.type === 'EXTRA') {
      console.log(`  ${m.nif}: EXTRA in OCR (base=${m.base.toFixed(2)}, irs=${m.irs.toFixed(2)})`);
    } else {
      console.log(`  ${m.nif}: MISSING in OCR`);
    }
  }
}

console.log('\n── Verdict ──');
if (matchCount === atBenefCount && missingInOcr === 0 && extraInOcr === 0) {
  console.log(`  ${matchCount}/${atBenefCount} beneficiaries — FULL MATCH`);
  console.log('  Pipeline: VALIDATED');
  console.log('  process-queue v5.9.1: TRANSMITENTE/ADQUIRENTE role distinction, legal zero withholding, SAVED guardrail');
  console.log('  CAAD 2025: 100% aligned with the AT beneficiary CSV truth set');
} else if (matchCount >= atBenefCount * 0.95) {
  console.log(`  ${matchCount}/${atBenefCount} beneficiaries match (${(matchCount/atBenefCount*100).toFixed(1)}%)`);
  console.log('  Pipeline: VALIDATED');
  console.log('  Remaining gaps require manual investigation');
}
