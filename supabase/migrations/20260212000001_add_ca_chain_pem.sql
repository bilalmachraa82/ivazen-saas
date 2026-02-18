-- Add CA certificate chain column to accountant_at_config
-- Stores PEM-encoded DGITA Root CA certificate(s) for AT TLS trust
-- AT uses a private Certificate Authority (DGITA) not in standard trust stores
ALTER TABLE public.accountant_at_config
ADD COLUMN IF NOT EXISTS ca_chain_pem text;
