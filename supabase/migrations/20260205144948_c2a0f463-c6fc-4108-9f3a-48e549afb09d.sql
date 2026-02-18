-- Remover o duplicado específico com sufixo -1
DELETE FROM tax_withholdings 
WHERE fiscal_year = 2025
  AND document_reference = 'ATSIRE01FR/79-1'
  AND beneficiary_nif = '213298724';