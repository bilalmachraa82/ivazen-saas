-- Add taxpayer_kind to profiles for fiscal UX adaptation
-- Values: 'eni' (ENI/independent), 'company' (empresa), 'mixed' (ambos)
-- Nullable: when NULL, the app infers from worker_type + data patterns

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS taxpayer_kind text
  CONSTRAINT profiles_taxpayer_kind_check
  CHECK (taxpayer_kind IS NULL OR taxpayer_kind IN ('eni', 'company', 'mixed'));

COMMENT ON COLUMN profiles.taxpayer_kind IS
  'Fiscal taxpayer type: eni (ENI/independent → IVA+SS), company (empresa → IVA+Modelo10), mixed (both). NULL = inferred at runtime.';
