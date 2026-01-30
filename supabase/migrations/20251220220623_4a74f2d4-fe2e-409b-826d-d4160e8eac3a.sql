-- M10-002: Add support for non-resident beneficiaries
-- Adds is_non_resident flag and country_code for Modelo 10 compliance

ALTER TABLE public.tax_withholdings 
ADD COLUMN IF NOT EXISTS is_non_resident boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS country_code varchar(2);

-- Add comment for documentation
COMMENT ON COLUMN public.tax_withholdings.is_non_resident IS 'Whether the beneficiary is a non-resident for tax purposes';
COMMENT ON COLUMN public.tax_withholdings.country_code IS 'ISO 3166-1 alpha-2 country code for non-resident beneficiaries';