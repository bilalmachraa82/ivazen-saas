-- Fix Storage RLS policies for invoices bucket
-- Problem: Accountant policies only check profiles.accountant_id (legacy single-accountant column).
-- The system now uses client_accountants (many-to-many), but storage policies were never updated.
-- This migration drops all existing policies and recreates them with three access paths:
--   1. Owner (user's own files)
--   2. Legacy accountant_id on profiles
--   3. Many-to-many client_accountants table

-- ============================================================================
-- Step 1: Drop ALL existing storage policies for the invoices bucket
-- ============================================================================

-- From migration 20251207235732
DROP POLICY IF EXISTS "Users can upload their own invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON storage.objects;
DROP POLICY IF EXISTS "Accountants can view client invoices" ON storage.objects;

-- From migration 20251222165653
DROP POLICY IF EXISTS "Accountants can upload client invoices" ON storage.objects;
DROP POLICY IF EXISTS "Accountants can update client invoices" ON storage.objects;
DROP POLICY IF EXISTS "Accountants can delete client invoices" ON storage.objects;

-- ============================================================================
-- Step 2: Create comprehensive policies with all three access paths
-- ============================================================================

-- SELECT: View/download invoice files
CREATE POLICY "invoices_select_policy"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'invoices'
  AND (
    -- Path 1: Owner — user's own files
    (storage.foldername(name))[1] = auth.uid()::text
    -- Path 2: Legacy accountant_id on profiles
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.accountant_id = auth.uid()
    )
    -- Path 3: Many-to-many client_accountants
    OR EXISTS (
      SELECT 1 FROM public.client_accountants ca
      WHERE ca.client_id::text = (storage.foldername(name))[1]
        AND ca.accountant_id = auth.uid()
    )
  )
);

-- INSERT: Upload invoice files
CREATE POLICY "invoices_insert_policy"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'invoices'
  AND (
    -- Path 1: Owner — user's own files
    (storage.foldername(name))[1] = auth.uid()::text
    -- Path 2: Legacy accountant_id on profiles
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.accountant_id = auth.uid()
    )
    -- Path 3: Many-to-many client_accountants
    OR EXISTS (
      SELECT 1 FROM public.client_accountants ca
      WHERE ca.client_id::text = (storage.foldername(name))[1]
        AND ca.accountant_id = auth.uid()
    )
  )
);

-- UPDATE: Update/replace invoice files (needed for upserts)
CREATE POLICY "invoices_update_policy"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'invoices'
  AND (
    -- Path 1: Owner — user's own files
    (storage.foldername(name))[1] = auth.uid()::text
    -- Path 2: Legacy accountant_id on profiles
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.accountant_id = auth.uid()
    )
    -- Path 3: Many-to-many client_accountants
    OR EXISTS (
      SELECT 1 FROM public.client_accountants ca
      WHERE ca.client_id::text = (storage.foldername(name))[1]
        AND ca.accountant_id = auth.uid()
    )
  )
);

-- DELETE: Remove invoice files
CREATE POLICY "invoices_delete_policy"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'invoices'
  AND (
    -- Path 1: Owner — user's own files
    (storage.foldername(name))[1] = auth.uid()::text
    -- Path 2: Legacy accountant_id on profiles
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.accountant_id = auth.uid()
    )
    -- Path 3: Many-to-many client_accountants
    OR EXISTS (
      SELECT 1 FROM public.client_accountants ca
      WHERE ca.client_id::text = (storage.foldername(name))[1]
        AND ca.accountant_id = auth.uid()
    )
  )
);
