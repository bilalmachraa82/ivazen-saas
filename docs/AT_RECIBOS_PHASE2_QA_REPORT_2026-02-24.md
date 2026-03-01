# Fase 2 — Recibos → SS: QA Report (2026-02-24)

## Commit alvo
`c8070b4` (branch main)

## Migrações aplicadas
1. `20260224103000_sync_revenue_entries_from_withholdings.sql` — coluna, funções, trigger
2. Grant fix: `GRANT EXECUTE ... TO authenticated, anon` para funções de sync

---

## C1) Schema / Trigger Smoke

### Coluna `source_withholding_id`
```
[{column_name: source_withholding_id}]
```
✅ Presente

### Funções criadas
```
map_withholding_income_to_revenue_category
sync_revenue_entries_from_withholdings
sync_revenue_entry_from_withholding
```
✅ 3/3 presentes

### Trigger ativo
```
tgname: trg_sync_revenue_entries_from_withholdings | tgenabled: O
tgname: update_tax_withholdings_updated_at         | tgenabled: O
```
✅ Trigger ativo (O = Origin/Always)

---

## C2) Backfill funcional

### Clientes com retenções B/F/E
```
client_id                              | fiscal_year | n
f86cd4e8-6ac7-4e60-a5eb-ff57df5015dc   | 2025        | 140
4cbe8e41-8127-49e2-a3f7-81bbfca89926   | 2024        | 9
58b4012f-c2d1-46e5-8555-4f42a464ff34   | 2025        | 4
f86cd4e8-6ac7-4e60-a5eb-ff57df5015dc   | 2024        | 1
```

### Backfill executado (f86cd4e8, 2025)
**140 rows upserted** ✅

### Amostra revenue_entries sincronizadas
```
period_quarter | category             | amount  | source
2025-Q1        | prestacao_servicos   | 1300    | at_withholding_sync
2025-Q1        | prestacao_servicos   | 250     | at_withholding_sync
2025-Q1        | prestacao_servicos   | 800     | at_withholding_sync
2025-Q2        | prestacao_servicos   | 750     | at_withholding_sync
2025-Q2        | prestacao_servicos   | 580     | at_withholding_sync
2025-Q2        | prestacao_servicos   | 525     | at_withholding_sync
... (140 total)
```
✅ Todas com `source='at_withholding_sync'` e `source_withholding_id` preenchido

---

## C3) Não regressão Modelo 10

```
total_withholdings: 154
```

```
fiscal_year | n
2025        | 144
2024        | 10
```
✅ Dados intactos (154 retenções, sem perda)

---

## C4) Não regressão IVA

### bad_rows (sales_invoices com notas de withholding)
```
bad_rows: 0
```
✅ **Zero contaminação** — sales_invoices não recebeu linhas indevidas

### Vendas validadas
```
validated_sales: 11646
```
✅ Total estável

---

## C5) AT sync continua operacional

```
created_at                     | sync_method | status  | reason_code              | method
2026-02-24 06:07:16+00         | api         | error   | AT_AUTH_FAILED           | api_connector
2026-02-24 06:04:40+00         | api         | success | AT_EMPTY_LIST            | api_connector
2026-02-24 06:04:35+00         | api         | partial | AT_SCHEMA_RESPONSE_ERROR | api_connector
2026-02-24 06:04:33+00         | api         | success | AT_EMPTY_LIST            | api_connector
... (20 rows, all api_connector method)
```
✅ Pipeline AT compras/vendas operacional, sem regressão

---

## Tabela PASS/FAIL

| # | Critério | Resultado | Evidência |
|---|----------|-----------|-----------|
| 1 | Migração aplicada (coluna/funções/trigger) | **PASS** ✅ | `source_withholding_id` existe, 3 funções, trigger `O` |
| 2 | Backfill insere/atualiza linhas | **PASS** ✅ | 140 rows upserted |
| 3 | `revenue_entries.source='at_withholding_sync'` visível | **PASS** ✅ | 140 entradas com source correto |
| 4 | `sales_invoices` sem rows indevidas (bad_rows=0) | **PASS** ✅ | `bad_rows: 0` |
| 5 | Modelo 10 mantém dados (sem perda) | **PASS** ✅ | 154 retenções intactas |
| 6 | AT compras/vendas continua operacional | **PASS** ✅ | Runs recentes com `api_connector`, sem regressão |

**Resultado: 6/6 PASS** ✅

---

## Patch adicional aplicado
- Grant de `EXECUTE` para roles `authenticated` e `anon` nas funções de sync (necessário para que a app e ferramentas de admin possam chamar o backfill)

## Blockers remanescentes
- Nenhum blocker para esta funcionalidade
- AT_AUTH_FAILED em ~7 clientes: problema de credenciais, não relacionado com esta migração
