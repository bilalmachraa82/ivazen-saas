-- Create storage bucket for invoice images
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false);

-- RLS policies for invoices bucket
CREATE POLICY "Users can upload their own invoices"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own invoices"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own invoices"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Accountants can view their clients' invoices
CREATE POLICY "Accountants can view client invoices"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'invoices'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id::text = (storage.foldername(name))[1]
    AND p.accountant_id = auth.uid()
  )
);