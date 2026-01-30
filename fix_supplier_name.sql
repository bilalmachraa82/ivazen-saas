-- FIX: Adicionar coluna supplier_name à tabela sales_invoices
-- 
-- Bug identificado: O código tenta inserir em supplier_name na tabela sales_invoices,
-- mas essa coluna não existe. A tabela foi criada apenas com supplier_nif.
--
-- Para aplicar no Supabase Dashboard:
-- 1. Ir a https://supabase.com/dashboard/project/oqvvtcfvjkghrwaatprx/sql/new
-- 2. Colar este SQL
-- 3. Executar
--
-- Data: 2026-01-29
-- Criado por: Jarvis

-- Adicionar coluna supplier_name (nullable, já que é o nosso próprio nome/empresa)
ALTER TABLE public.sales_invoices 
ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.sales_invoices.supplier_name IS 'Nome do vendedor (nós) - normalmente igual ao nome da empresa do utilizador';

-- Opcional: Preencher com o nome da empresa do perfil (se quiser)
-- UPDATE public.sales_invoices s
-- SET supplier_name = (SELECT company_name FROM profiles WHERE id = s.client_id)
-- WHERE supplier_name IS NULL;
