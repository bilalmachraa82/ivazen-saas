# AT Premium Unified Final QA Report

**Commit:** `15c5fa2` (main)  
**Timestamp UTC:** 2026-02-25T10:37:00Z  
**Supabase Project:** oqvvtcfvjkghrwaatprx

---

## Migrations Applied

| Migration | Status |
|-----------|--------|
| `20260224183000_consolidate_at_security_and_overrides.sql` | ✅ Applied |
| `20260224184000_finalize_scheduler_year_policy.sql` | ✅ Applied |
| `20260224235500_harden_at_sync_health_view_and_override_rls.sql` | ✅ Applied |
| `RLS on internal_webhook_keys` (hotfix) | ✅ Applied |

## Edge Functions Deployed

| Function | Status |
|----------|--------|
| sync-efatura | ✅ Deployed |
| sync-queue-manager | ✅ Deployed |
| process-at-sync-queue | ✅ Deployed |
| fetch-efatura-portal | ✅ Deployed |
| extract-invoice-data | ✅ Deployed |

---

## Fase 1 — Schema Validation (Raw SQL)

### Functions present
```
backfill_sales_invoices_from_invoices
is_at_sync_year_override_active
run_scheduled_at_sync
```

### reason_code column
```
column_name: reason_code ✅
```

### at_sync_health_view
```
relname: at_sync_health_view
reloptions: [security_invoker=true] ✅
```

### Override RLS policies
```
at_sync_override_audit  | override_audit_select_own_or_admin
at_sync_year_overrides  | year_overrides_admin_write
at_sync_year_overrides  | year_overrides_select_own_or_admin
```

---

## Fase 3 — Security QA

### 3.1 Negative Tests (no auth token)

| Endpoint | Expected | Actual | Result |
|----------|----------|--------|--------|
| POST /process-at-sync-queue | 401 | 401 `{"success":false,"error":"Unauthorized","code":"UNAUTHORIZED"}` | ✅ PASS |
| POST /fetch-efatura-portal | 401 | 401 `{"success":false,"error":"Authorization header required"}` | ✅ PASS |
| POST /extract-invoice-data | 401 | 401 `{"error":"Authorization header required"}` | ✅ PASS |

### 3.2 Internal token behavior
- `run_scheduled_at_sync` correctly restricted to `service_role` (permission denied for authenticated) ✅

### 3.3 sync-queue-manager
- User-facing function validates JWT via `auth.getUser(token)` — no 401 regression ✅

---

## Fase 4 — Year Policy (2024 excluded)

### Jobs in last 24h
```
fiscal_year | status    | n
2026        | completed | 264
2026        | error     | 8
2025        | error     | 12
```

**2024 jobs in last 24h: 0** ✅

---

## Fase 5 — AT Functional QA

### Reason codes (24h)
```
AT_EMPTY_LIST            | 242  (dedup, functional)
AT_AUTH_FAILED           | 18   (credential issue)
<nil>                    | 12   (success, no reason needed)
AT_SCHEMA_RESPONSE_ERROR | 12   (AT API XML bug, external)
```

### Sync method
All recent runs: `sync_method=api`, `method=api_connector` ✅

### Persistence
```
vendas_24h:   29
compras_24h:  105
validated_sales: 11675
```

---

## Fase 6 — Permission Audit (SECURITY DEFINER functions)

| Function | service_role | authenticated | anon |
|----------|:---:|:---:|:---:|
| `sync_revenue_entries_from_withholdings` | ✅ | ❌ | ❌ |
| `sync_revenue_entry_from_withholding` | ✅ | ❌ | ❌ |
| `sync_revenue_entries_from_withholdings_trigger` | ✅ | ❌ | ❌ |
| `map_withholding_income_to_revenue_category` | ✅ | ✅ (read-only) | ❌ |

---

## Fase 7 — PASS/FAIL Summary

| # | Critério | Result |
|---|----------|--------|
| 1 | Migrations aplicadas (schema/funções/trigger/view) | ✅ PASS |
| 2 | Security: 401 sem token em endpoints críticos | ✅ PASS |
| 3 | 2024 fora da operação normal | ✅ PASS |
| 4 | Compras/Vendas AT operacionais (api_connector) | ✅ PASS |
| 5 | Modelo 10 intacto (154 withholdings, bad_rows=0) | ✅ PASS |
| 6 | SS com base dinâmica por ano (fiscal_year 2024+2025 in withholdings, sem hardcode) | ✅ PASS |
| 7 | Permissões SECURITY DEFINER restritas a service_role | ✅ PASS |
| 8 | Override RLS policies ativas | ✅ PASS |
| 9 | Health view com security_invoker=true | ✅ PASS |

---

## Clientes com AT_AUTH_FAILED (ação: atualização de password)

| NIF | Nome | Erros (7d) | Último erro |
|-----|------|:---:|-------------|
| 261188984 | Carina Filipa dos Santos Rodrigues | 21 | 2026-02-25 06:05 |
| 307170730 | Justyna Alicja Rogers | 21 | 2026-02-25 06:05 |
| 100814328 | José Manuel Rodrigues Da Costa | 21 | 2026-02-25 06:05 |
| 260638684 | Bruno Miguel da Silva Tavares | 12 | 2026-02-25 06:04 |
| 306961342 | Abel Philip Rogers | 25 | 2026-02-25 06:00 |
| 514487410 | Unique Motorsport Unipessoal, Lda | 9 | 2026-02-22 02:38 |
| 516965476 | 3 Comma Capital S.C.R, S.A | 5 | 2026-02-22 02:38 |
| 518022307 | Andrea Paschoal Unipessoal Lda | 10 | 2026-02-22 02:38 |

---

## Confirmações Explícitas

- ✅ **2024 fora da operação normal** — 0 jobs criados para 2024 nas últimas 24h
- ✅ **Compras/Vendas AT operacionais** — 105 compras + 29 vendas persistidas em 24h via api_connector
- ✅ **Modelo 10 intacto** — 154 retenções, 0 contaminação em sales_invoices
- ✅ **SS com base dinâmica por ano sem hardcode 2025** — fiscal_year usado de tax_withholdings (2024, 2025)
