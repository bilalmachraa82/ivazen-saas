-- Allow accountants to SELECT upload_queue items for their clients
CREATE POLICY "Accountants can view client upload queue"
ON public.upload_queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = upload_queue.client_id
    AND ca.accountant_id = auth.uid()
  )
);

-- Allow accountants to UPDATE upload_queue items for their clients (retry, reset)
CREATE POLICY "Accountants can update client upload queue"
ON public.upload_queue FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = upload_queue.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- Allow accountants to DELETE upload_queue items for their clients
CREATE POLICY "Accountants can delete client upload queue"
ON public.upload_queue FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = upload_queue.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- Allow admins to SELECT all upload_queue items
CREATE POLICY "Admins can view all upload queue"
ON public.upload_queue FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to UPDATE all upload_queue items
CREATE POLICY "Admins can update all upload queue"
ON public.upload_queue FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to DELETE all upload_queue items
CREATE POLICY "Admins can delete all upload queue"
ON public.upload_queue FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));