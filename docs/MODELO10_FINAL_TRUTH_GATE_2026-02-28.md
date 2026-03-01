# MODELO 10 — FINAL TRUTH GATE (SEM ESTIMATIVAS)

**Data:** 2026-02-28T15:40 UTC  
**Cliente:** 9039d4fa-fd21-4652-b395-4f7d77c195da (NIF 508840309 / CAAD)  
**Ano Fiscal:** 2025  
**Process-queue version:** 5.6.0

---

## FASE 1 — SNAPSHOT BRUTO

### A) upload_queue por status/outcome_code

```sql
SELECT status, outcome_code, count(*) as cnt,
       round(sum((extracted_data->>'gross_amount')::numeric),2) as bruto,
       round(sum((extracted_data->>'withholding_amount')::numeric),2) as ret
FROM public.upload_queue
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' AND fiscal_year=2025
GROUP BY status, outcome_code ORDER BY cnt DESC;
```

| status | outcome_code | cnt | bruto | retenção |
|--------|-------------|-----|-------|----------|
| completed | SKIPPED_DUPLICATE | 1,308 | 2,351,466.56 | 524,027.63 |
| completed | SAVED | 1,270 | 2,185,152.71 | 482,083.46 |
| completed | SKIPPED_CANCELLED | 95 | 3,244,368.63 | 728,832.68 |
| needs_review | NEEDS_REVIEW | 20 | 21,098.28 | 3,945.18 |
| **TOTAL** | | **2,693** | | |

### B) tax_withholdings total

```sql
SELECT count(*) as cnt, round(sum(gross_amount),2) as bruto, round(sum(withholding_amount),2) as ret
FROM public.tax_withholdings
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' AND fiscal_year=2025;
```

| cnt | bruto | retenção |
|-----|-------|----------|
| **2,581** | **4,544,293.49** | **1,007,876.15** |

### C) revenue_entries 2025

```sql
SELECT count(*) as cnt, round(sum(amount),2) as total
FROM public.revenue_entries
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' AND period_quarter LIKE '2025%';
```

| cnt | total |
|-----|-------|
| 2,581 | 4,544,293.49 |

✅ Consistente com tax_withholdings (trigger automático).

### D) Estado da queue

```sql
SELECT count(*) FILTER (WHERE status='pending') as pending,
       count(*) FILTER (WHERE status='processing') as processing
FROM public.upload_queue WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' AND fiscal_year=2025;
```

| pending | processing |
|---------|------------|
| **0** | **0** |

✅ Queue totalmente processada.

---

## FASE 2 — VALIDAÇÃO DE CONSISTÊNCIA INTERNA

### 2.1 SAVED → tax_withholdings (match por chave)

```sql
-- SAVED com match em tw
SELECT count(*) as saved_with_tw_match FROM public.upload_queue uq
WHERE uq.client_id='9039d4fa-...' AND uq.fiscal_year=2025 AND uq.outcome_code='SAVED'
  AND EXISTS (SELECT 1 FROM public.tax_withholdings tw
    WHERE tw.client_id=uq.client_id AND tw.fiscal_year=2025
      AND tw.beneficiary_nif=(uq.extracted_data->>'beneficiary_nif')
      AND tw.document_reference=uq.normalized_doc_ref);
```

**Resultado: 1,270** — 100% dos SAVED têm match em tw. ✅

```sql
-- SAVED sem match em tw
SELECT count(*) as saved_no_tw ... AND NOT EXISTS ...;
```

**Resultado: 0** ✅

### 2.2 NEEDS_REVIEW não inserido em tw

```sql
SELECT count(*) as review_in_tw ... outcome_code='NEEDS_REVIEW' AND EXISTS ...;
```

**Resultado: 0** ✅ Nenhum NEEDS_REVIEW foi inserido em tw.

### 2.3 SKIPPED_CANCELLED não inserido em tw

```sql
SELECT count(*) as cancelled_in_tw ... outcome_code='SKIPPED_CANCELLED' AND EXISTS ...;
```

**Resultado: 3** ⚠️ Três documentos cancelados existem em tw (criados em processamentos anteriores ao v5.6.0, antes de a detecção ANULADO existir).

Detalhes dos 3 cancelados com registo em tw:

| beneficiary_nif | document_reference | gross_amount | withholding_amount |
|----------------|-------------------|-------------|-------------------|
| 199930503 | ATSIRE01FR/38 | 2,871.63 | 660.47 |
| 220776504 | ATSIRE01FR/37 | 2,637.54 | 606.63 |
| 208538933 | ATSIRE01FR/202 | 2,165.05 | 497.96 |

### 2.4 Decomposição completa de tax_withholdings por origem

```sql
-- tw por fonte de criação
SELECT 'SAVED_match', count(*), sum(gross_amount), sum(withholding_amount) ...
UNION ALL
SELECT 'DUPLICATE_prior', count(*), ... (tw matched by SKIPPED_DUPLICATE but not SAVED)
UNION ALL
SELECT 'true_orphan', count(*), ... (tw not matched by any queue entry)
```

