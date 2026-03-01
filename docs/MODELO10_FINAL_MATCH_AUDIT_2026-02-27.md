# MODELO 10 FINAL MATCH AUDIT — 2026-02-27

**Date:** 2026-02-27T17:22 UTC  
**Client NIF:** 508840309 (CAAD) | Client ID: `9039d4fa-fd21-4652-b395-4f7d77c195da`  
**Fiscal Year:** 2025  
**Commit base:** 230903c  
**process-queue version:** 5.0.0

---

## FASE A — Snapshot Pré-Correção

### A1: Retenções guardadas (ANTES)
```
recibos_verdes: 2580
rendimento_bruto: 4,543,779.14
retencao_irs: 1,007,415.60
```

### A2: Upload queue por status
```
status    | count
----------|------
completed | 2694
```

### A3: Motivos
```
motivo                          | count
-------------------------------|------
Duplicado semântico - ignorado | 1550
SEM_ERRO                       | 1055
Documento anulado              |   89
```

---

## FASE B — Correção Aplicada

1. Deleted 2 bracket-format duplicates from tax_withholdings (`<FR ATSIRE01FR/20>`, `<FR ATSIRE01FR/41>`) — normalized versions already existed.
2. Reset 89 "Documento anulado" items to pending.
3. Reset 30 false "Duplicado semântico" items to pending (normalized doc_ref NOT in tax_withholdings).
4. Total reset: 119 items.

## FASE C — Hardening Aplicado (process-queue v5.0.0)

1. `normalizeDocumentReference()` now strips angle brackets `<>`.
2. Stricter "anulado" detection: requires PROMINENT/UNAMBIGUOUS evidence.
3. Recovery path: items with valid `extracted_data` skip AI re-extraction.
4. Structured outcome codes: `SAVED`, `SKIPPED_CANCELLED`, `SKIPPED_DUPLICATE`, `NEEDS_REVIEW`.
5. Fixed `onConflict` to match actual constraint: `(beneficiary_nif, document_reference, fiscal_year)`.

---

## FASE D — Validação Final

### D1: Queue status pós-processamento
```
status    | count
----------|------
completed | 2694
```

### D2: Motivos pós-processamento
```
motivo                          | count
-------------------------------|------
Duplicado semântico - ignorado | 1520
SEM_ERRO                       | 1085
SKIPPED_CANCELLED              |   89
```

### D3: Retenções guardadas (DEPOIS)
```sql
select count(*) as recibos_verdes,
  round(coalesce(sum(gross_amount),0)::numeric,2) as rendimento_bruto,
  round(coalesce(sum(withholding_amount),0)::numeric,2) as retencao_irs
from public.tax_withholdings
where client_id = '9039d4fa-fd21-4652-b395-4f7d77c195da' and fiscal_year = 2025;
```

```
recibos_verdes:  2607
rendimento_bruto: 4,574,609.52
retencao_irs:     1,014,511.47
```

---

## PASS/FAIL Table

| Métrica | Alvo | Atual | Delta | Resultado |
|---------|------|-------|-------|-----------|
| recibos_verdes | 2697 | 2607 | **-90** | ❌ FAIL |
| rendimento_bruto | 4,569,023.74 | 4,574,609.52 | **+5,585.78** | ❌ FAIL |
| retencao_irs | 1,013,911.80 | 1,014,511.47 | **+599.67** | ❌ FAIL |

---

## Análise do Delta

### Contagem (-90 registos)
- Antes da correção: 2580 → Depois: 2607 → Ganho: +27 registos líquidos
- Dos 30 falsos duplicados resetados, 27 geraram novos registos (3 eram duplicados reais)
- Os 89 anulados foram todos reclassificados como `SKIPPED_CANCELLED` pelo AI v5.0.0 (prompt mais estrito ainda classificou como anulados)
- **Faltam 90 registos** que continuam marcados como "Duplicado semântico" (1520 itens) mas cujos dados NÃO existem em tax_withholdings

### Rendimento e Retenção (overshooting)
- rendimento_bruto está +5,585.78€ ACIMA do alvo
- retencao_irs está +599.67€ ACIMA do alvo
- Indica que os 27 novos registos incluem alguns com valores superiores ao esperado, ou que valores de registos existentes foram actualizados pelo UPSERT

### Causa raiz provável
A detecção de "Duplicado semântico" na versão anterior do pipeline foi demasiado agressiva. Não está no process-queue v5.0.0 — foi inserida por uma versão anterior que já não existe no código. Os 1520 itens marcados como duplicados precisam de uma auditoria mais profunda para identificar os ~90 que contêm dados únicos.

---

## Decisão: **NO-GO** ❌

Nenhuma das 3 métricas bate exactamente nos alvos. É necessário:
1. Auditar os 1520 "Duplicado semântico" restantes para identificar os ~90 com dados únicos
2. Investigar a fonte original da string "Duplicado semântico" (versão anterior do pipeline)
3. Reconciliar diferenças de montantes (UPSERT pode ter actualizado valores existentes)
