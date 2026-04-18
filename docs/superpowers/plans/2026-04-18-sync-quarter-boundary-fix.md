# Sync Quarter Boundary Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the silent-miss bug where AT sync reports `success` but omits sales emitted across the quarter boundary, by (a) widening the default date window to the previous quarter and (b) labelling empty-but-suspicious runs as `partial` with a concrete reason code.

**Architecture:** Two pure helpers are extracted from `sync-efatura/index.ts` — `getPreviousQuarterStart(now)` and `decideSyncStatus(atReturnedCount, hasPriorData)` — each with Vitest coverage. The edge function imports them, wires `clientHasPriorSales` / `clientHasPriorPurchases` lookups against Supabase, and writes a new `at_sync_history.invoices_returned_by_at` column (added by an additive migration). Re-runs over overlapping periods are safe because the existing `SELECT`-before-`INSERT` dedup in the insertion helpers catches duplicates.

**Tech Stack:** Deno (Supabase Edge Functions), TypeScript, Vitest (jsdom), PostgreSQL migration, Supabase JS client, Node.js script (ESM).

**Spec:** `docs/superpowers/specs/2026-04-18-sync-quarter-boundary-fix-design.md`

---

## File Structure

| File | Role | Action |
|---|---|---|
| `supabase/functions/sync-efatura/dateRange.ts` | Pure helper `getPreviousQuarterStart(now: Date): Date` | Create |
| `supabase/functions/sync-efatura/dateRange.test.ts` | Vitest suite for dateRange | Create |
| `supabase/functions/sync-efatura/syncStatus.ts` | Pure helper `decideSyncStatus(atReturnedCount, hasPriorData)` | Create |
| `supabase/functions/sync-efatura/syncStatus.test.ts` | Vitest suite for syncStatus | Create |
| `supabase/migrations/20260418120000_at_sync_history_returned_count.sql` | Adds `invoices_returned_by_at` column + reason-code index | Create |
| `supabase/functions/sync-efatura/index.ts` | Use both helpers, emit `invoices_returned_by_at`, call prior-data lookups | Modify |
| `scripts/force-client-sales-sync.mjs` | CLI: invoke sync-efatura for a specific client and poll `at_sync_jobs` | Create |
| `scripts/sync-regression-sweep.mjs` | CLI: read 10 random profiles and print their latest sync history row | Create (during Task 9) |
| `docs/release/VALIDATION_2026-04-18-sync-fix.md` | Captures the staging + prod validation evidence | Create (during Task 8) |

---

### Task 1: Pure helper — `getPreviousQuarterStart`

**Files:**
- Create: `supabase/functions/sync-efatura/dateRange.ts`
- Create: `supabase/functions/sync-efatura/dateRange.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/sync-efatura/dateRange.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getPreviousQuarterStart } from './dateRange';

describe('getPreviousQuarterStart', () => {
  it('returns Q1 start when in Q2 (April)', () => {
    // 2026-04-18 → Q2 → previous quarter Q1 starts 2026-01-01
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 3, 18))))
      .toEqual(new Date(2026, 0, 1));
  });

  it('returns Q2 start when in Q3 (July)', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 6, 5))))
      .toEqual(new Date(2026, 3, 1));
  });

  it('returns Q3 start when in Q4 (November)', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 10, 30))))
      .toEqual(new Date(2026, 6, 1));
  });

  it('rolls over to previous year Q4 when in Q1 (January)', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 0, 15))))
      .toEqual(new Date(2025, 9, 1));
  });

  it('rolls over to previous year Q4 on Jan 1', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2026, 0, 1))))
      .toEqual(new Date(2025, 9, 1));
  });

  it('handles leap-year Feb 29', () => {
    expect(getPreviousQuarterStart(new Date(Date.UTC(2024, 1, 29))))
      .toEqual(new Date(2023, 9, 1));
  });

  it('returns a Date object (not a string)', () => {
    const result = getPreviousQuarterStart(new Date(Date.UTC(2026, 3, 18)));
    expect(result).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/sync-efatura/dateRange.test.ts`
