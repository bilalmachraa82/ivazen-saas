-- Add all 7 income categories to tax_withholdings table
-- This migration extends the income_category constraint to support all Modelo 10 categories

-- First, drop the existing constraint
ALTER TABLE public.tax_withholdings
DROP CONSTRAINT IF EXISTS tax_withholdings_income_category_check;

-- Add the new constraint with all 7 categories
ALTER TABLE public.tax_withholdings
ADD CONSTRAINT tax_withholdings_income_category_check
CHECK (income_category IN ('A', 'B', 'E', 'F', 'G', 'H', 'R'));

-- Update table comment to reflect supported categories
COMMENT ON COLUMN public.tax_withholdings.income_category IS
'Categoria de Rendimento (Modelo 10):
A = Trabalho Dependente (salários, ordenados)
B = Trabalho Independente (recibos verdes, prestadores de serviços)
E = Rendimentos de Capitais (juros, dividendos, lucros)
F = Rendimentos Prediais (rendas de imóveis)
G = Incrementos Patrimoniais (mais-valias)
H = Pensões (reforma, velhice, invalidez, alimentos)
R = Retenções IRC (rendimentos a pessoas coletivas)';
