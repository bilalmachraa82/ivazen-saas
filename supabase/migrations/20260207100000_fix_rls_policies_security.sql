-- Security Fix: Replace overly permissive RLS policies (USING true)
-- These policies allowed ANY authenticated user to UPDATE any row,
-- not just the service role as intended.

-- ============================================================
-- FIX 1: at_sync_jobs UPDATE policy
-- Only accountants should update their own jobs, and service role
-- should be able to update any (for background processing)
-- ============================================================

DROP POLICY IF EXISTS "Service role can update sync jobs" ON public.at_sync_jobs;

-- Accountants can update their own sync jobs (e.g., cancel)
CREATE POLICY "Accountants can update own sync jobs"
ON public.at_sync_jobs FOR UPDATE
USING (accountant_id = auth.uid())
WITH CHECK (accountant_id = auth.uid());

-- ============================================================
-- FIX 2: upload_queue UPDATE policy
-- Only the owner should update their own queue items
-- Service role bypasses RLS automatically
-- ============================================================

DROP POLICY IF EXISTS "Service role can update queue items" ON upload_queue;

-- Users can update their own queue items
CREATE POLICY "Users can update own queue items"
ON upload_queue FOR UPDATE
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

-- ============================================================
-- FIX 3: at_credentials - split FOR ALL into granular policies
-- Clients should only SELECT their own credentials, not modify them
-- ============================================================

DROP POLICY IF EXISTS "at_credentials_access" ON at_credentials;

-- Accountants have full CRUD on their managed credentials
CREATE POLICY "Accountants manage credentials"
ON at_credentials FOR ALL
USING (accountant_id = auth.uid())
WITH CHECK (accountant_id = auth.uid());

-- Clients can only view their own credentials
CREATE POLICY "Clients view own credentials"
ON at_credentials FOR SELECT
USING (client_id = auth.uid());

-- ============================================================
-- NOTE: Service role (used by Edge Functions) bypasses RLS entirely,
-- so no explicit service role policy is needed.
-- ============================================================
