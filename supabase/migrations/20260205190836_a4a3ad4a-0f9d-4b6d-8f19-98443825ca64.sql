-- Drop existing functions to allow return type change
DROP FUNCTION IF EXISTS public.get_accountant_clients(uuid);
DROP FUNCTION IF EXISTS public.search_available_clients(text);

-- Recreate get_accountant_clients with phone and address
CREATE FUNCTION public.get_accountant_clients(accountant_uuid uuid)
RETURNS TABLE(
    id uuid, 
    full_name text, 
    company_name text, 
    nif text, 
    email text, 
    phone text,
    address text,
    pending_invoices bigint, 
    validated_invoices bigint, 
    access_level text, 
    is_primary boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.company_name,
        p.nif,
        p.email,
        p.phone,
        p.address,
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'pending'), 0),
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0),
        ca.access_level,
        ca.is_primary
    FROM client_accountants ca
    JOIN profiles p ON p.id = ca.client_id
    WHERE ca.accountant_id = accountant_uuid;
END;
$$;

-- Recreate search_available_clients with phone and address
CREATE FUNCTION public.search_available_clients(search_term text)
RETURNS TABLE(
    id uuid, 
    full_name text, 
    nif text, 
    email text, 
    company_name text, 
    phone text,
    address text,
    already_associated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.nif,
    p.email,
    p.company_name,
    p.phone,
    p.address,
    EXISTS (
      SELECT 1 FROM client_accountants ca 
      WHERE ca.client_id = p.id AND ca.accountant_id = auth.uid()
    ) AS already_associated
  FROM profiles p
  WHERE 
    p.id != auth.uid()
    AND (
      p.full_name ILIKE '%' || search_term || '%'
      OR p.nif ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
      OR p.company_name ILIKE '%' || search_term || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM client_accountants ca 
      WHERE ca.client_id = p.id AND ca.accountant_id = auth.uid()
    )
  ORDER BY p.full_name
  LIMIT 20;
END;
$$;