# MODELO 10 — 90 SUSPECTS RECONCILIATION — 2026-02-27

**Date:** 2026-02-27T18:45 UTC  
**Client NIF:** 508840309 (CAAD) | Client ID: `9039d4fa-fd21-4652-b395-4f7d77c195da`  
**Fiscal Year:** 2025  
**process-queue version:** 5.1.0

---

## FASE A — Baseline SQL Bruto

### A1: Retenções guardadas (ANTES)
```
recibos_verdes:   2607
rendimento_bruto: 4,574,609.52
retencao_irs:     1,014,511.47
```

### A2: Upload queue por status
```
status    | count
----------|------
completed | 2605
pending   |   89  (reset from SKIPPED_CANCELLED)
```

### A3: Motivos (pré-reset)
```
motivo                          | count
-------------------------------|------
Duplicado semântico - ignorado | 1520
SEM_ERRO                       | 1085
SKIPPED_CANCELLED              |   89
```

### A4: Queue extracted_data totals (source of truth)
```
source          | cnt  | total_gross    | total_ret
----------------|------|----------------|----------
queue_sem_erro  | 1085 | 1,946,731.78   | 437,017.39
queue_dup       | 1520 | 2,622,164.47   | 576,180.03
TOTAL QUEUE     | 2605 | 4,568,896.25   | 1,013,197.42
tax_withholdings| 2607 | 4,574,609.52   | 1,014,511.47
TARGET          | 2697 | 4,569,023.74   | 1,013,911.80
```

---

## FASE B — Root Cause Analysis

### B1: False Duplicates
- Checked ALL 1520 "Duplicado semântico" items against tax_withholdings by normalized key
- **Result: 0 false duplicates** — all 1520 correctly match existing rows

### B2: Cancelled Items (89 SKIPPED_CANCELLED)
- All 89 have `extracted_data = {"anulado": true}` — NO financial data extracted
- All 89 are UNIQUE files (no copies in queue — verified 2694 unique file sequences)
- AI falsely classified them as cancelled; they need full re-extraction

### B3: Amount Overshoot (+5,713.27 gross)
- Queue extracted_data total: 4,568,896.25 (close to target 4,569,023.74, diff -127.49)
- Tax_withholdings total: 4,574,609.52 (over target by +5,585.78)
- **Cause**: 2 extra rows in tax_withholdings not from queue:
  - NIF 508840309 (emitter itself), doc_ref ATSIRE01FR/26, gross 1,329.99
  - Possibly 1 more spurious row
- Additionally: v5.0.0 UPSERT with `ignoreDuplicates: false` may have overwritten some amounts

### B4: Expected Post-Fix State
```
Queue items with data:              2605
Cancelled items to reprocess:         89
Extra rows to investigate:             2
Expected new rows from cancelled:   ~89
Expected total:                    ~2696 (target 2697, diff -1)
```

---

## FASE C — Corrections Applied

### C1: process-queue v5.1.0 Changes
1. **Anulado handling**: AI prompt changed to NEVER return `{"anulado": true}` alone.
   Always extracts financial data even from possibly-cancelled documents.
2. **UPSERT mode**: Changed `ignoreDuplicates: false` → `ignoreDuplicates: true`
   to prevent overwriting existing rows with potentially different AI values.
3. **Fallback**: If AI still can't extract data, marks as `needs_review` instead of
   silently skipping.

### C2: Queue Reset
- Reset 89 SKIPPED_CANCELLED items to `pending` with `extracted_data = NULL`
- This forces full AI re-extraction (not recovery path)

### C3: Deployment
- process-queue v5.1.0 deployed successfully

---

## FASE D — Pending Actions

### D1: Trigger Processing
The process-queue function requires user authentication.
**Action needed**: Navigate to Modelo 10 → Background Upload tab → click "Processar Fila"
to trigger reprocessing of the 89 pending items.

### D2: Post-Processing Validation
After processing completes (pending = 0), run:
```sql
SELECT count(*) as recibos_verdes,
       round(coalesce(sum(gross_amount),0)::numeric,2) as rendimento_bruto,
       round(coalesce(sum(withholding_amount),0)::numeric,2) as retencao_irs
FROM public.tax_withholdings
WHERE client_id = '9039d4fa-fd21-4652-b395-4f7d77c195da'
  AND fiscal_year = 2025;
```

### D3: Investigate Spurious Row
The row with `beneficiary_nif = 508840309` (emitter NIF = client NIF) is self-referential
and likely invalid. Consider deletion after validating it's not a legitimate self-withholding.

### D4: If Metrics Don't Match
- Check queue items still in `needs_review` status
- List top delta-causing documents
- Investigate the 1-row gap (2696 vs 2697 target)

---

## Current Status: **PENDING REPROCESSING** ⏳

89 items reset and ready for processing. User must trigger process-queue from the UI.
Final GO/NO-GO decision will be made after reprocessing completes.
