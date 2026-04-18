# Sync Quarter Boundary Fix — Design Spec

**Date:** 2026-04-18
**Scope:** Phase 1 (cirúrgico) of the broader sales reliability programme
**Related:** [Phase roadmap](#phase-roadmap) — Phases 1.5 / 2–5 get their own specs once this lands.

---

## 1. Problem (ground truth)

The AT sync silently loses sales invoices across the quarter boundary. Reproduced 2026-04-18 against production data for **Bilal Machraa (NIF 232945993)**:

| ATCUD | Emitted | Amount | In DB? |
|---|---|---|---|
| JJ37MMGM-22 | 2026-04-02 | 1920,00€ | ❌ |
| JJ37MMGM-21 | 2026-04-01 | 210,00€ | ❌ |
| JJ37MMGM-20 | 2026-03-30 | 974,25€ | ❌ |
| JJ3TVYDZ-15 | 2026-02-27 | 1500,00€ | ✅ |
| JJ3TVYDZ-14 | 2026-02-24 | 1199,00€ | ✅ |
| JJ37MMGM-19 | 2026-02-23 | 90,00€ | ✅ |
| JJ37MMGM-18 | 2026-01-08 | 1100,00€ | ✅ |

Client's last sync attempt: `2026-04-17 19:26 UTC`, `at_credentials.last_sync_status = 'success'`, `consecutive_failures = 0`. Three documents missing with no trace in `at_sync_history`.

## 2. Root cause

### 2a. Default date window excludes the previous quarter

`supabase/functions/sync-efatura/index.ts:1066-1077`:

```ts
const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
const quarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
const defaultStartDate = quarterStart.toISOString().slice(0, 10);
```

When `run_scheduled_at_sync` enqueues a job without explicit dates, the edge function defaults to `start_of_current_quarter → today`. On any day in Q2, the whole of Q1 is invisible. Documents emitted in the last week of Q1 (e.g. Bilal's FR/20 on 2026-03-30) are never re-fetched after the quarter rolls over.

### 2b. `status='success'` is an unsafe over-promise

`at_sync_history` is written with `status='success'` whenever the SOAP call itself returned HTTP 200, even when the response list was empty. There is no check for "AT returned zero but we expected non-zero" — the historical `sales_invoices` count is never compared. A silent miss looks identical to a healthy run.

## 3. Goals

1. Re-fetch the previous quarter on every scheduled run so boundary documents cannot fall through the crack.
2. Mark runs as `partial` with a concrete `reason_code` when the AT response is empty but the client has prior sales — so the accountant sees the problem instead of guessing.
3. Ship atomically, revertible in one commit, with evidence against three accounts we can cross-check.

## 4. Non-goals (explicit)

- New UI work (SalesHealth dashboard, per-client cross-check button) — scheduled for Phase 1.5.
- Changes to the Playwright recibos-verdes scraper or the AT-connector VPS.
- Changes to Modelo 10 / withholding pipeline.
- Adding `UNIQUE` constraints to `sales_invoices` — the existing manual `SELECT`-before-`INSERT` dedup is sufficient for idempotent re-runs and tightening the constraint is a separate migration concern.
- Supporting arbitrary historical periods on schedule — keep the `limit_scheduled_sync_to_current_and_previous` invariant.

## 5. Design

### 5a. Widen the default window to `previousQuarterStart → today`

**File:** `supabase/functions/sync-efatura/index.ts` (block at lines 1066-1077)

**New logic:**

```ts
function getPreviousQuarterStart(now: Date): Date {
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3); // 1..4
  if (currentQuarter === 1) {
    // January–March → previous quarter is Q4 of last year
    return new Date(now.getFullYear() - 1, 9, 1); // Oct 1
  }
  return new Date(now.getFullYear(), (currentQuarter - 2) * 3, 1);
}

const defaultStartDate = getPreviousQuarterStart(now).toISOString().slice(0, 10);
```

**Behaviour by date-of-sync:**
| Run date | Old default start | New default start |
|---|---|---|
| 2026-04-18 | 2026-04-01 | 2026-01-01 |
| 2026-07-02 | 2026-07-01 | 2026-04-01 |
| 2026-01-15 | 2026-01-01 | 2025-10-01 |

**Safety:** re-fetching over already-synced periods is idempotent. `insertSalesInvoicesFromAT` (sync-efatura lines 883-895) performs a `SELECT` on `(client_id, supplier_nif, document_number)` before `INSERT`; duplicates are counted as `skipped`, never inserted. Same pattern on `invoices` (purchases) at lines 815-827.

**Performance:** worst case each run now fetches 6 months of AT data per client instead of ≤3. The connector already handles month-chunking and schema-error retries (`sync-efatura/index.ts:243-270`). No new retries needed.

### 5d. `partial` status for suspicious empty runs

**Data change:** new migration `supabase/migrations/20260418120000_at_sync_history_returned_count.sql`:

```sql
ALTER TABLE public.at_sync_history
  ADD COLUMN IF NOT EXISTS invoices_returned_by_at integer;

COMMENT ON COLUMN public.at_sync_history.invoices_returned_by_at IS
  'Raw invoice count returned by AT SOAP before dedup. Differs from invoices_synced when all were duplicates, or is 0 when AT reports no activity for the period.';

CREATE INDEX IF NOT EXISTS idx_at_sync_history_reason_code_status
  ON public.at_sync_history (reason_code, status)
  WHERE status IN ('partial', 'error');
```

**Code change:** `sync-efatura/index.ts` — when finalizing a sync history row, status is decided *per direction* (compras and vendas are evaluated independently because a client can legitimately have one without the other):

```ts
const atReturnedCount = soapResult.invoices?.length ?? 0;
const hasPriorData =
  direction === 'vendas'
    ? await clientHasPriorSales(supabase, clientId)       // sales_invoices table
    : await clientHasPriorPurchases(supabase, clientId);  // invoices table

let status: 'success' | 'partial' | 'error';
let reasonCode: string | null;

if (atReturnedCount === 0 && hasPriorData) {
  status = 'partial';
  reasonCode = 'AT_ZERO_RESULTS_SUSPICIOUS';
} else {
  status = 'success';
  reasonCode = null;
}
```

`clientHasPriorSales` / `clientHasPriorPurchases` return `true` iff there exists any row for that `client_id` with `document_date >= today − 180 days` in the respective table. Cached per-run per-client (one pair of lookups per sync).

**Propagation to `at_credentials.last_sync_status`:** if any run in the job set for this credential returned `partial`, the credential's `last_sync_status` is set to `partial`. The existing scheduler (`20260220133000_add_at_sync_automation_scheduler.sql:144`) already treats `partial` as a retry trigger, so no change there.

## 6. Testing

### 6.1 Unit tests (Vitest)

**New file:** `src/lib/__tests__/syncQuarterBoundary.test.ts`

Covers `getPreviousQuarterStart` for each quarter, year rollover (Jan), leap year edge, and the Supabase edge-function Deno file is tested via an extracted pure helper module:

**New file:** `supabase/functions/sync-efatura/dateRange.ts` — the pure `getPreviousQuarterStart` helper extracted from `index.ts` solely for testability. The edge function imports it via a relative path; the Vitest test imports the same file directly (no Deno runtime dependency in the helper itself, only `Date`).

### 6.2 Regression — full test suite

`npm test -- --run` must remain green (currently 944/944).

### 6.3 Deno check

`deno check supabase/functions/sync-efatura/index.ts` must pass locally before deploy.

## 7. Validation plan (live accounts)

Three test cases on accounts we have access to. All commands run from repo root with `.env` loaded.

### 7.1 Bilal Machraa (232945993) — gap-reproducing case

**Before fix** (baseline captured 2026-04-18):
- DB vendas 2026: 4
- AT ground truth: 7

**Procedure:**
1. Deploy the fixed edge function to staging (or preview). Do NOT touch prod yet.
2. Invoke manually via a new helper script `scripts/force-client-sales-sync.mjs` (created during implementation; reads `.env` like `check-clients.mjs`, invokes the `sync-efatura` edge function with explicit `client_id`, `direction='ambos'`, no date overrides so the new default kicks in):
   ```bash
   node scripts/force-client-sales-sync.mjs \
     --client-id 5a994a12-8364-4320-ac35-e93f81edcf10 \
     --env staging
   ```
3. Wait for completion (poll `at_sync_jobs` until `status='completed'`).
4. `node scripts/check-clients.mjs` (already committed in this branch) → reconciliation section must print `MATCH` for all 7 ATCUDs.

**Pass criteria:** 7/7 MATCH; 0 MISSING; 0 extras.

### 7.2 Majda Machraa (232946060) — unknown case, silent-success probe

**Before fix:**
- DB vendas 2026 Q1: 0
- AT ground truth: unknown (no screenshot)

**Procedure:**
1. Run the same sync against Majda.
2. Expected outcome A: vendas appear → proves she was also hit by the boundary bug. Document and report.
3. Expected outcome B: still 0 vendas, BUT `at_sync_history.invoices_returned_by_at = 0` AND `status = 'partial'` AND `reason_code = 'AT_ZERO_RESULTS_SUSPICIOUS'` — proves 1d works and flags her for follow-up.

**Pass criteria:** one of A or B. Never silent `success` with 0.

### 7.3 Helene Konokovi Abiassi (232091803) — no-regression baseline

**Before fix:**
- DB vendas 2026 Q1: 28
- Healthy, no gap suspected.

**Procedure:**
1. Run the same sync against Helene.
2. Count vendas 2026 Q1 after run.

**Pass criteria:** count stays ≥ 28. `status = 'success'`. No new errors in `at_sync_history`.

### 7.4 Production rollout gate

Only after 7.1+7.2+7.3 pass on staging:
1. Merge to `main`, let Vercel + Supabase deploy both the edge function and the migration.
2. Wait for the next cron window (06:00 Lisbon).
3. Morning-after check: run `check-clients.mjs` with 10 random clients; confirm zero regressions and see at least one new `partial` flag land if any client actually had an AT miss.

## 8. Rollback

- **Code:** `git revert` of the 1a commit restores the old default window. The 1d logic is self-contained in the sync-efatura status-setting branch and can be reverted independently.
- **Migration:** additive (adds column + index). No data rewrite. Left in place on rollback — the column is simply unread.
- **No data corruption risk:** dedup by `(client_id, supplier_nif, document_number)` prevents duplicate rows even if a partial-then-fixed state overlaps.

## 9. Observability

- `get_at_sync_health()` (already exists) aggregates `at_sync_history.status`. Once `partial` is emitted, it will naturally surface in the dashboard at `src/pages/EFaturaSync.tsx` without UI changes.
- `reason_code = 'AT_ZERO_RESULTS_SUSPICIOUS'` is new; add it to the known-reason list in the dashboard so it renders a human-readable label.

## 10. Open questions

None blocking. Items deferred to Phase 1.5:
- Whether to replay the missing Bilal Q1 invoices by re-forcing a full-year sync once the fix is live. Preferred yes, one-time script.
- Whether to backfill `at_sync_history.invoices_returned_by_at` for historical rows. Decision: no, leave NULL; only new rows populated.

## 11. Phase roadmap

This spec is **Phase 1** of a five-phase programme. Subsequent phases each ship as their own spec:

1. **Phase 1 (this spec)** — silent-miss fix + partial status.
2. **Phase 1.5** — `SalesHealth.tsx` accountant dashboard surfacing `partial` + zero-vendas-current-quarter clients.
3. **Phase 2** — AT-vs-IVAzen reconciliation button per client.
4. **Phase 3** — SS Directa copy-paste output fidelity pass (format-exact match).
5. **Phase 4** — cron+alerting (Slack/email on `partial` > 48h).
6. **Phase 5** — SS semi-automation (PDF export of declaration + receipt parsing). No SS scraping.
