-- Fix invoice_vat_lines RLS to include accountants via client_accountants
BEGIN;

DROP POLICY IF EXISTS "invoice_vat_lines_access" ON invoice_vat_lines;

CREATE POLICY "invoice_vat_lines_access" ON invoice_vat_lines
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_vat_lines.invoice_id
      AND (
        i.client_id = auth.uid()
        OR i.validated_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.client_accountants ca
          WHERE ca.client_id = i.client_id
            AND ca.accountant_id = auth.uid()
        )
      )
  )
);

COMMIT;
