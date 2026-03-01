# MODELO 10 RECONCILIATION — POST-AUDIT UPDATE 2026-02-27

**Date:** 2026-02-27T21:30 UTC  
**Client NIF:** 508840309 (CAAD) | Fiscal Year: 2025  
**Objective:** Quantify remaining gap after decimal error fixes and guardrail deployment

---

## Correções Aplicadas (v5.3.0)

### 1. ✅ Erro Decimal Catastrófico — CORRIGIDO
- NIF 118298496, FR/33: gross 2,342,070 → 23,420.70
- NIF 118298496, FR/28: gross 653,930 → 6,539.30
- **Impacto**: -2,966,040€ bruto, -682,189.20€ retenção

### 2. ✅ Sanity Check no process-queue (v5.3.0)
- Guard: `gross_amount > 50,000€` → auto-divide by 100/1000 if arithmetic confirms
- Arithmetic validation: `gross * rate / 100 ≈ withholding` (±1€)

### 3. ✅ Duplicate Tracking (v5.3.0)
- Pre-UPSERT check: if record exists, marks upload_queue with `Duplicado semântico` warning
- 89 anulados + duplicados agora visíveis na UI

---

## Estado Pós-Correções

```text
                     ACTUAL         TARGET          DELTA
Registos:            2,695          2,697            -2
Bruto (total):  4,837,836.75   4,569,023.74   +268,813.01
  └ c/ ret>0:   4,588,064.51   4,569,023.74    +19,040.77
  └ ret=0:        249,772.24        ???          (135 registos)
Retenção:       1,057,615.92   1,013,911.80    +43,704.12
```

## Análise do Gap

### Contagem: -2 (2695 vs 2697)
- Queue: 2,693 completed
- Withholdings: 2,695 (2 PDFs geraram 2 linhas cada)
- **2 documentos em falta no upload original**

### Bruto +19K (excluindo 135 sem retenção)
- 135 registos com withholding=0 mas gross>0 totalizam 249,772.24€
- Se target **inclui** estes: delta = +268,813.01€
- Se target **exclui** estes: delta = +19,040.77€
- **Acção necessária**: confirmar com contabilidade

### Retenção +43,704.12€
- 10 registos com delta aritmético >1€ (total ~493€ — negligenciável)
- Restante ~43K sugere possível inclusão de registos que o target exclui
- Ou: target usa arredondamentos/regras diferentes

## 10 Outliers (delta > 1€)

| NIF | Ref | Gross | Wh Actual | Wh Expected | Delta |
|-----|-----|-------|-----------|-------------|-------|
| 216608392 | FR/100 | 1,951.92 | 364.99 | 448.94 | -83.95 |
| 216608392 | FR/29 | 1,500.00 | 280.49 | 345.00 | -64.51 |
| 126172722 | FR/16 | 1,000.00 | 186.99 | 230.00 | -43.01 |
| 135245621 | FR/20 | 1,000.00 | 186.99 | 230.00 | -43.01 |
| 206324308 | FR/14 | 1,000.00 | 186.99 | 230.00 | -43.01 |
| 205935346 | FR/52 | 1,000.00 | 186.99 | 230.00 | -43.01 |
| 216608392 | FR/71 | 1,000.00 | 186.99 | 230.00 | -43.01 |
| 128797630 | FR/61 | 1,000.00 | 186.99 | 230.00 | -43.01 |
| 165711256 | FR/33 | 1,000.00 | 186.99 | 230.00 | -43.01 |
| 216608392 | FR/27 | 1,000.00 | 186.99 | 230.00 | -43.01 |

**Padrão**: AI extrai ~186.99€ como retenção de 1000€ a 23% (esperado: 230€). Possível causa: AI lê valor líquido (813.01€ * 23% = 186.99€) em vez de retenção bruta.

---

## Próximos Passos Recomendados

1. **Confirmar com contabilidade**: target inclui 135 registos com ret=0?
2. **Verificar 2 docs em falta**: existem no lote original?
3. **Re-extrair 10 outliers**: confirmar se wh é 186.99 ou 230.00 no documento
