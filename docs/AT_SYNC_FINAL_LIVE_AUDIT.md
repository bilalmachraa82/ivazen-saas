# AT Sync Final Live Audit — 2026-02-23

## Meta
- **Audit timestamp (UTC):** 2026-02-23 20:25 UTC
- **Expected commit:** `2b3a1a91dde8d13b3f398b4fd6f664ed10d29e8b`
- **Code base commit (AT logic):** `aa385fc36350e36fed33378476b7d1318164ef0c`
- **Project ref:** `oqvvtcfvjkghrwaatprx`

---

## FASE 0-1 — Sanity & DB

| Check | Result |
|---|---|
| `reason_code` column exists | ✅ |
| `run_scheduled_at_sync` function | ✅ |
| `backfill_sales_invoices_from_invoices` function | ✅ |
| Cron `at-sync-auto-dispatch` | ✅ active, `*/15 * * * *` |

## FASE 2 — Edge Function Deploy

All 5 deployed successfully:
- `sync-efatura` ✅
- `process-at-sync-queue` ✅
- `sync-queue-manager` ✅
- `fetch-efatura-portal` ✅
- `upload-at-certificate` ✅

## FASE 3 — Diagnóstico 48h

### Distribuição por ano/status/reason_code

| fiscal_year | status | reason_code | count |
|---|---|---|---|
| 2026 | success | AT_EMPTY_LIST | 599 |
| 2026 | partial | AT_SCHEMA_RESPONSE_ERROR | 28 |
| 2026 | error | AT_AUTH_FAILED | 24 |
| 2026 | success | (null) | 14 |
| 2026 | partial | AT_AUTH_FAILED | 5 |
| 2025 | success | AT_EMPTY_LIST | 117 |
| 2025 | error | AT_AUTH_FAILED | 14 |
| 2025 | running | (null) | 13 |
| 2025 | partial | AT_SCHEMA_RESPONSE_ERROR | 10 |
| 2025 | success | (null) | 6 |
| 2025 | partial | AT_AUTH_FAILED | 1 |
| 2024 | error | AT_YEAR_UNAVAILABLE | 264 |
| 2024 | error | AT_AUTH_FAILED | 14 |

### Top error messages (48h)

| error_message | count |
|---|---|
| Conteúdo: Ano não disponível para consulta. | 264 |
| Ocorreu um erro na autenticacao dos contribuintes. | 47 |
| Sem credenciais utilizáveis para connector | 5 |

### Jobs por estado (48h)

| status | count |
|---|---|
| completed | 780 |
| error | 327 |
| pending | 3 → cleaned |
| processing | 1 → cleaned |

## FASE 4 — Stuck Jobs

4 stuck jobs found from batch `c8b1ce5b` (2025 fiscal year, >20 min old).
**Action:** Cleaned to `error` status with message `Stuck >20min, cleaned by audit`.
**Post-cleanup:** 0 stuck jobs remaining.

## FASE 5 — Teste Cirúrgico (batch `73557205`)

### Jobs Result

| client_id | fiscal_year | status | started_at | completed_at |
|---|---|---|---|---|
| `a5848d49` | 2026 | ✅ completed | 20:20:22 | 20:20:26 |
| `eac407b5` | 2026 | ✅ completed | 20:20:26 | 20:20:29 |
| `39359e45` | 2026 | ✅ completed | 20:20:29 | 20:20:31 |

**3/3 completed**, zero errors.

### sync_history for batch clients

| client_id | method | reason_code | compras_total | compras_imported | vendas_total | vendas_imported | records_skipped |
|---|---|---|---|---|---|---|---|
| `39359e45` | api_connector | AT_EMPTY_LIST | 22 | 0 | 0 | 0 | 22 |
| `eac407b5` | api_connector | (null) | 10 | 0 | 5 | 0 | 15 |
| `a5848d49` | api_connector | AT_EMPTY_LIST | 0 | 0 | 0 | 0 | 0 |

