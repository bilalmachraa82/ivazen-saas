ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS iva_cadence text NOT NULL DEFAULT 'quarterly';

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_iva_cadence_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_iva_cadence_check
CHECK (iva_cadence IN ('monthly', 'quarterly'));

DROP FUNCTION IF EXISTS public.get_accountant_clients(uuid);

CREATE FUNCTION public.get_accountant_clients(accountant_uuid uuid)
RETURNS TABLE(
    id uuid,
    full_name text,
    company_name text,
    nif text,
    email text,
    phone text,
    address text,
    iva_cadence text,
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
        p.iva_cadence,
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'pending'), 0),
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0),
        ca.access_level,
        ca.is_primary
    FROM client_accountants ca
    JOIN profiles p ON p.id = ca.client_id
    WHERE ca.accountant_id = accountant_uuid;
END;
$$;
