-- Auto-grant client access for accounting office team members
-- When a new user signs up with @accountingadvantage.pt email:
-- 1. They get the 'accountant' role
-- 2. They get access to all clients that the primary accountant (Adelia) has

-- Function: on new user signup, if email matches office domain, grant full access
CREATE OR REPLACE FUNCTION public.auto_grant_office_clients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _office_domain text := 'accountingadvantage.pt';
  _primary_accountant_id uuid;
  _inserted_count int := 0;
BEGIN
  -- Only proceed if the new user's email matches the office domain
  IF NEW.email IS NULL OR NOT NEW.email LIKE '%@' || _office_domain THEN
    RETURN NEW;
  END IF;

  -- Ensure user has the accountant role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'accountant')
  ON CONFLICT DO NOTHING;

  -- Also ensure client role (all office users are also clients)
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;

  -- Find the primary accountant (Adelia) - the one with most clients
  SELECT accountant_id INTO _primary_accountant_id
  FROM client_accountants
  GROUP BY accountant_id
  ORDER BY count(*) DESC
  LIMIT 1;

  IF _primary_accountant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Grant access to all clients the primary accountant has
  INSERT INTO client_accountants (accountant_id, client_id, access_level, is_primary)
  SELECT NEW.id, ca.client_id, 'full', false
  FROM client_accountants ca
  WHERE ca.accountant_id = _primary_accountant_id
    AND ca.client_id != NEW.id  -- don't self-reference
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS _inserted_count = ROW_COUNT;

  RAISE LOG 'auto_grant_office_clients: granted % clients to % (%)',
    _inserted_count, NEW.email, NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert (new signup)
DROP TRIGGER IF EXISTS trg_auto_grant_office_clients ON auth.users;
CREATE TRIGGER trg_auto_grant_office_clients
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_grant_office_clients();

-- Also handle when a new client is added to Adelia (primary accountant):
-- automatically propagate to all office team members
CREATE OR REPLACE FUNCTION public.propagate_client_to_office()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _office_domain text := 'accountingadvantage.pt';
  _accountant_email text;
BEGIN
  -- Check if the accountant adding this client is from the office
  SELECT email INTO _accountant_email
  FROM auth.users
  WHERE id = NEW.accountant_id;

  IF _accountant_email IS NULL OR NOT _accountant_email LIKE '%@' || _office_domain THEN
    RETURN NEW;
  END IF;

  -- Propagate to all other office accountants
  INSERT INTO client_accountants (accountant_id, client_id, access_level, is_primary)
  SELECT u.id, NEW.client_id, 'full', false
  FROM auth.users u
  JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'accountant'
  WHERE u.email LIKE '%@' || _office_domain
    AND u.id != NEW.accountant_id
    AND u.id != NEW.client_id  -- don't self-reference
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger on client_accountants insert
DROP TRIGGER IF EXISTS trg_propagate_client_to_office ON client_accountants;
CREATE TRIGGER trg_propagate_client_to_office
  AFTER INSERT ON client_accountants
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_client_to_office();
