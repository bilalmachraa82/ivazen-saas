# Accountant Feedback Matrix — March 2026

This matrix translates the meeting transcripts into release-verifiable product outcomes.

| Concern | Status | Release handling |
| --- | --- | --- |
| Portfolio / accountant access | Resolved | Super-admin/accountant portfolio access restored and must be revalidated in UAT |
| Dashboard collapse / oversized queries | Resolved for delivery | Global overview lightened; detail loads per client |
| Wrong VAT monthly/trimestral alerts | Resolved | `iva_cadence` + VAT-regime-aware deadlines |
| Exempt (`Art. 53`) handling | Implemented, needs UAT proof | Code path exists; live UAT still required with an exempt client |
| Missing supplier names | Resolved | Supplier fallback/enrichment is now cross-cutting |
| Placeholder documents from AT | Resolved | Placeholder origin is explained contextually |
| Duplicate cleanup losing uploaded file | Resolved | Keep the useful uploaded copy |
| Recent imports hard to prioritize | Resolved | `recentWindow` filters + recent import highlighting |
| Bulk ignore / exclude from VAT calculation | Resolved | `accounting_excluded` + bulk action |
| Reconciliation with dead actions | Resolved for release scope | Reconciliation supports opening invoices and clearer context |
| Sales import confusion | Resolved at UX level | Wrong path blocked, correct path highlighted |
| Full AT auto-sync for sales | Not in this release | Explicitly out of scope and documented as a limitation |
