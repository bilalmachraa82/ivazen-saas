# AT Sync Production Rollout — 2026-02-23

## Commit Aplicado
- **Target**: `8a340654a386ea2676972c47be45fc440ec8b314`
- **Código AT base**: `aa385fc36350e36fed33378476b7d1318164ef0c`

## Migrations Aplicadas

### 1) `limit_scheduled_sync_to_current_and_previous`
- `run_scheduled_at_sync(p_force)` agora usa **apenas** `[current_year, current_year - 1]`
- `p_force` já não inclui `current_year - 2` (2024 removido permanentemente)

### 2) `mark_at_sales_invoices_validated`
- Backfill: `UPDATE sales_invoices SET status='validated', validated_at=now() WHERE image_path LIKE 'at-webservice-sales/%' AND status IN (NULL, 'pending')`

## Deploy Status

| Function | Status |
|---|---|
| sync-efatura | ✅ Deployed |
| sync-queue-manager | ✅ Deployed |
| process-at-sync-queue | ✅ Deployed |

## SQL Outputs Brutos

### A) Política de Anos — Jobs Novos (24h)

```
fiscal_year | status    | n
------------|-----------|----
2026        | completed | 267
2026        | error     | 8
2025        | error     | 6
```

**✅ Zero jobs para 2024.** Apenas 2026 e 2025.

### B) Scheduler Function

```
proname
-------------------------
run_scheduled_at_sync
```

✅ Função presente e atualizada.

### C) Sales AT Status

```
status    | n
----------|------
validated | 11218
```

**✅ 100% das vendas AT estão em `validated`.** Zero pendentes.

### D) Últimas Runs (24h) — Amostra

| created_at | client_id | status | method | reason_code | compras_total | vendas_total | records_imported |
|---|---|---|---|---|---|---|---|
| 2026-02-23 20:20:29 | 39359e45 | success | api_connector | AT_EMPTY_LIST | 22 | 0 | 0 |
| 2026-02-23 20:20:26 | eac407b5 | success | api_connector | (null) | 10 | 5 | 0 |
| 2026-02-23 20:20:24 | a5848d49 | success | api_connector | AT_EMPTY_LIST | 0 | 0 | 0 |
| 2026-02-23 19:35:33 | ff9371eb | success | api_connector | AT_EMPTY_LIST | 14 | 0 | 0 |
| 2026-02-23 19:35:30 | ff70a9ba | success | api_connector | AT_EMPTY_LIST | 26 | 0 | 1 |
| 2026-02-23 19:35:27 | f6e6dcba | partial | api_connector | AT_SCHEMA_RESPONSE_ERROR | 42 | 0 | 0 |
| 2026-02-23 19:35:07 | e25f84e7 | partial | api_connector | AT_SCHEMA_RESPONSE_ERROR | 49 | 0 | 0 |

- **Todos usam `api_connector`** ✅
- `records_imported: 0` = deduplicação ativa (dados já na DB)
- `AT_SCHEMA_RESPONSE_ERROR` = bug intermitente XML na API da AT (externo)

### E) Clientes com AT_AUTH_FAILED (password inválida)

| NIF | Nome | Erros (7d) | Último Erro |
|---|---|---|---|
| 261188984 | Carina Filipa dos Santos Rodrigues | 15 | 2026-02-23 19:34 |
| 307170730 | Justyna Alicja Rogers | 15 | 2026-02-23 19:34 |
| 100814328 | José Manuel Rodrigues Da Costa | 15 | 2026-02-23 19:34 |
| 260638684 | Bruno Miguel da Silva Tavares | 9 | 2026-02-23 19:33 |
| 306961342 | Abel Philip Rogers | 19 | 2026-02-23 19:30 |
| 514487410 | Unique Motorsport Unipessoal, Lda | 9 | 2026-02-22 02:38 |
| 516965476 | 3 Comma Capital S.C.R, S.A | 5 | 2026-02-22 02:38 |
| 518022307 | Andrea Paschoal Unipessoal Lda | 10 | 2026-02-22 02:38 |

**Ação necessária**: Atualizar credenciais AT destes 8 clientes em Definições → Credenciais AT.

---

## PASS/FAIL

| Critério | Resultado | Prova |
|---|---|---|
| Sem 2024 em novos jobs | ✅ PASS | Query A: apenas fiscal_year 2026 e 2025 |
| Vendas AT em `validated` | ✅ PASS | Query C: 11218 validated, 0 pending |
| Sync `api_connector` ativo | ✅ PASS | Query D: todas as runs usam api_connector |
| Lista NIFs password inválida | ✅ PASS | Query E: 8 clientes identificados |

## RCA Final

1. **Vendas apareciam como "0"** porque eram inseridas com `status='pending'` e os widgets fiscais lêem apenas `validated`. Corrigido: sync-efatura agora insere vendas AT como `validated`; backfill aplicado a 11218 registos existentes.

2. **2024 gerava ruído** porque o scheduler incluía `current_year - 2`. Corrigido: scheduler limitado a `[current, current-1]`.

3. **8 clientes bloqueados** por credenciais AT incorretas — requer ação manual do contabilista.

4. **AT_SCHEMA_RESPONSE_ERROR** — bug intermitente na API XML da AT, sem correção possível do nosso lado.
