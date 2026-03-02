# Archived Operational Migrations

These SQL files were moved out of `supabase/migrations/` because they contain
**data operations** (INSERT/UPDATE/DELETE of production data) rather than pure
schema changes. They have already been executed on the production database.

## Why archived

- `B3_insert_users.sql` contained 406 user INSERT statements with temporary
  passwords — security risk in a public repository.
- Other files contain one-off data fixes (deduplication, status updates) that
  should not be re-run by `supabase db push` or similar tooling.

## Files

| File | Purpose |
|------|---------|
| B2_disable_constraints.sql | Disable triggers before bulk import |
| B3_insert_users.sql | 406 user records (SENSITIVE) |
| B5_enable_constraints.sql | Re-enable triggers after import |
| B6_verify_counts.sql | Row count verification queries |
| 20260205144719_*.sql | Modelo 10 duplicate cleanup |
| 20260205144928_*.sql | FT/RG duplicate pair removal |
| 20260205144948_*.sql | Single record deletion |
| 20260223194500_*.sql | Mark AT sales as validated |
| 20260224103000_*.sql | Sync withholdings to revenue_entries |
| 20260224144912_*.sql | Revenue entries sync (retry) |
| 20260227170500_*.sql | Per-client uniqueness hardening |

## Important

These migrations were already applied to production. Do NOT re-run them.
