
-- Migration 1: Add supplier_vat_id column
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS supplier_vat_id text;

-- Migration 2: Expand ai_dp_field constraint to accept value 10
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_ai_dp_field_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_ai_dp_field_check CHECK (ai_dp_field IN (10, 20, 21, 22, 23, 24));
