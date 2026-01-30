-- Add RLS policies for accountants to manage client withholdings

-- Allow accountants to INSERT withholdings for their clients
CREATE POLICY "Accountants can insert client withholdings"
ON public.tax_withholdings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = tax_withholdings.client_id
    AND profiles.accountant_id = auth.uid()
  )
);

-- Allow accountants to UPDATE withholdings for their clients
CREATE POLICY "Accountants can update client withholdings"
ON public.tax_withholdings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = tax_withholdings.client_id
    AND profiles.accountant_id = auth.uid()
  )
);

-- Allow accountants to DELETE withholdings for their clients
CREATE POLICY "Accountants can delete client withholdings"
ON public.tax_withholdings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = tax_withholdings.client_id
    AND profiles.accountant_id = auth.uid()
  )
);