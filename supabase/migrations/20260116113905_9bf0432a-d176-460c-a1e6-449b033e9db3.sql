-- Function for clients to remove an accountant from their profile
CREATE OR REPLACE FUNCTION public.remove_client_accountant(p_accountant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  association_exists BOOLEAN;
  was_primary BOOLEAN;
BEGIN
  -- Check if association exists for this client
  SELECT EXISTS (
    SELECT 1 FROM client_accountants 
    WHERE client_id = auth.uid() AND accountant_id = p_accountant_id
  ) INTO association_exists;
  
  IF NOT association_exists THEN
    RAISE EXCEPTION 'Este contabilista não está associado à sua conta';
  END IF;
  
  -- Check if was primary
  SELECT is_primary INTO was_primary
  FROM client_accountants
  WHERE client_id = auth.uid() AND accountant_id = p_accountant_id;
  
  -- Remove association
  DELETE FROM client_accountants 
  WHERE client_id = auth.uid() AND accountant_id = p_accountant_id;
  
  -- If was primary, update legacy field and promote another accountant if exists
  IF was_primary THEN
    UPDATE profiles SET accountant_id = (
      SELECT accountant_id FROM client_accountants 
      WHERE client_id = auth.uid() 
      ORDER BY created_at ASC 
      LIMIT 1
    ) WHERE id = auth.uid();
    
    -- Make the next accountant primary if exists
    UPDATE client_accountants 
    SET is_primary = true 
    WHERE client_id = auth.uid() 
    AND accountant_id = (
      SELECT accountant_id FROM client_accountants 
      WHERE client_id = auth.uid() 
      ORDER BY created_at ASC 
      LIMIT 1
    );
  END IF;
  
  RETURN TRUE;
END;
$$;