# IVAzen Final Release Notes — March 2026

## Objective

Close the accountant feedback loop with a safe, auditable release branch before merging anything else into `main`.

## Included in this release track

- accountant dashboard and portfolio access hardening
- validation workflow hardening
- duplicate cleanup preserving uploaded source files
- supplier fallback and contextual document origin handling
- recent import prioritization in purchases and sales
- bulk `Não contabilizar`
- `iva_cadence` support and VAT-regime-aware deadlines
- protected import flow for sales/recibos verdes
- release gates, runbooks, and UAT documentation

## Explicitly not included in this release

- automatic AT synchronization of sales/recibos verdes
- server-side sync ledger
- supplier rules engine
- queue-backed background orchestration
- full server-side replacement for every `fetchAllPages` usage

## Release success criteria

- `build`, `test`, and `lint` pass
- accountant UAT is executed and documented
- public deployment is confirmed to be on the audited commit
- no blocker remains in dashboard, validation, sales, import, reconciliation, or fiscal deadline flows
