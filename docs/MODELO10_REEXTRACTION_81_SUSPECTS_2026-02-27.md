# MODELO 10 — RE-EXTRACTION OF 81 SUSPECTS — 2026-02-27

**Date:** 2026-02-27T18:10 UTC  
**Client NIF:** 508840309 (CAAD) | Client ID: `9039d4fa-fd21-4652-b395-4f7d77c195da`  
**Fiscal Year:** 2025  
**process-queue version:** 5.2.0

---

## Root Cause

The AI (Gemini 2.5 Flash) misread Portuguese decimal separators:
- PT format: `2.758,80` (dot = thousands, comma = decimal)
- AI read as: `27587.98` or `27588.0` (10x inflation)
- All 81 records had `gross_amount > 10,000€` while median is `874.28€`

## Actions Taken

### 1. Prompt Hardening (v5.2.0)
Added explicit Portuguese decimal separator rules to both:
- `process-queue/index.ts` (EXTRACTION_PROMPT)
- `extract-withholding/index.ts` (EXTRACTION_PROMPT)

Rules added:
```
- O PONTO (.) é separador de MILHARES
- A VÍRGULA (,) é separador DECIMAL
- "2.758,80" → 2758.80 (CORRECTO)
- Valores > 10.000€ são RAROS — verificar duas vezes
```

### 2. Data Cleanup
- **Deleted:** 81 records from `tax_withholdings` where `gross_amount > 10000`
- **Reset:** 84 queue items to `pending` with `extracted_data = NULL`

### 3. Post-Cleanup Baseline
```
pending_queue:       84
current_withholdings: 2614
current_gross:       3,468,999.09€
current_ret:         757,931.08€
```

### 4. Expected Post-Reprocessing
```
Expected records:    2614 + 84 = 2698 (target 2697, +1 from possible dup)
Expected gross:      ~4,569,023.74€ (if decimals parsed correctly)
Expected ret:        ~1,013,911.80€
```

## Next Steps

**User must trigger processing:**
1. Navigate to Modelo 10 → Importar → Documentos
2. Click "Processar Fila" to trigger re-extraction of 84 pending items
3. After processing completes (pending = 0), verify totals

**Verification SQL:**
```sql
SELECT count(*) as recibos_verdes,
       round(sum(gross_amount)::numeric, 2) as rendimento_bruto,
       round(sum(withholding_amount)::numeric, 2) as retencao_irs
FROM public.tax_withholdings
WHERE client_id = '9039d4fa-fd21-4652-b395-4f7d77c195da'
  AND fiscal_year = 2025;
```

## Status: **PENDING REPROCESSING** ⏳
