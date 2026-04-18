# SalesHealth Dashboard — Design Spec (Phase 1.5)

**Date:** 2026-04-18
**Scope:** Phase 1.5 of the sales-reliability programme
**Prerequisite:** Phase 1 deployed (`2026-04-18-sync-quarter-boundary-fix-design.md`)
**Follow-on:** Phase 2 will add per-client AT-vs-DB reconciliation button.

---

## 1. Problem

Phase 1 makes the silent miss *visible* in the DB (via `at_sync_history.status='partial'` and `invoices_returned_by_at`). It does NOT give the accountant a single place to see which of the ~242 clients need attention right now. Today the signal is buried in individual sync-history tables and requires opening each client to judge.

## 2. Goal

A single page, `/accountant/sales-health`, where an accountant sees every client ranked by severity and can take a one-click recovery action without leaving the page.

## 3. Non-goals

- Fixing sync internals (already covered by Phase 1).
- Cross-checking against the AT portal (deferred to Phase 2).
- Touching the Modelo 10 / withholding pipeline.
- Mobile layout refinement (desktop-first; mobile gets a stacked fallback).

## 4. Design

### 4.1 RPC — `get_accountant_sales_health(p_accountant_id uuid)`

Returns one row per client in the accountant's portfolio, aggregating:

| Column | Type | Source |
|---|---|---|
| `client_id` | uuid | `profiles.id` (joined via `accountant_clients`) |
| `full_name` | text | `profiles.full_name` |
| `nif` | text | `profiles.nif` |
| `last_sync_at` | timestamptz | `at_credentials.last_sync_at` |
| `last_sync_status` | text | `at_credentials.last_sync_status` |
| `last_reason_code` | text | latest `at_sync_history.reason_code` for this client |
| `latest_at_returned_count` | integer | latest `at_sync_history.invoices_returned_by_at` |
| `vendas_current_quarter` | integer | count from `sales_invoices` |
| `vendas_prior_year_same_period` | integer | same, shifted −1 year |
| `severity` | integer | 0=healthy, 1=stale, 2=suspicious_empty, 3=error, 4=no_credentials |

Computed in a single SQL function with CTEs to avoid N+1. Indexed via existing `idx_sales_invoices_client_date` and the Phase 1 `idx_at_sync_history_reason_status`.

### 4.2 UI — `src/pages/accountant/SalesHealth.tsx`

- Header: `H1` "Saúde das vendas" + trimester selector (defaults to current).
- KPI strip: counts per severity band, colour-coded. Clicking a band filters the table.
- Table:
  - Sort default: severity DESC, then `vendas_current_quarter ASC`, then `last_sync_at ASC`.
  - Columns: Cliente (name + NIF), Estado (badge), Motivo, Vendas Q actual, Vendas Q homólogo, Último sync.
  - Row actions (dropdown on the far right): `Forçar sync` → invokes existing `sync-efatura` edge function with the client_id (inline progress, no page reload); `Abrir cliente` → navigates to client detail.
  - Density: same as `src/pages/accountant/ClientSelector.tsx` for visual consistency.
- Filters above the table: status chip set (Todos / Saudável / Parcial / Erro / Sem credenciais), reason-code multiselect, text search (name/NIF).
- Dark-mode tokens from `design-tokens.ts` + shadcn badge variants. No hardcoded colours.

### 4.3 Data flow

```
SalesHealth page loads
  → useQuery(['sales-health', accountantId, quarter])
    → supabase.rpc('get_accountant_sales_health', {...})
  → render table with sort + filters
Row: "Forçar sync"
  → supabase.functions.invoke('sync-efatura', { clientId, direction: 'vendas' })
  → toast 'A sincronizar…', poll query.refetch() every 3s, stop on completion
```

### 4.4 Error handling

- RPC failure: render the skeleton with a toast `Erro ao carregar dashboard; tentar novamente`.
- Force-sync failure: per-row error badge, message from `error.message`, no dashboard-level blocker.
- Rate limit (manual dispatch concurrency): guarded by a short debounce; at most one force-sync in flight per client at a time.

### 4.5 Testing

- **RPC:** `supabase/migrations/.../get_accountant_sales_health.sql` has an inline DO block with a fixture + expected row count (pattern used by existing RPC migrations).
- **Component:** `src/pages/accountant/__tests__/SalesHealth.test.tsx` — React Testing Library + Vitest, covers:
  1. Renders the severity summary strip
  2. Filters to "suspicious_empty" show only rows with that status
  3. Force-sync dispatch calls `supabase.functions.invoke` with the correct payload
  4. Severity sort puts `suspicious_empty` rows above healthy rows

## 5. Rollback

- Page is additive (new route + new RPC). If the RPC proves expensive, feature-flag the route behind `VITE_ENABLE_SALES_HEALTH=true` and serve an empty stub.
- RPC is read-only; rollback is `DROP FUNCTION`.

## 6. Open questions

- **Placement in sidebar:** under "Acessos AT" or as a dedicated "Saúde" group? Decision proposed: dedicated "Saúde" group, expandable into future panels (Phase 2+).
- **Severity threshold for `stale`:** proposal `last_sync_at < now() - 72h`. Confirm before plan.

---

## Acceptance criteria

1. Page renders within 1.5s for a 242-client portfolio (single RPC call, no N+1).
2. Bilal + Majda + Helene appear with correct severity after Phase 1 deploy:
   - Bilal: `healthy` (post-Phase 1 fix recovers his 3 missing)
   - Majda: `suspicious_empty` OR `healthy` depending on ground truth
   - Helene: `healthy`
3. Force-sync action updates the row's status live without full-page reload.
4. Keyboard-accessible: all row actions reachable via tab + enter.
5. Dark mode: no hardcoded colour failures (same bar as `SSCalculationSummary`).
