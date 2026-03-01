# Data Migration: Lovable Cloud → Supabase (dmprkdvkzzjtixlatnlx)

## Overview

Schema (tables, functions, RLS, triggers) is already applied via 94 migrations.
This guide migrates the **data** (rows, users, storage files).

## Table Import Order (respects foreign keys)

### Tier 0 — Users (must be first)
Export from Lovable Cloud > Users tab:
- auth.users (emails + IDs — passwords cannot be exported)

### Tier 1 — Root tables (depend only on auth.users)
1. `profiles` (id = auth.users.id, 1:1)
2. `user_roles` (user_id → auth.users)
3. `partners` (no user FK)
4. `internal_webhook_keys` (no user FK)
5. `ai_metrics` (no user FK)

### Tier 2 — Core data tables (depend on profiles)
6. `invoices` (user_id, client_id → profiles)
7. `tax_withholdings` (user_id → auth.users, client_id → profiles)
8. `sales_invoices` (user_id → auth.users)
9. `at_credentials` (user_id → auth.users)
10. `accountant_at_config` (accountant_id → auth.users)
11. `accountant_requests` (user_id → auth.users)
12. `notification_preferences` (user_id → auth.users)
13. `push_subscriptions` (user_id → auth.users)
14. `category_preferences` (user_id → auth.users)
15. `classification_rules` (user_id → auth.users)
16. `classification_examples` (user_id → auth.users)
17. `user_onboarding_progress` (user_id → auth.users)
18. `ss_declarations` (user_id)
19. `revenue_entries` (user_id)
20. `upload_queue` (client_id → auth.users)

### Tier 3 — Relationship tables
21. `client_accountants` (client_id, accountant_id → profiles)
22. `client_invitations` (client_id, accountant_id → profiles)

### Tier 4 — Child/dependent tables
23. `invoice_vat_lines` (invoice_id → invoices)
24. `invoice_validation_logs` (invoice_id → invoices)
25. `withholding_logs` (withholding_id → tax_withholdings)
26. `at_sync_history` (user_id, client_id)
27. `at_sync_jobs` (client_id, sync_history_id → at_sync_history)
28. `at_sync_year_overrides` (accountant_id → profiles)
29. `at_sync_override_audit` (override_id → at_sync_year_overrides)
30. `at_sync_automation_runs` (accountant_id)
31. `at_withholding_candidates` (client_id → profiles)
32. `sent_notifications` (user_id)

### Storage Buckets
- `invoices` (private) — uploaded invoice images/PDFs
- `upload-queue` (private) — pending uploads
- `partner-logos` (public)

## Strategy: Preserve User IDs

Instead of creating new users and remapping all IDs, we use the Supabase Admin API
to create users with the **same UUIDs** they had in Lovable. This eliminates the
need for any ID mapping across 30+ tables.

## Step-by-Step

### 1. Export from Lovable Cloud

In Lovable editor > Cloud > Database:
- Export EVERY table as CSV
- Also go to Cloud > Users — note each user's email and UUID

### 2. Run migration script (see migrate-data.sql)

### 3. Migrate storage files manually
- Download from Lovable Cloud > Storage
- Upload to new Supabase > Storage (same bucket/path structure)
