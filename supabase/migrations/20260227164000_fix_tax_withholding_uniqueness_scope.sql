-- Fix withholding uniqueness scope to avoid cross-client conflicts.
-- Previous unique key did not include client_id:
--   (beneficiary_nif, document_reference, fiscal_year)
-- That could cause upserts from one client to collide with another client.

ALTER TABLE public.tax_withholdings
DROP CONSTRAINT IF EXISTS tax_withholdings_unique_doc;

ALTER TABLE public.tax_withholdings
DROP CONSTRAINT IF EXISTS tax_withholdings_unique_doc_per_client;

ALTER TABLE public.tax_withholdings
ADD CONSTRAINT tax_withholdings_unique_doc_per_client
UNIQUE (client_id, beneficiary_nif, document_reference, fiscal_year);
