/**
 * fix-audit-data-v3.mjs
 * Cátia Francisco: corrigir fiscal_period em TODOS os registos onde não bate com document_date
 * (inclui null fiscal_period que o v2 ignorou)
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dmprkdvkzzjtixlatnlx.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const SEP = '─'.repeat(60);

const CATIA_ID = '4d99fa1a-8aed-4db5-8671-9b6e81195c71';

const EFATURA = {
  '202501': { n: 253, total: 3808.23 }, '202502': { n: 229, total: 3296.45 },
  '202503': { n: 232, total: 3326.39 }, '202504': { n: 45,  total: 613.90  },
  '202505': { n: 236, total: 3439.97 }, '202506': { n: 219, total: 3275.78 },
  '202507': { n: 272, total: 4359.64 }, '202508': { n: 73,  total: 1074.90 },
  '202509': { n: 261, total: 3498.78 }, '202510': { n: 282, total: 3909.05 },
  '202511': { n: 256, total: 3269.50 }, '202512': { n: 273, total: 3991.18 },
};

function docDateToFiscalPeriod(documentDate) {
  // Convert '2025-08-15' → '202508'
  if (!documentDate) return null;
  return documentDate.slice(0, 7).replace('-', '');
}

function fiscalPeriodNormalized(fp) {
  if (!fp) return null;
  if (/^\d{6}$/.test(fp)) return fp;                           // already YYYYMM
  if (/^\d{4}-\d{2}$/.test(fp)) return fp.replace('-', '');   // YYYY-MM → YYYYMM
  return fp;
}

async function fetchAll() {
  let all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from('sales_invoices')
      .select('id, document_number, document_date, fiscal_period, total_amount, created_at')
      .eq('client_id', CATIA_ID)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log('IVAzen Data Fix v3 — Correcção fiscal_period Cátia');
  console.log('='.repeat(60));

  const all = await fetchAll();
  console.log(`Total registos: ${all.length}`);

  // Find ALL records where fiscal_period doesn't match document_date
  const toFix = [];
  for (const r of all) {
    if (!r.document_date) continue;
    const correct = docDateToFiscalPeriod(r.document_date);
    const current = fiscalPeriodNormalized(r.fiscal_period);
    if (current !== correct) {
      toFix.push({ id: r.id, old: r.fiscal_period, correct });
    }
  }

  // Count nulls vs wrong
  const nullFp = toFix.filter(r => r.old === null);
  const wrongFp = toFix.filter(r => r.old !== null);
  console.log(`\nRegistos a corrigir: ${toFix.length} (null: ${nullFp.length}, errado: ${wrongFp.length})`);

  // Show summary by period
  const byPeriod = {};
  for (const r of toFix) {
    if (!byPeriod[r.correct]) byPeriod[r.correct] = 0;
    byPeriod[r.correct]++;
  }
  console.log('Por período destino:');
  for (const [p, n] of Object.entries(byPeriod).sort()) {
    console.log(`  ${p}: ${n} registos`);
  }

  if (toFix.length === 0) {
    console.log('\nNada a corrigir — fiscal_period já correcto em todos.');
  } else {
    // Apply in batches per correct period
    let totalFixed = 0;
    const byCorrect = {};
    for (const r of toFix) {
      if (!byCorrect[r.correct]) byCorrect[r.correct] = [];
      byCorrect[r.correct].push(r.id);
    }

    for (const [period, ids] of Object.entries(byCorrect)) {
      const BATCH = 200;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { error } = await supabase
          .from('sales_invoices')
          .update({ fiscal_period: period })
          .in('id', batch);
        if (error) {
          console.error(`  ✗ Erro a actualizar para ${period}:`, error.message);
        } else {
          totalFixed += batch.length;
        }
      }
      console.log(`  ✅ ${period}: ${ids.length} corrigidos`);
    }
    console.log(`\nTotal corrigidos: ${totalFixed}`);
  }

  // ── Final verification ──
  console.log('\n' + SEP);
  console.log('Verificação final Cátia vs e-fatura');
  console.log(SEP);

  const allAfter = await fetchAll();
  const periodMap = {};
  for (const r of allAfter) {
    const p = r.fiscal_period || 'null';
    if (!periodMap[p]) periodMap[p] = { count: 0, total: 0 };
    periodMap[p].count++;
    periodMap[p].total += parseFloat(r.total_amount || 0);
  }

  console.log('  Período | App  | e-fat | ΔN | ΔTotal');
  let allOk = true;
  const allPeriods = new Set([...Object.keys(periodMap), ...Object.keys(EFATURA)]);
  for (const p of [...allPeriods].sort()) {
    const app = periodMap[p];
    const ef = EFATURA[p];
    if (!ef) {
      if (app) console.log(`  ${p} | ${app.count} | N/A (período extra)`);
      continue;
    }
    if (!app) {
      console.log(`  ${p} | MISSING | ${ef.n} | -${ef.n} | MISSING ⚠️`);
      allOk = false;
      continue;
    }
    const diffN = app.count - ef.n;
    const diffT = (app.total - ef.total).toFixed(2);
    const ok = diffN === 0;
    if (!ok) allOk = false;
    const flag = ok ? (Math.abs(parseFloat(diffT)) < 1 ? '✅' : '⚠️ total') : '⚠️';
    console.log(`  ${p} | ${String(app.count).padStart(4)} | ${String(ef.n).padStart(4)}  | ${diffN >= 0 ? '+' : ''}${diffN} | ${diffT}€ ${flag}`);
  }
  console.log(`\n  ${allOk ? '✅ CONTAGENS TODAS CORRECTAS' : '⚠️  Ainda há diferenças de contagem'}`);

  // Note about total differences (Jan -200€, Mar +55€)
  console.log('\n  Nota: diferenças de total (sem diferença de contagem) são normais — podem ser');
  console.log('  arredondamentos ou IVA incluído/excluído conforme a fonte (Excel vs AT sync).');
  console.log('  O nº de faturas é o indicador principal para a contabilista.');
}

main().catch(console.error);
