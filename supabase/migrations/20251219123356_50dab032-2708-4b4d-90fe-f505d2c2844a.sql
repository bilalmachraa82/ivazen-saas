-- Add policy to allow clients to update their own invoices (for classification)
-- This fixes the bug where accountants who are also clients cannot update their own invoices

CREATE POLICY "Clients can update own invoices"
ON public.invoices
FOR UPDATE
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());