# MODELO 10 RECONCILIATION — HARD CLOSE ATTEMPT 2026-02-27

**Date:** 2026-02-27T21:42 UTC  
**Client ID:** 9039d4fa-fd21-4652-b395-4f7d77c195da (NIF 508840309 / CAAD)  
**Fiscal Year:** 2025  
**Commit:** d4dc965 → process-queue v5.4.0 deployed

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
              ACTUAL         TARGET        DELTA       PASS?
Recibos:      2,695          2,697          -2         ❌
Bruto:   4,837,836.75   4,569,023.74   +268,813.01    ❌
Retenção:1,057,615.92   1,013,911.80    +43,704.12    ❌
```

## PRE-SNAPSHOT (before any changes this session)

```text
Timestamp: 2026-02-27T21:41:44Z
Withholdings: 2,695 | Bruto: 4,837,836.75 | Retenção: 1,057,615.92
Queue: 2,697 total (2,697 completed, 0 pending, 0 review, 0 failed)
```

## CHANGES DEPLOYED (v5.4.0)

### Phase 1 — Process-queue logic fixes
1. ✅ **Anulado handling reverted**: `possibly_cancelled` with `cancellation_evidence` → `SKIPPED_CANCELLED` (no insert). Without evidence → extract normally.
2. ✅ **Recovery path disabled**: Always fresh AI extraction. No reuse of `extracted_data`.
3. ✅ **Dedupe with client_id**: Lookup and UPSERT now use `(client_id, beneficiary_nif, document_reference, fiscal_year)`.
4. ✅ **Sanity check refined**: Catastrophic decimal correction only with strong arithmetic proof. Arithmetic mismatches → `NEEDS_REVIEW` (no auto-correction of withholding).
5. ✅ **DB constraint updated**: `tax_withholdings_unique_doc` now includes `client_id`.

### Phase 2 — Tracking & auditability
1. ✅ **Outcome codes**: `SAVED`, `SKIPPED_DUPLICATE`, `SKIPPED_CANCELLED`, `NEEDS_REVIEW`, `FAILED`, `NOT_INVOICE`
2. ✅ **`normalized_doc_ref`** persisted in `upload_queue` for audit
3. ✅ **`outcome_code`** column added to `upload_queue`

### Phase 3 — Reconciliation (NOT YET EXECUTED)
Data was NOT reprocessed in this session. The queue has 0 pending items.
A full clean-slate reprocess is required to populate outcome_code and normalized_doc_ref.

## DELTA ANALYSIS

### Recibos: -2 (2695 vs 2697)
- Queue has 2,697 items (all `completed`)
- Withholdings has 2,695 → 2 queue items were silently deduplicated by UPSERT
- The 2 items: NIF 138350051/ATSIRE01FR/3 and NIF 172606551/ATSIRE01FR/29

### Bruto: +268,813.01
- 135 records with withholding=0 account for 249,772.24€ gross
- Remaining delta (excluding zero-ret): +19,040.77€
- 10 records have arithmetic delta >1€ totaling only 492.54€
- **Root cause of remaining ~18.5K**: AI extraction errors (gross/net confusion) across many small documents

### Retenção: +43,704.12
- Same root cause: AI extracts slightly inflated values across many records

## NEXT STEPS TO REACH ZERO-DELTA

1. **Clean-slate reprocess** with v5.4.0 to get fresh AI extractions with improved prompt
2. **Investigate the 2 "duplicate" queue items** — may be legitimately different documents with same normalized key
3. **After reprocess**: compare new totals; identify remaining outliers by `outcome_code` and arithmetic delta
4. **Manual correction** of persistent outliers if AI cannot self-correct

---

**Report generated:** 2026-02-27T21:42 UTC  
**Process-queue version:** 5.4.0  
**Status:** NO-GO — requires clean-slate reprocess with new engine
