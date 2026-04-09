ALTER TABLE public.revenue_entries
ADD COLUMN IF NOT EXISTS entry_month text;

CREATE UNIQUE INDEX IF NOT EXISTS revenue_entries_client_quarter_category_month_unique
ON public.revenue_entries (client_id, period_quarter, category, entry_month);
