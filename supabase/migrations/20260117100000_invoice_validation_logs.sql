-- Create invoice_validation_logs table for tracking validation history
CREATE TABLE IF NOT EXISTS invoice_validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('purchase', 'sales')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('validated', 'rejected', 'edited', 'classification_changed', 'created')),
  changes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_invoice_id ON invoice_validation_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_user_id ON invoice_validation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_created_at ON invoice_validation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_invoice_type ON invoice_validation_logs(invoice_type);

-- Enable RLS
ALTER TABLE invoice_validation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view logs for invoices they have access to
CREATE POLICY "Users can view validation logs for their invoices"
  ON invoice_validation_logs FOR SELECT
  USING (
    -- Check if user owns the invoice (purchase)
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_validation_logs.invoice_id
      AND invoices.client_id = auth.uid()
    )
    OR
    -- Check if user owns the invoice (sales)
    EXISTS (
      SELECT 1 FROM sales_invoices
      WHERE sales_invoices.id = invoice_validation_logs.invoice_id
      AND sales_invoices.client_id = auth.uid()
    )
    OR
    -- Accountants can see logs for their clients' invoices
    EXISTS (
      SELECT 1 FROM client_accountants ca
      JOIN invoices i ON i.client_id = ca.client_id
      WHERE i.id = invoice_validation_logs.invoice_id
      AND ca.accountant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM client_accountants ca
      JOIN sales_invoices si ON si.client_id = ca.client_id
      WHERE si.id = invoice_validation_logs.invoice_id
      AND ca.accountant_id = auth.uid()
    )
    OR
    -- User created the log entry
    user_id = auth.uid()
  );

-- Policy: Users can insert logs for invoices they have access to
CREATE POLICY "Users can insert validation logs for their invoices"
  ON invoice_validation_logs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Check if user owns the invoice (purchase)
      EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.id = invoice_validation_logs.invoice_id
        AND invoices.client_id = auth.uid()
      )
      OR
      -- Check if user owns the invoice (sales)
      EXISTS (
        SELECT 1 FROM sales_invoices
        WHERE sales_invoices.id = invoice_validation_logs.invoice_id
        AND sales_invoices.client_id = auth.uid()
      )
      OR
      -- Accountants can insert logs for their clients' invoices
      EXISTS (
        SELECT 1 FROM client_accountants ca
        JOIN invoices i ON i.client_id = ca.client_id
        WHERE i.id = invoice_validation_logs.invoice_id
        AND ca.accountant_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM client_accountants ca
        JOIN sales_invoices si ON si.client_id = ca.client_id
        WHERE si.id = invoice_validation_logs.invoice_id
        AND ca.accountant_id = auth.uid()
      )
    )
  );

-- Create function to log validation changes
CREATE OR REPLACE FUNCTION log_invoice_validation(
  p_invoice_id UUID,
  p_invoice_type TEXT,
  p_action TEXT,
  p_changes JSONB DEFAULT '[]'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO invoice_validation_logs (
    invoice_id,
    invoice_type,
    user_id,
    action,
    changes
  ) VALUES (
    p_invoice_id,
    p_invoice_type,
    auth.uid(),
    p_action,
    p_changes
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_invoice_validation TO authenticated;

COMMENT ON TABLE invoice_validation_logs IS 'Stores history of validation actions on invoices';
COMMENT ON COLUMN invoice_validation_logs.invoice_type IS 'Type of invoice: purchase or sales';
COMMENT ON COLUMN invoice_validation_logs.action IS 'Type of action: validated, rejected, edited, classification_changed, created';
COMMENT ON COLUMN invoice_validation_logs.changes IS 'JSON array of changes: [{field, old_value, new_value}]';
