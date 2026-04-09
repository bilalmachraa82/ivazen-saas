-- Aggregate total sales invoice revenue without paginating through every row.
-- Uses SECURITY INVOKER so RLS applies under the caller identity.

CREATE OR REPLACE FUNCTION public.get_sales_invoices_total_amount(
  p_client_id uuid DEFAULT NULL,
  p_fiscal_periods text[] DEFAULT NULL,
  p_year integer DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result numeric;
BEGIN
  SELECT COALESCE(SUM(si.total_amount), 0)
  INTO result
  FROM public.sales_invoices si
  WHERE (p_client_id IS NULL OR si.client_id = p_client_id)
    AND (p_fiscal_periods IS NULL OR si.fiscal_period = ANY(p_fiscal_periods))
    AND (
      p_year IS NULL
      OR (
        si.document_date >= make_date(p_year, 1, 1)
        AND si.document_date < make_date(p_year + 1, 1, 1)
      )
    );

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_sales_invoices_total_amount(uuid, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_invoices_total_amount(uuid, text[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_invoices_total_amount(uuid, text[], integer) TO service_role;
