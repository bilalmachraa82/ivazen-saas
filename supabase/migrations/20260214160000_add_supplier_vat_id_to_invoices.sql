-- Add supplier_vat_id to store foreign VAT IDs (e.g., IE..., ES..., FR...) separately from PT NIF.
-- This is additive and non-breaking. We keep supplier_nif as the primary identifier for now.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS supplier_vat_id text;

