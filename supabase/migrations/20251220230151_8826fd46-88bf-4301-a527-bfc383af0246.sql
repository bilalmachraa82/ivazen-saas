-- CRITICAL SECURITY FIX: Remove unused gemini_api_key column
-- This column stored API keys client-side which is a security risk
-- The app now uses LOVABLE_API_KEY as a secure server-side secret

ALTER TABLE public.profiles DROP COLUMN IF EXISTS gemini_api_key;