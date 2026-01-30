-- Drop the existing trigger that blocks accountant_id changes
DROP TRIGGER IF EXISTS protect_accountant_id_trigger ON profiles;
DROP FUNCTION IF EXISTS protect_accountant_id();

-- Create function to search available clients (without accountant)
CREATE OR REPLACE FUNCTION public.search_available_clients(search_term TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  company_name TEXT,
  nif TEXT,
  email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.company_name, p.nif, p.email
  FROM profiles p
  JOIN user_roles ur ON p.id = ur.user_id
  WHERE ur.role = 'client'
    AND p.accountant_id IS NULL
    AND p.id != auth.uid()
    AND (
      p.nif ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
      OR p.full_name ILIKE '%' || search_term || '%'
      OR p.company_name ILIKE '%' || search_term || '%'
    )
  LIMIT 20;
$$;

-- Create function to get accountant's clients
CREATE OR REPLACE FUNCTION public.get_accountant_clients(accountant_uuid UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  company_name TEXT,
  nif TEXT,
  email TEXT,
  pending_invoices BIGINT,
  validated_invoices BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.company_name,
    p.nif,
    p.email,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status IN ('pending', 'classified')), 0) as pending_invoices,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0) as validated_invoices
  FROM profiles p
  WHERE p.accountant_id = accountant_uuid;
$$;

-- Create function for accountant to associate a client
CREATE OR REPLACE FUNCTION public.associate_client(client_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_accountant BOOLEAN;
  client_has_accountant BOOLEAN;
BEGIN
  -- Check if current user is an accountant
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accountant'
  ) INTO is_accountant;
  
  IF NOT is_accountant THEN
    RAISE EXCEPTION 'Apenas contabilistas podem associar clientes';
  END IF;
  
  -- Check if client already has an accountant
  SELECT accountant_id IS NOT NULL INTO client_has_accountant
  FROM profiles WHERE id = client_uuid;
  
  IF client_has_accountant THEN
    RAISE EXCEPTION 'Este cliente já está associado a um contabilista';
  END IF;
  
  -- Associate the client
  UPDATE profiles SET accountant_id = auth.uid() WHERE id = client_uuid;
  
  RETURN TRUE;
END;
$$;

-- Create function for accountant to remove a client
CREATE OR REPLACE FUNCTION public.remove_client(client_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_accountant BOOLEAN;
  is_my_client BOOLEAN;
BEGIN
  -- Check if current user is an accountant
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accountant'
  ) INTO is_accountant;
  
  IF NOT is_accountant THEN
    RAISE EXCEPTION 'Apenas contabilistas podem remover clientes';
  END IF;
  
  -- Check if client belongs to this accountant
  SELECT accountant_id = auth.uid() INTO is_my_client
  FROM profiles WHERE id = client_uuid;
  
  IF NOT is_my_client THEN
    RAISE EXCEPTION 'Este cliente não está na sua carteira';
  END IF;
  
  -- Remove association
  UPDATE profiles SET accountant_id = NULL WHERE id = client_uuid;
  
  RETURN TRUE;
END;
$$;

-- Create function for client to remove their accountant association
CREATE OR REPLACE FUNCTION public.remove_my_accountant()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET accountant_id = NULL WHERE id = auth.uid();
  RETURN TRUE;
END;
$$;