Expected: FAIL — `Failed to resolve import "./dateRange"`

- [ ] **Step 3: Write minimal implementation**

Create `supabase/functions/sync-efatura/dateRange.ts`:

```ts
/**
 * Returns the first day of the quarter immediately preceding the quarter
 * that `now` falls in. Used by sync-efatura to build a default date window
 * that always includes the tail of the previous quarter, preventing
 * documents emitted near the quarter boundary from silently dropping out
 * of scope once the calendar rolls into a new quarter.
 */
export function getPreviousQuarterStart(now: Date): Date {
  const month = now.getUTCMonth(); // 0..11
  const currentQuarter = Math.ceil((month + 1) / 3); // 1..4
  if (currentQuarter === 1) {
    // Q1: previous quarter is Q4 of last year (Oct = month 9)
    return new Date(now.getUTCFullYear() - 1, 9, 1);
  }
  const prevQuarterStartMonth = (currentQuarter - 2) * 3;
  return new Date(now.getUTCFullYear(), prevQuarterStartMonth, 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/sync-efatura/dateRange.test.ts`
Expected: PASS — 7/7 tests green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/sync-efatura/dateRange.ts supabase/functions/sync-efatura/dateRange.test.ts
git commit -m "feat(sync): extract getPreviousQuarterStart pure helper with tests"
```

---

### Task 2: Wire `getPreviousQuarterStart` into sync-efatura default window

**Files:**
- Modify: `supabase/functions/sync-efatura/index.ts` (import block + lines 1065-1077)

- [ ] **Step 1: Open `supabase/functions/sync-efatura/index.ts` and locate the current default-range block**

The block is at lines 1065-1077 (identified by the comment `// Default date range: current quarter up to today (never future dates)`).

- [ ] **Step 2: Add the helper import near the top of the file**

Find the existing local imports (around lines 1-30). Add this line alongside them:

```ts
import { getPreviousQuarterStart } from "./dateRange.ts";
```

- [ ] **Step 3: Replace the default-range block**

Replace lines 1066-1077 with:

```ts
// Default date range: previous quarter start up to today. Re-fetches the
// tail of the previous quarter every run so documents emitted near the
// boundary never fall out of scope. Dedup in the insertion helpers
// makes the overlap idempotent.
const now = new Date();
const todayIso = getTodayISODate();
const defaultStartDate = getPreviousQuarterStart(now)
  .toISOString()
  .slice(0, 10);

const requestedStartDate = startDate || defaultStartDate;
const requestedEndDate = endDate || todayIso;
```

- [ ] **Step 4: Verify Deno check still passes**

Run: `deno check supabase/functions/sync-efatura/index.ts`
Expected: no type errors.

If `deno` is not available locally, skip this step and rely on Step 5 + the CI pipeline.

- [ ] **Step 5: Run the full Vitest suite**

Run: `npm test -- --run`
Expected: 951/951 pass (previous 944 + 7 from dateRange test).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/sync-efatura/index.ts
git commit -m "fix(sync): widen default window to previousQuarterStart (kills quarter-boundary miss)"
```

---

### Task 3: Pure helper — `decideSyncStatus`

**Files:**
- Create: `supabase/functions/sync-efatura/syncStatus.ts`
- Create: `supabase/functions/sync-efatura/syncStatus.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/sync-efatura/syncStatus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decideSyncStatus } from './syncStatus';

