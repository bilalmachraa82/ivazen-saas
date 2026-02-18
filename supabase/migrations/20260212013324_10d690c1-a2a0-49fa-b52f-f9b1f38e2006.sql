-- BUG 2 FIX: Allow 'portal' sync_method in at_sync_history
ALTER TABLE public.at_sync_history
DROP CONSTRAINT IF EXISTS at_sync_history_sync_method_check,
ADD CONSTRAINT at_sync_history_sync_method_check
CHECK (sync_method IN ('api', 'csv', 'manual', 'portal'));

COMMENT ON COLUMN public.at_sync_history.sync_method IS 'Método usado: api (webservice SOAP), csv (import manual), manual (entrada manual) ou portal (e-Fatura JSON endpoint)';
