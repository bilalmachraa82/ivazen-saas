-- ============================================================
-- STEP 3: Re-enable FK constraints + triggers AFTER importing all CSVs
-- Run this AFTER all CSV data has been imported via Table Editor
-- ============================================================

-- Re-enable FK constraint checking
SET session_replication_role = 'origin';

-- Re-enable all triggers
ALTER TABLE public.profiles ENABLE TRIGGER ALL;
ALTER TABLE public.user_roles ENABLE TRIGGER ALL;
ALTER TABLE public.invoices ENABLE TRIGGER ALL;
ALTER TABLE public.invoice_vat_lines ENABLE TRIGGER ALL;
ALTER TABLE public.invoice_validation_logs ENABLE TRIGGER ALL;
ALTER TABLE public.tax_withholdings ENABLE TRIGGER ALL;
ALTER TABLE public.withholding_logs ENABLE TRIGGER ALL;
ALTER TABLE public.at_withholding_candidates ENABLE TRIGGER ALL;
ALTER TABLE public.sales_invoices ENABLE TRIGGER ALL;
ALTER TABLE public.revenue_entries ENABLE TRIGGER ALL;
ALTER TABLE public.ss_declarations ENABLE TRIGGER ALL;
ALTER TABLE public.at_credentials ENABLE TRIGGER ALL;
ALTER TABLE public.accountant_at_config ENABLE TRIGGER ALL;
ALTER TABLE public.accountant_requests ENABLE TRIGGER ALL;
ALTER TABLE public.client_accountants ENABLE TRIGGER ALL;
ALTER TABLE public.client_invitations ENABLE TRIGGER ALL;
ALTER TABLE public.category_preferences ENABLE TRIGGER ALL;
ALTER TABLE public.classification_rules ENABLE TRIGGER ALL;
ALTER TABLE public.classification_examples ENABLE TRIGGER ALL;
ALTER TABLE public.notification_preferences ENABLE TRIGGER ALL;
ALTER TABLE public.push_subscriptions ENABLE TRIGGER ALL;
ALTER TABLE public.sent_notifications ENABLE TRIGGER ALL;
ALTER TABLE public.user_onboarding_progress ENABLE TRIGGER ALL;
ALTER TABLE public.upload_queue ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_history ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_jobs ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_year_overrides ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_override_audit ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_automation_runs ENABLE TRIGGER ALL;
ALTER TABLE public.partners ENABLE TRIGGER ALL;
ALTER TABLE public.ai_metrics ENABLE TRIGGER ALL;

-- ============================================================
-- VERIFY: Check row counts across all tables
-- ============================================================
SELECT 'profiles' AS tbl, count(*) FROM public.profiles
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
UNION ALL SELECT 'invoices', count(*) FROM public.invoices
UNION ALL SELECT 'invoice_vat_lines', count(*) FROM public.invoice_vat_lines
UNION ALL SELECT 'tax_withholdings', count(*) FROM public.tax_withholdings
UNION ALL SELECT 'sales_invoices', count(*) FROM public.sales_invoices
UNION ALL SELECT 'revenue_entries', count(*) FROM public.revenue_entries
UNION ALL SELECT 'at_credentials', count(*) FROM public.at_credentials
UNION ALL SELECT 'client_accountants', count(*) FROM public.client_accountants
UNION ALL SELECT 'at_sync_history', count(*) FROM public.at_sync_history
UNION ALL SELECT 'at_withholding_candidates', count(*) FROM public.at_withholding_candidates
UNION ALL SELECT 'upload_queue', count(*) FROM public.upload_queue
UNION ALL SELECT 'withholding_logs', count(*) FROM public.withholding_logs
ORDER BY tbl;
