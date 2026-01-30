-- Add NISS column to profiles table for Social Security quick access
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS niss VARCHAR(11) NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.niss IS 'Número de Identificação da Segurança Social (11 digits)';