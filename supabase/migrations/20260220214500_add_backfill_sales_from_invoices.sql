-- Optional backfill helper: move AT webservice vendas that were previously stored in invoices
-- into sales_invoices.

CREATE OR REPLACE FUNCTION public.backfill_sales_invoices_from_invoices(
  p_created_after timestamptz DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH source_rows AS (
    SELECT
      i.id AS invoice_id,
      i.client_id,
      i.document_date,
      i.document_number,
      i.document_type,
      i.customer_nif,
      i.total_amount,
      i.total_vat,
      i.vat_standard,
      i.vat_intermediate,
      i.vat_reduced,
      i.base_standard,
      i.base_intermediate,
      i.base_reduced,
      i.base_exempt,
      i.fiscal_period,
      i.fiscal_region,
      i.atcud,
      i.image_path,
      i.created_at,
      p.nif AS supplier_nif
    FROM public.invoices i
    JOIN public.profiles p ON p.id = i.client_id
    WHERE i.efatura_source = 'webservice'
      AND i.supplier_nif = p.nif
      AND i.document_date IS NOT NULL
      AND (p_created_after IS NULL OR i.created_at >= p_created_after)
      AND NOT EXISTS (
        SELECT 1
        FROM public.sales_invoices s
        WHERE s.client_id = i.client_id
          AND s.supplier_nif = p.nif
          AND COALESCE(s.document_number, '') = COALESCE(i.document_number, '')
      )
  ), inserted_rows AS (
    INSERT INTO public.sales_invoices (
      client_id,
      document_date,
      document_number,
      document_type,
      customer_nif,
      customer_name,
      supplier_nif,
      total_amount,
      total_vat,
      vat_standard,
      vat_intermediate,
      vat_reduced,
      base_standard,
      base_intermediate,
      base_reduced,
      base_exempt,
      fiscal_period,
      fiscal_region,
      atcud,
      image_path,
      status,
      notes,
      created_at
    )
    SELECT
      r.client_id,
      r.document_date,
      r.document_number,
      COALESCE(r.document_type, 'FT'),
      r.customer_nif,
      NULL,
      r.supplier_nif,
      COALESCE(r.total_amount, 0),
      COALESCE(r.total_vat, 0),
      COALESCE(r.vat_standard, 0),
      COALESCE(r.vat_intermediate, 0),
      COALESCE(r.vat_reduced, 0),
      COALESCE(r.base_standard, 0),
      COALESCE(r.base_intermediate, 0),
      COALESCE(r.base_reduced, 0),
      COALESCE(r.base_exempt, 0),
      r.fiscal_period,
      COALESCE(r.fiscal_region, 'PT'),
      r.atcud,
      COALESCE(r.image_path, 'backfill/invoices'),
      CASE WHEN r.total_amount IS NULL THEN 'pending' ELSE 'pending' END,
      CONCAT('Backfilled from invoices.id=', r.invoice_id),
      r.created_at
    FROM source_rows r
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted_rows;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

COMMENT ON FUNCTION public.backfill_sales_invoices_from_invoices(timestamptz) IS
'Optional helper to backfill sales_invoices from webservice rows that were wrongly persisted into invoices.';

REVOKE ALL ON FUNCTION public.backfill_sales_invoices_from_invoices(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_sales_invoices_from_invoices(timestamptz) TO service_role;
