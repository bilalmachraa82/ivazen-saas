-- =====================================================
-- Fix Adélia's Client Management: RLS + Backfill + Sync
-- =====================================================

-- 1) DROP existing restrictive policies on profiles for accountants
DROP POLICY IF EXISTS "Accountants can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Accountants can update client profiles" ON profiles;

-- 2) CREATE new policies based on client_accountants table (many-to-many model)

-- Accountants can SELECT profiles of clients they are associated with
CREATE POLICY "Accountants can view client profiles via association"
ON profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'accountant') 
  AND EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = profiles.id
    AND ca.accountant_id = auth.uid()
  )
);

-- Accountants can UPDATE profiles of clients they are associated with (full access)
CREATE POLICY "Accountants can update client profiles via association"
ON profiles FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'accountant') 
  AND EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = profiles.id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'accountant') 
  AND EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = profiles.id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- 3) BACKFILL: Insert missing associations from profiles.accountant_id into client_accountants
INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
SELECT 
  p.id AS client_id,
  p.accountant_id AS accountant_id,
  'full' AS access_level,
  TRUE AS is_primary,
  p.accountant_id AS invited_by
FROM profiles p
WHERE p.accountant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = p.id
    AND ca.accountant_id = p.accountant_id
  );

-- 4) CREATE sync trigger function: when profiles.accountant_id changes, sync to client_accountants
CREATE OR REPLACE FUNCTION sync_accountant_id_to_client_accountants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If accountant_id is being set or changed
  IF NEW.accountant_id IS NOT NULL AND (OLD.accountant_id IS DISTINCT FROM NEW.accountant_id) THEN
    -- Unmark previous primary if different accountant
    IF OLD.accountant_id IS NOT NULL AND OLD.accountant_id != NEW.accountant_id THEN
      UPDATE client_accountants
      SET is_primary = FALSE
      WHERE client_id = NEW.id AND accountant_id = OLD.accountant_id;
    END IF;
    
    -- Upsert new primary accountant
    INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
    VALUES (NEW.id, NEW.accountant_id, 'full', TRUE, NEW.accountant_id)
    ON CONFLICT (client_id, accountant_id) DO UPDATE
    SET is_primary = TRUE, access_level = 'full';
  END IF;
  
  -- If accountant_id is being cleared
  IF NEW.accountant_id IS NULL AND OLD.accountant_id IS NOT NULL THEN
    UPDATE client_accountants
    SET is_primary = FALSE
    WHERE client_id = NEW.id AND accountant_id = OLD.accountant_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5) CREATE the trigger
DROP TRIGGER IF EXISTS trigger_sync_accountant_to_client_accountants ON profiles;
CREATE TRIGGER trigger_sync_accountant_to_client_accountants
  AFTER UPDATE OF accountant_id ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_accountant_id_to_client_accountants();