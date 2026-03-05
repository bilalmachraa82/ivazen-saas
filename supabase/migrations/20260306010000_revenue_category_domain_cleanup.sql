-- F6.2/F6.3: Revenue category domain validation and cleanup
-- Evidence-first: capture affected rows BEFORE cleanup

-- Step 1: Create evidence table for audit trail
CREATE TABLE IF NOT EXISTS _revenue_category_cleanup_evidence (
  id UUID PRIMARY KEY,
  old_revenue_category TEXT,
  new_revenue_category TEXT DEFAULT 'prestacao_servicos',
  cleaned_at TIMESTAMPTZ DEFAULT NOW(),
  probable_cause TEXT
);

-- Step 2: Capture affected rows (invalid revenue_category values)
INSERT INTO _revenue_category_cleanup_evidence (id, old_revenue_category, probable_cause)
SELECT
  id,
  revenue_category,
  CASE
    WHEN revenue_category ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN 'UUID value — likely frontend form submitted option ID instead of category string'
    WHEN revenue_category IS NULL
      THEN 'NULL value — DEFAULT not applied'
    ELSE 'Unknown invalid value'
  END
FROM sales_invoices
WHERE revenue_category IS NULL
   OR revenue_category NOT IN (
    'prestacao_servicos', 'vendas', 'hotelaria', 'restauracao',
    'alojamento_local', 'producao_venda', 'propriedade_intelectual',
    'comercio', 'outros'
  );

-- Step 3: Fix invalid values to the safe default
UPDATE sales_invoices
SET revenue_category = 'prestacao_servicos'
WHERE revenue_category IS NULL
   OR revenue_category NOT IN (
    'prestacao_servicos', 'vendas', 'hotelaria', 'restauracao',
    'alojamento_local', 'producao_venda', 'propriedade_intelectual',
    'comercio', 'outros'
  );

-- Step 4: Add CHECK constraint to prevent future invalid values
ALTER TABLE sales_invoices
ADD CONSTRAINT chk_revenue_category
CHECK (revenue_category IN (
  'prestacao_servicos', 'vendas', 'hotelaria', 'restauracao',
  'alojamento_local', 'producao_venda', 'propriedade_intelectual',
  'comercio', 'outros'
));
