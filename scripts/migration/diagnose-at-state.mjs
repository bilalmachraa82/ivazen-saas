#!/usr/bin/env node
/**
 * F0 — Rebaseline Factual Diagnostic Script
 * Read-only. No mutations.
 * Captures: credential status, sync errors, scheduler runs, eligibility, revenue_category domain
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
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
    if ((val.startsWith('"') && val.endsWith('"'))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const BASE = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rpc(query) {
  const r = await fetch(`${BASE}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ query })
  });
  if (!r.ok) {
    // exec_sql may not exist. Fallback to REST queries.
    return null;
  }
  return r.json();
}

async function restQuery(table, params = '') {
  const r = await fetch(`${BASE}/rest/v1/${table}?${params}`, { headers: h });
  if (!r.ok) {
    console.error(`REST error for ${table}: ${r.status} ${await r.text()}`);
    return null;
  }
  const range = r.headers.get('content-range');
  return { data: await r.json(), count: range ? range.split('/')[1] : null };
}

console.log('=== F0 REBASELINE DIAGNOSTIC ===');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log(`Supabase: ${BASE}`);
console.log('');

// F0.2 — at_credentials status distribution
console.log('--- F0.2: AT Credentials Status Distribution ---');
const creds = await restQuery('at_credentials', 'select=last_sync_status&limit=50000');
if (creds?.data) {
  const dist = {};
  creds.data.forEach(c => { dist[c.last_sync_status || 'null'] = (dist[c.last_sync_status || 'null'] || 0) + 1; });
  console.log(JSON.stringify(dist, null, 2));
  console.log(`Total credentials: ${creds.data.length}`);
}

// F0.3 — Sync errors last 24h
console.log('\n--- F0.3: Sync Errors Last 24h ---');
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const errors24h = await restQuery('at_sync_history',
  `select=reason_code,status,created_at&status=eq.error&created_at=gte.${oneDayAgo}&limit=5000`);
if (errors24h?.data) {
  const byReason = {};
  errors24h.data.forEach(e => { byReason[e.reason_code || 'null'] = (byReason[e.reason_code || 'null'] || 0) + 1; });
  console.log(`Total errors 24h: ${errors24h.data.length}`);
  console.log('By reason_code:', JSON.stringify(byReason, null, 2));
}

// F0.4 — Sync errors last 7d
console.log('\n--- F0.4: Sync Errors Last 7d ---');
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const errors7d = await restQuery('at_sync_history',
  `select=reason_code,status,created_at&status=eq.error&created_at=gte.${sevenDaysAgo}&limit=50000`);
if (errors7d?.data) {
  const byReason7 = {};
  errors7d.data.forEach(e => { byReason7[e.reason_code || 'null'] = (byReason7[e.reason_code || 'null'] || 0) + 1; });
  console.log(`Total errors 7d: ${errors7d.data.length}`);
  console.log('By reason_code:', JSON.stringify(byReason7, null, 2));

  // F0.8 — Time analysis: errors inside vs outside AT window
  console.log('\n--- F0.8: Error Distribution Inside vs Outside AT Window ---');
  let insideWindow = 0, outsideWindow = 0;
  const insideReasons = {}, outsideReasons = {};
  errors7d.data.forEach(e => {
    const d = new Date(e.created_at);
    // Convert to Lisbon time (UTC+0 in winter, UTC+1 in summer)
    // March 2026: CET (UTC+0 since Portugal uses WET, switches to WEST in late March)
    // Portugal is in WET (UTC+0) until last Sunday of March
    const utcHour = d.getUTCHours();
    const utcMin = d.getUTCMinutes();
    const timeVal = utcHour * 60 + utcMin;
    // AT windows: 06:00-06:15 and 19:30-19:45 (in Lisbon time = UTC for WET)
    const inWindow = (timeVal >= 360 && timeVal <= 375) || (timeVal >= 1170 && timeVal <= 1185);
    if (inWindow) {
      insideWindow++;
      insideReasons[e.reason_code || 'null'] = (insideReasons[e.reason_code || 'null'] || 0) + 1;
    } else {
      outsideWindow++;
      outsideReasons[e.reason_code || 'null'] = (outsideReasons[e.reason_code || 'null'] || 0) + 1;
    }
  });
  console.log(`Inside AT window (06:00-06:15, 19:30-19:45): ${insideWindow}`);
  console.log('  Reasons:', JSON.stringify(insideReasons, null, 2));
  console.log(`Outside AT window: ${outsideWindow}`);
  console.log('  Reasons:', JSON.stringify(outsideReasons, null, 2));
}

// F0.5 — Automation runs
console.log('\n--- F0.5: Recent Automation Runs ---');
const runs = await restQuery('at_sync_automation_runs',
  'select=run_date,run_slot,total_jobs,notes,triggered_at&order=triggered_at.desc&limit=5');
if (runs?.data) {
  console.log(JSON.stringify(runs.data, null, 2));
} else {
  console.log('No automation runs data or table not accessible');
}

// F0.6 — Eligibility breakdown (via REST approximation)
console.log('\n--- F0.6: Eligibility Breakdown (REST approximation) ---');
// We can't run arbitrary SQL via REST, so we approximate
const allCreds = await restQuery('at_credentials',
  'select=client_id,accountant_id,portal_nif,portal_password_encrypted,environment,last_sync_at,last_sync_status,consecutive_failures&limit=50000');
const activeConfigs = await restQuery('accountant_at_config',
  'select=accountant_id,is_active&is_active=eq.true&limit=50000');
const pendingJobs = await restQuery('at_sync_jobs',
  `select=client_id,accountant_id,status&status=in.(pending,processing)&limit=50000`);

if (allCreds?.data && activeConfigs?.data) {
  const activeAccountants = new Set(activeConfigs.data.map(c => c.accountant_id));
  const pendingJobSet = new Set(
    (pendingJobs?.data || []).map(j => `${j.client_id}_${j.accountant_id}`)
  );

  let total = 0, withActiveConfig = 0, withPortalNif = 0, withPortalPwd = 0;
  let isProduction = 0, noPendingJobs = 0, backoffEligible = 0;
  let withAnyFailures = 0, withMaxBackoff = 0;

  const now = Date.now();

  allCreds.data.forEach(ac => {
    total++;
    if (activeAccountants.has(ac.accountant_id)) withActiveConfig++;
    if (ac.portal_nif && ac.portal_nif.trim() !== '') withPortalNif++;
    if (ac.portal_password_encrypted && ac.portal_password_encrypted.trim() !== '') withPortalPwd++;
    const env = ac.environment || 'production';
    if (env === 'production') isProduction++;
    if (!pendingJobSet.has(`${ac.client_id}_${ac.accountant_id}`)) noPendingJobs++;

    const failures = ac.consecutive_failures || 0;
    if (failures > 0) withAnyFailures++;
    if (failures >= 3) withMaxBackoff++;

    // Backoff check
    const backoffHours = 6 * Math.pow(2, Math.min(failures, 3));
    const lastSync = ac.last_sync_at ? new Date(ac.last_sync_at).getTime() : 0;
    const backoffMs = backoffHours * 3600000;
    const pastBackoff = !ac.last_sync_at || (now - lastSync) > backoffMs ||
      ['error', 'partial'].includes(ac.last_sync_status || 'never');
    if (pastBackoff) backoffEligible++;
  });

  console.log(JSON.stringify({
    total,
    with_active_config: withActiveConfig,
    with_portal_nif: withPortalNif,
    with_portal_password: withPortalPwd,
    is_production: isProduction,
    no_pending_jobs: noPendingJobs,
    backoff_eligible: backoffEligible,
    with_any_failures: withAnyFailures,
    with_max_backoff: withMaxBackoff,
    // Exclusion reasons
    excluded_no_config: total - withActiveConfig,
    excluded_no_nif: total - withPortalNif,
    excluded_no_password: total - withPortalPwd,
    excluded_not_production: total - isProduction,
    excluded_pending_jobs: total - noPendingJobs,
    excluded_backoff: total - backoffEligible,
  }, null, 2));
}

// F0.9 — Revenue category domain validation
console.log('\n--- F0.9: Revenue Category Domain Validation ---');
const validCategories = ['prestacao_servicos','vendas','hotelaria','restauracao',
  'alojamento_local','producao_venda','propriedade_intelectual','comercio','outros'];
const allSales = await restQuery('sales_invoices',
  'select=id,revenue_category&limit=50000');
if (allSales?.data) {
  const invalid = allSales.data.filter(s => !validCategories.includes(s.revenue_category));
  console.log(`Total sales_invoices: ${allSales.data.length}`);
  console.log(`Invalid revenue_category: ${invalid.length}`);
  if (invalid.length > 0) {
    // Save evidence: sample of affected IDs and values
    const sample = invalid.slice(0, 20).map(s => ({ id: s.id, revenue_category: s.revenue_category }));
    console.log('Sample affected (max 20):');
    console.log(JSON.stringify(sample, null, 2));

    // Distribution of invalid values
    const invalidDist = {};
    invalid.forEach(s => {
      invalidDist[s.revenue_category || 'NULL'] = (invalidDist[s.revenue_category || 'NULL'] || 0) + 1;
    });
    console.log('Invalid value distribution:', JSON.stringify(invalidDist, null, 2));
    console.log('\nProbable cause: UUID values likely came from frontend form submitting option IDs instead of category strings.');
  }
}

// F0.7 — Connector health (we need the actual URL from secrets - can't retrieve decrypted value via REST)
console.log('\n--- F0.7: AT Connector Health ---');
console.log('Note: Cannot retrieve decrypted AT_CONNECTOR_URL from Supabase secrets via CLI.');
console.log('Connector health must be tested via edge function invocation or direct SSH.');

// Test via edge function
try {
  const healthResp = await fetch(`${BASE}/functions/v1/sync-efatura`, {
    method: 'POST',
    headers: {
      ...h,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'health_check'
    })
  });
  console.log(`Edge function response: ${healthResp.status}`);
  const healthBody = await healthResp.json().catch(() => null);
  if (healthBody) console.log('Response:', JSON.stringify(healthBody, null, 2));
} catch (e) {
  console.log('Edge function health check failed:', e.message);
}

console.log('\n=== F0 DIAGNOSTIC COMPLETE ===');
