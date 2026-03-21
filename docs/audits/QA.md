# QA Checklist (Manual + Automated)

This document is a practical QA checklist for IVAzen. It focuses on the critical user flows and the regressions we've seen in production (uploads, OCR/extraction, validation, exports).

## Preflight (Always Do This First)

- Confirm you're testing the expected deployment:
- Open `/upload` and check the build stamp at the bottom: `Build <commit> · <ISO time>`.
- If the build stamp is not changing after a deploy, you're likely stuck with a cached PWA/Service Worker.

## PWA/Service Worker Reset (If "It’s Still the Same")

1. Chrome/Edge DevTools
1. `Application` tab
1. `Service Workers` -> `Unregister`
1. `Storage` -> `Clear site data`
1. Hard reload (`Cmd+Shift+R` on macOS)
1. Re-check the build stamp on `/upload`

## Auth

1. Unauthenticated user visiting `/upload` is redirected to `/auth`.
1. Client login can reach `/dashboard`.
1. Accountant login can reach `/accountant` and see client list.
1. Super Admin login can reach `/admin`.

## Accountant Client Association (RLS)

1. Login as accountant.
1. Select a client.
1. Upload and save an invoice for that client.
1. Expected: invoice row is inserted with `client_id=<selectedClientId>`, no RLS error.

## Upload (Individual)

1. Go to `/upload` -> "Individual".
1. Upload a PDF invoice.
1. Expected:
1. Extraction runs (edge function `extract-invoice-data`).
1. Invoice is saved even when supplier tax id is missing/foreign, provided `document_date` and `total_amount` exist.
1. The UI shows `NIF/VAT` and shows `VAT: <...>` when the supplier has a foreign VAT ID.

## Upload (Bulk)

1. Go to `/upload` -> "Em Bulk".
1. Drag and drop multiple PDFs (mix of normal PT invoices + edge cases).
1. Expected:
1. `validateBulkFiles()` accepts all valid PDFs even when the browser reports `file.type=""` or `application/octet-stream`.
1. Queue shows all items.
1. Click "Processar".
1. Expected: `N processadas` equals `N guardadas`.
1. For any item not saved, UI should show the DB error (as a warning) and allow retry.

## OCR/Extraction Edge Cases (Critical)

1. Foreign VAT supplier (example: Google Ireland VAT like `IE...`)
1. Expected:
1. Extractor returns either `supplier_vat_id` or a `supplier_nif` that normalizes into foreign VAT.
1. Invoice is saved.
1. UI does not block on "NIF inválido".
1. Handwritten/scanned invoice with supplier NIF labeled as `N/N Cont.` and spaced digits (example `150 798 369`)
1. Expected:
1. Extractor can capture the NIF (second-pass tax-id extraction helps).
1. If still missing, invoice is still saved and marked "para revisão".
1. Customer NIF is not confused with supplier NIF.

## Validation Flow

1. Open `/validation`.
1. Open an invoice detail dialog.
1. Edit:
1. `supplier_nif` (or VAT) when needed
1. `final_dp_field`
1. `final_deductibility`
1. Validate invoice.
1. Expected:
1. Invoice moves to `status=validated`.
1. Exports include it.

## Exports (DP)

1. Go to `/export`.
1. Select a quarter (ex: `2025-Q3`).
1. Export XLSX.
1. Expected:
1. `Resumo DP` totals match the UI totals.
1. Purchases VAT deductible uses `(final_deductibility ?? ai_deductibility)`.
1. DP field mapping is consistent:
1. Campo 21 = 6%
1. Campo 23 = 13%
1. Campo 22 = 23%
1. Campo 24 = Outros bens e serviços

## Accountant Reconciliation (Purchases)

1. Export DP XLSX from IVAzen (quarterly).
1. Compare with accountant sheet:
1. `python3 scripts/compare_dp_purchases.py --accountant-xls "/Users/bilal/Downloads/JUSTYNA/IVA apur. 3º trim.xls" --ivazen-xlsx "<path-to-ivazen-export>.xlsx"`
1. Expected:
1. Fields 20-24 VAT totals match accountant output within cents.
1. Campo 91 and deductible totals match.

## Automated Test Entry Points

- Unit tests: `npm test`
- E2E tests: `npm run e2e`

E2E tests require:

- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`

