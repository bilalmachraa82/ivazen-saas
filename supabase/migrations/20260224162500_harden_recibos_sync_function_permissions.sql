-- Security hardening:
-- Do not expose SECURITY DEFINER write functions to regular authenticated users.
-- Keep execution restricted to service_role.

REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() FROM anon;

GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings_trigger() TO service_role;

