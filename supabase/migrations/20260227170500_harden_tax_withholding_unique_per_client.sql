-- Defensive hardening for per-client uniqueness on tax_withholdings.
-- 1) Remove duplicate rows within the same client/key, keeping the newest.
-- 2) Ensure the per-client unique constraint exists.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY client_id, beneficiary_nif, document_reference, fiscal_year
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.tax_withholdings
  WHERE document_reference IS NOT NULL
)
DELETE FROM public.tax_withholdings t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tax_withholdings_unique_doc_per_client'
      AND conrelid = 'public.tax_withholdings'::regclass
  ) THEN
    ALTER TABLE public.tax_withholdings
    ADD CONSTRAINT tax_withholdings_unique_doc_per_client
    UNIQUE (client_id, beneficiary_nif, document_reference, fiscal_year);
  END IF;
END $$;