| Fonte | cnt | bruto | retenção |
|-------|-----|-------|----------|
| SAVED_match (run atual) | 1,270 | 2,185,152.71 | 482,083.46 |
| DUPLICATE_prior (runs anteriores) | 1,308 | 2,351,466.56 | 524,027.63 |
| true_orphan (cancelados legacy) | 3 | 7,674.22 | 1,765.06 |
| **TOTAL** | **2,581** | **4,544,293.49** | **1,007,876.15** |

✅ Soma verificada: 1,270 + 1,308 + 3 = 2,581 ✓  
✅ Bruto: 2,185,152.71 + 2,351,466.56 + 7,674.22 = 4,544,293.49 ✓  
✅ Retenção: 482,083.46 + 524,027.63 + 1,765.06 = 1,007,876.15 ✓

### 2.5 Documentos únicos válidos na queue

```sql
SELECT count(DISTINCT (extracted_data->>'beneficiary_nif') || '|' || normalized_doc_ref)
FROM public.upload_queue
WHERE client_id='9039d4fa-...' AND fiscal_year=2025
  AND outcome_code IN ('SAVED','SKIPPED_DUPLICATE','NEEDS_REVIEW');
```

**Resultado: 2,598**

### 2.6 Reconciliação aritmética

| Componente | Contagem | Notas |
|-----------|----------|-------|
| Docs únicos válidos na queue | 2,598 | SAVED + DUPLICATE + REVIEW |
| − NEEDS_REVIEW (não em tw) | −20 | Taxa efetiva divergente |
| = Esperado em tw | 2,578 | |
| tw total | 2,581 | |
| − 3 cancelados legacy em tw | −3 | Criados antes de detecção ANULADO |
| = tw legítimos | 2,578 | |
| **Delta** | **0** | ✅ Reconciliação interna fechada |

### 2.7 Decomposição do delta target original (2,697) vs tw (2,581)

| Classe | Contagem | Origem |
|--------|----------|--------|
| Em tax_withholdings | 2,581 | DB |
| NEEDS_REVIEW (não em tw) | 20 | Queue |
| SKIPPED_CANCELLED (não em tw) | 92 | Queue (95 total − 3 em tw) |
| Docs nunca carregados | 4 | 2,697 − 2,693 = 4 |
| **TOTAL** | **2,697** | = target original |

Verificação: 2,581 + 20 + 92 + 4 = 2,697 ✓

---

## FASE 3 — PROVA AT OFICIAL (GATE CRÍTICO)

### 3.1 at_sync_history

```sql
SELECT count(*) FROM public.at_sync_history
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da'
  AND start_date >= '2025-01-01' AND end_date <= '2025-12-31';
```

**Resultado: 0**

### 3.2 at_withholding_candidates

```sql
SELECT status, count(*) FROM public.at_withholding_candidates
WHERE client_id='9039d4fa-fd21-4652-b395-4f7d77c195da' AND fiscal_year=2025
GROUP BY status;
```

**Resultado: 0 registos**

### 3.3 Declaração obrigatória

> **Não é possível validar target com AT oficial neste momento.**
>
> Nenhum sync AT (API SOAP/mTLS nem portal scraping) foi executado para este cliente/ano. Os 2,693 documentos na queue foram carregados exclusivamente via bulk upload manual de PDFs. O target de 2,697 é externo ao sistema e não pode ser verificado independentemente sem dataset AT oficial.

---

## FASE 4 — DECISÃO FINAL

### Tabela PASS/FAIL

| Critério | Resultado | Evidência |
|----------|-----------|-----------|
| Queue processada (pending=0, processing=0) | ✅ PASS | SQL output: pending=0, processing=0 |
| Consistência SAVED → tw (100%) | ✅ PASS | 1,270/1,270 = 100% match |
| NEEDS_REVIEW não em tw | ✅ PASS | 0 leaks |
| SKIPPED_CANCELLED não em tw (v5.6.0) | ⚠️ WARN | 3 leaks de runs anteriores (pre-v5.6.0) |
| revenue_entries = tw | ✅ PASS | 2,581 = 2,581 |
| Somas internas verificadas | ✅ PASS | Bruto e retenção fecham a 0.00€ |
| Delta target decomposto a 100% | ✅ PASS | 2,581 + 20 + 92 + 4 = 2,697 |
| **Evidência AT oficial** | **❌ FAIL** | 0 registos em at_sync_history e at_withholding_candidates |
| **Target validado com AT** | **❌ FAIL** | Impossível sem dataset AT |

### Decisão

## ❌ NO-GO — Falta prova AT oficial

---

## FASE 5 — AÇÕES PENDENTES

1. [ ] **Executar sync AT API/portal** para cliente CAAD 2025 — obter listagem oficial
2. [ ] **Cruzar AT oficial vs queue/tw** — validar correspondência doc a doc
3. [ ] **Decidir sobre 20 NEEDS_REVIEW** — aprovar manualmente ou ajustar threshold aritmético
4. [ ] **Identificar 4 docs em falta** — usando listagem AT como referência
5. [ ] **Decidir sobre 3 cancelados legacy em tw** — remover ou manter (impacto: 7,674.22€ bruto / 1,765.06€ retenção)

---

**Timestamp:** 2026-02-28T15:40 UTC  
**Status:** ❌ NO-GO — Reconciliação interna consistente; falta validação AT oficial  
**Próxima ação:** Executar sync AT para obter dataset de referência
