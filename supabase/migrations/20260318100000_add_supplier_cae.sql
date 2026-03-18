-- Add supplier_cae column to invoices and sales_invoices tables
-- Stores the supplier's CAE (EACCode) from AT e-Fatura API
-- This is the key signal for automatic invoice classification

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supplier_cae text;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS supplier_cae text;

-- Index for quick lookup by CAE (useful for classification rules)
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_cae ON invoices (supplier_cae) WHERE supplier_cae IS NOT NULL;

COMMENT ON COLUMN invoices.supplier_cae IS 'Supplier CAE code from AT EACCode - used for expense classification';
COMMENT ON COLUMN sales_invoices.supplier_cae IS 'Supplier CAE code from AT EACCode - used for revenue classification';
