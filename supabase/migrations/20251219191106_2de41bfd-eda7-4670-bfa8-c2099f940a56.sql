-- Adicionar campo revenue_category a sales_invoices para classificação de vendas
ALTER TABLE public.sales_invoices 
ADD COLUMN revenue_category TEXT DEFAULT 'prestacao_servicos';

-- Adicionar campo para confiança da classificação IA
ALTER TABLE public.sales_invoices 
ADD COLUMN ai_category_confidence INTEGER;

-- Índice para performance em queries por categoria
CREATE INDEX idx_sales_invoices_revenue_category ON public.sales_invoices(revenue_category);

-- Comentário explicativo
COMMENT ON COLUMN public.sales_invoices.revenue_category IS 'Categoria de receita para cálculos SS: prestacao_servicos, vendas, hotelaria, restauracao, alojamento_local, producao_venda, propriedade_intelectual, comercio';