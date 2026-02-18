-- Add source_sales_invoice_id to link tax_withholdings with sales_invoices
-- This enables data reuse between Modelo 10 and IVA flows

ALTER TABLE tax_withholdings 
ADD COLUMN IF NOT EXISTS source_sales_invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tax_withholdings_source_sales_invoice 
ON tax_withholdings(source_sales_invoice_id) 
WHERE source_sales_invoice_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tax_withholdings.source_sales_invoice_id IS 
'Links to the original sales invoice when a recibo verde is imported. Enables data reuse between Modelo 10 and IVA flows.';