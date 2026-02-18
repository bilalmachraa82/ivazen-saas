# Final Evidence Pack: Justyna Q3 2025

Date: 2026-02-18
Status: CLOSED

## 1) Production/Deploy Evidence

- Repo: `iva-inteligente-mvp`
- Branch: `main`
- Code commit for hardening + QA assets: `cc9a404`
- Edge function deployed: `extract-invoice-data`
- Deploy confirmation (Lovable report): `Successfully deployed edge functions: extract-invoice-data`
- Runtime guard in active code:
  - `ratioOk = ratio === null ? fullTotal <= 25 : ratio >= 0.45 && ratio <= 2.6`
  - `deltaOk = previousTotalVat <= 0 ? true : deltaAbs <= 8`
  - `isSane = fullTotal > 0.5 && ratioOk && deltaOk`

## 2) SQL Evidence (A/B/C/D)

### A) EDP state (post re-extract)

| document_number | document_date | total_vat | status | requires_accountant_validation |
|---|---|---:|---|---|
| FT2025 K3425/340023333798 | 2025-07-05 | 11.18 | classified | true |
| FT2025 K3425/340026795665 | 2025-08-02 | 8.98 | classified | true |
| FT2025 K3425/340030638633 | 2025-09-02 | 8.64 | classified | true |

### B) Audit log evidence (EDP Aug correction)

- `action=edited`
- `total_vat: 21.37 -> 8.98`
- Previous overcount event exists in history (`8.98 -> 21.37`) and is now reverted by re-extract with guardrail.

### C) Purchases Q3 by DP field

| dp_field | n_docs | vat_total | vat_deductivel |
|---:|---:|---:|---:|
| 24 | 7 | 42.17 | 42.17 |

Field 41 (regularization): `0.27`

Net target for field 24: `42.17 - 0.27 = 41.90`

### D) Sales Q3 totals

| n_vendas | total_vendas | iva_liquidado |
|---:|---:|---:|
| 5 | 4159.50 | 0.00 |

## 3) PASS/FAIL Checklist

| Criteria | Expected | Actual | Result |
|---|---:|---:|---|
| EDP Jul | 11.18 | 11.18 | PASS |
| EDP Aug | 8.98 (+/-0.02) | 8.98 | PASS |
| EDP Sep | 8.64 | 8.64 | PASS |
| Purchases VAT total | 42.17 | 42.17 | PASS |
| Field 41 | 0.27 | 0.27 | PASS |
| Net field 24 | 41.90 | 41.90 | PASS |
| Sales total Q3 | 4159.50 | 4159.50 | PASS |
| No manual SQL forcing of `total_vat` | Required | Confirmed in closure report | PASS |

## 4) Closing Statement

Reconciliation for Justyna Q3 2025 is closed with objective evidence.
The EDP August overcount was corrected through UI re-extraction with production sanity guard active.
No manual SQL value forcing was used for final totals.

## 5) Supporting Repo Files

- `supabase/functions/extract-invoice-data/index.ts`
- `supabase/functions/extract-invoice-data/edpSanity.ts`
- `supabase/functions/extract-invoice-data/edpSanity.test.ts`
- `docs/RUNBOOK_RECONCILIACAO_TRIMESTRAL.md`
- `docs/RELEASE_NOTE_2026-02-EDP_REEXTRACT.md`

