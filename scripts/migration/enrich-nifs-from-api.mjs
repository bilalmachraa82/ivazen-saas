#!/usr/bin/env node
/**
 * Enrich supplier_name + supplier_cae for invoices missing names.
 * Uses NIF.PT API (https://www.nif.pt/api/) — €10 per 1000 lookups.
 *
 * Usage:
 *   node scripts/migration/enrich-nifs-from-api.mjs --key=YOUR_NIF_PT_KEY
 *   node scripts/migration/enrich-nifs-from-api.mjs --key=YOUR_KEY --dry-run
 *   node scripts/migration/enrich-nifs-from-api.mjs --key=YOUR_KEY --limit=10
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
} catch {}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};
const NIF_PT_KEY = getArg('key');
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(getArg('limit') || '0') || 0;

if (!NIF_PT_KEY) {
  console.error(`
╔══════════════════════════════════════════════════════════╗
║  NIF.PT API Key Required                                ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  1. Vai a https://www.nif.pt/api/                        ║
║  2. Cria conta (email + password)                        ║
║  3. Compra créditos (€10 = 1000 lookups)                 ║
║  4. Copia a API key do dashboard                         ║
║  5. Corre:                                               ║
║                                                          ║
║  node scripts/migration/enrich-nifs-from-api.mjs \\       ║
║    --key=A_TUA_API_KEY                                   ║
║                                                          ║
║  Flags opcionais:                                        ║
║    --dry-run    Ver resultados sem gravar                 ║
║    --limit=10   Testar com poucos NIFs                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

// Rate limiter: max 10 requests/second for NIF.PT
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function lookupNif(nif) {
  const url = `https://www.nif.pt/?json=1&q=${nif}&key=${NIF_PT_KEY}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 403) return { error: 'API key inválida ou sem créditos' };
      if (resp.status === 429) return { error: 'Rate limit — aguardar' };
      return { error: `HTTP ${resp.status}` };
    }
    const data = await resp.json();
    if (data.result === 'error') {
      return { error: data.message || 'NIF não encontrado' };
    }
    // NIF.PT returns: nif_validation, title, address, pc4, pc3, city, activity, cae, ...
    const record = data.records?.[nif] || data.records?.[Object.keys(data.records || {})[0]];
    if (!record) return { error: 'Sem dados' };
    return {
      name: record.title || null,
      cae: record.cae || null,
      activity: record.activity || null,
      city: record.city || null,
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  console.log(`\n=== Enrich NIFs from NIF.PT API ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // Step 1: Find NIFs that are NOT yet in supplier_directory
  // First get all distinct NIFs from invoices
  const { data: rows, error: qErr } = await supabase
    .from('invoices')
    .select('supplier_nif')
    .not('supplier_nif', 'is', null)
    .neq('supplier_nif', 'AT');

  if (qErr) { console.error('Query error:', qErr); return; }

  const allNifs = [...new Set(rows.map(r => r.supplier_nif))]
    .filter(nif => /^\d{9}$/.test(nif));

  // Check which ones already exist in supplier_directory
  const existing = new Set();
  for (let i = 0; i < allNifs.length; i += 100) {
    const batch = allNifs.slice(i, i + 100);
    const { data: dirRows } = await supabase
      .from('supplier_directory')
      .select('nif')
      .in('nif', batch);
    for (const r of (dirRows || [])) existing.add(r.nif);
  }

  const uniqueNifs = allNifs.filter(nif => !existing.has(nif));
  const nifsToProcess = LIMIT > 0 ? uniqueNifs.slice(0, LIMIT) : uniqueNifs;

  console.log(`Total NIFs PT distintos: ${allNifs.length}`);
  console.log(`Já no supplier_directory: ${existing.size}`);
  console.log(`Faltam: ${uniqueNifs.length}`);
  console.log(`A processar: ${nifsToProcess.length}`);
  console.log(`Custo estimado: €${(nifsToProcess.length * 0.01).toFixed(2)}\n`);

  if (nifsToProcess.length === 0) {
    console.log('Nada a fazer!');
    return;
  }

  // Step 2: Lookup each NIF
  let found = 0;
  let notFound = 0;
  let errors = 0;
  const results = [];

  for (let i = 0; i < nifsToProcess.length; i++) {
    const nif = nifsToProcess[i];
    process.stdout.write(`[${i + 1}/${nifsToProcess.length}] NIF ${nif}... `);

    const result = await lookupNif(nif);

    if (result.error) {
      console.log(`❌ ${result.error}`);
      if (result.error.includes('Rate limit')) {
        console.log('   Aguardando 5s...');
        await sleep(5000);
        i--; // Retry
        continue;
      }
      if (result.error.includes('inválida')) {
        console.error('\n⛔ API key inválida. Verifica a chave.\n');
        return;
      }
      errors++;
      continue;
    }

    if (result.name) {
      console.log(`✅ ${result.name} (CAE: ${result.cae || 'N/A'})`);
      found++;
      results.push({ nif, ...result });
    } else {
      console.log(`⚠️ Sem nome`);
      notFound++;
    }

    // Rate limit: ~5 req/s to be safe
    await sleep(200);
  }

  console.log(`\n=== Lookup Complete ===`);
  console.log(`✅ Encontrados: ${found}`);
  console.log(`⚠️ Sem dados: ${notFound}`);
  console.log(`❌ Erros: ${errors}`);

  if (found === 0) {
    console.log('\nNenhum nome encontrado. Nada a atualizar.');
    return;
  }

  // Step 3: Save to supplier_directory + propagate to invoices
  if (DRY_RUN) {
    console.log('\n[DRY RUN] Resultados que seriam gravados no supplier_directory:');
    for (const r of results) {
      console.log(`  ${r.nif} → ${r.name} (CAE: ${r.cae || 'N/A'}, ${r.activity || ''})`);
    }
    return;
  }

  console.log(`\nA gravar ${found} fornecedores no supplier_directory...`);
  let dirSaved = 0;
  let invoicesUpdated = 0;

  for (const r of results) {
    // 1. Upsert into supplier_directory (source of truth)
    const { error: dirErr } = await supabase
      .from('supplier_directory')
      .upsert({
        nif: r.nif,
        name: r.name,
        cae: r.cae || null,
        activity: r.activity || null,
        city: r.city || null,
        source: 'nif_pt',
        confidence: 90,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'nif' });

    if (dirErr) {
      console.error(`  ❌ supplier_directory ${r.nif}:`, dirErr.message);
      continue;
    }
    dirSaved++;

    // 2. Propagate to invoices missing name
    const updateData = { supplier_name: r.name };
    if (r.cae) updateData.supplier_cae = r.cae;

    const { count } = await supabase
      .from('invoices')
      .update(updateData, { count: 'exact' })
      .eq('supplier_nif', r.nif)
      .or('supplier_name.is.null,supplier_name.eq.');

    invoicesUpdated += (count || 0);

    // 3. Also propagate to sales_invoices
    await supabase
      .from('sales_invoices')
      .update(updateData)
      .eq('supplier_nif', r.nif)
      .or('supplier_name.is.null,supplier_name.eq.');
  }

  console.log(`\n=== Done ===`);
  console.log(`supplier_directory: ${dirSaved} entradas`);
  console.log(`Faturas atualizadas: ${invoicesUpdated}`);
  console.log(`Créditos NIF.PT usados: ${nifsToProcess.length}`);
}

main().catch(console.error);
