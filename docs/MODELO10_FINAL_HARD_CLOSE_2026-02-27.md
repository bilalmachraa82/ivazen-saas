# MODELO 10 FINAL HARD CLOSE — 2026-02-27

**Date:** 2026-02-27T22:15 UTC  
**Client ID:** 9039d4fa-fd21-4652-b395-4f7d77c195da (NIF 508840309 / CAAD)  
**Fiscal Year:** 2025  
**Process-queue version:** 5.5.0 (deployed)

---

## GATE FINAL — ❌ NO-GO

```sql
select count(*) as recibos,
       round(coalesce(sum(gross_amount),0)::numeric,2) as bruto,
       round(coalesce(sum(withholding_amount),0)::numeric,2) as retencao
from public.tax_withholdings
where client_id='9039d4fa-fd21-4652-b395-4f7d77c195da'
  and fiscal_year=2025;
```

```text
              ACTUAL            TARGET          DELTA        PASS?
Recibos:      2,695             2,697            -2          ❌
Bruto:   4,837,836.75      4,569,023.74    +268,813.01      ❌
Retenção:1,057,615.92      1,013,911.80     +43,704.12      ❌
```

---

## PHASE 1 — CODE FIXES APPLIED (v5.5.0)

### Fix 1: NEEDS_REVIEW no longer upserts into tax_withholdings
- **Before (v5.4.0, lines 452-455):** `arithmeticNeedsReview=true` still called `upsertWithholding()`
- **After (v5.5.0):** NEEDS_REVIEW items are stored in `upload_queue` only; no DB write to `tax_withholdings`
- **Impact:** Prevents future arithmetic-suspect records from inflating totals

### Fix 2: normalizeDocumentReference suffix pattern
- **Before:** `/-N$/` — only caught literal `-N` suffix
- **After:** `/-\d+$/` — catches `-1`, `-2`, `-N`, `-3`, etc.
- **Impact:** Better deduplication of copy/version suffixes

### Fix 3: Duplicate tracking via outcome_code (maintained from v5.4.0)
- `SKIPPED_DUPLICATE` set in `upload_queue.outcome_code` column
- Pre-UPSERT check uses `(client_id, beneficiary_nif, document_reference, fiscal_year)`

---

## PHASE 2 — DIAGNOSTIC SQL RESULTS

### Queue outcome distribution
```sql
select outcome_code, count(*)
from public.upload_queue
where client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' and fiscal_year=2025
group by 1 order by 2 desc;
```
```text
outcome_code | count
-------------|------
NULL         | 2,693
```
**⚠️ ALL 2,693 queue items have NULL outcome_code** — v5.4.0/5.5.0 was deployed but queue was NEVER reprocessed. All data in `tax_withholdings` was inserted by older engine versions.

### Withholdings summary
```text
Total records:           2,695
Unique (nif,doc_ref):    2,695 (no actual duplicates in table)
Zero-retention records:  135 (gross: 249,772.24€)
Non-zero retention:      2,560 (gross: 4,588,064.51€, ret: 1,057,615.92€)
```

### Arithmetic mismatches (|expected_wh - actual_wh| > 1€)
```text
Count: 10 records
Total arithmetic delta: 492.54€

Top offenders:
NIF 216608392 ATSIRE01FR/100: gross=1951.92, wh=364.99, expected=448.94, Δ=83.95€
NIF 216608392 ATSIRE01FR/29:  gross=1500,    wh=280.49, expected=345.00, Δ=64.51€
NIF 126172722 ATSIRE01FR/16:  gross=1000,    wh=186.99, expected=230.00, Δ=43.01€
NIF 135245621 ATSIRE01FR/20:  gross=1000,    wh=186.99, expected=230.00, Δ=43.01€
NIF 206324308 ATSIRE01FR/14:  gross=1000,    wh=186.99, expected=230.00, Δ=43.01€
NIF 205935346 ATSIRE01FR/52:  gross=1000,    wh=186.99, expected=230.00, Δ=43.01€
NIF 216608392 ATSIRE01FR/71:  gross=1000,    wh=186.99, expected=230.00, Δ=43.01€
NIF 128797630 ATSIRE01FR/61:  gross=1000,    wh=186.99, expected=230.00, Δ=43.01€
NIF 165711256 ATSIRE01FR/33:  gross=1000,    wh=186.99, expected=230.00, Δ=43.01€
NIF 216608392 ATSIRE01FR/27:  gross=1000,    wh=186.99, expected=230.00, Δ=43.01€
```

**Pattern:** 7 records show gross=1000€ with wh=186.99€ (expected 230€). The AI likely extracted the NET value as GROSS. Real gross ≈ 812.57€ (186.99/0.23).

---

## PHASE 3 — SELECTIVE REPROCESS: NOT POSSIBLE

### Why selective reprocess cannot work
1. **All outcome_codes are NULL**: The v5.5.0 engine was never run against this data. We cannot identify suspects vs clean records.
2. **The delta is diffuse**: +268K€ bruto overshoot is NOT concentrated in a few outliers — it's distributed across potentially hundreds of records with small AI extraction errors from older engine versions.
3. **Arithmetic mismatches explain only 492.54€ of 43,704.12€ retention delta**: The remaining ~43K€ of retention overshoot comes from records that PASS arithmetic checks (gross*rate ≈ wh) but have inflated absolute values.

### What would fix it: Clean-slate reprocess
The ONLY path to zero-delta requires:
```sql
-- 1. Delete all withholdings for this client/year
DELETE FROM public.tax_withholdings
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' AND fiscal_year=2025;

-- 2. Delete linked revenue_entries
DELETE FROM public.revenue_entries
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da'
  AND period_quarter LIKE '2025%';

-- 3. Reset ALL queue items to pending with clean slate
UPDATE public.upload_queue
SET status='pending', extracted_data=NULL, confidence=NULL,
    warnings=NULL, error_message=NULL, outcome_code=NULL,
    normalized_doc_ref=NULL, processed_at=NULL, started_at=NULL,
    retry_count=0
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da'
  AND fiscal_year=2025;
```
Then trigger process-queue repeatedly until pending=0.

### Missing 4 queue items (2693 vs 2697 target)
The upload_queue only has 2,693 items. Target is 2,697 documents (2,608 valid + 89 anulados). 4 documents were never uploaded to the queue. These must be identified and re-uploaded from source.

---

## VERDICT

| Metric | Actual | Target | Delta | Status |
|--------|--------|--------|-------|--------|
| Recibos | 2,695 | 2,697 | -2 | ❌ |
| Bruto | 4,837,836.75€ | 4,569,023.74€ | +268,813.01€ | ❌ |
| Retenção | 1,057,615.92€ | 1,013,911.80€ | +43,704.12€ | ❌ |

**Result: NO-GO**

**Root cause:** All data was extracted by older engine versions (pre-v5.4.0). The v5.5.0 fixes (NEEDS_REVIEW no-upsert, improved normalization, arithmetic sanity) have never been applied to this data.

**Required action:** Clean-slate reprocess of all 2,693 queue items with v5.5.0 + locate and upload the 4 missing source documents.

---

**Report generated:** 2026-02-27T22:15 UTC  
**Process-queue version:** 5.5.0  
**Status:** NO-GO — requires clean-slate reprocess
