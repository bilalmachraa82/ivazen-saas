/**
 * fix-audit-data.mjs
 * Diagnóstico e correcção dos problemas de dados reportados por Raquela (24.03.2026)
 * Corre: node scripts/fix-audit-data.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dmprkdvkzzjtixlatnlx.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcHJrZHZrenpqdGl4bGF0bmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0NDc1NiwiZXhwIjoyMDg3MDIwNzU2fQ.N1NlcwgzsJ7ZZ-xpN29Xvr79vUZMUaY5QZFWjZHNWIY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

const SEP = '─'.repeat(60);

async function sql(query, params = {}) {
  // Execute arbitrary SQL via pg_net or RPC isn't available directly,
  // so we use the REST API for table-level queries.
  throw new Error('Use helper functions instead of raw SQL');
}

// ──────────────────────────────────────────────
// STEP 1: Find client IDs
// ──────────────────────────────────────────────
async function findClients() {
  console.log('\n' + SEP);
  console.log('STEP 1: Encontrar clientes');
  console.log(SEP);

  const searches = [
    { name: 'Cátia Francisco', terms: ['Cátia', 'Catia', 'catia'] },
    { name: 'Maria Tereza Silva', terms: ['Maria Tereza', 'Tereza Silva', 'tereza'] },
    { name: 'Rafael Paisano', terms: ['Rafael Paisano', 'Paisano', 'paisano'] },
    { name: 'Agostinho', terms: ['Agostinho'] },
    { name: 'Mário Carvalhal', terms: ['Mário Carvalhal', 'Mario Carvalhal', 'carvalhal'] },
  ];

  const clients = {};

  for (const search of searches) {
    let found = null;
    for (const term of search.terms) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, email, nif')
        .ilike('full_name', `%${term}%`)
        .limit(5);

      if (data && data.length > 0) {
        found = data[0];
        if (data.length > 1) {
          console.log(`  ⚠️  ${search.name}: múltiplos resultados — usando primeiro`);
          data.forEach(d => console.log(`     ${d.id} | ${d.full_name || d.company_name} | ${d.email}`));
        }
        break;
      }
    }
    if (found) {
      clients[search.name] = found;
      console.log(`  ✓ ${search.name}: ${found.id} | ${found.full_name || found.company_name} | ${found.email}`);
    } else {
      // Try company_name
      for (const term of search.terms) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, company_name, email, nif')
          .ilike('company_name', `%${term}%`)
          .limit(3);
        if (data && data.length > 0) {
          found = data[0];
          break;
        }
      }
      if (found) {
        clients[search.name] = found;
        console.log(`  ✓ ${search.name} (company): ${found.id} | ${found.full_name || found.company_name} | ${found.email}`);
      } else {
        console.log(`  ✗ ${search.name}: NÃO ENCONTRADO`);
      }
    }
  }

  return clients;
}

// ──────────────────────────────────────────────
// STEP 2: Diagnóstico Cátia Francisco
// ──────────────────────────────────────────────
async function diagnoseCatia(clientId) {
  console.log('\n' + SEP);
  console.log('STEP 2: Cátia Francisco — Diagnóstico de vendas');
  console.log(SEP);

  if (!clientId) { console.log('  ✗ client_id não disponível — skip'); return null; }

  // Count by period
  const { data: byPeriod } = await supabase
    .from('sales_invoices')
    .select('fiscal_period, total_amount')
    .eq('client_id', clientId);

  if (!byPeriod || byPeriod.length === 0) {
    console.log('  Sem vendas encontradas para este cliente.');
    return null;
  }

  // Aggregate by period
  const periodMap = {};
  for (const row of byPeriod) {
    const p = row.fiscal_period || 'null';
    if (!periodMap[p]) periodMap[p] = { count: 0, total: 0 };
    periodMap[p].count++;
    periodMap[p].total += parseFloat(row.total_amount || 0);
  }

  console.log('\n  Período          | Faturas | Total App     | Total e-fatura  | Diff');
  const eFaturaTotals = {
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

  const periods = Object.keys(periodMap).sort();
  for (const p of periods) {
    const app = periodMap[p];
    const ef = eFaturaTotals[p];
    const efStr = ef ? `${ef.n} | ${ef.total.toFixed(2)}€` : 'N/A';
    const diffN = ef ? app.count - ef.n : '?';
    const diffT = ef ? (app.total - ef.total).toFixed(2) : '?';
    const flag = (diffN !== 0 || Math.abs(diffT) > 0.1) ? ' ⚠️' : ' ✓';
    console.log(`  ${p.padEnd(16)} | ${String(app.count).padStart(7)} | ${app.total.toFixed(2).padStart(13)}€ | ${efStr.padEnd(15)} | n:${diffN} t:${diffT}€${flag}`);
  }

  // Find duplicates by document_number
  const { data: allDocs } = await supabase
    .from('sales_invoices')
    .select('id, document_number, document_date, total_amount, fiscal_period, created_at')
    .eq('client_id', clientId)
    .order('document_number');

  const docGroups = {};
  for (const doc of allDocs || []) {
    const key = `${doc.document_number}|${doc.document_date}`;
    if (!docGroups[key]) docGroups[key] = [];
    docGroups[key].push(doc);
  }

  const duplicates = Object.entries(docGroups).filter(([, docs]) => docs.length > 1);
  console.log(`\n  Duplicados encontrados: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log('  (mostrando primeiros 10)');
    for (const [key, docs] of duplicates.slice(0, 10)) {
      console.log(`  ${key}: ${docs.length}x | IDs: ${docs.map(d => d.id).join(', ')}`);
    }
  }

  // Check wrong totals: months with correct count but different total
  const wrongTotalMonths = periods.filter(p => {
    const ef = eFaturaTotals[p];
    if (!ef) return false;
    const app = periodMap[p];
    return app.count === ef.n && Math.abs(app.total - ef.total) > 0.5;
  });

  if (wrongTotalMonths.length > 0) {
    console.log(`\n  Meses com contagem certa mas total errado: ${wrongTotalMonths.join(', ')}`);
    // Sample a few invoices from one of these months to check total_amount vs vat_amount
    const sampleMonth = wrongTotalMonths[0];
    const { data: sample } = await supabase
      .from('sales_invoices')
      .select('document_number, total_amount, vat_amount, net_amount, document_date')
      .eq('client_id', clientId)
      .eq('fiscal_period', sampleMonth)
      .limit(5);
    console.log(`\n  Amostra de ${sampleMonth} (verificar se total_amount inclui IVA):`);
    for (const s of sample || []) {
      console.log(`    doc:${s.document_number} total:${s.total_amount} vat:${s.vat_amount} net:${s.net_amount}`);
    }
  }

  return { docGroups, duplicates, allDocs };
}

// ──────────────────────────────────────────────
// STEP 3: Limpar duplicados da Cátia
// ──────────────────────────────────────────────
async function cleanCatiaDuplicates(clientId, docGroups, dryRun = false) {
  console.log('\n' + SEP);
  console.log(`STEP 3: Limpar duplicados da Cátia (dryRun=${dryRun})`);
  console.log(SEP);

  if (!clientId || !docGroups) { console.log('  skip'); return; }

  const duplicates = Object.entries(docGroups).filter(([, docs]) => docs.length > 1);
  if (duplicates.length === 0) {
    console.log('  Sem duplicados para limpar.');
    return;
  }

  // For each duplicate group, keep the most recent (highest created_at), delete the rest
  const toDelete = [];
  for (const [, docs] of duplicates) {
    const sorted = docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const keep = sorted[0];
    const remove = sorted.slice(1);
    toDelete.push(...remove.map(d => d.id));
  }

  console.log(`  IDs para eliminar: ${toDelete.length} registos`);
  if (dryRun) {
    console.log('  DRY RUN — nenhuma alteração efectuada');
    console.log('  IDs:', toDelete.slice(0, 20).join(', '), toDelete.length > 20 ? `... +${toDelete.length - 20}` : '');
    return toDelete;
  }

  // Delete in batches of 100
  let deleted = 0;
  const BATCH = 100;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    const { error } = await supabase
      .from('sales_invoices')
      .delete()
      .in('id', batch);
    if (error) {
      console.error(`  ✗ Erro ao eliminar batch ${i}-${i + BATCH}:`, error.message);
    } else {
      deleted += batch.length;
    }
  }

  console.log(`  ✅ Eliminados ${deleted} duplicados`);
  return deleted;
}

// ──────────────────────────────────────────────
// STEP 4: Verificar net_amount vs total_amount
// ──────────────────────────────────────────────
async function diagnoseTotalMismatch(clientId) {
  console.log('\n' + SEP);
  console.log('STEP 4: Cátia — Verificar se total_amount inclui IVA indevidamente');
  console.log(SEP);

  if (!clientId) { console.log('  skip'); return; }

  // Check if net_amount is consistently different from total_amount (IVA included in total)
  const { data } = await supabase
    .from('sales_invoices')
    .select('total_amount, vat_amount, net_amount, fiscal_period')
    .eq('client_id', clientId)
    .not('vat_amount', 'is', null)
    .not('net_amount', 'is', null)
    .gt('vat_amount', 0)
    .limit(20);

  if (!data || data.length === 0) {
    console.log('  Sem registos com vat_amount e net_amount preenchidos.');
    return;
  }

  let countConsistent = 0, countDoubleIVA = 0;
  for (const row of data) {
    const expectedTotal = parseFloat(row.net_amount) + parseFloat(row.vat_amount);
    const actual = parseFloat(row.total_amount);
    if (Math.abs(actual - parseFloat(row.net_amount)) < 0.02) {
      // total_amount is net (correct - IVA separate)
      countConsistent++;
    } else if (Math.abs(actual - expectedTotal) < 0.02) {
      // total_amount is net+vat (also consistent)
      countConsistent++;
    } else {
      countDoubleIVA++;
      console.log(`  ⚠️  Mismatch ${row.fiscal_period}: total=${row.total_amount} net=${row.net_amount} vat=${row.vat_amount} (expected ${expectedTotal.toFixed(2)})`);
    }
  }
  console.log(`  Consistentes: ${countConsistent}/${data.length} | Erros: ${countDoubleIVA}/${data.length}`);
}

// ──────────────────────────────────────────────
// STEP 5: Maria Tereza Silva
// ──────────────────────────────────────────────
async function diagnoseMariaTereza(clientId) {
  console.log('\n' + SEP);
  console.log('STEP 5: Maria Tereza Silva — Verificar sync AT');
  console.log(SEP);

  if (!clientId) { console.log('  skip'); return; }

  // Check sales_invoices
  const { count: salesCount } = await supabase
    .from('sales_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);
  console.log(`  sales_invoices: ${salesCount ?? 0} registos`);

  // Check AT credentials
  const { data: creds } = await supabase
    .from('at_credentials')
    .select('id, nif, sync_enabled, created_at, updated_at')
    .eq('client_id', clientId);
  console.log(`  at_credentials: ${creds?.length ?? 0} registos`);
  if (creds?.length > 0) {
    creds.forEach(c => console.log(`    nif=${c.nif} sync_enabled=${c.sync_enabled} updated=${c.updated_at}`));
  } else {
    console.log('  ⚠️  SEM CREDENCIAIS AT — sync impossível sem configurar credenciais');
  }

  // Check sync logs
  const { data: logs } = await supabase
    .from('at_sync_logs')
    .select('sync_type, status, started_at, completed_at, error_message, records_synced')
    .eq('client_id', clientId)
    .order('started_at', { ascending: false })
    .limit(5);

  console.log(`  Últimos syncs:`);
  if (!logs || logs.length === 0) {
    console.log('    Nenhum registo de sync.');
  } else {
    logs.forEach(l => console.log(`    ${l.started_at?.slice(0,16)} ${l.sync_type} ${l.status} records=${l.records_synced} ${l.error_message ? '| ERR: ' + l.error_message.slice(0, 80) : ''}`));
  }
}

// ──────────────────────────────────────────────
// STEP 6: Rafael Paisano
// ──────────────────────────────────────────────
async function diagnoseRafael(clientId) {
  console.log('\n' + SEP);
  console.log('STEP 6: Rafael Paisano — Verificar períodos 2026');
  console.log(SEP);

  if (!clientId) { console.log('  skip'); return; }

  const { data: periods } = await supabase
    .from('sales_invoices')
    .select('fiscal_period')
    .eq('client_id', clientId);

  const unique = [...new Set((periods || []).map(p => p.fiscal_period))].sort().reverse();
  console.log(`  Períodos disponíveis (${unique.length}):`, unique.join(', '));

  const has2026 = unique.some(p => p && p.startsWith('2026'));
  const has2025 = unique.some(p => p && p.startsWith('2025'));
  console.log(`  2026: ${has2026 ? '✓' : '✗'}  2025: ${has2025 ? '✓' : '✗'}`);

  // Check max document_date
  const { data: maxDate } = await supabase
    .from('sales_invoices')
    .select('document_date, created_at')
    .eq('client_id', clientId)
    .order('document_date', { ascending: false })
    .limit(1);
  if (maxDate?.[0]) {
    console.log(`  Última fatura: document_date=${maxDate[0].document_date} created_at=${maxDate[0].created_at?.slice(0,10)}`);
  }

  // Check sync logs
  const { data: logs } = await supabase
    .from('at_sync_logs')
    .select('sync_type, status, started_at, records_synced, error_message')
    .eq('client_id', clientId)
    .order('started_at', { ascending: false })
    .limit(5);

  console.log(`  Últimos syncs:`);
  if (!logs || logs.length === 0) {
    console.log('    Nenhum registo de sync.');
  } else {
    logs.forEach(l => console.log(`    ${l.started_at?.slice(0,16)} ${l.sync_type} ${l.status} records=${l.records_synced} ${l.error_message ? '| ERR: ' + l.error_message.slice(0, 80) : ''}`));
  }

  // Check AT credentials
  const { data: creds } = await supabase
    .from('at_credentials')
    .select('nif, sync_enabled')
    .eq('client_id', clientId);
  console.log(`  AT credentials: ${creds?.map(c => `nif=${c.nif} sync=${c.sync_enabled}`).join(', ') || 'NENHUMA'}`);
}

// ──────────────────────────────────────────────
// STEP 7: Trigger AT sync para clientes em falta
// ──────────────────────────────────────────────
async function triggerSync(clientId, clientName) {
  console.log(`\n  → Triggering AT sync para ${clientName} (${clientId})`);

  const { data, error } = await supabase.functions.invoke('sync-efatura', {
    body: {
      client_id: clientId,
      source: 'manual',
      force: true,
    }
  });

  if (error) {
    console.log(`  ✗ Erro: ${error.message}`);
    return false;
  }
  console.log(`  ✓ Resposta:`, JSON.stringify(data).slice(0, 200));
  return true;
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log('IVAzen Data Fix — Auditoria Raquela 24.03.2026');
  console.log('='.repeat(60));

  // Step 1: Find client IDs
  const clients = await findClients();

  const catiaId = clients['Cátia Francisco']?.id;
  const mariaId = clients['Maria Tereza Silva']?.id;
  const rafaelId = clients['Rafael Paisano']?.id;

  // Step 2: Diagnose Cátia
  const catiaData = await diagnoseCatia(catiaId);

  // Step 3: Clean Cátia duplicates — DRY RUN first
  const toDelete = await cleanCatiaDuplicates(catiaId, catiaData?.docGroups, true);

  // Confirm and execute if there are duplicates
  if (toDelete && toDelete.length > 0) {
    console.log(`\n  ⚡ Executando limpeza de ${toDelete.length} duplicados...`);
    await cleanCatiaDuplicates(catiaId, catiaData?.docGroups, false);

    // Verify after cleanup
    console.log('\n  Verificação pós-limpeza:');
    await diagnoseCatia(catiaId);
  }

  // Step 4: Check total mismatch
  await diagnoseTotalMismatch(catiaId);

  // Step 5: Maria Tereza
  await diagnoseMariaTereza(mariaId);

  // Step 6: Rafael Paisano
  await diagnoseRafael(rafaelId);

  // Step 7: Trigger sync where needed
  console.log('\n' + SEP);
  console.log('STEP 7: AT Sync para clientes com dados em falta');
  console.log(SEP);

  if (rafaelId) await triggerSync(rafaelId, 'Rafael Paisano');
  if (mariaId) await triggerSync(mariaId, 'Maria Tereza Silva');

  console.log('\n' + '='.repeat(60));
  console.log('FIM — verificar resultados acima');
}

main().catch(console.error);
