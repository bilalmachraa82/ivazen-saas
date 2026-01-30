-- Criar tabela client_accountants para gerir relações contabilista-cliente
CREATE TABLE public.client_accountants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    accountant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    access_level text NOT NULL DEFAULT 'full',
    is_primary boolean NOT NULL DEFAULT false,
    invited_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(client_id, accountant_id)
);

-- Criar índices para performance
CREATE INDEX idx_client_accountants_client ON public.client_accountants(client_id);
CREATE INDEX idx_client_accountants_accountant ON public.client_accountants(accountant_id);

-- Habilitar RLS
ALTER TABLE public.client_accountants ENABLE ROW LEVEL SECURITY;

-- Políticas RLS

-- Contabilistas podem ver suas próprias associações
CREATE POLICY "Accountants can view own associations"
ON public.client_accountants
FOR SELECT
USING (accountant_id = auth.uid());

-- Clientes podem ver quem os gere
CREATE POLICY "Clients can view their accountants"
ON public.client_accountants
FOR SELECT
USING (client_id = auth.uid());

-- Admins podem ver tudo
CREATE POLICY "Admins can view all associations"
ON public.client_accountants
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Contabilistas podem criar associações
CREATE POLICY "Accountants can insert associations"
ON public.client_accountants
FOR INSERT
WITH CHECK (
    accountant_id = auth.uid() 
    AND has_role(auth.uid(), 'accountant'::app_role)
);

-- Contabilistas podem remover suas associações
CREATE POLICY "Accountants can delete own associations"
ON public.client_accountants
FOR DELETE
USING (accountant_id = auth.uid());

-- Clientes podem remover contabilistas
CREATE POLICY "Clients can delete their accountants"
ON public.client_accountants
FOR DELETE
USING (client_id = auth.uid());

-- Admins podem gerir tudo
CREATE POLICY "Admins can manage all associations"
ON public.client_accountants
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrar dados existentes: criar registos para clientes com accountant_id
INSERT INTO public.client_accountants (client_id, accountant_id, is_primary, access_level)
SELECT id, accountant_id, true, 'full'
FROM public.profiles
WHERE accountant_id IS NOT NULL
ON CONFLICT (client_id, accountant_id) DO NOTHING;

-- Actualizar função associate_client para usar a nova tabela
CREATE OR REPLACE FUNCTION public.associate_client(
    client_uuid uuid,
    p_access_level text DEFAULT 'full',
    p_is_primary boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accountant_id uuid;
BEGIN
    v_accountant_id := auth.uid();
    
    -- Verificar se é contabilista
    IF NOT has_role(v_accountant_id, 'accountant') THEN
        RAISE EXCEPTION 'Apenas contabilistas podem associar clientes';
    END IF;
    
    -- Verificar se o cliente existe
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = client_uuid) THEN
        RAISE EXCEPTION 'Cliente não encontrado';
    END IF;
    
    -- Inserir na tabela client_accountants
    INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
    VALUES (client_uuid, v_accountant_id, p_access_level, p_is_primary, v_accountant_id)
    ON CONFLICT (client_id, accountant_id) DO UPDATE
    SET access_level = EXCLUDED.access_level,
        is_primary = EXCLUDED.is_primary;
    
    -- Actualizar accountant_id no perfil se for primário
    IF p_is_primary THEN
        UPDATE profiles SET accountant_id = v_accountant_id WHERE id = client_uuid;
    END IF;
    
    RETURN true;
END;
$$;

-- Actualizar função remove_client
CREATE OR REPLACE FUNCTION public.remove_client(client_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accountant_id uuid;
BEGIN
    v_accountant_id := auth.uid();
    
    -- Remover da tabela client_accountants
    DELETE FROM client_accountants 
    WHERE client_id = client_uuid AND accountant_id = v_accountant_id;
    
    -- Se era primário, remover do perfil
    UPDATE profiles 
    SET accountant_id = NULL 
    WHERE id = client_uuid AND accountant_id = v_accountant_id;
    
    RETURN true;
END;
$$;

-- Actualizar função get_accountant_clients para usar a nova tabela
CREATE OR REPLACE FUNCTION public.get_accountant_clients(accountant_uuid uuid)
RETURNS TABLE (
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.company_name,
        p.nif,
        p.email,
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'pending'), 0) as pending_invoices,
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0) as validated_invoices,
        ca.access_level,
        ca.is_primary
    FROM client_accountants ca
    JOIN profiles p ON p.id = ca.client_id
    WHERE ca.accountant_id = accountant_uuid;
END;
$$;

-- Actualizar função get_client_accountants
CREATE OR REPLACE FUNCTION public.get_client_accountants(client_uuid uuid)
RETURNS TABLE (
    id uuid,
    accountant_id uuid,
    full_name text,
    company_name text,
    nif text,
    email text,
    access_level text,
    is_primary boolean,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    WHERE ca.client_id = client_uuid;
END;
$$;

-- Criar função remove_client_accountant (para clientes removerem contabilistas)
CREATE OR REPLACE FUNCTION public.remove_client_accountant(p_accountant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client_id uuid;
BEGIN
    v_client_id := auth.uid();
    
    -- Remover da tabela client_accountants
    DELETE FROM client_accountants 
    WHERE client_id = v_client_id AND accountant_id = p_accountant_id;
    
    -- Se era o accountant_id do perfil, limpar
    UPDATE profiles 
    SET accountant_id = NULL 
    WHERE id = v_client_id AND accountant_id = p_accountant_id;
    
    RETURN true;
END;
$$;