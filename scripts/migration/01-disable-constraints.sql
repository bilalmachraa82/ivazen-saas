-- ============================================================
-- STEP 1: Disable FK constraints + triggers for data import
-- Run this BEFORE importing any CSV data
-- ============================================================

-- Disable all triggers on tables (prevents RLS/audit triggers from interfering)
ALTER TABLE public.profiles DISABLE TRIGGER ALL;
ALTER TABLE public.user_roles DISABLE TRIGGER ALL;
ALTER TABLE public.invoices DISABLE TRIGGER ALL;
ALTER TABLE public.invoice_vat_lines DISABLE TRIGGER ALL;
ALTER TABLE public.invoice_validation_logs DISABLE TRIGGER ALL;
ALTER TABLE public.tax_withholdings DISABLE TRIGGER ALL;
ALTER TABLE public.withholding_logs DISABLE TRIGGER ALL;
ALTER TABLE public.at_withholding_candidates DISABLE TRIGGER ALL;
ALTER TABLE public.sales_invoices DISABLE TRIGGER ALL;
ALTER TABLE public.revenue_entries DISABLE TRIGGER ALL;
ALTER TABLE public.ss_declarations DISABLE TRIGGER ALL;
ALTER TABLE public.at_credentials DISABLE TRIGGER ALL;
ALTER TABLE public.accountant_at_config DISABLE TRIGGER ALL;
ALTER TABLE public.accountant_requests DISABLE TRIGGER ALL;
ALTER TABLE public.client_accountants DISABLE TRIGGER ALL;
ALTER TABLE public.client_invitations DISABLE TRIGGER ALL;
ALTER TABLE public.category_preferences DISABLE TRIGGER ALL;
ALTER TABLE public.classification_rules DISABLE TRIGGER ALL;
ALTER TABLE public.classification_examples DISABLE TRIGGER ALL;
ALTER TABLE public.notification_preferences DISABLE TRIGGER ALL;
ALTER TABLE public.push_subscriptions DISABLE TRIGGER ALL;
ALTER TABLE public.sent_notifications DISABLE TRIGGER ALL;
ALTER TABLE public.user_onboarding_progress DISABLE TRIGGER ALL;
ALTER TABLE public.upload_queue DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_history DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_jobs DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_year_overrides DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_override_audit DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_automation_runs DISABLE TRIGGER ALL;
ALTER TABLE public.partners DISABLE TRIGGER ALL;
ALTER TABLE public.ai_metrics DISABLE TRIGGER ALL;

-- Disable session_replication_role to bypass ALL FK checks during import
SET session_replication_role = 'replica';

-- Confirmation
SELECT 'Constraints and triggers DISABLED — ready for CSV import' AS status;
