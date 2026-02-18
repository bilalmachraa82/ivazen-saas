
-- Drop the restrictive DELETE policy
DROP POLICY IF EXISTS "No one can delete invoices" ON public.invoices;

-- Clients can delete their own invoices
CREATE POLICY "Clients can delete own invoices"
ON public.invoices
FOR DELETE
TO authenticated
USING (client_id = auth.uid());

-- Accountants can delete client invoices via association
CREATE POLICY "Accountants can delete client invoices via association"
ON public.invoices
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM client_accountants ca
  WHERE ca.client_id = invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
));
