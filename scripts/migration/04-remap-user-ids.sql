-- ============================================================
-- STEP 4: Remap user IDs (ONLY needed if Supabase assigned new UUIDs)
--
-- If users were created with different IDs than Lovable,
-- run this to update ALL tables.
--
-- Fill in the mapping table below with old → new UUID pairs.
-- ============================================================

-- Create temporary mapping table
CREATE TEMP TABLE id_mapping (
  old_id UUID NOT NULL,
  new_id UUID NOT NULL
);

-- ============================================================
-- INSERT YOUR ID MAPPINGS HERE:
-- (old Lovable UUID → new Supabase UUID)
-- ============================================================

-- INSERT INTO id_mapping VALUES
--   ('old-uuid-1', 'new-uuid-1'),
--   ('old-uuid-2', 'new-uuid-2');

-- ============================================================
-- Run the remapping (uncomment after filling in mappings)
-- ============================================================

-- UPDATE public.profiles SET id = m.new_id FROM id_mapping m WHERE profiles.id = m.old_id;
-- UPDATE public.user_roles SET user_id = m.new_id FROM id_mapping m WHERE user_roles.user_id = m.old_id;
-- UPDATE public.invoices SET user_id = m.new_id FROM id_mapping m WHERE invoices.user_id = m.old_id;
-- UPDATE public.invoices SET client_id = m.new_id FROM id_mapping m WHERE invoices.client_id = m.old_id;
-- UPDATE public.invoices SET accountant_id = m.new_id FROM id_mapping m WHERE invoices.accountant_id = m.old_id;
-- UPDATE public.invoices SET validated_by = m.new_id FROM id_mapping m WHERE invoices.validated_by = m.old_id;
-- UPDATE public.tax_withholdings SET user_id = m.new_id FROM id_mapping m WHERE tax_withholdings.user_id = m.old_id;
-- UPDATE public.tax_withholdings SET client_id = m.new_id FROM id_mapping m WHERE tax_withholdings.client_id = m.old_id;
-- UPDATE public.sales_invoices SET user_id = m.new_id FROM id_mapping m WHERE sales_invoices.user_id = m.old_id;
-- UPDATE public.revenue_entries SET user_id = m.new_id FROM id_mapping m WHERE revenue_entries.user_id = m.old_id;
-- UPDATE public.at_credentials SET user_id = m.new_id FROM id_mapping m WHERE at_credentials.user_id = m.old_id;
-- UPDATE public.accountant_at_config SET accountant_id = m.new_id FROM id_mapping m WHERE accountant_at_config.accountant_id = m.old_id;
-- UPDATE public.accountant_requests SET user_id = m.new_id FROM id_mapping m WHERE accountant_requests.user_id = m.old_id;
-- UPDATE public.client_accountants SET client_id = m.new_id FROM id_mapping m WHERE client_accountants.client_id = m.old_id;
-- UPDATE public.client_accountants SET accountant_id = m.new_id FROM id_mapping m WHERE client_accountants.accountant_id = m.old_id;
-- UPDATE public.client_invitations SET client_id = m.new_id FROM id_mapping m WHERE client_invitations.client_id = m.old_id;
-- UPDATE public.client_invitations SET accountant_id = m.new_id FROM id_mapping m WHERE client_invitations.accountant_id = m.old_id;
-- UPDATE public.client_invitations SET invited_by = m.new_id FROM id_mapping m WHERE client_invitations.invited_by = m.old_id;
-- UPDATE public.category_preferences SET user_id = m.new_id FROM id_mapping m WHERE category_preferences.user_id = m.old_id;
-- UPDATE public.classification_rules SET user_id = m.new_id FROM id_mapping m WHERE classification_rules.user_id = m.old_id;
-- UPDATE public.classification_examples SET user_id = m.new_id FROM id_mapping m WHERE classification_examples.user_id = m.old_id;
-- UPDATE public.notification_preferences SET user_id = m.new_id FROM id_mapping m WHERE notification_preferences.user_id = m.old_id;
-- UPDATE public.push_subscriptions SET user_id = m.new_id FROM id_mapping m WHERE push_subscriptions.user_id = m.old_id;
-- UPDATE public.sent_notifications SET user_id = m.new_id FROM id_mapping m WHERE sent_notifications.user_id = m.old_id;
-- UPDATE public.user_onboarding_progress SET user_id = m.new_id FROM id_mapping m WHERE user_onboarding_progress.user_id = m.old_id;
-- UPDATE public.upload_queue SET client_id = m.new_id FROM id_mapping m WHERE upload_queue.client_id = m.old_id;
-- UPDATE public.at_sync_history SET user_id = m.new_id FROM id_mapping m WHERE at_sync_history.user_id = m.old_id;
-- UPDATE public.at_sync_history SET client_id = m.new_id FROM id_mapping m WHERE at_sync_history.client_id = m.old_id;
-- UPDATE public.at_sync_jobs SET client_id = m.new_id FROM id_mapping m WHERE at_sync_jobs.client_id = m.old_id;
-- UPDATE public.at_sync_year_overrides SET accountant_id = m.new_id FROM id_mapping m WHERE at_sync_year_overrides.accountant_id = m.old_id;
-- UPDATE public.at_sync_automation_runs SET accountant_id = m.new_id FROM id_mapping m WHERE at_sync_automation_runs.accountant_id = m.old_id;
-- UPDATE public.at_withholding_candidates SET client_id = m.new_id FROM id_mapping m WHERE at_withholding_candidates.client_id = m.old_id;
-- UPDATE public.at_withholding_candidates SET accountant_id = m.new_id FROM id_mapping m WHERE at_withholding_candidates.accountant_id = m.old_id;
-- UPDATE public.at_withholding_candidates SET reviewed_by = m.new_id FROM id_mapping m WHERE at_withholding_candidates.reviewed_by = m.old_id;
-- UPDATE public.ss_declarations SET user_id = m.new_id FROM id_mapping m WHERE ss_declarations.user_id = m.old_id;
-- UPDATE public.withholding_logs SET user_id = m.new_id FROM id_mapping m WHERE withholding_logs.user_id = m.old_id;
-- UPDATE public.invoice_validation_logs SET user_id = m.new_id FROM id_mapping m WHERE invoice_validation_logs.user_id = m.old_id;

-- Verify
-- SELECT 'Done! Check row counts:' AS status;

DROP TABLE id_mapping;
