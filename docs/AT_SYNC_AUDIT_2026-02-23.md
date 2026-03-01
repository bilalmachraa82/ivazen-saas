# AT Sync Audit — 2026-02-23

## Scope
Audit and hardening for AT purchases/sales sync with focus on:
- why sales were not visible,
- removing unsupported fiscal year paths (2024),
- reducing false operational confusion after successful sync.

## What I could validate locally
- Git/code audit completed on `main`.
- Test suite passed: `388/388`.
- Build passed (`vite build`).
- `deno check` passed for updated edge functions.

## Root causes found in code

1. **Bulk sync UI still allowed unsupported years**
- `BulkClientSync` exposed hardcoded year options including 2024/2023.
- This causes avoidable failed runs once 2024 is no longer available in AT.

2. **Backend accepted any fiscal year in queue manager**
- `sync-queue-manager` had no allowed-year guard.
- Even if UI changed, direct calls could still enqueue unsupported years.

3. **Scheduler force/manual path still included current-2 year**
- `run_scheduled_at_sync(true)` included current year - 2 (2024 in 2026).
- This creates avoidable `AT_YEAR_UNAVAILABLE` noise.

4. **Sales visibility issue in fiscal widgets**
- AT sales were inserted with `status='pending'`.
- VAT/fiscal widgets primarily consume `validated` data.
- Net effect: sales existed in DB but could appear as zero in key dashboards until validation.

5. **UI cache invalidation incomplete after sync**
- After sync completion, only a subset of queries was invalidated.
- This can show stale numbers immediately after successful imports.

## Changes implemented

### 1) Remove unsupported years from Bulk Sync UI
- File: `/Users/bilal/Programaçao/ivazen/iva-inteligente-mvp/src/pages/BulkClientSync.tsx`
- Replaced hardcoded year arrays with dynamic `[currentYear, currentYear - 1]`.

### 2) Enforce year policy in queue manager
- File: `/Users/bilal/Programaçao/ivazen/iva-inteligente-mvp/supabase/functions/sync-queue-manager/index.ts`
- Added validation: only `currentYear` and `currentYear - 1` are accepted.
- Returns HTTP 400 with `FISCAL_YEAR_NOT_ALLOWED` otherwise.
- Updated function version string for traceability.

### 3) Make AT sales immediately visible in fiscal flows
- File: `/Users/bilal/Programaçao/ivazen/iva-inteligente-mvp/supabase/functions/sync-efatura/index.ts`
- `insertSalesInvoicesFromAT` now writes:
  - `status = 'validated'`
  - `validated_at = now()`
- Purchases path intentionally unchanged (to avoid changing deductibility behavior).

### 4) Force-refresh fiscal/sales caches after sync
- File: `/Users/bilal/Programaçao/ivazen/iva-inteligente-mvp/src/hooks/useATCredentials.ts`
- File: `/Users/bilal/Programaçao/ivazen/iva-inteligente-mvp/src/hooks/useBulkSync.ts`
- Added invalidations for fiscal/VAT/sales query keys.
- Also fixed toast imported count fallback (`invoicesProcessed || inserted || count || 0`).

### 5) New migration: scheduler limited to current + previous year
- File: `/Users/bilal/Programaçao/ivazen/iva-inteligente-mvp/supabase/migrations/20260223194000_limit_scheduled_sync_to_current_and_previous.sql`
- Replaces `run_scheduled_at_sync` so `p_force` bypasses time-window only (no current-2 year).

### 6) New migration: backfill existing AT sales pending -> validated
- File: `/Users/bilal/Programaçao/ivazen/iva-inteligente-mvp/supabase/migrations/20260223194500_mark_at_sales_invoices_validated.sql`
- Updates only rows matching `image_path LIKE 'at-webservice-sales/%'` and pending/null status.

## Why sales may have looked missing
Even with successful sync, if imported AT sales remain `pending`, VAT/fiscal widgets can show 0 because they read validated datasets. This patch removes that visibility gap for AT-origin sales.

## What still depends on production operations
I cannot execute these steps directly in your production Supabase project from this environment:
- apply new SQL migrations,
- deploy updated edge functions,
- run live SQL verification queries,
- update wrong client passwords (the 12 `AT_AUTH_FAILED` cases).

## Production validation SQL (run after deploy)

### A) Check pending AT sales before/after migration
```sql
select
  status,
  count(*) as n
from public.sales_invoices
where image_path like 'at-webservice-sales/%'
group by status
order by n desc;
```

### B) Ensure new AT sales are validated
```sql
select
  created_at,
  client_id,
  status,
  document_date,
  document_number,
  total_amount,
  total_vat
from public.sales_invoices
where image_path like 'at-webservice-sales/%'
  and created_at > now() - interval '24 hours'
order by created_at desc
limit 100;
```

### C) Confirm sync method + direction totals
```sql
select
  created_at,
  client_id,
  status,
  sync_method,
  reason_code,
  metadata->>'method' as method,
  metadata#>>'{directions,compras,totalRecords}' as compras_total,
  metadata#>>'{directions,vendas,totalRecords}' as vendas_total,
  records_imported,
  error_message
from public.at_sync_history
where created_at > now() - interval '24 hours'
order by created_at desc
limit 200;
```

### D) List auth-failed clients to request password updates
```sql
select
  h.client_id,
  p.nif,
  p.full_name,
  max(h.created_at) as last_error_at,
  count(*) as errors
from public.at_sync_history h
join public.profiles p on p.id = h.client_id
where h.created_at > now() - interval '7 days'
  and h.reason_code = 'AT_AUTH_FAILED'
group by h.client_id, p.nif, p.full_name
order by last_error_at desc;
```

### E) Verify no unsupported year jobs are being generated now
```sql
with y as (
  select extract(year from now())::int as cy
)
select fiscal_year, status, count(*) as n
from public.at_sync_jobs, y
where created_at > now() - interval '24 hours'
group by fiscal_year, status
order by fiscal_year desc, n desc;
```

Expected: only `cy` and `cy-1` for newly created jobs.

## Decision summary
- For clients with correct NIF/password and AT data available in allowed period, pipeline is configured to import all available purchases and sales.
- 2024 extraction path is now removed from operational flow (UI/backend/scheduler policy).
- The 12 wrong-password cases remain blocked until credentials are corrected.
