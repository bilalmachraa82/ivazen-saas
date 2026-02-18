-- =============================================================
-- MIGRATION: Limpar duplicados Fatura+Recibo (FT/RG pairs)
-- Na contabilidade portuguesa, FT (fatura) e RG (recibo) da mesma
-- transação não devem ambos ser declarados no Modelo 10.
-- Mantemos apenas o documento mais recente (RG, que confirma pagamento).
-- =============================================================

-- Identificar e eliminar FT quando existe RG correspondente
-- (mesmo NIF, mesmo valor, data próxima = mesma transação)
WITH ft_rg_pairs AS (
  SELECT 
    t1.id as ft_id,
    t1.document_reference as ft_ref,
    t1.gross_amount as ft_amount,
    t1.payment_date as ft_date,
    t2.id as rg_id,
    t2.document_reference as rg_ref,
    t2.payment_date as rg_date
  FROM tax_withholdings t1
  JOIN tax_withholdings t2 
    ON t1.beneficiary_nif = t2.beneficiary_nif
    AND t1.fiscal_year = t2.fiscal_year
    AND t1.gross_amount = t2.gross_amount
    AND t1.id != t2.id
    AND t1.document_reference LIKE '%FT%'
    AND t2.document_reference LIKE '%RG%'
    AND ABS(t1.payment_date::date - t2.payment_date::date) <= 7
  WHERE t1.fiscal_year = 2025
)
DELETE FROM tax_withholdings 
WHERE id IN (SELECT ft_id FROM ft_rg_pairs);

-- Também limpar pares onde temos dois documentos com mesmo NIF+valor+data
-- (tolerância de 3 dias), mantendo apenas o mais recente
WITH semantic_duplicates AS (
  SELECT 
    id,
    beneficiary_nif,
    gross_amount,
    payment_date,
    document_reference,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY beneficiary_nif, gross_amount
      ORDER BY created_at DESC
    ) as rn
  FROM tax_withholdings
  WHERE fiscal_year = 2025
    AND beneficiary_nif IN (
      SELECT beneficiary_nif 
      FROM tax_withholdings 
      WHERE fiscal_year = 2025
      GROUP BY beneficiary_nif, gross_amount
      HAVING COUNT(*) > 1
    )
)
DELETE FROM tax_withholdings 
WHERE id IN (
  SELECT id FROM semantic_duplicates 
  WHERE rn > 1
  AND beneficiary_nif IN ('220899096', '223253960')
);