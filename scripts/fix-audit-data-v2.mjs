/**
 * fix-audit-data-v2.mjs — Segunda passagem
 * 1. Limpar 62 duplicados restantes da Cátia (Março)
 * 2. Corrigir fiscal_period para registos cujo document_date não bate com o período
 * 3. Encontrar Rafael correcto e verificar dados
 * 4. Diagnóstico final Cátia vs e-fatura
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dmprkdvkzzjtixlatnlx.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const SEP = '─'.repeat(60);

const CATIA_ID   = '4d99fa1a-8aed-4db5-8671-9b6e81195c71';
const MARIA_ID   = '75e5b973-6b8f-47ba-a1bb-c6988eed86e1';

// e-fatura reference data (from PDF)
const EFATURA = {
  '2025-01': { n: 253, total: 3808.23 }, '202501': { n: 253, total: 3808.23 },
  '2025-02': { n: 229, total: 3296.45 }, '202502': { n: 229, total: 3296.45 },
  '2025-03': { n: 232, total: 3326.39 }, '202503': { n: 232, total: 3326.39 },
  '2025-04': { n: 45,  total: 613.90  }, '202504': { n: 45,  total: 613.90  },
  '2025-05': { n: 236, total: 3439.97 }, '202505': { n: 236, total: 3439.97 },
  '2025-06': { n: 219, total: 3275.78 }, '202506': { n: 219, total: 3275.78 },
  '2025-07': { n: 272, total: 4359.64 }, '202507': { n: 272, total: 4359.64 },
  '2025-08': { n: 73,  total: 1074.90 }, '202508': { n: 73,  total: 1074.90 },
  '2025-09': { n: 261, total: 3498.78 }, '202509': { n: 261, total: 3498.78 },
  '2025-10': { n: 282, total: 3909.05 }, '202510': { n: 282, total: 3909.05 },
  '2025-11': { n: 256, total: 3269.50 }, '202511': { n: 256, total: 3269.50 },
  '2025-12': { n: 273, total: 3991.18 }, '202512': { n: 273, total: 3991.18 },
};

// ──────────────────────────────────────────────
// Find Rafael correcto (full name)
// ──────────────────────────────────────────────
async function findRafael() {
  console.log('\n' + SEP);
  console.log('STEP 0: Encontrar Rafael Paisano correcto');
  console.log(SEP);

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, company_name, email, nif')
    .ilike('full_name', '%Rafael%Paisano%');

  if (!data || data.length === 0) {
    // Try just Paisano
    const { data: d2 } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, email, nif')
      .ilike('full_name', '%Paisano%');
    console.log('  Todos os Paisano:');
    (d2 || []).forEach(p => console.log(`    ${p.id} | ${p.full_name} | ${p.email} | NIF:${p.nif}`));
    return d2?.[0]?.id;
  }

  data.forEach(p => console.log(`  ${p.id} | ${p.full_name} | ${p.email} | NIF:${p.nif}`));
  // Find the one with "Rafael" specifically (not Diandra)
  const rafael = data.find(p => p.full_name?.toLowerCase().includes('rafael'));
  if (rafael) {
    console.log(`  → Usando: ${rafael.id} | ${rafael.full_name}`);
    return rafael.id;
  }
  return data[0]?.id;
}

// ──────────────────────────────────────────────
// Full dump of Cátia's document_date distribution
// ──────────────────────────────────────────────
async function catiaFullDump() {
  console.log('\n' + SEP);
  console.log('STEP 1: Cátia — distribuição por document_date (todos os registos)');
  console.log(SEP);

  // Fetch ALL records — paginated
  let all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from('sales_invoices')
      .select('id, document_number, document_date, fiscal_period, total_amount, created_at')
      .eq('client_id', CATIA_ID)
      .order('document_date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`  Total registos: ${all.length}`);

  // Group by document_date month
  const byDateMonth = {};
  for (const r of all) {
    const month = r.document_date?.slice(0, 7); // YYYY-MM
    if (!byDateMonth[month]) byDateMonth[month] = { count: 0, total: 0 };
    byDateMonth[month].count++;
    byDateMonth[month].total += parseFloat(r.total_amount || 0);
  }

  // Group by fiscal_period
  const byFiscal = {};
  for (const r of all) {
    const p = r.fiscal_period || 'null';
    if (!byFiscal[p]) byFiscal[p] = { count: 0, total: 0 };
    byFiscal[p].count++;
    byFiscal[p].total += parseFloat(r.total_amount || 0);
  }

  console.log('\n  Por document_date (mes):');
  console.log('  Mês       | App | e-fatura | Diff');
  const dateMonths = Object.keys(byDateMonth).sort();
  for (const m of dateMonths) {
    const app = byDateMonth[m];
    // normalize: 2025-05 → 2025-05
    const ef = EFATURA[m] || EFATURA[m?.replace('-', '')];
    const efStr = ef ? `${ef.n}` : 'N/A';
    const diff = ef ? app.count - ef.n : '?';
    const flag = diff !== 0 ? ' ⚠️' : ' ✓';
    console.log(`  ${m} | ${String(app.count).padStart(5)} | ${efStr.padStart(8)} | ${diff}${flag}`);
  }

  console.log('\n  Por fiscal_period:');
  const fiscalPeriods = Object.keys(byFiscal).sort();
  for (const p of fiscalPeriods) {
    const app = byFiscal[p];
    const ef = EFATURA[p];
    const efStr = ef ? `${ef.n}` : 'N/A';
    const diff = ef ? app.count - ef.n : '?';
    const flag = typeof diff === 'number' && diff !== 0 ? ' ⚠️' : ' ✓';
    console.log(`  ${p.padEnd(8)} | ${String(app.count).padStart(5)} | ${efStr.padStart(8)} | ${diff}${flag}`);
  }

  // Find fiscal_period mismatches: where fiscal_period month ≠ document_date month
  const mismatches = all.filter(r => {
    if (!r.document_date || !r.fiscal_period) return false;
    const docMonth = r.document_date.slice(0, 7); // YYYY-MM
    // Normalize fiscal_period to YYYY-MM
    let fpMonth = r.fiscal_period;
    if (/^\d{6}$/.test(fpMonth)) fpMonth = fpMonth.slice(0, 4) + '-' + fpMonth.slice(4);
    return docMonth !== fpMonth;
  });

  console.log(`\n  Registos com fiscal_period ≠ document_date mês: ${mismatches.length}`);
  if (mismatches.length > 0) {
    // Show first 10
    mismatches.slice(0, 10).forEach(r =>
      console.log(`    doc_date=${r.document_date} fp=${r.fiscal_period} doc_num=${r.document_number}`)
    );
  }

  return { all, byDateMonth, byFiscal, mismatches };
}

// ──────────────────────────────────────────────
// Fix fiscal_period mismatches
// ──────────────────────────────────────────────
async function fixFiscalPeriods(mismatches) {
  console.log('\n' + SEP);
  console.log(`STEP 2: Corrigir fiscal_period para ${mismatches.length} registos`);
  console.log(SEP);

  if (mismatches.length === 0) {
    console.log('  Nada a corrigir.');
    return;
  }

  // Group by correct fiscal_period
  const byCorrectPeriod = {};
  for (const r of mismatches) {
    const docMonth = r.document_date.slice(0, 7); // YYYY-MM
    const correctPeriod = docMonth.replace('-', ''); // YYYYMM compact format (check what format is in DB)
    // Determine which format to use: check existing fiscal_period format
    let useFormat = r.fiscal_period;
    // If existing is YYYYMM (6 digits), keep that format; if YYYY-MM, use that
    const correctFormatted = /^\d{6}$/.test(r.fiscal_period)
      ? docMonth.replace('-', '')  // YYYYMM
      : docMonth;                   // YYYY-MM

    if (!byCorrectPeriod[correctFormatted]) byCorrectPeriod[correctFormatted] = [];
    byCorrectPeriod[correctFormatted].push({ id: r.id, oldPeriod: r.fiscal_period });
  }

  console.log('  Correcções agrupadas:');
  for (const [newPeriod, records] of Object.entries(byCorrectPeriod)) {
    const oldPeriods = [...new Set(records.map(r => r.oldPeriod))];
    console.log(`    ${oldPeriods.join('/')} → ${newPeriod}: ${records.length} registos`);
  }

  // Apply corrections in batches
  let totalFixed = 0;
  for (const [newPeriod, records] of Object.entries(byCorrectPeriod)) {
    const ids = records.map(r => r.id);
    const BATCH = 100;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const { error } = await supabase
        .from('sales_invoices')
        .update({ fiscal_period: newPeriod })
        .in('id', batch);
      if (error) {
        console.error(`  ✗ Erro a actualizar batch para ${newPeriod}:`, error.message);
      } else {
        totalFixed += batch.length;
      }
    }
  }

  console.log(`  ✅ Corrigidos ${totalFixed} registos de fiscal_period`);
}

// ──────────────────────────────────────────────
// Second cleanup pass for remaining duplicates
// ──────────────────────────────────────────────
async function cleanRemainingDuplicates(all) {
  console.log('\n' + SEP);
  console.log('STEP 3: Segunda limpeza de duplicados restantes');
  console.log(SEP);

  const docGroups = {};
  for (const doc of all) {
    const key = `${doc.document_number}|${doc.document_date}`;
    if (!docGroups[key]) docGroups[key] = [];
    docGroups[key].push(doc);
  }

  const duplicates = Object.entries(docGroups).filter(([, docs]) => docs.length > 1);
  console.log(`  Duplicados encontrados após correcção de períodos: ${duplicates.length}`);

  if (duplicates.length === 0) {
    console.log('  Nada a limpar.');
    return;
  }

  const toDelete = [];
  for (const [, docs] of duplicates) {
    const sorted = docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    toDelete.push(...sorted.slice(1).map(d => d.id));
  }

  console.log(`  Eliminando ${toDelete.length} duplicados restantes...`);
  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    const { error } = await supabase.from('sales_invoices').delete().in('id', batch);
    if (error) console.error(`  ✗ Erro:`, error.message);
    else deleted += batch.length;
  }
  console.log(`  ✅ Eliminados ${deleted} duplicados`);
}

// ──────────────────────────────────────────────
// Final verification for Cátia
// ──────────────────────────────────────────────
async function finalVerifyCatia() {
  console.log('\n' + SEP);
  console.log('STEP 4: Verificação final Cátia vs e-fatura');
  console.log(SEP);

  const { data } = await supabase
    .from('sales_invoices')
    .select('fiscal_period, total_amount')
    .eq('client_id', CATIA_ID);

  const periodMap = {};
  for (const r of data || []) {
    const p = r.fiscal_period || 'null';
    if (!periodMap[p]) periodMap[p] = { count: 0, total: 0 };
    periodMap[p].count++;
    periodMap[p].total += parseFloat(r.total_amount || 0);
  }

  console.log('  Período | App     | e-fatura | Diff n | Diff total');
  let allOk = true;
  for (const p of Object.keys(periodMap).sort()) {
    const app = periodMap[p];
    const ef = EFATURA[p];
    if (!ef) {
      console.log(`  ${p.padEnd(8)} | ${app.count} | N/A (sem ref e-fatura)`);
      continue;
    }
    const diffN = app.count - ef.n;
    const diffT = (app.total - ef.total).toFixed(2);
    const ok = diffN === 0 && Math.abs(parseFloat(diffT)) < 1;
    if (!ok) allOk = false;
    console.log(`  ${p.padEnd(8)} | ${String(app.count).padStart(5)} | ${String(ef.n).padStart(5)}   | ${diffN > 0 ? '+' : ''}${diffN}  | ${diffT}€ ${ok ? '✓' : '⚠️'}`);
  }
  // Check for missing periods (e-fatura has data but app doesn't)
  for (const [p, ef] of Object.entries(EFATURA)) {
    if (!periodMap[p]) {
      console.log(`  ${p.padEnd(8)} | MISSING | ${ef.n}   | -${ef.n}  | MISSING ⚠️`);
      allOk = false;
    }
  }
  console.log(`\n  Resultado: ${allOk ? '✅ TUDO CORRECTO' : '⚠️  Ainda há diferenças (ver acima)'}`);
}

// ──────────────────────────────────────────────
// Rafael: check with correct ID
// ──────────────────────────────────────────────
async function diagnoseRafael(rafaelId) {
  console.log('\n' + SEP);
  console.log('STEP 5: Rafael Paisano — períodos de vendas');
  console.log(SEP);

  if (!rafaelId) { console.log('  ID não disponível'); return; }

  const { data: periods } = await supabase
    .from('sales_invoices')
    .select('fiscal_period, document_date')
    .eq('client_id', rafaelId)
    .order('document_date', { ascending: false })
    .limit(500);

  const unique = [...new Set((periods || []).map(p => p.fiscal_period))].filter(Boolean).sort().reverse();
  const has2026 = unique.some(p => p.startsWith('2026'));
  const has2025 = unique.some(p => p.startsWith('2025'));

  console.log(`  Total registos: ${periods?.length ?? 0}`);
  console.log(`  Períodos: ${unique.join(', ') || 'nenhum'}`);
  console.log(`  2026: ${has2026 ? '✅' : '✗ FALTA'}  2025: ${has2025 ? '✅' : '✗ FALTA'}`);

  if (!has2026) {
    console.log('\n  → Sem dados 2026. A verificar credenciais AT...');
    const { data: creds } = await supabase
      .from('at_credentials')
      .select('nif, sync_enabled, updated_at')
      .eq('client_id', rafaelId);

    if (!creds || creds.length === 0) {
      console.log('  ⚠️  Sem credenciais AT — necessário configurar no portal para fazer sync 2026');
    } else {
      creds.forEach(c => console.log(`  Credencial: nif=${c.nif} sync=${c.sync_enabled} updated=${c.updated_at}`));

      // Try to trigger sync
      console.log('  → A tentar sync AT...');
      const { data: syncResult, error: syncErr } = await supabase.functions.invoke('sync-efatura', {
        body: { client_id: rafaelId, source: 'manual', force: true }
      });
      if (syncErr) {
        console.log(`  ✗ Sync falhou: ${syncErr.message}`);
      } else {
        console.log(`  ✓ Sync iniciado:`, JSON.stringify(syncResult).slice(0, 200));
      }
    }
  }
}

// ──────────────────────────────────────────────
// Maria Tereza: check accountant AT config
// ──────────────────────────────────────────────
async function diagnoseMaria() {
  console.log('\n' + SEP);
  console.log('STEP 6: Maria Tereza Silva — sem credenciais AT');
  console.log(SEP);

  // Check if accountant has AT config for this client
  const { data: atConfig } = await supabase
    .from('accountant_at_config')
    .select('*')
    .eq('client_id', MARIA_ID);

  console.log(`  accountant_at_config: ${atConfig?.length ?? 0} registos`);
  if (atConfig?.length > 0) {
    atConfig.forEach(c => console.log(`    ${JSON.stringify(c).slice(0, 150)}`));
  } else {
    console.log('  ⚠️  Sem configuração AT de contabilista para este cliente');
    console.log('  → ACÇÃO NECESSÁRIA: Raquela deve configurar credenciais AT da Maria Tereza');
    console.log('    via Settings > Clientes > Maria Tereza Silva > Configurar AT');
  }

  // Check at_credentials with service role
  const { data: creds } = await supabase
    .from('at_credentials')
    .select('id, nif, sync_enabled, client_id')
    .eq('client_id', MARIA_ID);
  console.log(`  at_credentials rows: ${creds?.length ?? 0}`);

  // Check profile completeness
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, nif, email')
    .eq('id', MARIA_ID)
    .single();
  console.log(`  Profile: ${JSON.stringify(profile)}`);
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log('IVAzen Data Fix v2 — Auditoria Raquela 24.03.2026');
  console.log('='.repeat(60));

  // Step 0: Find Rafael
  const rafaelId = await findRafael();

  // Step 1: Full dump of Cátia
  const { all, mismatches } = await catiaFullDump();

  // Step 2: Fix fiscal_period mismatches
  if (mismatches.length > 0) {
    await fixFiscalPeriods(mismatches);
  }

  // Reload after fiscal_period fixes
  let allUpdated = [];
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await supabase
        .from('sales_invoices')
        .select('id, document_number, document_date, fiscal_period, total_amount, created_at')
        .eq('client_id', CATIA_ID)
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      allUpdated = allUpdated.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  // Step 3: Second duplicate cleanup
  await cleanRemainingDuplicates(allUpdated);

  // Step 4: Final verification
  await finalVerifyCatia();

  // Step 5: Rafael
  await diagnoseRafael(rafaelId);

  // Step 6: Maria Tereza
  await diagnoseMaria();

  console.log('\n' + '='.repeat(60));
  console.log('FIM v2');
}

main().catch(console.error);
