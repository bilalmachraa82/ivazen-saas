-- Allow explicit invoice exclusion from DP calculation with an auditable reason.
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS exclusion_reason text;

