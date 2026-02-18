-- Adicionar campo para email de contacto AT (usado no CSR)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS at_contact_email text;

COMMENT ON COLUMN public.profiles.at_contact_email IS 
  'Email de contacto para comunicações com a AT (usado no CSR)';