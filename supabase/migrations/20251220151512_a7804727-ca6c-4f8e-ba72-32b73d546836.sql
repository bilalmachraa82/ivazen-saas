-- Adicionar campos de rendimentos isentos e dispensados conforme Portaria n.º 4/2024
ALTER TABLE public.tax_withholdings 
ADD COLUMN IF NOT EXISTS exempt_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS dispensed_amount NUMERIC DEFAULT 0;

-- Adicionar categoria E (Rendimentos de Capitais) à lista de categorias válidas
-- Nota: Não existe CHECK constraint na tabela, então só precisamos atualizar o código