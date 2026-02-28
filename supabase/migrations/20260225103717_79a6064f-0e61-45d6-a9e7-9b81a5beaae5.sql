-- Fix RLS on internal_webhook_keys (service_role only)
ALTER TABLE public.internal_webhook_keys ENABLE ROW LEVEL SECURITY;

-- Only service_role should read this table (already granted via REVOKE ALL + GRANT SELECT TO service_role)
-- No RLS policy needed for service_role as it bypasses RLS