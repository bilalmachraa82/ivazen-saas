-- =====================================================
-- SCRIPT PARA CORRIGIR CLIENT_IDs EM TAX_WITHHOLDINGS
-- =====================================================
-- Problema: Os 141 registos foram criados com client_id do accountant
-- em vez do client_id do cliente Abrumis.

-- PASSO 1: DIAGNÓSTICO
-- =====================================================

-- Ver quantos registos existem por client_id e fiscal_year
SELECT
  client_id,
  fiscal_year,
  COUNT(*) as count,
  SUM(gross_amount::numeric) as total_bruto,
  SUM(withholding_amount::numeric) as total_retencao
FROM tax_withholdings
GROUP BY client_id, fiscal_year
ORDER BY count DESC;

-- Ver os perfis associados a esses client_ids
SELECT
  p.id,
  p.full_name,
  p.company_name,
  p.nif,
  (SELECT COUNT(*) FROM tax_withholdings tw WHERE tw.client_id = p.id) as withholding_count
FROM profiles p
WHERE p.id IN (SELECT DISTINCT client_id FROM tax_withholdings)
ORDER BY withholding_count DESC;

-- Ver quem são os accountants
SELECT
  p.id,
  p.full_name,
  p.email,
  ur.role
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'accountant';

-- Ver clientes associados a accountants
SELECT
  ac.accountant_id,
  ac.client_id,
  p.full_name as client_name,
  p.company_name,
  p.nif
FROM accountant_clients ac
JOIN profiles p ON p.id = ac.client_id;

-- PASSO 2: CORRECÇÃO
-- =====================================================
-- SUBSTITUIR os valores abaixo com os IDs reais:
-- - ACCOUNTANT_ID: ID do accountant que fez o upload
-- - ABRUMIS_CLIENT_ID: ID do cliente Abrumis

-- Ver os registos que precisam ser corrigidos
SELECT
  id,
  client_id,
  beneficiary_nif,
  beneficiary_name,
  gross_amount,
  fiscal_year,
  created_at
FROM tax_withholdings
WHERE client_id = 'ACCOUNTANT_ID_AQUI'  -- Substituir pelo ID do accountant
AND fiscal_year = 2025
ORDER BY created_at DESC
LIMIT 10;

-- EXECUTAR A CORRECÇÃO (descomentar depois de verificar):
-- UPDATE tax_withholdings
-- SET client_id = 'ABRUMIS_CLIENT_ID_AQUI'  -- Substituir pelo ID do cliente
-- WHERE client_id = 'ACCOUNTANT_ID_AQUI'    -- Substituir pelo ID do accountant
-- AND fiscal_year = 2025;

-- PASSO 3: VERIFICAÇÃO
-- =====================================================

-- Depois de corrigir, verificar novamente
SELECT
  client_id,
  fiscal_year,
  COUNT(*) as count,
  SUM(gross_amount::numeric) as total_bruto
FROM tax_withholdings
GROUP BY client_id, fiscal_year
ORDER BY count DESC;

-- =====================================================
-- CORREÇÃO DA UPLOAD_QUEUE (para dados pendentes)
-- =====================================================

-- Ver se há items na upload_queue com client_id errado
SELECT
  id,
  user_id,
  client_id,
  file_name,
  status,
  created_at
FROM upload_queue
WHERE status = 'pending'
  AND user_id = client_id  -- Isto indica que não foi definido client_id separado
LIMIT 10;

-- Se houver items pendentes com client_id errado, corrigir:
-- UPDATE upload_queue
-- SET client_id = 'ABRUMIS_CLIENT_ID_AQUI'
-- WHERE user_id = 'ACCOUNTANT_ID_AQUI'
-- AND client_id = 'ACCOUNTANT_ID_AQUI'
-- AND status = 'pending';
