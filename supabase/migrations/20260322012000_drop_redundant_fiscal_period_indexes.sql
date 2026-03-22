-- Drop single-column fiscal_period indexes superseded by the composite
-- (client_id, fiscal_period DESC) indexes from migration 20260321200000.
-- The old indexes are never chosen by the planner for the RPC queries
-- and waste write amplification on every INSERT/UPDATE.

DROP INDEX IF EXISTS public.idx_invoices_period;
DROP INDEX IF EXISTS public.idx_sales_invoices_fiscal_period;
