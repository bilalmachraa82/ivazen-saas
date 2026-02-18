-- Allow Campo 10 (Aquisições Intracomunitárias) in invoices.ai_dp_field
-- This matches the DP export logic which supports dp_field=10 for reverse charge flows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'invoices'
      AND c.conname = 'invoices_ai_dp_field_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.invoices DROP CONSTRAINT invoices_ai_dp_field_check';
  END IF;
END $$;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_ai_dp_field_check
  CHECK (ai_dp_field IN (10, 20, 21, 22, 23, 24));

