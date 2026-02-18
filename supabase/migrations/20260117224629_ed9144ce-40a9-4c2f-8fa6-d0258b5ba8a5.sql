-- DUPLICATE: invoice_validation_logs already created in 20260117100000
-- Made idempotent with IF NOT EXISTS / DROP IF EXISTS guards.

CREATE TABLE IF NOT EXISTS public.invoice_validation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_type text NOT NULL DEFAULT 'purchase',
  user_id uuid NOT NULL,
  action text NOT NULL,
  changes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoice_validation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies (idempotent via DROP IF EXISTS)
DROP POLICY IF EXISTS "Users can view own invoice logs" ON public.invoice_validation_logs;
CREATE POLICY "Users can view own invoice logs" ON public.invoice_validation_logs
FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM invoices i WHERE i.id = invoice_validation_logs.invoice_id AND i.client_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM sales_invoices si WHERE si.id = invoice_validation_logs.invoice_id AND si.client_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN profiles p ON p.id = i.client_id
    WHERE i.id = invoice_validation_logs.invoice_id AND p.accountant_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM sales_invoices si
    JOIN profiles p ON p.id = si.client_id
    WHERE si.id = invoice_validation_logs.invoice_id AND p.accountant_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own logs" ON public.invoice_validation_logs;
CREATE POLICY "Users can insert own logs" ON public.invoice_validation_logs
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all logs" ON public.invoice_validation_logs;
DO $$ BEGIN
  CREATE POLICY "Admins can view all logs" ON public.invoice_validation_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN undefined_function THEN
  -- has_role may not exist yet, skip admin policy
  NULL;
END $$;

-- Sync legacy data (idempotent via NOT EXISTS)
INSERT INTO client_accountants (client_id, accountant_id, is_primary, access_level, invited_by)
SELECT p.id, p.accountant_id, true, 'full', p.accountant_id
FROM profiles p
WHERE p.accountant_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM client_accountants ca
  WHERE ca.client_id = p.id AND ca.accountant_id = p.accountant_id
);

CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_invoice_id ON public.invoice_validation_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_user_id ON public.invoice_validation_logs(user_id);