**Interpretation:**
- `eac407b5`: AT reports 10 compras + 5 vendas. All 15 skipped = **deduplication** (already in DB). Confirmed: DB has 147 purchases + 5 sales for this client.
- `39359e45`: 22 compras skipped (already imported). No vendas from AT.
- `a5848d49`: AT returned empty list (client has no invoices in 2026).

## FASE 6 — Prova de Persistência

### Contadores globais

| metric | value |
|---|---|
| compras_2h (webservice) | **5** |
| vendas_2h | **2** |
| **Total compras DB** | **58,335** |
| **Total vendas DB** | **11,227** |

### Runs com vendas > 0 (2h window)

| client_id | vendas_total | vendas_imported | total_sales_db |
|---|---|---|---|
| `eac407b5` | 5 | 0 | 5 (dedup) |
| `dca857fc` | 2 | **2** ← NEW | 318 |
| `c7233b47` | 114 | 0 | 114 (dedup) |
| `c2038c37` | 15 | 0 | 15 (dedup) |
| `88a7ca79` | 4 | 0 | 4 (dedup) |

**Key evidence:** Client `dca857fc` had 2 NEW sales imported this session:
- `FA FA2026/1` (€3,522.72, date 2026-02-23) — created 19:34:48 UTC
- `FS FS2026/1` (€39.45, date 2026-01-15) — created 19:34:48 UTC

### reason_code distribution (2h)

| reason_code | count |
|---|---|
| AT_EMPTY_LIST | 123 |
| (null) = success | 7 |
| AT_SCHEMA_RESPONSE_ERROR | 6 |
| AT_AUTH_FAILED | 6 |

## CRITÉRIOS DE ACEITAÇÃO

| # | Critério | Result | Evidência |
|---|---|---|---|
| 1 | Novos jobs criados após trigger | **PASS** | Batch `73557205`: 3 jobs created and completed |
| 2 | sync_method='api', method='api_connector' | **PASS** | All 3 runs show `api_connector` |
| 3 | AT_STARTDATE_FUTURE = 0 | **PASS** | `select count(*)=0` confirmed |
| 4 | vendas persists when vendas_total>0 | **PASS** | `dca857fc`: 2 new sales imported; others: dedup (data already in DB) |
| 5 | Compras sem regressão | **PASS** | 58,335 total; 5 new in 2h window |
| 6 | Sem fila presa após re-trigger | **PASS** | 0 stuck jobs after cleanup |

**Overall: 6/6 PASS**

## RCA — Por que "vendas_2h = 0" parecia acontecer

1. **Deduplicação ativa:** O sistema importou vendas em runs anteriores (21 Feb bulk run importou milhares). Runs subsequentes encontram os mesmos registos e fazem skip (`vendas_imported=0`), mas isso é **comportamento correto** — os dados já estão na DB.

2. **AT_EMPTY_LIST:** Muitos clientes simplesmente não têm vendas no período consultado (2026-01-01 a hoje).

3. **AT_YEAR_UNAVAILABLE (2024):** A AT fechou consultas para 2024. Não é um bug do sistema.

4. **AT_AUTH_FAILED (47 cases):** ~7 clientes têm credenciais incorretas. Requer atualização manual pelo contabilista.

5. **AT_SCHEMA_RESPONSE_ERROR:** Bug intermitente no XML da AT. Afeta ~4% dos runs mas não bloqueia o pipeline.

## Próximas Ações

1. **Credenciais AT_AUTH_FAILED:** Atualizar credenciais dos 7 clientes afetados em Definições → Credenciais AT.
2. **Jobs 2025 running:** 13 runs com status `running` de 2025 — o scheduler vai re-tentar automaticamente.
3. **AT_ENCRYPTION_KEY:** Adicionar secret dedicada para substituir o fallback `SUPABASE_SERVICE_ROLE_KEY`.
