# Accountant UAT Checklist

Use this checklist on the audited release branch or staging environment before merging into `main`.

## General

- [ ] Log in with an accountant account that has portfolio access
- [ ] Confirm the active deployment/commit under test

## Dashboard

- [ ] Portfolio overview loads without collapsing
- [ ] Accountant sees the full client portfolio
- [ ] Monthly client shows only monthly VAT deadline
- [ ] Quarterly client shows only quarterly VAT deadline
- [ ] Exempt client shows no monthly/quarterly VAT deadline

## Purchases / Validation

- [ ] Client selection persists correctly
- [ ] `Não dedutível` sets DP field to `Nenhum`
- [ ] `Não dedutível` forces deductibility to `0%`
- [ ] Recent-import filter isolates newly imported invoices
- [ ] Bulk selection works on the filtered list
- [ ] Bulk `Não contabilizar` works
- [ ] Duplicate manager uses the active client automatically
- [ ] Opening an invoice from validation preserves client context

## Reconciliation

- [ ] Reconciliation tab loads
- [ ] Supplier labels are intelligible
- [ ] Open-invoice actions work from reconciliation rows
- [ ] No dead action/button remains

## Documents / Preview

- [ ] Uploaded document preview opens for real files
- [ ] AT-imported placeholder documents show contextual messaging
- [ ] Origin of the document is understandable to the accountant

## Sales

- [ ] Sales page opens without runtime errors
- [ ] KPIs are coherent with filtered data
- [ ] Recent-import filter works
- [ ] Empty-state text points to the correct import flow when there are no sales

## Import flows

- [ ] Purchases CSV import path is clear
- [ ] Sales/recibos verdes uploaded in the wrong place are blocked with an explicit message
- [ ] Correct revenue import flow is reachable from the UI

## Final sign-off

- [ ] Internal audit approved
- [ ] Final external audit approved
- [ ] Ready to merge release branch into `main`
