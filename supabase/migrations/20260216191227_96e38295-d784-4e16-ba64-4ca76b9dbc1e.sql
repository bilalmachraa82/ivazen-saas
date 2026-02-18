
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exclusion_reason TEXT DEFAULT NULL;
