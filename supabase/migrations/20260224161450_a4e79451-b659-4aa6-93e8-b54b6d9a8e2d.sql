
-- Security hardening: revoke SECURITY DEFINER write functions from authenticated/anon
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM anon;

-- map function is IMMUTABLE and read-only, safe for authenticated but revoke anon
REVOKE EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) FROM anon;

GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) TO service_role;
