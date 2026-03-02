-- =============================================================
-- MIGRATION: Limpar duplicados Modelo 10 e normalizar referências
-- =============================================================

-- PARTE 1: Eliminar duplicados por variação de prefixo
-- (ex: "FR ATSIRE01FR/22" vs "ATSIRE01FR/22" são o mesmo documento)
WITH normalized AS (
  SELECT 
    id,
    beneficiary_nif,
    fiscal_year,
    document_reference,
    gross_amount,
    created_at,
    REGEXP_REPLACE(document_reference, '^(FR |FT |RG |NC |ND |R |F )', '', 'i') as base_ref,
    ROW_NUMBER() OVER (
      PARTITION BY beneficiary_nif, fiscal_year, 
        REGEXP_REPLACE(document_reference, '^(FR |FT |RG |NC |ND |R |F )', '', 'i')
      ORDER BY created_at DESC
    ) as rn
  FROM tax_withholdings
  WHERE fiscal_year = 2025
),
prefix_duplicates AS (
  SELECT id FROM normalized WHERE rn > 1
)
DELETE FROM tax_withholdings WHERE id IN (SELECT id FROM prefix_duplicates);

-- PARTE 2: Eliminar duplicados por sufixo -1, -2 (cópias/segundas vias)
WITH copy_refs AS (
  SELECT 
    id,
    beneficiary_nif,
    fiscal_year,
    document_reference,
    REGEXP_REPLACE(document_reference, '-\d+$', '') as base_ref,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY beneficiary_nif, fiscal_year, 
        REGEXP_REPLACE(document_reference, '-\d+$', '')
      ORDER BY created_at DESC
    ) as rn
  FROM tax_withholdings
  WHERE fiscal_year = 2025
    AND document_reference ~ '-\d+$'
)
DELETE FROM tax_withholdings WHERE id IN (
  SELECT id FROM copy_refs WHERE rn > 1
);

-- PARTE 3: Corrigir valores brutos das 2 faturas (NIF 242821243)
-- O PDF da AT indica 900€ total para estas 2 faturas
-- Proporção correta baseada nos valores de retenção (66.70 + 36.80 = 103.50)
UPDATE tax_withholdings 
SET gross_amount = CASE 
  WHEN document_reference LIKE '%2500/000023%' THEN 580.00  -- 900 * (66.7/103.5) ≈ 580
  WHEN document_reference LIKE '%2500/000037%' THEN 320.00  -- 900 * (36.8/103.5) ≈ 320
  END
WHERE beneficiary_nif = '242821243' 
  AND fiscal_year = 2025
  AND document_reference LIKE '%2500/000%';

-- PARTE 4: Normalizar todas as referências existentes (remover prefixos)
UPDATE tax_withholdings
SET document_reference = REGEXP_REPLACE(document_reference, '^(FR |FT |RG |NC |ND |R |F )', '', 'i')
WHERE fiscal_year = 2025
  AND document_reference ~ '^(FR |FT |RG |NC |ND |R |F )';