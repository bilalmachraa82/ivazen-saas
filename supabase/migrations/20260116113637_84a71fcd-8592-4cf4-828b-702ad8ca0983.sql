-- Drop and recreate functions with new signatures
DROP FUNCTION IF EXISTS public.get_accountant_clients(uuid);
DROP FUNCTION IF EXISTS public.associate_client(uuid);
DROP FUNCTION IF EXISTS public.remove_client(uuid);

-- Update associate_client function to use new table
CREATE OR REPLACE FUNCTION public.associate_client(client_uuid uuid, p_access_level text DEFAULT 'full', p_is_primary boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_accountant BOOLEAN;
  client_exists BOOLEAN;
  already_associated BOOLEAN;
BEGIN
  -- Check if current user is an accountant
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accountant'
  ) INTO is_accountant;
  
  IF NOT is_accountant THEN
    RAISE EXCEPTION 'Apenas contabilistas podem associar clientes';
  END IF;
  
  -- Check if client exists
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = client_uuid
  ) INTO client_exists;
  
  IF NOT client_exists THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  
  -- Check if already associated
  SELECT EXISTS (
    SELECT 1 FROM client_accountants 
    WHERE client_id = client_uuid AND accountant_id = auth.uid()
  ) INTO already_associated;
  
  IF already_associated THEN
    RAISE EXCEPTION 'Este cliente já está associado a si';
  END IF;
  
  -- If this is the first accountant for this client, make them primary
  IF NOT EXISTS (SELECT 1 FROM client_accountants WHERE client_id = client_uuid) THEN
    p_is_primary := true;
  END IF;
  
  -- Insert the association
  INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
  VALUES (client_uuid, auth.uid(), p_access_level, p_is_primary, auth.uid());
  
  -- Also update legacy field for backwards compatibility
  IF p_is_primary THEN
    UPDATE profiles SET accountant_id = auth.uid() WHERE id = client_uuid;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Update remove_client function to use new table
CREATE OR REPLACE FUNCTION public.remove_client(client_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_accountant BOOLEAN;
  is_associated BOOLEAN;
  was_primary BOOLEAN;
BEGIN
  -- Check if current user is an accountant
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accountant'
  ) INTO is_accountant;
  
  IF NOT is_accountant THEN
    RAISE EXCEPTION 'Apenas contabilistas podem remover clientes';
  END IF;
  
  -- Check if client is associated with this accountant
  SELECT EXISTS (
    SELECT 1 FROM client_accountants 
    WHERE client_id = client_uuid AND accountant_id = auth.uid()
  ) INTO is_associated;
  
  IF NOT is_associated THEN
    RAISE EXCEPTION 'Este cliente não está na sua carteira';
  END IF;
  
  -- Check if was primary
  SELECT is_primary INTO was_primary
  FROM client_accountants
  WHERE client_id = client_uuid AND accountant_id = auth.uid();
  
  -- Remove association
  DELETE FROM client_accountants 
  WHERE client_id = client_uuid AND accountant_id = auth.uid();
  
  -- If was primary, update legacy field and promote another accountant if exists
  IF was_primary THEN
    UPDATE profiles SET accountant_id = (
      SELECT accountant_id FROM client_accountants 
      WHERE client_id = client_uuid 
      ORDER BY created_at ASC 
      LIMIT 1
    ) WHERE id = client_uuid;
    
    -- Make the next accountant primary if exists
    UPDATE client_accountants 
    SET is_primary = true 
    WHERE client_id = client_uuid 
    AND accountant_id = (SELECT accountant_id FROM client_accountants WHERE client_id = client_uuid ORDER BY created_at ASC LIMIT 1);
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Update get_accountant_clients to use new table with new return type
CREATE OR REPLACE FUNCTION public.get_accountant_clients(accountant_uuid uuid)
RETURNS TABLE(
  id uuid, 
  full_name text, 
  company_name text, 
  nif text, 
  email text, 
  pending_invoices bigint, 
  validated_invoices bigint,
  access_level text,
  is_primary boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate caller is the accountant or an admin
  IF accountant_uuid != auth.uid() AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Can only query own clients';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.company_name,
    p.nif,
    p.email,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status IN ('pending', 'classified')), 0) as pending_invoices,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0) as validated_invoices,
    ca.access_level,
    ca.is_primary
  FROM client_accountants ca
  JOIN profiles p ON p.id = ca.client_id
  WHERE ca.accountant_id = accountant_uuid;
END;
$$;

-- Function to get client's accountants
CREATE OR REPLACE FUNCTION public.get_client_accountants(client_uuid uuid)
RETURNS TABLE(
  id uuid,
  accountant_id uuid,
  full_name text,
  company_name text,
  nif text,
  email text,
  access_level text,
  is_primary boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate caller is the client, one of the accountants, or an admin
  IF client_uuid != auth.uid() 
    AND NOT EXISTS (SELECT 1 FROM client_accountants WHERE client_id = client_uuid AND accountant_id = auth.uid())
    AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ca.id,
    ca.accountant_id,
    p.full_name,
    p.company_name,
    p.nif,
    p.email,
    ca.access_level,
    ca.is_primary,
    ca.created_at
  FROM client_accountants ca
  JOIN profiles p ON p.id = ca.accountant_id
  WHERE ca.client_id = client_uuid
  ORDER BY ca.is_primary DESC, ca.created_at ASC;
END;
$$;

-- Function for primary accountant to invite another accountant
CREATE OR REPLACE FUNCTION public.invite_accountant_to_client(
  client_uuid uuid,
  accountant_nif text,
  p_access_level text DEFAULT 'full'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_primary_accountant BOOLEAN;
  target_accountant_id UUID;
BEGIN
  -- Check if current user is the primary accountant for this client
  SELECT EXISTS (
    SELECT 1 FROM client_accountants 
    WHERE client_id = client_uuid 
    AND accountant_id = auth.uid() 
    AND is_primary = true
  ) INTO is_primary_accountant;
  
  IF NOT is_primary_accountant THEN
    RAISE EXCEPTION 'Apenas o contabilista principal pode convidar outros contabilistas';
  END IF;
  
  -- Find the accountant by NIF
  SELECT p.id INTO target_accountant_id
  FROM profiles p
  JOIN user_roles ur ON p.id = ur.user_id
  WHERE p.nif = accountant_nif AND ur.role = 'accountant';
  
  IF target_accountant_id IS NULL THEN
    RAISE EXCEPTION 'Contabilista não encontrado com este NIF';
  END IF;
  
  -- Check if already associated
  IF EXISTS (SELECT 1 FROM client_accountants WHERE client_id = client_uuid AND accountant_id = target_accountant_id) THEN
    RAISE EXCEPTION 'Este contabilista já tem acesso a este cliente';
  END IF;
  
  -- Insert association
  INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
  VALUES (client_uuid, target_accountant_id, p_access_level, false, auth.uid());
  
  RETURN TRUE;
END;
$$;