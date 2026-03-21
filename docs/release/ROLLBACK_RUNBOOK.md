# Rollback Runbook

## Principle

Rollback must prefer reverting the release merge or redeploying the previous known-good frontend/backend artifact. Do not reset history on shared branches.

## If the release was merged to `main`

1. Identify the merge commit
2. Revert it with a normal revert commit
3. Redeploy frontend from the reverted `main`
4. Redeploy any affected Supabase edge function version if required

## If the issue is frontend-only

1. Revert the release merge commit or create a hotfix commit
2. Trigger a new Vercel deployment
3. Re-run smoke:
   - dashboard
   - validation
   - sales
   - import center

## If the issue is edge-function-only

1. Redeploy the previous function version
2. Confirm notification/import behavior in logs
3. Keep schema unchanged unless a new forward migration is required

## Schema rollback guidance

The current delivery should avoid destructive rollbacks. For schema issues:

- prefer forward-fix migrations
- do not manually drop fields used by the live app
- keep `profiles.iva_cadence` and `invoices.accounting_excluded` intact unless a dedicated rollback plan exists

## Evidence to capture

- failing route / client / workflow
- timestamp
- current deployed commit
- screenshots or console/network logs
