-- Criar tabela de retenções na fonte para Modelo 10
CREATE TABLE public.tax_withholdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL,
  
  -- Beneficiário (quem recebeu o pagamento)
  beneficiary_nif TEXT NOT NULL,
  beneficiary_name TEXT,
  beneficiary_address TEXT,
  
  -- Categoria de Rendimento AT
  -- B = Categoria B (Rendimentos empresariais/profissionais - Recibos Verdes)
  -- F = Categoria F (Rendimentos prediais/rendas)
  income_category TEXT NOT NULL CHECK (income_category IN ('B', 'F')),
  
  -- Localização do rendimento
  -- C = Continente, RA = Açores, RM = Madeira
  location_code TEXT NOT NULL DEFAULT 'C' CHECK (location_code IN ('C', 'RA', 'RM')),
  
  -- Valores monetários
  gross_amount NUMERIC NOT NULL,
  withholding_rate NUMERIC,
  withholding_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Referências
  payment_date DATE NOT NULL,
  document_reference TEXT,
  source_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  notes TEXT,
  
  -- Status do registo
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'included', 'submitted')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_tax_withholdings_client_year ON public.tax_withholdings(client_id, fiscal_year);
CREATE INDEX idx_tax_withholdings_beneficiary ON public.tax_withholdings(beneficiary_nif);

-- Enable Row Level Security
ALTER TABLE public.tax_withholdings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own withholdings"
  ON public.tax_withholdings
  FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Users can insert own withholdings"
  ON public.tax_withholdings
  FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update own withholdings"
  ON public.tax_withholdings
  FOR UPDATE
  USING (client_id = auth.uid());

CREATE POLICY "Users can delete own withholdings"
  ON public.tax_withholdings
  FOR DELETE
  USING (client_id = auth.uid());

CREATE POLICY "Accountants can view client withholdings"
  ON public.tax_withholdings
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = tax_withholdings.client_id 
    AND profiles.accountant_id = auth.uid()
  ));

CREATE POLICY "Admins can view all withholdings"
  ON public.tax_withholdings
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_tax_withholdings_updated_at
  BEFORE UPDATE ON public.tax_withholdings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();