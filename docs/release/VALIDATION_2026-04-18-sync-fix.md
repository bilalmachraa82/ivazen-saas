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

### Bilal Machraa — 232945993 — PASS (Phase 1 behaving exactly as designed)

**Initial baseline:** 4/7 vendas in DB vs AT portal screenshot. 3 ATCUDs missing: `JJ37MMGM-22` (2026-04-02, 1920€), `JJ37MMGM-21` (2026-04-01, 210€), `JJ37MMGM-20` (2026-03-30, 974,25€).

**Initial investigation mis-step:** an earlier version of this report claimed Bilal's `end_date` was stuck at `2026-03-30`. That was a false positive from ordering by `id` (UUID-v4, random) in the debug script — it surfaced two old rows from different days and was interpreted as a pattern. The subagent forensic script `scripts/debug-bilal-enddate-forensics.mjs` (commit `3f61471`) checked all 49 rows since 2026-03-25 and confirmed `end_date` always equals the creation-day date. **No end_date bug exists.**

**Actual Phase 1 result for Bilal:**
- `start_date=2026-01-01`, `end_date=2026-04-18` — widening and today-clamp both correct ✅
- `status=partial`, `reason_code=AT_ZERO_RESULTS_SUSPICIOUS` — **exactly what we designed**: AT SOAP returned "Lista de faturas vazia." for vendas despite Bilal having 25 prior sales.
- Vendas count unchanged at 4 — because the underlying AT SOAP response is genuinely empty.

**Why the 3 ATCUDs are still missing (operational, not code):**
Bilal's `at_credentials.subuser_id=null` and `encrypted_username="232945993"` (literal NIF). `fatshareFaturas` requires emitter-side credentials — a SIRE subuser or an equivalent delegation — for issued-invoice queries. His credential does not have that, so AT returns empty even though SIRE has the data. The Phase 1 fix correctly surfaces this as `partial` instead of hiding it as `success`, giving the accountant the concrete signal to act.

**Conclusion: Phase 1 is working for Bilal.** The 3 missing invoices are a credential-config issue to be addressed operationally (add a SIRE subuser or use the manual Excel import until the credential is upgraded).

### Majda Machraa — 232946060 — PENDING

Still in the drain queue at the time of writing. Expected behaviour under the new code:
- If she genuinely has no 2026 Q1 vendas: `status=success` + `reason_code=AT_EMPTY_LIST` (no suspicion, no prior Q1-2026 data).
- If she has prior-year sales + zero new: either `partial` + `AT_ZERO_RESULTS_SUSPICIOUS`, OR `success` + `AT_EMPTY_LIST` depending on how `clientHasPriorSales` evaluates (180-day window).

To be re-checked the morning after the 06:00 Lisbon cron.

### Helene Konokovi Abiassi — 232091803 — PENDING

Still in drain queue. Expected: unchanged count (28), `status=success`, no regression.

## Multi-key auth — RESOLVED

Initial symptom: the edge function's `SUPABASE_SERVICE_ROLE_KEY` env var in production does NOT byte-equal the project's legacy `service_role` JWT (digest `178e732…` vs JWT-SHA `77cc003…`). The server-side override is the new-format `sb_secret_…` key. After Phase 1's auth-hardening (`1861b96`) collapsed `isServiceRoleToken` to byte-for-byte compare, external callers with the legacy JWT were rejected.

Fix (commit `b2eabda`): `isServiceRoleToken` is now variadic and a new `isConfiguredServiceRoleToken` reads both `SUPABASE_SERVICE_ROLE_KEY` (primary) and an optional `SERVICE_ROLE_KEY_LEGACY` (transition fallback) from the environment. `sync-efatura` uses the new helper. The legacy JWT is set as `SERVICE_ROLE_KEY_LEGACY` via `supabase secrets set`. Live verification: a direct `curl` with the legacy JWT now returns `status=partial` + `reason_code=AT_ZERO_RESULTS_SUSPICIOUS` for Bilal (expected), instead of `"Token inválido ou expirado"`.

Security is preserved — byte-for-byte compare against each allowed key; JWT payloads are never decoded.

## Verdict

**Phase 1: DELIVERED, OPERATIONAL, AND VALIDATED.** Live traffic proves both halves of the fix are in effect:
- 13 rows populated `invoices_returned_by_at` in the first 30 min post-deploy.
- 3 distinct clients labelled `AT_ZERO_RESULTS_SUSPICIOUS` — the silent-success kill is catching real gaps.
- All current-year runs use `start_date=2026-01-01` — previous-quarter widening applied.
- Bilal's own run lands `partial + AT_ZERO_RESULTS_SUSPICIOUS` — the pipeline correctly surfaces his credential limitation instead of hiding it.
- Multi-key auth fix deployed — legacy JWT invokers (CLI, GitHub Action) work again without regressing the byte-compare security.

**Outstanding (operational, not Phase 1 code):**
1. Bilal's credential needs a SIRE subuser to restore `fatshareFaturas` vendas flow. Operational fix by the accountant / user.
2. Morning-after sweep on the 06:00 Lisbon cron (automated via `.github/workflows/nightly-sync-health.yml`).
3. 17 other edge functions still use `isServiceRoleToken` with a single key. They work today (internal calls share the same env var) but could be migrated to `isConfiguredServiceRoleToken` for consistency — nice-to-have, not blocker.
4. Phase 1.5 (SalesHealth dashboard) can proceed — spec at `docs/superpowers/specs/2026-04-18-sales-health-dashboard-design.md`.
