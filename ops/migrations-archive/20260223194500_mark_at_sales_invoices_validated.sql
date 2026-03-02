-- Mark AT webservice sales imports as validated so they are visible in fiscal calculations.
-- Safe/idempotent: updates only rows created by AT sync path and currently pending/null.

UPDATE public.sales_invoices
SET
  status = 'validated',
  validated_at = COALESCE(validated_at, created_at, now())
WHERE COALESCE(status, 'pending') = 'pending'
  AND image_path LIKE 'at-webservice-sales/%';
