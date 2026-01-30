-- Add gemini_api_key column to profiles table for custom API key storage
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.gemini_api_key IS 'User custom Gemini API key for using Gemini 3 Flash directly';