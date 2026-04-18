# Bilal end_date=2026-03-30 — Root Cause

## Evidence summary

Direct query against prod `at_sync_history` (service role, 2026-04-18) contradicts the bug premise. Bilal's rows **do not** show a stuck `end_date=2026-03-30`. Every row's `end_date` equals its `created_at` day:

```
2026-04-18T01:53:35Z  end_date=2026-04-18  status=partial  rc=AT_ZERO_RESULTS_SUSPICIOUS  imp=1 skip=116
2026-04-17T19:26:04Z  end_date=2026-04-17  status=success  rc=AT_EMPTY_LIST            imp=0 skip=116
2026-04-17T05:25:30Z  end_date=2026-04-17  status=success  rc=AT_EMPTY_LIST            imp=1 skip=115
2026-04-16T18:55:42Z  end_date=2026-04-16  status=success  rc=AT_EMPTY_LIST            imp=0 skip=115
2026-04-16T05:25:21Z  end_date=2026-04-16  status=success  rc=AT_EMPTY_LIST            imp=0 skip=115
```

Full distribution since 2026-03-25 (49 rows): perfect diagonal — end_date tracks created_at day, 2 rows/day (05:00 + 18:30 crons). `SELECT … WHERE end_date='2026-03-30' AND created_at >= '2026-04-16'` returns **zero rows**.

Healthy reference (Helene, `af826459-…`) shows the same correct pattern.

Today's batch (created_at on 2026-04-18) contains 252 rows: **236 with end_date=2026-04-18**, and 16 with end_date=2025-12-31. The 16 exceptions are all clients whose `at_sync_jobs.fiscal_year=2025`, processed via `process-at-sync-queue/index.ts:206-207`:
```ts
const endDate = Number(fy) === currentYear ? today : `${fy}-12-31`;
```
All 16 are `status=error` with `reason_code=AT_AUTH_FAILED` or `UNKNOWN_AT_ERROR` (independent issue: clients with FY2025 jobs failing on auth). Not related to Bilal.

### Origin of the misreading

The pre-existing debug script `scripts/debug-bilal-history.mjs` (lines 19-24) orders by `id DESC`. `at_sync_history.id` is a UUID v4 (random), so this returns two arbitrary rows. That is how rows from 2026-03-30 and 2026-04-06 were surfaced and misread as "the last 3 runs". Chronological ordering (`created_at DESC`) shows the real picture.

## Hypotheses tested

### H1: sync-efatura clamps end_date for a per-client flag
- What I checked: `sync-efatura/index.ts:1108-1143` computes `effectiveEndDate = min(requestedEndDate, todayIso)`. No per-client branch. All 10+ `at_sync_history` write sites (lines 1172, 1188, 1227, 1263, 1289, 1343, 1474, 1596, 2014) reuse the same `effectiveEndDate` or only update `status/metadata/completed_at` — none rewrite `end_date`.
- Result: refuted.

### H2: process-at-sync-queue passes a stale endDate
- What I checked: `process-at-sync-queue/index.ts:197-207`. Only input is `job.fiscal_year`. Bilal's `at_sync_jobs.fiscal_year=2026` on every recent row. No job-level date override column exists.
- Result: refuted.

### H3: run_scheduled_at_sync RPC or a trigger rewrites end_date
- What I checked: `supabase/migrations/20260220133000_add_at_sync_automation_scheduler.sql`, `20260305010000_sync_improvements.sql`, `20260330113000_support_shared_at_connector_access.sql`. `end_date` only appears in READ predicates (`h.end_date >= make_date(v_year,12,31)`). No trigger or update targets `at_sync_history.end_date`.
- Result: refuted.

### H4: Stuck row really exists
- What I checked: `SELECT id,created_at,end_date FROM at_sync_history WHERE client_id=BILAL AND end_date='2026-03-30' AND created_at >= '2026-04-16'`.
- Result: refuted. 0 rows.

## Root cause

**There is no `end_date` bug.** The reported pattern (`end_date=2026-03-30` across three runs on 2026-04-16/17/18) does not exist in production data; it is a query artefact from `scripts/debug-bilal-history.mjs` ordering by random UUID `id` instead of `created_at`. Bilal's `end_date` values correctly follow `min(fiscal_year_end, today)` on every run — identical to every other current-year client.

There **is** a separate real problem visible on Bilal's 2026-04-18 row (`status=partial`, `reason_code=AT_ZERO_RESULTS_SUSPICIOUS`): AT SOAP returns `"Lista de faturas vazia."` for vendas, and the recibos-verdes fallback finds nothing, yet Bilal has 25 prior sales_invoices. That is the legitimate anomaly worth investigating — but it is an AT-side data/credential issue (portal_password or subuser visibility for the vendas scope), not an edge-function date bug. The 3 missing ATCUDs from the screenshot (FR/20, FR/21, FR/22) match this: AT isn't returning them for Bilal's credentials.

## Proposed fix

### A. Correct the misleading debug script (safe, small)
- File: `scripts/debug-bilal-history.mjs:23`
- Change: replace `.order('id', { ascending: false })` with `.order('created_at', { ascending: false })` so callers don't misdiagnose non-issues from random UUID ordering.
- Risk: none — script is a developer tool, not code path.
- Validation: re-run `node scripts/debug-bilal-history.mjs` — top row must have `created_at >= today`.

### B. No application-code fix required for the reported bug
`sync-efatura` and `process-at-sync-queue` handle `end_date` correctly. No diff to deploy.

### C. Follow-up for the real issue (out of scope but noted)
- Investigate why vendas SOAP returns empty for Bilal's NIF 232945993 while compras works. His credentials use `portal_nif` only (no `subuser_id`), which is atypical for a sujeito passivo who emits invoices. Likely needs a Fatura-Express sub-user credential or a WFA username/password for the vendas endpoint. File: `supabase/functions/sync-efatura/index.ts:1382-1403` (credential resolution) — behaviour is correct, but the underlying AT cred is insufficient for `fatshareFaturas` on the emitter side.

### Validation plan

1. After applying A, verify: `node scripts/debug-bilal-history.mjs` shows today's row first and `end_date=2026-04-18`.
2. Cross-check: run `scripts/debug-bilal-enddate-forensics.mjs` (added this commit) — confirms 0 rows with `end_date=2026-03-30` created since 2026-04-16.
3. For the real vendas-missing problem, add to existing triage: ask Bilal to confirm which portal user is used on the AT Fatura-Express emitter side and load that as `subuser_id` / `encrypted_username` in `at_credentials`.
