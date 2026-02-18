-- Fase 2: Adicionar constraint UNIQUE para prevenir duplicados futuros
-- Primeiro criar índice único parcial (não bloqueia dados existentes com duplicados)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_withholding_doc 
ON tax_withholdings (beneficiary_nif, document_reference, fiscal_year)
WHERE document_reference IS NOT NULL;