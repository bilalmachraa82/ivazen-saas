-- Performance indexes for most common query patterns
-- Uses CONCURRENTLY to avoid locking production tables

-- Compound index for invoice list (filter by client, order by date)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_client_date
  ON public.invoices(client_id, document_date DESC);

-- Compound index for sales invoice list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_invoices_client_date
  ON public.sales_invoices(client_id, document_date DESC);

-- Compound index for tax withholdings (keyset pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tax_withholdings_client_year_date
  ON public.tax_withholdings(client_id, fiscal_year, payment_date DESC, id DESC);

-- Covering index for dashboard stats (count by status without fetching rows)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_client_status
  ON public.invoices(client_id, status, ai_confidence);
