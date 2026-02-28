
-- Phase 2: Add outcome tracking columns to upload_queue
ALTER TABLE public.upload_queue ADD COLUMN IF NOT EXISTS outcome_code text;
ALTER TABLE public.upload_queue ADD COLUMN IF NOT EXISTS normalized_doc_ref text;

-- Phase 1.3: Add client_id to unique constraint on tax_withholdings
-- Drop old constraint, add new one with client_id
ALTER TABLE public.tax_withholdings DROP CONSTRAINT IF EXISTS tax_withholdings_unique_doc;
ALTER TABLE public.tax_withholdings ADD CONSTRAINT tax_withholdings_unique_doc 
  UNIQUE (client_id, beneficiary_nif, document_reference, fiscal_year);
