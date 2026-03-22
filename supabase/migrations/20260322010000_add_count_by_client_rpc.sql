-- RPC to count rows per client_id in a given table efficiently
-- Returns only (client_id, count) pairs instead of all rows.
-- For 242 clients with 53K rows, this returns ~242 rows instead of 53K.
--
-- Uses SECURITY INVOKER so RLS policies apply under the caller's identity.
-- Table name validated against whitelist to prevent SQL injection.

CREATE OR REPLACE FUNCTION count_rows_by_client(
  p_client_ids uuid[],
  p_table_name text
)
RETURNS TABLE(client_id uuid, row_count bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Validate table name whitelist
  IF p_table_name NOT IN ('sales_invoices', 'tax_withholdings') THEN
    RAISE EXCEPTION 'Invalid table_name: %', p_table_name
      USING ERRCODE = '22023';
  END IF;

  IF p_table_name = 'sales_invoices' THEN
    RETURN QUERY
      SELECT si.client_id, COUNT(*)::bigint AS row_count
      FROM sales_invoices si
      WHERE si.client_id = ANY(p_client_ids)
      GROUP BY si.client_id;
  ELSE
    RETURN QUERY
      SELECT tw.client_id, COUNT(*)::bigint AS row_count
      FROM tax_withholdings tw
      WHERE tw.client_id = ANY(p_client_ids)
      GROUP BY tw.client_id;
  END IF;
END;
$$;

-- Restrict access: no anonymous, only authenticated and service_role
REVOKE EXECUTE ON FUNCTION count_rows_by_client(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_rows_by_client(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION count_rows_by_client(uuid[], text) TO service_role;
