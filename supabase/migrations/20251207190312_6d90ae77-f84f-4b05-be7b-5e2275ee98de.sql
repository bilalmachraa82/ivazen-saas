-- Enum para roles de utilizador
CREATE TYPE public.app_role AS ENUM ('client', 'accountant', 'admin');

-- Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  company_name TEXT,
  nif TEXT UNIQUE,
  cae TEXT,
  activity_description TEXT,
  vat_regime TEXT DEFAULT 'normal',
  accountant_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de roles (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Tabela de facturas
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.profiles(id) NOT NULL,
  
  -- QR Code raw e parsed
  qr_raw TEXT,
  supplier_nif TEXT NOT NULL,
  supplier_name TEXT,
  customer_nif TEXT,
  document_type TEXT,
  document_date DATE NOT NULL,
  document_number TEXT,
  atcud TEXT,
  fiscal_region TEXT DEFAULT 'PT',
  
  -- Bases por taxa
  base_exempt DECIMAL(12,2) DEFAULT 0,
  base_reduced DECIMAL(12,2) DEFAULT 0,
  base_intermediate DECIMAL(12,2) DEFAULT 0,
  base_standard DECIMAL(12,2) DEFAULT 0,
  
  -- IVA por taxa
  vat_reduced DECIMAL(12,2) DEFAULT 0,
  vat_intermediate DECIMAL(12,2) DEFAULT 0,
  vat_standard DECIMAL(12,2) DEFAULT 0,
  
  total_amount DECIMAL(12,2) NOT NULL,
  total_vat DECIMAL(12,2) DEFAULT 0,
  
  -- Classificação IA
  ai_classification TEXT CHECK (ai_classification IN ('ACTIVIDADE', 'PESSOAL', 'MISTA')),
  ai_dp_field INTEGER CHECK (ai_dp_field IN (20, 21, 22, 23, 24)),
  ai_deductibility INTEGER CHECK (ai_deductibility IN (0, 25, 50, 100)),
  ai_confidence INTEGER CHECK (ai_confidence BETWEEN 0 AND 100),
  ai_reason TEXT,
  
  -- Validação manual
  final_classification TEXT,
  final_dp_field INTEGER,
  final_deductibility INTEGER,
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ,
  
  -- Estado
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  image_path TEXT NOT NULL,
  fiscal_period TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de exemplos de classificação para Few-Shot Learning
CREATE TABLE public.classification_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_nif TEXT NOT NULL,
  supplier_name TEXT,
  expense_category TEXT,
  client_activity TEXT,
  final_classification TEXT NOT NULL,
  final_dp_field INTEGER,
  final_deductibility INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_period ON public.invoices(fiscal_period);
CREATE INDEX idx_examples_supplier ON public.classification_examples(supplier_nif);
CREATE INDEX idx_examples_category ON public.classification_examples(expense_category);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_examples ENABLE ROW LEVEL SECURITY;

-- Função para verificar role (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policies para profiles
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Accountants can view client profiles"
ON public.profiles FOR SELECT
USING (accountant_id = auth.uid());

-- Policies para user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Policies para invoices
CREATE POLICY "Clients can view own invoices"
ON public.invoices FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Clients can insert own invoices"
ON public.invoices FOR INSERT
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Accountants can view client invoices"
ON public.invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = invoices.client_id
    AND profiles.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can update client invoices"
ON public.invoices FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = invoices.client_id
    AND profiles.accountant_id = auth.uid()
  )
);

-- Policies para classification_examples (acessível a accountants e admins)
CREATE POLICY "Authenticated users can view examples"
ON public.classification_examples FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Accountants can insert examples"
ON public.classification_examples FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'admin'));

-- Trigger para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  
  -- Atribuir role padrão 'client'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();