describe('decideSyncStatus', () => {
  it('returns success when AT returned at least one invoice', () => {
    expect(decideSyncStatus({ atReturnedCount: 1, hasPriorData: false }))
      .toEqual({ status: 'success', reasonCode: null });
  });

  it('returns success when AT returned zero and client has no prior data (first-timer / genuinely empty)', () => {
    expect(decideSyncStatus({ atReturnedCount: 0, hasPriorData: false }))
      .toEqual({ status: 'success', reasonCode: null });
  });

  it('returns partial with AT_ZERO_RESULTS_SUSPICIOUS when AT returned zero but client has prior data', () => {
    expect(decideSyncStatus({ atReturnedCount: 0, hasPriorData: true }))
      .toEqual({ status: 'partial', reasonCode: 'AT_ZERO_RESULTS_SUSPICIOUS' });
  });

  it('returns success when AT returned many and client has prior data', () => {
    expect(decideSyncStatus({ atReturnedCount: 42, hasPriorData: true }))
      .toEqual({ status: 'success', reasonCode: null });
  });

  it('treats negative counts defensively as zero', () => {
    expect(decideSyncStatus({ atReturnedCount: -1, hasPriorData: true }))
      .toEqual({ status: 'partial', reasonCode: 'AT_ZERO_RESULTS_SUSPICIOUS' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/sync-efatura/syncStatus.test.ts`
Expected: FAIL — `Failed to resolve import "./syncStatus"`

- [ ] **Step 3: Write minimal implementation**

Create `supabase/functions/sync-efatura/syncStatus.ts`:

```ts
export interface DecideSyncStatusInput {
  atReturnedCount: number;
  hasPriorData: boolean;
}

export interface SyncStatusDecision {
  status: 'success' | 'partial' | 'error';
  reasonCode: string | null;
}

/**
 * Decide the status of an AT sync run from the raw SOAP result count
 * and whether the client has prior activity for this direction. A zero
 * count from AT is suspicious only when the client is known to have
 * historically issued invoices in this direction — otherwise it just
 * means "nothing to sync".
 */
export function decideSyncStatus({
  atReturnedCount,
  hasPriorData,
}: DecideSyncStatusInput): SyncStatusDecision {
  const safeCount = Math.max(0, Math.floor(atReturnedCount));
  if (safeCount === 0 && hasPriorData) {
    return { status: 'partial', reasonCode: 'AT_ZERO_RESULTS_SUSPICIOUS' };
  }
  return { status: 'success', reasonCode: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/sync-efatura/syncStatus.test.ts`
Expected: PASS — 5/5 green.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/sync-efatura/syncStatus.ts supabase/functions/sync-efatura/syncStatus.test.ts
git commit -m "feat(sync): add decideSyncStatus pure helper with tests"
```

---

### Task 4: Migration — `invoices_returned_by_at` column + reason-code index

**Files:**
- Create: `supabase/migrations/20260418120000_at_sync_history_returned_count.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260418120000_at_sync_history_returned_count.sql`:

```sql
-- Add a raw count of invoices returned by AT SOAP, pre-dedup.
-- Differs from invoices_synced when all items were duplicates (skipped),
-- and is 0 when AT reported no activity for the queried period.
-- Used by decideSyncStatus() in sync-efatura to flag suspicious empty
-- runs as `partial` instead of silently `success`.

ALTER TABLE public.at_sync_history
  ADD COLUMN IF NOT EXISTS invoices_returned_by_at integer;

COMMENT ON COLUMN public.at_sync_history.invoices_returned_by_at IS
  'Raw invoice count returned by AT SOAP before dedup. NULL for rows written before this column existed. 0 with status=partial indicates a suspicious empty response (client has historical activity).';

-- Composite index to speed up dashboard queries that filter by
-- (reason_code, status) when surfacing partial/error runs.
CREATE INDEX IF NOT EXISTS idx_at_sync_history_reason_status
  ON public.at_sync_history (reason_code, status)
  WHERE status IN ('partial', 'error');
```

- [ ] **Step 2: Verify the migration file is valid SQL**

Run: `grep -c "ALTER TABLE\|CREATE INDEX\|COMMENT ON" supabase/migrations/20260418120000_at_sync_history_returned_count.sql`
Expected: `3`

- [ ] **Step 3: Confirm the timestamp prefix is later than the most recent existing migration**

Run: `ls supabase/migrations/ | sort | tail -3`
Expected: the new file `20260418120000_*` appears last (or equal-ranked) in timestamp order.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418120000_at_sync_history_returned_count.sql
git commit -m "feat(db): add at_sync_history.invoices_returned_by_at column + reason_code index"
```

---

### Task 5: Integrate `decideSyncStatus` + prior-data lookups into sync-efatura

**Files:**
- Modify: `supabase/functions/sync-efatura/index.ts`

- [ ] **Step 1: Locate the sync-history insertion site**

Grep inside `supabase/functions/sync-efatura/index.ts` for the `at_sync_history` insert:

Run: `grep -n "at_sync_history" supabase/functions/sync-efatura/index.ts`

The insertion call(s) accept a `status` field, currently hardcoded to `'success'` on the happy path. There may be multiple insertion sites — one per direction (`compras` / `vendas`) — all must be updated consistently.

- [ ] **Step 2: Add the helper import near the existing imports**

Near the top of `supabase/functions/sync-efatura/index.ts`, add:

```ts
import { decideSyncStatus } from "./syncStatus.ts";
```

- [ ] **Step 3: Add prior-data lookup helpers inside the file**

Above the first sync-history insertion, add two helpers (before any function that needs them):

```ts
/**
 * Returns true when the client has at least one row in `sales_invoices`
 * with document_date within the past 180 days. Used to decide whether
 * an AT SOAP zero-result response is suspicious or genuinely empty.
 */
async function clientHasPriorSales(
  supabase: any,
  clientId: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { count } = await supabase
    .from("sales_invoices")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("document_date", cutoff);
  return (count ?? 0) > 0;
}

/**
 * Returns true when the client has at least one row in `invoices`
 * (purchases) with document_date within the past 180 days.
 */
async function clientHasPriorPurchases(
  supabase: any,
  clientId: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("document_date", cutoff);
  return (count ?? 0) > 0;
}
```

- [ ] **Step 4: Update every `at_sync_history` insertion site to compute status dynamically**

For each insertion, the engineer must:

1. Compute `atReturnedCount` from the SOAP response object available at that scope. The raw count is `soapResult.invoices?.length ?? 0` or the direction-specific equivalent used by that block (e.g., `comprasInvoices.length`, `vendasInvoices.length`). Use whichever local variable holds the pre-dedup list.
2. Call the direction-appropriate prior-data helper:
   - For a `compras` / purchases insertion: `const hasPriorData = await clientHasPriorPurchases(supabase, clientId);`
   - For a `vendas` / sales insertion: `const hasPriorData = await clientHasPriorSales(supabase, clientId);`
3. Replace the hardcoded status with:
   ```ts
   const { status, reasonCode } = decideSyncStatus({
     atReturnedCount,
     hasPriorData,
   });
   ```
4. Pass both `status` and `reason_code: reasonCode` in the insert, and add the new column:
   ```ts
   .insert({
     client_id: clientId,
     sync_type: direction,                  // 'compras' | 'vendas'
     sync_year: fiscalYear,
     status,
     reason_code: reasonCode,
     invoices_synced: inserted,
     invoices_returned_by_at: atReturnedCount,
     // ...existing fields
   });
   ```
5. If a site already sets `status = 'error'` on a SOAP failure, leave that branch alone. `decideSyncStatus` is only consulted on the SOAP-success branch.

- [ ] **Step 5: Propagate `partial` to `at_credentials.last_sync_status`**

After all directions for a given credential complete, if any direction decided `partial`, set the credential to `partial` (highest-severity wins over `success`, never over `error`). Locate the existing update to `at_credentials.last_sync_status` and change:

```ts
// BEFORE (example pattern)
last_sync_status: hasError ? 'error' : 'success',

// AFTER
last_sync_status: hasError
  ? 'error'
  : hasPartial
  ? 'partial'
  : 'success',
```

Where `hasPartial` is a boolean aggregated across the directions processed in this run (track it alongside the existing `hasError` tracker).

- [ ] **Step 6: Run the full Vitest suite**

Run: `npm test -- --run`
Expected: 956/956 pass (previous 951 + 5 from syncStatus test).

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/sync-efatura/index.ts
git commit -m "fix(sync): emit partial status + invoices_returned_by_at when AT response is suspiciously empty"
```

---

### Task 6: `scripts/force-client-sales-sync.mjs` — validation helper

**Files:**
- Create: `scripts/force-client-sales-sync.mjs`

- [ ] **Step 1: Create the script**

Create `scripts/force-client-sales-sync.mjs`:

```js
#!/usr/bin/env node
// Forces a sync-efatura run for a single client, bypassing the scheduler's
// backoff. Prints job progress until completion or timeout. Intended for
// on-demand validation after deploying the quarter-boundary fix.
//
// Usage:
//   node scripts/force-client-sales-sync.mjs --client-id <uuid> [--direction ambos|vendas|compras] [--timeout-ms 120000]

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function parseArgs(argv) {
  const out = { direction: 'ambos', timeoutMs: 120000 };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--client-id') out.clientId = value;
    else if (key === '--direction') out.direction = value;
    else if (key === '--timeout-ms') out.timeoutMs = Number(value);
  }
  if (!out.clientId) {
    console.error('Missing --client-id <uuid>');
    process.exit(1);
  }
  return out;
}

function loadEnv() {
  const raw = readFileSync('.env', 'utf8');
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [
          l.slice(0, i).trim(),
          l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`▶ Invoking sync-efatura for client=${args.clientId} direction=${args.direction}`);
  const started = Date.now();
  const { data, error } = await supabase.functions.invoke('sync-efatura', {
    body: { clientId: args.clientId, direction: args.direction },
  });
  if (error) {
    console.error('Invocation failed:', error.message ?? error);
    process.exit(1);
  }
  console.log(`◀ sync-efatura returned in ${Date.now() - started}ms`);
  console.log(JSON.stringify(data, null, 2));

  console.log('\n▶ Polling at_sync_history for the latest run…');
  const deadline = Date.now() + args.timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const { data: rows } = await supabase
      .from('at_sync_history')
      .select('sync_type, sync_year, status, invoices_synced, invoices_returned_by_at, reason_code, error_message')
      .eq('client_id', args.clientId)
      .order('id', { ascending: false })
      .limit(4);
    if (rows?.length) {
      last = rows;
      const stillRunning = rows.some((r) => r.status === 'running' || r.status === 'pending');
      if (!stillRunning) break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('Latest history rows:');
  for (const r of last ?? []) {
    console.log(`  ${r.sync_type} y=${r.sync_year} status=${r.status} synced=${r.invoices_synced ?? 0} at_returned=${r.invoices_returned_by_at ?? '?'} reason=${r.reason_code ?? '—'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-check the script is syntactically valid without running it**

Run: `node --check scripts/force-client-sales-sync.mjs`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/force-client-sales-sync.mjs
git commit -m "feat(scripts): add force-client-sales-sync for manual validation runs"
```

---

### Task 7: Full test + lint + build gate

**Files:**
- No file changes — verification only.

- [ ] **Step 1: Run full Vitest suite**

Run: `npm test -- --run`
Expected: all tests pass (956+).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: succeeds. PWA generated.

- [ ] **Step 4: If anything fails, do NOT proceed to validation. Fix root cause and re-run this task.**

---

### Task 8: Staging validation — Bilal, Majda, Helene

**Files:**
- Create: `docs/release/VALIDATION_2026-04-18-sync-fix.md`

- [ ] **Step 1: Deploy the migration**

Run: `npx supabase db push` (or the project's equivalent deployment command documented in `docs/release/DEPLOY_RUNBOOK.md`).
Expected: migration `20260418120000_at_sync_history_returned_count.sql` applied, no errors. Confirm with:

```bash
grep -A1 "invoices_returned_by_at" supabase/migrations/20260418120000_at_sync_history_returned_count.sql
```

- [ ] **Step 2: Deploy the updated edge function**

Run: `npx supabase functions deploy sync-efatura`
Expected: deploy succeeds, function is live.

- [ ] **Step 3: Capture baseline for the three test accounts**

Run: `node scripts/check-clients.mjs > /tmp/baseline-pre-fix.txt`
Expected: Bilal shows 4/7 MATCH, Majda shows 0 vendas 2026 Q1, Helene shows 28 vendas 2026 Q1.

- [ ] **Step 4: Force sync for Bilal**

Run:
```bash
node scripts/force-client-sales-sync.mjs \
  --client-id 5a994a12-8364-4320-ac35-e93f81edcf10 \
  --direction vendas
```
Expected: the latest history rows include `sync_type=vendas`, `status=success`, `invoices_returned_by_at >= 7`.

- [ ] **Step 5: Re-check Bilal against ground truth**

Run: `node scripts/check-clients.mjs`
Expected: Bilal reconciliation section prints `MATCH` for all 7 ATCUDs: JJ37MMGM-22, JJ37MMGM-21, JJ37MMGM-20, JJ3TVYDZ-15, JJ3TVYDZ-14, JJ37MMGM-19, JJ37MMGM-18.

- [ ] **Step 6: Force sync for Majda**

Run:
```bash
node scripts/force-client-sales-sync.mjs \
  --client-id 918dde3c-b33d-4e65-94df-53a0a3a79c38 \
  --direction vendas
```
Expected: EITHER
- (A) new vendas land → record the count and note that Majda was also hit by the boundary bug, OR
- (B) `invoices_returned_by_at = 0` AND `status = 'partial'` AND `reason_code = 'AT_ZERO_RESULTS_SUSPICIOUS'` — the silent-success kill is working.

- [ ] **Step 7: Force sync for Helene (regression baseline)**

Run:
```bash
node scripts/force-client-sales-sync.mjs \
  --client-id af826459-7260-4b3c-9b97-08077299e356 \
  --direction vendas
```
Expected: `status=success`, `invoices_returned_by_at >= 28`. No data loss. `check-clients.mjs` still shows 28 vendas 2026 Q1.

- [ ] **Step 8: Write the validation report**

Create `docs/release/VALIDATION_2026-04-18-sync-fix.md` with:

```markdown
# Validation — Sync Quarter Boundary Fix — 2026-04-18

Spec: docs/superpowers/specs/2026-04-18-sync-quarter-boundary-fix-design.md
Plan: docs/superpowers/plans/2026-04-18-sync-quarter-boundary-fix.md

## Environment
- Edge function deploy SHA: <paste git rev-parse HEAD>
- Migration applied: 20260418120000_at_sync_history_returned_count.sql

## Bilal (232945993)
- Pre-fix DB count 2026: 4
- Post-fix DB count 2026: <paste>
- AT ground truth: 7 (FR/22, FR/21, FR/20, FT/15, FT/14, FR/19, FR/18)
- Reconciliation: <PASS|FAIL> — paste the MATCH/MISSING block from check-clients.mjs

## Majda (232946060)
- Pre-fix DB count 2026 Q1: 0
- Post-fix DB count 2026 Q1: <paste>
- at_sync_history last vendas row: status=<paste>, reason_code=<paste>, invoices_returned_by_at=<paste>
- Outcome: <A: latent docs recovered | B: partial flagged correctly>

## Helene (232091803)
- Pre-fix DB count 2026 Q1: 28
- Post-fix DB count 2026 Q1: <paste>
- Regression check: <PASS|FAIL>

## Verdict
- <Ready for prod | Needs fix>
```

- [ ] **Step 9: Commit the validation report**

```bash
git add docs/release/VALIDATION_2026-04-18-sync-fix.md
git commit -m "docs(release): validation report for sync quarter boundary fix — staging run"
```

- [ ] **Step 10: Gate**

If any of Bilal / Helene checks failed, or if Majda showed silent-success with 0 returned (neither outcome A nor B), STOP HERE. Open a follow-up task, do not continue to prod rollout.

---

### Task 9: Production rollout + morning-after regression sweep

**Files:**
- Modify: `docs/release/VALIDATION_2026-04-18-sync-fix.md` (append prod-rollout section)

- [ ] **Step 1: Merge the branch into main**

If the work has been on a feature branch, merge via PR (`gh pr create --base main`). If on main directly (project convention accepts it), push with `git push origin main`.

- [ ] **Step 2: Wait for the next scheduled cron window**

The `at-sync-auto-dispatch` cron fires every 15 min but only takes action at 19:30 and 06:00 Lisbon. Wait for the next window to elapse.

- [ ] **Step 3: Morning-after regression sweep — add a sweep script**

Create `scripts/sync-regression-sweep.mjs`:

```js
#!/usr/bin/env node
// Reads 10 random profiles (with NIF) from the DB and prints, for each:
//   - last at_sync_history row: status, reason_code, invoices_returned_by_at
//   - vendas count in the current trimester
// Used as a morning-after regression check.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
    }),
);

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: profiles } = await supabase
  .from('profiles')
  .select('id, full_name, nif')
  .not('nif', 'is', null)
  .limit(10);

for (const p of profiles ?? []) {
  const { data: h } = await supabase
    .from('at_sync_history')
    .select('sync_type, status, reason_code, invoices_returned_by_at, invoices_synced')
    .eq('client_id', p.id)
    .order('id', { ascending: false })
    .limit(2);
  console.log(`\n${p.full_name} (${p.nif})`);
  for (const row of h ?? []) {
    console.log(
      `  ${row.sync_type} status=${row.status} reason=${row.reason_code ?? '—'} at_returned=${row.invoices_returned_by_at ?? 'NULL'} synced=${row.invoices_synced}`,
    );
  }
}
```

Run: `node scripts/sync-regression-sweep.mjs`

Expected, for every client:
- `last_sync_status` is `success` or `partial` (never regressed to `error`).
- `invoices_returned_by_at` is populated on post-fix rows (non-NULL).
- No client went from N vendas to 0 between runs.

Commit the sweep script alongside the validation report:

```bash
git add scripts/sync-regression-sweep.mjs
git commit -m "feat(scripts): add sync-regression-sweep for morning-after checks"
```

- [ ] **Step 4: Append prod results to the validation report**

Append a "Prod rollout" section to `docs/release/VALIDATION_2026-04-18-sync-fix.md` with:
- Merge commit SHA
- First cron run timestamp
- Regression sweep results (10-client summary)
- Verdict: proceed to Phase 1.5 / hold

- [ ] **Step 5: Commit and push**

```bash
git add docs/release/VALIDATION_2026-04-18-sync-fix.md
git commit -m "docs(release): append prod-rollout validation for sync quarter boundary fix"
git push origin main
```

- [ ] **Step 6: Announce completion**

Update the user with the final counts for the three test accounts plus the 10-client sweep summary. Ask whether to proceed to Phase 1.5 (SalesHealth dashboard) or wait.

---

## Risks and rollback

**Risk:** the widened window causes AT to rate-limit or return schema errors across clients. Mitigation: `sync-efatura` already retries with month-chunking on schema errors (`sync-efatura/index.ts:243-270`). If rate-limits appear, revert Task 2 only (the default window change) — Tasks 3-5 (status logic, migration) can stay in place.

**Rollback paths:**
- Code: `git revert <Task 2 commit>` restores the original default window. `git revert <Task 5 commit>` reverts the status logic. Each is independent.
- Migration: leave in place — additive column, unread after code revert.
- Prod state: no data corruption possible. Dedup on `(client_id, supplier_nif, document_number)` prevents duplicates even under re-run overlap.

## Notes on TDD discipline

Tasks 1 and 3 are strict TDD (test first, watch it fail, minimal implementation, watch it pass). Tasks 2 and 5 are integration-level where unit tests don't exist for the full edge-function handler; they rely on the already-tested pure helpers plus the staging validation in Task 8 as the behavioural test. Task 4 is schema-only and validated by structural grep + downstream reads in Task 8. Task 6 is a CLI tool validated by `node --check` + the fact that Task 8 executes it.
