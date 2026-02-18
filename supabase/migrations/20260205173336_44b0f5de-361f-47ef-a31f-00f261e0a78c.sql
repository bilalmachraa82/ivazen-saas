-- Adicionar campos para melhor auditoria e compliance fiscal
-- Baseado no feedback: separar fonte técnica de autoridade legal

-- Campo para forçar validação contabilística (confiança < 80%)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS 
  requires_accountant_validation BOOLEAN DEFAULT FALSE;

-- Campo para indicar a autoridade/confiança dos dados
-- Valores: user_uploaded, at_certified, auto_classified
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS 
  data_authority TEXT DEFAULT 'user_uploaded';

-- Índice parcial para filtrar facturas que requerem revisão
CREATE INDEX IF NOT EXISTS idx_invoices_requires_validation 
  ON invoices(requires_accountant_validation) 
  WHERE requires_accountant_validation = TRUE;

-- Comentários para documentação
COMMENT ON COLUMN invoices.requires_accountant_validation IS 'Forçar revisão contabilística quando confiança IA < 80%';
COMMENT ON COLUMN invoices.data_authority IS 'Origem dos dados: user_uploaded, at_certified, auto_classified';