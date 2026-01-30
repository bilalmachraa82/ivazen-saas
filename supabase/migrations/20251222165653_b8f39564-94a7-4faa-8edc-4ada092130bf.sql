-- Add Storage INSERT policy for accountants to upload to client folders
CREATE POLICY "Accountants can upload client invoices"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id::text = (storage.foldername(name))[1]
    AND p.accountant_id = auth.uid()
  )
);

-- Add Storage UPDATE policy for accountants (for upserts)
CREATE POLICY "Accountants can update client invoices"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id::text = (storage.foldername(name))[1]
    AND p.accountant_id = auth.uid()
  )
);

-- Add Storage DELETE policy for accountants
CREATE POLICY "Accountants can delete client invoices"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'invoices' AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id::text = (storage.foldername(name))[1]
    AND p.accountant_id = auth.uid()
  )
);