-- Adicionar coluna email à tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Criar função para sincronizar email do auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), NEW.email);
  
  -- Atribuir role padrão 'client'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$;

-- Criar função admin para obter emails dos utilizadores existentes
CREATE OR REPLACE FUNCTION public.sync_profile_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
END;
$$;

-- Executar sincronização inicial
SELECT public.sync_profile_emails();

-- Permitir admins usar a função de sync
GRANT EXECUTE ON FUNCTION public.sync_profile_emails() TO authenticated;