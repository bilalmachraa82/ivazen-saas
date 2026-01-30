
-- Fase B: Completar Perfil Fiscal
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ss_contribution_rate numeric DEFAULT 21.4,
ADD COLUMN IF NOT EXISTS is_first_year boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_accountant_ss boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_ss_declaration text;

-- Fase A: Tabela de Receitas para Segurança Social
CREATE TABLE public.revenue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_quarter text NOT NULL, -- '2025-Q1', '2025-Q2', etc
  category text NOT NULL, -- 'prestacao_servicos', 'vendas', 'hotelaria', 'outros'
  amount numeric NOT NULL DEFAULT 0,
  source text DEFAULT 'manual', -- 'manual', 'saft_import', 'api'
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for revenue_entries
CREATE POLICY "Users can view own revenue entries"
ON public.revenue_entries
FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Users can insert own revenue entries"
ON public.revenue_entries
FOR INSERT
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update own revenue entries"
ON public.revenue_entries
FOR UPDATE
USING (client_id = auth.uid());

CREATE POLICY "Users can delete own revenue entries"
ON public.revenue_entries
FOR DELETE
USING (client_id = auth.uid());

CREATE POLICY "Accountants can view client revenue entries"
ON public.revenue_entries
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = revenue_entries.client_id
  AND profiles.accountant_id = auth.uid()
));

CREATE POLICY "Admins can view all revenue entries"
ON public.revenue_entries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela de Histórico de Declarações SS
CREATE TABLE public.ss_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_quarter text NOT NULL,
  total_revenue numeric NOT NULL DEFAULT 0,
  contribution_base numeric NOT NULL DEFAULT 0,
  contribution_amount numeric NOT NULL DEFAULT 0,
  contribution_rate numeric NOT NULL,
  status text DEFAULT 'draft', -- 'draft', 'submitted', 'confirmed'
  submitted_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, period_quarter)
);

-- Enable RLS
ALTER TABLE public.ss_declarations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ss_declarations
CREATE POLICY "Users can view own declarations"
ON public.ss_declarations
FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Users can insert own declarations"
ON public.ss_declarations
FOR INSERT
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update own declarations"
ON public.ss_declarations
FOR UPDATE
USING (client_id = auth.uid());

CREATE POLICY "Accountants can view client declarations"
ON public.ss_declarations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = ss_declarations.client_id
  AND profiles.accountant_id = auth.uid()
));

CREATE POLICY "Admins can view all declarations"
ON public.ss_declarations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela de Métricas IA (Fase D)
CREATE TABLE public.ai_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_nif text NOT NULL,
  supplier_name text,
  total_classifications integer DEFAULT 0,
  total_corrections integer DEFAULT 0,
  last_classification_at timestamptz,
  last_correction_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(supplier_nif)
);

-- Enable RLS
ALTER TABLE public.ai_metrics ENABLE ROW LEVEL SECURITY;

-- RLS for ai_metrics (only accountants and admins)
CREATE POLICY "Accountants can view ai metrics"
ON public.ai_metrics
FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can manage ai metrics"
ON public.ai_metrics
FOR ALL
USING (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_revenue_entries_updated_at
BEFORE UPDATE ON public.revenue_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_metrics_updated_at
BEFORE UPDATE ON public.ai_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
