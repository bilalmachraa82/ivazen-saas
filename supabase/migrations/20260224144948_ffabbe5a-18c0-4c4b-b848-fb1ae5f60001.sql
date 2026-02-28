-- Fix: permitir que utilizadores autenticados executem as funções de sync
GRANT EXECUTE ON FUNCTION public.sync_revenue_entries_from_withholdings(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_revenue_entry_from_withholding(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_withholding_income_to_revenue_category(text) TO authenticated;