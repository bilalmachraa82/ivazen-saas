# Deploy Runbook

## Branch policy

- feature work merges into `release/ivazen-finalization-2026-03`
- only the release branch can merge into `main`
- `main` remains frozen until all audits and UAT are complete

## Required GitHub protection settings

Configure these in the repository settings for the release branch and `main`:

- require pull requests before merging
- require approval from at least one reviewer
- require status checks to pass:
  - build
  - test
  - lint
- require branch to be up to date before merge
- block direct pushes for non-admin users if applicable

## Pre-merge checklist

1. `npm run verify:release`
2. accountant UAT completed
3. audit notes attached to the PR
4. deploy target confirmed

## Supabase rollout

1. apply migrations if any new release migration is present
2. deploy affected edge functions
3. verify runtime configuration

## Frontend rollout

1. merge release branch to `main`
2. confirm Vercel production deployment starts from the merge commit
3. verify the public URL points to the audited commit

## Post-deploy smoke

- dashboard portfolio
- validation for a real client
- sales page
- import center
- deadlines card
- reconciliation
