-- Table for accountant registration requests
CREATE TABLE public.accountant_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  occ_number TEXT, -- Ordem dos Contabilistas Certificados
  cedula_number TEXT, -- Número de cédula profissional
  company_name TEXT,
  tax_office TEXT, -- Repartição de Finanças
  specializations TEXT[], -- Áreas de especialização
  years_experience INTEGER,
  motivation TEXT, -- Razão para se registar
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT, -- Notas do admin sobre a decisão
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accountant_requests ENABLE ROW LEVEL SECURITY;

-- Users can view and insert their own requests
CREATE POLICY "Users can view own request"
ON public.accountant_requests
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own request"
ON public.accountant_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update pending request"
ON public.accountant_requests
FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending');

-- Admins can view and manage all requests
CREATE POLICY "Admins can view all requests"
ON public.accountant_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all requests"
ON public.accountant_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Function for admin to approve an accountant request
CREATE OR REPLACE FUNCTION public.approve_accountant_request(request_id uuid, p_admin_notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  request_user_id UUID;
  is_admin BOOLEAN;
BEGIN
  -- Check if caller is admin
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar pedidos';
  END IF;
  
  -- Get the user_id from the request
  SELECT user_id INTO request_user_id
  FROM accountant_requests
  WHERE id = request_id AND status = 'pending';
  
  IF request_user_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;
  
  -- Update request status
  UPDATE accountant_requests
  SET 
    status = 'approved',
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = request_id;
  
  -- Grant accountant role
  INSERT INTO user_roles (user_id, role)
  VALUES (request_user_id, 'accountant')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- Function for admin to reject an accountant request
CREATE OR REPLACE FUNCTION public.reject_accountant_request(request_id uuid, p_admin_notes text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if caller is admin
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem rejeitar pedidos';
  END IF;
  
  -- Update request status
  UPDATE accountant_requests
  SET 
    status = 'rejected',
    admin_notes = p_admin_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to check if user has pending accountant request
CREATE OR REPLACE FUNCTION public.get_my_accountant_request()
RETURNS TABLE(
  id uuid,
  status text,
  occ_number text,
  cedula_number text,
  admin_notes text,
  created_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id,
    ar.status,
    ar.occ_number,
    ar.cedula_number,
    CASE WHEN ar.status != 'pending' THEN ar.admin_notes ELSE NULL END,
    ar.created_at,
    ar.reviewed_at
  FROM accountant_requests ar
  WHERE ar.user_id = auth.uid()
  ORDER BY ar.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to get all pending requests for admins
CREATE OR REPLACE FUNCTION public.get_pending_accountant_requests()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  occ_number text,
  cedula_number text,
  company_name text,
  tax_office text,
  specializations text[],
  years_experience integer,
  motivation text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ar.id,
    ar.user_id,
    p.full_name,
    p.email,
    ar.occ_number,
    ar.cedula_number,
    ar.company_name,
    ar.tax_office,
    ar.specializations,
    ar.years_experience,
    ar.motivation,
    ar.created_at
  FROM accountant_requests ar
  JOIN profiles p ON p.id = ar.user_id
  WHERE ar.status = 'pending'
  ORDER BY ar.created_at ASC;
END;
$$;