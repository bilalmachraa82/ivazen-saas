ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS accounting_excluded boolean NOT NULL DEFAULT false;
