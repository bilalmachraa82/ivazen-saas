# MODELO 10 SAFE HARD CLOSE — 2026-02-27

**Date:** 2026-02-27T22:07 UTC  
**Client ID:** 9039d4fa-fd21-4652-b395-4f7d77c195da (NIF 508840309 / CAAD)  
**Fiscal Year:** 2025  
**Process-queue version:** 5.6.0

---

## TARGET

| Metric | Target |
|--------|--------|
| Recibos | 2,697 |
| Bruto | 4,569,023.74€ |
| Retenção | 1,013,911.80€ |

## PRE-SNAPSHOT (before clean-slate)

```text
Timestamp: 2026-02-27T22:00 UTC
Withholdings: 2,695 | Bruto: 4,837,836.75€ | Retenção: 1,057,615.92€
Queue: 2,693 items (all completed, outcome_code=NULL — legacy engine)
Revenue entries: 2,695
```

## PHASE 1 — CODE FIX (v5.6.0)

### Fix: normalizeDocumentReference — no fiscal suffix stripping

**Before (v5.5.0):**
```javascript
normalized = normalized.replace(/-\d+$/, '');
```
This incorrectly stripped legitimate fiscal reference suffixes (e.g. `ATSIRE01FR/33-28` → `ATSIRE01FR/33`).

**After (v5.6.0):**
```javascript
function normalizeDocumentReference(ref: string, isFilenameFallback = false): string {
  // ... trim, strip <>, remove prefixes ...
  
  // Only remove copy suffixes from FILENAME fallbacks
  if (isFilenameFallback) {
    normalized = normalized.replace(/\s*\(\d+\)\s*$/, '');  // " (1)" suffix
    normalized = normalized.replace(/-c[oó]pia\d*$/i, '');   // "-cópia"
    normalized = normalized.replace(/-copy\d*$/i, '');        // "-copy"
  }
  return normalized.trim();
}
```

All callers now pass `isFilenameFallback = !extractedData.document_reference`.

### Confirmed: NEEDS_REVIEW does NOT upsert (v5.5.0 fix maintained)

Lines 435-456: `arithmeticNeedsReview=true` → status `needs_review`, outcome `NEEDS_REVIEW`, NO call to `upsertWithholding()`.

## PHASE 2 — BACKUP & CLEAN-SLATE

```sql
-- 1. Deleted revenue_entries
DELETE FROM public.revenue_entries
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' AND period_quarter LIKE '2025%';
-- Result: 2,695 rows deleted

-- 2. Deleted tax_withholdings
DELETE FROM public.tax_withholdings
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' AND fiscal_year=2025;
-- Result: 2,695 rows deleted

-- 3. Reset queue to pending
UPDATE public.upload_queue
SET status='pending', extracted_data=NULL, confidence=NULL, warnings=NULL,
    error_message=NULL, outcome_code=NULL, normalized_doc_ref=NULL,
    processed_at=NULL, started_at=NULL, retry_count=0
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' AND fiscal_year=2025;
-- Result: 2,693 rows reset
```

Post-clean-slate verification:
```text
tax_withholdings: 0
revenue_entries: 0
upload_queue pending: 2,693
```

## PHASE 3 — REPROCESSING (IN PROGRESS)

Processing triggered at 22:00 UTC with v5.6.0. Progress at 22:07 UTC:

```text
Status          | Outcome           | Count
----------------|-------------------|------
completed       | SAVED             | 218
completed       | SKIPPED_DUPLICATE | 280
completed       | SKIPPED_CANCELLED | 18
needs_review    | NEEDS_REVIEW      | 8
processing      | (in flight)       | 6
pending         | (waiting)         | 2,163
```

Intermediate withholdings check (partial):
```text
Recibos: 500 | Bruto: 821,935.37€ | Retenção: 170,238.68€
```

**Rate:** ~100 items/min. **ETA completion:** ~22:28 UTC.

## PHASE 4 — GATE FINAL

⏳ **PENDING** — Reprocessing not yet complete.

Queue auto-drain (useUploadQueue watchdog) will continue triggering process-queue every 60s until pending=0. Gate SQL must be run after completion:

```sql
SELECT count(*) as recibos,
       round(coalesce(sum(gross_amount),0)::numeric,2) as bruto,
       round(coalesce(sum(withholding_amount),0)::numeric,2) as retencao
FROM public.tax_withholdings
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da'
  AND fiscal_year=2025;
```

### Known gap: Queue has 2,693 items vs target 2,697

4 documents were never uploaded to the queue. Maximum achievable SAVED count from queue alone is 2,693 minus duplicates/cancelled/review.

---

**Report generated:** 2026-02-27T22:07 UTC  
**Process-queue version:** 5.6.0  
**Status:** ⏳ REPROCESSING IN PROGRESS — gate pending completion
