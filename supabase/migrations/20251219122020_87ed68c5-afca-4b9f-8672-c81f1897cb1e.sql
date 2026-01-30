-- Add new columns for SS calculation compliance
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS worker_type TEXT DEFAULT 'independent';
-- Values: 'independent', 'eni', 'eirl', 'agricultural'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accounting_regime TEXT DEFAULT 'simplified';
-- Values: 'simplified', 'organized'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_other_employment BOOLEAN DEFAULT false;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS other_employment_salary NUMERIC DEFAULT 0;
-- Average monthly salary from employed work (TCO)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS taxable_profit NUMERIC DEFAULT 0;
-- Taxable profit for organized accounting

-- Add comment for documentation
COMMENT ON COLUMN profiles.worker_type IS 'Type of independent worker: independent, eni, eirl, agricultural';
COMMENT ON COLUMN profiles.accounting_regime IS 'Accounting regime: simplified or organized';
COMMENT ON COLUMN profiles.has_other_employment IS 'Whether the worker also has employed work (TCO)';
COMMENT ON COLUMN profiles.other_employment_salary IS 'Average monthly salary from employed work';
COMMENT ON COLUMN profiles.taxable_profit IS 'Annual taxable profit for organized accounting regime';