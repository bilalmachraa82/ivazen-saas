-- ============================================================
-- Diagnóstico Auditoria Raquela — 24.03.2026
-- Executar no Supabase SQL Editor (read-only queries)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- F3.1 — Cátia Francisco: duplicados em sales_invoices
-- ──────────────────────────────────────────────────────────

-- 1a) Encontrar o client_id da Cátia Francisco
SELECT id, full_name, company_name, email, nif
FROM profiles
WHERE full_name ILIKE '%Cátia%' OR full_name ILIKE '%Catia%' OR email ILIKE '%catia%';

-- 1b) Contar faturas por período (substituir <CATIA_CLIENT_ID> pelo UUID encontrado acima)
SELECT
  fiscal_period,
  COUNT(*) AS total_invoices,
  SUM(total_amount) AS total_amount,
  SUM(vat_amount) AS total_vat
FROM sales_invoices
WHERE client_id = '<CATIA_CLIENT_ID>'
GROUP BY fiscal_period
ORDER BY fiscal_period DESC;

-- 1c) Detetar duplicados: mesmo document_number, múltiplos registos
SELECT
  document_number,
  document_date,
  COUNT(*) AS occurrences,
  array_agg(id ORDER BY created_at) AS ids,
  array_agg(created_at ORDER BY created_at) AS created_ats,
  array_agg(total_amount ORDER BY created_at) AS amounts
FROM sales_invoices
WHERE client_id = '<CATIA_CLIENT_ID>'
GROUP BY document_number, document_date
HAVING COUNT(*) > 1
ORDER BY occurrences DESC, document_number;

-- 1d) Detalhe dos períodos problemáticos (Jan/Fev/Mar 2025)
SELECT
  fiscal_period,
  COUNT(*) AS total,
  COUNT(DISTINCT document_number) AS unique_docs,
  COUNT(*) - COUNT(DISTINCT document_number) AS likely_duplicates,
  SUM(total_amount) AS total_amount
FROM sales_invoices
WHERE client_id = '<CATIA_CLIENT_ID>'
  AND fiscal_period IN ('2025-01','202501','2025-02','202502','2025-03','202503','2025-Q1')
GROUP BY fiscal_period
ORDER BY fiscal_period;


-- ──────────────────────────────────────────────────────────
-- F3.2 — Maria Tereza Silva: vendas em falta
-- ──────────────────────────────────────────────────────────

-- 2a) Encontrar o client_id da Maria Tereza Silva
SELECT id, full_name, company_name, email, nif
FROM profiles
WHERE full_name ILIKE '%Maria Tereza%' OR full_name ILIKE '%Tereza Silva%' OR email ILIKE '%tereza%';

-- 2b) Verificar credenciais AT configuradas (substituir <MARIA_CLIENT_ID>)
SELECT
  client_id,
  nif,
  created_at,
  updated_at,
  sync_enabled
FROM at_credentials
WHERE client_id = '<MARIA_CLIENT_ID>';

-- 2c) Ver último sync e erros
SELECT
  client_id,
  sync_type,
  status,
  started_at,
  completed_at,
  error_message,
  records_synced
FROM at_sync_logs
WHERE client_id = '<MARIA_CLIENT_ID>'
ORDER BY started_at DESC
LIMIT 20;

-- 2d) Contar vendas existentes
SELECT COUNT(*) AS total_sales, MIN(document_date) AS oldest, MAX(document_date) AS newest
FROM sales_invoices
WHERE client_id = '<MARIA_CLIENT_ID>';


-- ──────────────────────────────────────────────────────────
-- F3.3 — Rafael Paisano: períodos 2026 em falta
-- ──────────────────────────────────────────────────────────

-- 3a) Encontrar o client_id do Rafael Paisano
SELECT id, full_name, company_name, email, nif
FROM profiles
WHERE full_name ILIKE '%Rafael%Paisano%' OR full_name ILIKE '%Paisano%' OR email ILIKE '%rafael%paisano%';

-- 3b) Ver TODOS os períodos disponíveis (substituir <RAFAEL_CLIENT_ID>)
SELECT DISTINCT fiscal_period
FROM sales_invoices
WHERE client_id = '<RAFAEL_CLIENT_ID>'
ORDER BY fiscal_period DESC;

-- 3c) Ver datas máximas de documentos e sincronização
SELECT
  MAX(document_date) AS last_document_date,
  MAX(created_at) AS last_sync_at,
  COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM document_date) = 2026) AS invoices_2026,
  COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM document_date) = 2025) AS invoices_2025
FROM sales_invoices
WHERE client_id = '<RAFAEL_CLIENT_ID>';

-- 3d) Último sync AT do Rafael
SELECT
  sync_type, status, started_at, completed_at, error_message, records_synced
FROM at_sync_logs
WHERE client_id = '<RAFAEL_CLIENT_ID>'
ORDER BY started_at DESC
LIMIT 10;


-- ──────────────────────────────────────────────────────────
-- F3.CLEANUP — Remover duplicados da Cátia (executar DEPOIS
-- de confirmar os IDs com as queries acima)
-- ──────────────────────────────────────────────────────────

-- ATENÇÃO: só executar após confirmar quais IDs são duplicados
-- Mantém o registo mais recente (criado por último) para cada par (client_id, document_number, document_date)

-- Preview do que seria eliminado:
/*
SELECT id, document_number, document_date, created_at
FROM sales_invoices
WHERE client_id = '<CATIA_CLIENT_ID>'
  AND id NOT IN (
    SELECT DISTINCT ON (client_id, document_number, document_date) id
    FROM sales_invoices
    WHERE client_id = '<CATIA_CLIENT_ID>'
    ORDER BY client_id, document_number, document_date, created_at DESC
  )
ORDER BY document_number, created_at;
*/

-- Executar limpeza (descomenta após confirmar o preview):
/*
DELETE FROM sales_invoices
WHERE client_id = '<CATIA_CLIENT_ID>'
  AND id NOT IN (
    SELECT DISTINCT ON (client_id, document_number, document_date) id
    FROM sales_invoices
    WHERE client_id = '<CATIA_CLIENT_ID>'
    ORDER BY client_id, document_number, document_date, created_at DESC
  );
*/
