-- Add income_code column to tax_withholdings table to persist selected income codes
ALTER TABLE public.tax_withholdings 
ADD COLUMN income_code text;