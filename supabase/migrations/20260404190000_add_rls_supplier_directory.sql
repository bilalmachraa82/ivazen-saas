-- Enable RLS on supplier_directory and _revenue_category_cleanup_evidence
-- Fixes HIGH security vulnerability: both tables were exposed via PostgREST
-- without any row-level security policies.

-- ============================================================
-- 1. supplier_directory — reference data (NIF, name, CAE, activity)
-- ============================================================

ALTER TABLE supplier_directory ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read (it is shared reference data)
CREATE POLICY "Authenticated users can read supplier directory"
  ON supplier_directory
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role may insert (populated by edge functions / scripts)
CREATE POLICY "Service role can insert into supplier directory"
  ON supplier_directory
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service_role may update
CREATE POLICY "Service role can update supplier directory"
  ON supplier_directory
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Only service_role may delete
CREATE POLICY "Service role can delete from supplier directory"
  ON supplier_directory
  FOR DELETE
  TO service_role
  USING (true);

-- ============================================================
-- 2. _revenue_category_cleanup_evidence — internal audit table
--    No public access at all; service_role only.
-- ============================================================

ALTER TABLE _revenue_category_cleanup_evidence ENABLE ROW LEVEL SECURITY;

-- service_role full access (needed for migration scripts / admin queries)
CREATE POLICY "Service role full access to cleanup evidence"
  ON _revenue_category_cleanup_evidence
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
