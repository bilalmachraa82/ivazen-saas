-- Remove existing partial unique index that doesn't work with UPSERT
DROP INDEX IF EXISTS public.idx_unique_withholding_doc;

-- Create proper UNIQUE constraint for UPSERT to work
ALTER TABLE public.tax_withholdings 
ADD CONSTRAINT tax_withholdings_unique_doc UNIQUE (beneficiary_nif, document_reference, fiscal_year);