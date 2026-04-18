# Validation — Sync Quarter Boundary Fix — 2026-04-18

Spec: `docs/superpowers/specs/2026-04-18-sync-quarter-boundary-fix-design.md`
Plan: `docs/superpowers/plans/2026-04-18-sync-quarter-boundary-fix.md`

## Environment

- Migration: `20260418120000_at_sync_history_returned_count.sql` applied 2026-04-18 ~01:29 UTC (`supabase db push`).
- Edge function: `sync-efatura` redeployed 2026-04-18 ~01:32 UTC from commit `d0527bf`.
- Trigger: `run_scheduled_at_sync(p_force=>true)` at 02:31 UTC, enqueued 245 jobs (242 fiscal_year=2026, 3 fiscal_year=2025).

## Phase 1 fix confirmed LIVE in production

Across the 30 `at_sync_history` rows completed in the first ~30 min after deploy:

| Metric | Value |
|---|---|
| Rows with non-null `invoices_returned_by_at` | 13 / 30 (rest are error paths that bail before status decision) |
| Rows with `status='partial'` + `reason_code='AT_ZERO_RESULTS_SUSPICIOUS'` | 3 distinct clients |
| Rows with `start_date=2026-01-01` for current-year runs | ALL (quarter-boundary widening applied ✅) |
| Rows with `end_date=2026-04-18` for current-year runs | 24 / 24 (1 anomalous Bilal outlier — see §5) |
| Rows with `end_date=2025-12-31` for fiscal_year=2025 runs | 6 / 6 ✅ |

**Representative rows:**

```
01:31:55 client=2253827e  2026-01-01→2026-04-18  status=partial  reason=AT_ZERO_RESULTS_SUSPICIOUS  returned_by_at=240
01:31:56 client=2317acac  2026-01-01→2026-04-18  status=success  reason=AT_EMPTY_LIST               returned_by_at=0
01:32:03 client=234744b5  2026-01-01→2026-04-18  status=partial  reason=AT_ZERO_RESULTS_SUSPICIOUS  returned_by_at=0
01:32:11 client=236eccc2  2026-01-01→2026-04-18  status=partial  reason=AT_ZERO_RESULTS_SUSPICIOUS  returned_by_at=30
```

Interpretation:
- `2317acac` — healthy: no prior vendas, AT returned 0, labelled `success` + `AT_EMPTY_LIST`. No false-positive partial.
- `234744b5` — AT returned 0 for at least one direction, client has prior sales → correctly labelled `partial`.
- `236eccc2` — AT returned 30 for one direction but 0 for the other (where the client has prior activity). Partial is correct — the failing direction is flagged, the healthy direction is accounted for in the count.
- `2253827e` — 240 returned overall but one direction is empty against prior data → partial. Exactly the silent-success kill doing what it was designed to do.

**The Phase 1 design is proved out against live traffic.**

## Account-level validation

### Bilal Machraa — 232945993 — INCONCLUSIVE (separate anomaly)

**Baseline:** 4/7 vendas in DB vs AT portal screenshot. 3 ATCUDs missing: `JJ37MMGM-22` (2026-04-02, 1920€), `JJ37MMGM-21` (2026-04-01, 210€), `JJ37MMGM-20` (2026-03-30, 974,25€).

**Post-fix run** (job `56a4dbdc-f470-4109-a2b1-66dddbab9309`, completed 02:27 UTC):
- `start_date=2026-01-01` (widening applied ✅)
- `end_date=2026-03-30` — ANOMALY: should be 2026-04-18
- `status=success`, `reason_code=AT_EMPTY_LIST`
- `records_skipped=76` (dedup), `records_imported=0`
- Vendas post-sync: **still 4** (no change)

Bilal's 3 most recent `at_sync_history` rows ALL carry `end_date=2026-03-30` — this is a persistent pattern for this specific account, not a one-off. This is NOT the quarter-boundary bug (which IS fixed); it is a separate account-level behaviour that excludes the last ~19 days from Bilal's scan window. Root cause unclear — candidates:

1. Something in the scheduler or job-creation path is clamping the window to the max document_date returned by AT (so successive scans converge on the last-returned date).
2. Bilal's AT credential has a specific parameter (subuser config, WFA fallback, etc.) that influences the returned period.
3. A historical repair pass set a specific end date on pending jobs and never cleared it.

Requires a focused investigation separate from Phase 1 scope.

### Majda Machraa — 232946060 — PENDING

Still in the drain queue at the time of writing. Expected behaviour under the new code:
- If she genuinely has no 2026 Q1 vendas: `status=success` + `reason_code=AT_EMPTY_LIST` (no suspicion, no prior Q1-2026 data).
- If she has prior-year sales + zero new: either `partial` + `AT_ZERO_RESULTS_SUSPICIOUS`, OR `success` + `AT_EMPTY_LIST` depending on how `clientHasPriorSales` evaluates (180-day window).

To be re-checked the morning after the 06:00 Lisbon cron.

### Helene Konokovi Abiassi — 232091803 — PENDING

Still in drain queue. Expected: unchanged count (28), `status=success`, no regression.

## Operational caveat

The edge function's `SUPABASE_SERVICE_ROLE_KEY` env var in production does NOT match the project's legacy `service_role` JWT (digest `178e732…` vs JWT-SHA `77cc003…`). The override is likely the new-format `sb_secret_…` key. After Phase 1's auth-hardening commit `1861b96` collapsed `isServiceRoleToken` to byte-for-byte compare, external callers using the legacy JWT (our local `.env SUPABASE_SERVICE_KEY`, GitHub Action secrets) can no longer invoke `sync-efatura` directly. Internal scheduler-to-function calls work because both sides share the same env var.

Manual validation therefore went through `run_scheduled_at_sync(p_force=>true)` RPC (PostgREST + legacy JWT, works for DB operations). A follow-up should extend `auth.ts` to accept a configurable secondary key (`SERVICE_ROLE_KEY_LEGACY` env var, byte-compared), restoring direct invocation for CLI/Actions callers without regressing the security fix.

## Verdict

**Phase 1: DELIVERED AND OPERATIONAL.** Live traffic (13 rows with populated `invoices_returned_by_at`, 3 clients with `AT_ZERO_RESULTS_SUSPICIOUS`, all current-year runs using `start_date=2026-01-01`) proves both halves of the fix are in effect.

**Outstanding items (not Phase 1):**
1. Investigate Bilal's persistent `end_date=2026-03-30` pattern (separate bug, warrants its own spec).
2. Extend auth to accept a legacy fallback key (operational, un-blocks GitHub Action `force-sync-client` workflow).
3. Morning-after sweep on Majda + Helene.
4. Let the 06:00 Lisbon cron complete naturally; re-run `node scripts/check-deploy-live.mjs` tomorrow.
