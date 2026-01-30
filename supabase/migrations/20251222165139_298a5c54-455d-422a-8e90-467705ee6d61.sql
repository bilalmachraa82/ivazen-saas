-- Add INSERT policy for accountants on invoices table
CREATE POLICY "Accountants can insert client invoices"
ON public.invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = invoices.client_id
    AND profiles.accountant_id = auth.uid()
  )
);

-- Add INSERT policy for accountants on sales_invoices table
CREATE POLICY "Accountants can insert client sales invoices"
ON public.sales_invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = sales_invoices.client_id
    AND profiles.accountant_id = auth.uid()
  )
);

-- Add UPDATE policy for accountants on sales_invoices table (was missing)
CREATE POLICY "Accountants can update client sales invoices"
ON public.sales_invoices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = sales_invoices.client_id
    AND profiles.accountant_id = auth.uid()
  )
);