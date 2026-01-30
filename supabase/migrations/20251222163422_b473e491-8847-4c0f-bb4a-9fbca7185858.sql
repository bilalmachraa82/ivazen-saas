-- Fix 1: Block anonymous access to profiles table
-- Add base authentication requirement for all operations
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Fix 2: Block anonymous access to revenue_entries table
CREATE POLICY "Require authentication for revenue_entries"
ON public.revenue_entries
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Fix 3: Add input validation to search_available_clients function
CREATE OR REPLACE FUNCTION public.search_available_clients(search_term text)
RETURNS TABLE(id uuid, full_name text, company_name text, nif text, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate input length
  IF LENGTH(search_term) > 100 THEN
    RAISE EXCEPTION 'Search term too long';
  END IF;
  
  -- Block dangerous LIKE patterns (potential DoS)
  IF search_term ~ '[%_]{4,}' THEN
    RAISE EXCEPTION 'Invalid search pattern';
  END IF;
  
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
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
END;
$$;

-- Fix 4: Add ownership validation to get_accountant_clients
CREATE OR REPLACE FUNCTION public.get_accountant_clients(accountant_uuid uuid)
RETURNS TABLE(id uuid, full_name text, company_name text, nif text, email text, pending_invoices bigint, validated_invoices bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0) as validated_invoices
  FROM profiles p
  WHERE p.accountant_id = accountant_uuid;
END;
$$;

-- Fix 5: Add NIF validation to update_ai_metrics
CREATE OR REPLACE FUNCTION public.update_ai_metrics(p_supplier_nif text, p_supplier_name text DEFAULT NULL::text, p_was_correction boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate NIF format (9 digits)
  IF p_supplier_nif !~ '^[0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid NIF format';
  END IF;
  
  -- Validate supplier name length if provided
  IF p_supplier_name IS NOT NULL AND LENGTH(p_supplier_name) > 200 THEN
    RAISE EXCEPTION 'Supplier name too long';
  END IF;

  INSERT INTO ai_metrics (
    supplier_nif, 
    supplier_name, 
    total_classifications, 
    total_corrections, 
    last_classification_at, 
    last_correction_at
  )
  VALUES (
    p_supplier_nif, 
    p_supplier_name, 
    1, 
    CASE WHEN p_was_correction THEN 1 ELSE 0 END,
    NOW(),
    CASE WHEN p_was_correction THEN NOW() ELSE NULL END
  )
  ON CONFLICT (supplier_nif) DO UPDATE SET
    total_classifications = ai_metrics.total_classifications + 1,
    total_corrections = ai_metrics.total_corrections + CASE WHEN p_was_correction THEN 1 ELSE 0 END,
    last_classification_at = NOW(),
    last_correction_at = CASE WHEN p_was_correction THEN NOW() ELSE ai_metrics.last_correction_at END,
    supplier_name = COALESCE(EXCLUDED.supplier_name, ai_metrics.supplier_name),
    updated_at = NOW();
END;
$$;