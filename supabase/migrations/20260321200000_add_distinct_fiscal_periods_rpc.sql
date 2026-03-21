-- RPC to fetch distinct fiscal periods efficiently
-- Avoids fetching all rows just to extract ~20 unique period values
--
-- Uses SECURITY INVOKER so RLS policies on invoices/sales_invoices
-- apply automatically under the calling user's identity.

CREATE OR REPLACE FUNCTION get_distinct_fiscal_periods(
  p_client_id uuid DEFAULT NULL,
  p_table_name text DEFAULT 'invoices'
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result text[];
BEGIN
  -- Validate table name whitelist
  IF p_table_name NOT IN ('invoices', 'sales_invoices') THEN
    RAISE EXCEPTION 'Invalid table_name: %', p_table_name
      USING ERRCODE = '22023';
  END IF;

  IF p_table_name = 'sales_invoices' THEN
    IF p_client_id IS NOT NULL THEN
      SELECT array_agg(DISTINCT fiscal_period ORDER BY fiscal_period DESC)
      INTO result
      FROM sales_invoices
      WHERE client_id = p_client_id
        AND fiscal_period IS NOT NULL
        AND fiscal_period <> '';
    ELSE
      SELECT array_agg(DISTINCT fiscal_period ORDER BY fiscal_period DESC)
      INTO result
      FROM sales_invoices
      WHERE fiscal_period IS NOT NULL
        AND fiscal_period <> '';
    END IF;
  ELSE
    IF p_client_id IS NOT NULL THEN
      SELECT array_agg(DISTINCT fiscal_period ORDER BY fiscal_period DESC)
      INTO result
      FROM invoices
      WHERE client_id = p_client_id
        AND fiscal_period IS NOT NULL
        AND fiscal_period <> '';
    ELSE
      SELECT array_agg(DISTINCT fiscal_period ORDER BY fiscal_period DESC)
      INTO result
      FROM invoices
      WHERE fiscal_period IS NOT NULL
        AND fiscal_period <> '';
    END IF;
  END IF;

  RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$;

-- Revoke default PUBLIC access, grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION get_distinct_fiscal_periods(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_distinct_fiscal_periods(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_distinct_fiscal_periods(uuid, text) TO service_role;

-- Composite indexes for efficient index-only scans on fiscal_period queries
CREATE INDEX IF NOT EXISTS idx_invoices_client_fiscal_period
  ON public.invoices(client_id, fiscal_period DESC)
  WHERE fiscal_period IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_client_fiscal_period
  ON public.sales_invoices(client_id, fiscal_period DESC)
  WHERE fiscal_period IS NOT NULL;
