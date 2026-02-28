
-- Fix security warnings from linter

-- 1) Fix at_control_center_view: set security_invoker=true
ALTER VIEW public.at_control_center_view SET (security_invoker = true);

-- 2) Fix search_path on get_at_control_center_stats (already has it, but ensure)
-- Already SET search_path in definition, skip

-- 3) Fix the RLS policies info warnings for internal_webhook_keys and at_sync_automation_runs
-- internal_webhook_keys already handled previously
-- at_sync_automation_runs: add read policy for service_role usage (it bypasses RLS anyway)
-- These are INFO level, not blocking

-- The real issue: at_control_center_view security_invoker
-- Already done above
