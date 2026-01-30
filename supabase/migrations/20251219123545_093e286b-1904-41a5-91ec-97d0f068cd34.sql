-- Create table for sales invoices (revenue invoices)
CREATE TABLE public.sales_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_date date NOT NULL,
  document_number text,
  document_type text DEFAULT 'FT',
  customer_nif text,
  customer_name text,
  supplier_nif text NOT NULL, -- Our NIF (the seller)
  total_amount numeric NOT NULL,
  total_vat numeric DEFAULT 0,
  vat_standard numeric DEFAULT 0,
  vat_intermediate numeric DEFAULT 0,
  vat_reduced numeric DEFAULT 0,
  base_standard numeric DEFAULT 0,
  base_intermediate numeric DEFAULT 0,
  base_reduced numeric DEFAULT 0,
  base_exempt numeric DEFAULT 0,
  fiscal_period text,
  fiscal_region text DEFAULT 'PT',
  atcud text,
  qr_raw text,
  image_path text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'validated')),
  created_at timestamp with time zone DEFAULT now(),
  validated_at timestamp with time zone,
  notes text
);

-- Enable RLS
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sales invoices"
ON public.sales_invoices FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Users can insert own sales invoices"
ON public.sales_invoices FOR INSERT
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update own sales invoices"
ON public.sales_invoices FOR UPDATE
USING (client_id = auth.uid());

CREATE POLICY "Accountants can view client sales invoices"
ON public.sales_invoices FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = sales_invoices.client_id
  AND profiles.accountant_id = auth.uid()
));

CREATE POLICY "Admins can view all sales invoices"
ON public.sales_invoices FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for performance
CREATE INDEX idx_sales_invoices_client_id ON public.sales_invoices(client_id);
CREATE INDEX idx_sales_invoices_fiscal_period ON public.sales_invoices(fiscal_period);