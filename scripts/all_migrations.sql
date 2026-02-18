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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();-- Create storage bucket for invoice images
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
);-- =============================================
-- FASE 1: CORREÇÕES DE SEGURANÇA CRÍTICAS (CORRIGIDO)
-- =============================================

-- 1. Corrigir RLS de classification_examples
-- Remover política permissiva que expõe dados fiscais
DROP POLICY IF EXISTS "Authenticated users can view examples" ON public.classification_examples;

-- Criar política restritiva: apenas contabilistas e admins podem ver exemplos
CREATE POLICY "Accountants and admins can view examples" 
ON public.classification_examples 
FOR SELECT 
USING (
  has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'admin')
);

-- 2. Adicionar DELETE policies explícitas (audit trail - ninguém pode apagar)
-- Invoices: Manter histórico completo para auditoria fiscal
CREATE POLICY "No one can delete invoices" 
ON public.invoices 
FOR DELETE 
USING (false);

-- Classification examples: Manter para integridade do modelo
CREATE POLICY "No one can delete classification examples" 
ON public.classification_examples 
FOR DELETE 
USING (false);

-- Profiles: Apenas o próprio utilizador pode apagar (RGPD)
CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);

-- User roles: Apenas admins podem apagar roles
CREATE POLICY "Admins can delete user roles" 
ON public.user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- 3. Criar trigger para proteger accountant_id de alterações não autorizadas
CREATE OR REPLACE FUNCTION public.protect_accountant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o utilizador é o próprio dono do perfil
  IF auth.uid() = NEW.id THEN
    -- Se já tinha contabilista e está a tentar mudar para outro (não nulo e diferente)
    IF OLD.accountant_id IS NOT NULL 
       AND NEW.accountant_id IS NOT NULL 
       AND OLD.accountant_id != NEW.accountant_id THEN
      RAISE EXCEPTION 'Não pode alterar o contabilista diretamente. Contacte o seu contabilista atual.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_accountant_id_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_accountant_id();

-- 4. Adicionar política para contabilistas gerirem clientes
CREATE POLICY "Accountants can update client profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'accountant') 
  AND accountant_id = auth.uid()
);

-- 5. Adicionar políticas para admins terem acesso total
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all invoices" 
ON public.invoices 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all invoices" 
ON public.invoices 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert user roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));
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
-- Create table to store user category preferences
CREATE TABLE public.category_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cae_prefix VARCHAR(5),
  category VARCHAR(50) NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, cae_prefix, category)
);

-- Enable Row Level Security
ALTER TABLE public.category_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own preferences" 
ON public.category_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
ON public.category_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
ON public.category_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" 
ON public.category_preferences 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_category_preferences_user ON public.category_preferences(user_id);
CREATE INDEX idx_category_preferences_usage ON public.category_preferences(user_id, usage_count DESC);-- Create partners table for dynamic management
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  initials text NOT NULL,
  logo_url text,
  website_url text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Public can view active partners
CREATE POLICY "Anyone can view active partners"
  ON public.partners FOR SELECT
  USING (is_active = true);

-- Admins can manage partners
CREATE POLICY "Admins can manage partners"
  ON public.partners FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial partners data
INSERT INTO public.partners (name, initials, display_order) VALUES
  ('Contabilidade Silva & Associados', 'CS', 1),
  ('MS Escritórios', 'MS', 2),
  ('TechStartup Lda', 'TS', 3),
  ('Gabinete Fiscal PT', 'GF', 4),
  ('ENI Consultores', 'EC', 5),
  ('Digital Finance', 'DF', 6),
  ('Porto Accounting', 'PA', 7),
  ('Lisbon Tax Services', 'LT', 8);-- Criar bucket para logos de parceiros
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-logos', 'partner-logos', true);

-- RLS para permitir leitura pública
CREATE POLICY "Anyone can view partner logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-logos');

-- RLS para upload apenas para admins
CREATE POLICY "Admins can upload partner logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'partner-logos' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS para atualizar apenas para admins
CREATE POLICY "Admins can update partner logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'partner-logos' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS para eliminar apenas para admins
CREATE POLICY "Admins can delete partner logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'partner-logos' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);-- Update partners table policy to require authentication for viewing
DROP POLICY IF EXISTS "Anyone can view active partners" ON public.partners;

CREATE POLICY "Authenticated users can view active partners" 
ON public.partners 
FOR SELECT 
USING (is_active = true AND auth.uid() IS NOT NULL);-- Create table for push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Create table for notification preferences
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pending_invoices BOOLEAN NOT NULL DEFAULT true,
  deadline_reminders BOOLEAN NOT NULL DEFAULT true,
  new_uploads BOOLEAN NOT NULL DEFAULT true,
  reminder_days INTEGER[] NOT NULL DEFAULT ARRAY[3, 7],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track sent notifications (avoid duplicates)
CREATE TABLE public.sent_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  reference_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  body TEXT
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;

-- Push subscriptions policies
CREATE POLICY "Users can view own subscriptions" 
  ON public.push_subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" 
  ON public.push_subscriptions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions" 
  ON public.push_subscriptions FOR DELETE 
  USING (auth.uid() = user_id);

-- Notification preferences policies
CREATE POLICY "Users can view own preferences" 
  ON public.notification_preferences FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
  ON public.notification_preferences FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
  ON public.notification_preferences FOR UPDATE 
  USING (auth.uid() = user_id);

-- Sent notifications policies
CREATE POLICY "Users can view own sent notifications" 
  ON public.sent_notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sent notifications"
  ON public.sent_notifications FOR INSERT
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences(user_id);
CREATE INDEX idx_sent_notifications_user_id ON public.sent_notifications(user_id);
CREATE INDEX idx_sent_notifications_type_ref ON public.sent_notifications(notification_type, reference_id);

-- Add triggers for updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add gemini_api_key column to profiles table for custom API key storage
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.gemini_api_key IS 'User custom Gemini API key for using Gemini 3 Flash directly';-- Add unique constraint on supplier_nif for upsert functionality
ALTER TABLE ai_metrics ADD CONSTRAINT ai_metrics_supplier_nif_unique UNIQUE (supplier_nif);

-- Create RPC function to update AI metrics
CREATE OR REPLACE FUNCTION public.update_ai_metrics(
  p_supplier_nif TEXT,
  p_supplier_name TEXT DEFAULT NULL,
  p_was_correction BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_metrics (
    supplier_nif, 
    supplier_name, 
    total_classifications, 
    total_corrections, 
    last_classification_at, 
    last_correction_at
  )
  VALUES (
    p_supplier_nif, 
    p_supplier_name, 
    1, 
    CASE WHEN p_was_correction THEN 1 ELSE 0 END,
    NOW(),
    CASE WHEN p_was_correction THEN NOW() ELSE NULL END
  )
  ON CONFLICT (supplier_nif) DO UPDATE SET
    total_classifications = ai_metrics.total_classifications + 1,
    total_corrections = ai_metrics.total_corrections + CASE WHEN p_was_correction THEN 1 ELSE 0 END,
    last_classification_at = NOW(),
    last_correction_at = CASE WHEN p_was_correction THEN NOW() ELSE ai_metrics.last_correction_at END,
    supplier_name = COALESCE(EXCLUDED.supplier_name, ai_metrics.supplier_name),
    updated_at = NOW();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_ai_metrics(TEXT, TEXT, BOOLEAN) TO authenticated;-- Adicionar coluna email à tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Criar função para sincronizar email do auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), NEW.email);
  
  -- Atribuir role padrão 'client'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$;

-- Criar função admin para obter emails dos utilizadores existentes
CREATE OR REPLACE FUNCTION public.sync_profile_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
END;
$$;

-- Executar sincronização inicial
SELECT public.sync_profile_emails();

-- Permitir admins usar a função de sync
GRANT EXECUTE ON FUNCTION public.sync_profile_emails() TO authenticated;-- Add new columns for SS calculation compliance
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS worker_type TEXT DEFAULT 'independent';
-- Values: 'independent', 'eni', 'eirl', 'agricultural'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accounting_regime TEXT DEFAULT 'simplified';
-- Values: 'simplified', 'organized'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_other_employment BOOLEAN DEFAULT false;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS other_employment_salary NUMERIC DEFAULT 0;
-- Average monthly salary from employed work (TCO)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS taxable_profit NUMERIC DEFAULT 0;
-- Taxable profit for organized accounting

-- Add comment for documentation
COMMENT ON COLUMN profiles.worker_type IS 'Type of independent worker: independent, eni, eirl, agricultural';
COMMENT ON COLUMN profiles.accounting_regime IS 'Accounting regime: simplified or organized';
COMMENT ON COLUMN profiles.has_other_employment IS 'Whether the worker also has employed work (TCO)';
COMMENT ON COLUMN profiles.other_employment_salary IS 'Average monthly salary from employed work';
COMMENT ON COLUMN profiles.taxable_profit IS 'Annual taxable profit for organized accounting regime';-- Add policy to allow clients to update their own invoices (for classification)
-- This fixes the bug where accountants who are also clients cannot update their own invoices

CREATE POLICY "Clients can update own invoices"
ON public.invoices
FOR UPDATE
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());-- Create table for sales invoices (revenue invoices)
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
CREATE INDEX idx_sales_invoices_fiscal_period ON public.sales_invoices(fiscal_period);-- Drop the existing trigger that blocks accountant_id changes
DROP TRIGGER IF EXISTS protect_accountant_id_trigger ON profiles;
DROP FUNCTION IF EXISTS protect_accountant_id();

-- Create function to search available clients (without accountant)
CREATE OR REPLACE FUNCTION public.search_available_clients(search_term TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  company_name TEXT,
  nif TEXT,
  email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.company_name, p.nif, p.email
  FROM profiles p
  JOIN user_roles ur ON p.id = ur.user_id
  WHERE ur.role = 'client'
    AND p.accountant_id IS NULL
    AND p.id != auth.uid()
    AND (
      p.nif ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
      OR p.full_name ILIKE '%' || search_term || '%'
      OR p.company_name ILIKE '%' || search_term || '%'
    )
  LIMIT 20;
$$;

-- Create function to get accountant's clients
CREATE OR REPLACE FUNCTION public.get_accountant_clients(accountant_uuid UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  company_name TEXT,
  nif TEXT,
  email TEXT,
  pending_invoices BIGINT,
  validated_invoices BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.company_name,
    p.nif,
    p.email,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status IN ('pending', 'classified')), 0) as pending_invoices,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0) as validated_invoices
  FROM profiles p
  WHERE p.accountant_id = accountant_uuid;
$$;

-- Create function for accountant to associate a client
CREATE OR REPLACE FUNCTION public.associate_client(client_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_accountant BOOLEAN;
  client_has_accountant BOOLEAN;
BEGIN
  -- Check if current user is an accountant
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accountant'
  ) INTO is_accountant;
  
  IF NOT is_accountant THEN
    RAISE EXCEPTION 'Apenas contabilistas podem associar clientes';
  END IF;
  
  -- Check if client already has an accountant
  SELECT accountant_id IS NOT NULL INTO client_has_accountant
  FROM profiles WHERE id = client_uuid;
  
  IF client_has_accountant THEN
    RAISE EXCEPTION 'Este cliente já está associado a um contabilista';
  END IF;
  
  -- Associate the client
  UPDATE profiles SET accountant_id = auth.uid() WHERE id = client_uuid;
  
  RETURN TRUE;
END;
$$;

-- Create function for accountant to remove a client
CREATE OR REPLACE FUNCTION public.remove_client(client_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_accountant BOOLEAN;
  is_my_client BOOLEAN;
BEGIN
  -- Check if current user is an accountant
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accountant'
  ) INTO is_accountant;
  
  IF NOT is_accountant THEN
    RAISE EXCEPTION 'Apenas contabilistas podem remover clientes';
  END IF;
  
  -- Check if client belongs to this accountant
  SELECT accountant_id = auth.uid() INTO is_my_client
  FROM profiles WHERE id = client_uuid;
  
  IF NOT is_my_client THEN
    RAISE EXCEPTION 'Este cliente não está na sua carteira';
  END IF;
  
  -- Remove association
  UPDATE profiles SET accountant_id = NULL WHERE id = client_uuid;
  
  RETURN TRUE;
END;
$$;

-- Create function for client to remove their accountant association
CREATE OR REPLACE FUNCTION public.remove_my_accountant()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET accountant_id = NULL WHERE id = auth.uid();
  RETURN TRUE;
END;
$$;-- Adicionar campo revenue_category a sales_invoices para classificação de vendas
ALTER TABLE public.sales_invoices 
ADD COLUMN revenue_category TEXT DEFAULT 'prestacao_servicos';

-- Adicionar campo para confiança da classificação IA
ALTER TABLE public.sales_invoices 
ADD COLUMN ai_category_confidence INTEGER;

-- Índice para performance em queries por categoria
CREATE INDEX idx_sales_invoices_revenue_category ON public.sales_invoices(revenue_category);

-- Comentário explicativo
COMMENT ON COLUMN public.sales_invoices.revenue_category IS 'Categoria de receita para cálculos SS: prestacao_servicos, vendas, hotelaria, restauracao, alojamento_local, producao_venda, propriedade_intelectual, comercio';-- Criar tabela de retenções na fonte para Modelo 10
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
  EXECUTE FUNCTION public.update_updated_at_column();-- Adicionar campos de rendimentos isentos e dispensados conforme Portaria n.º 4/2024
ALTER TABLE public.tax_withholdings 
ADD COLUMN IF NOT EXISTS exempt_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS dispensed_amount NUMERIC DEFAULT 0;

-- Adicionar categoria E (Rendimentos de Capitais) à lista de categorias válidas
-- Nota: Não existe CHECK constraint na tabela, então só precisamos atualizar o código-- M10-002: Add support for non-resident beneficiaries
-- Adds is_non_resident flag and country_code for Modelo 10 compliance

ALTER TABLE public.tax_withholdings 
ADD COLUMN IF NOT EXISTS is_non_resident boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS country_code varchar(2);

-- Add comment for documentation
COMMENT ON COLUMN public.tax_withholdings.is_non_resident IS 'Whether the beneficiary is a non-resident for tax purposes';
COMMENT ON COLUMN public.tax_withholdings.country_code IS 'ISO 3166-1 alpha-2 country code for non-resident beneficiaries';-- Create table for withholding change history
CREATE TABLE public.withholding_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  withholding_id UUID NOT NULL REFERENCES public.tax_withholdings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  changes JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withholding_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their own withholdings
CREATE POLICY "Users can view own withholding logs" 
ON public.withholding_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tax_withholdings tw 
    WHERE tw.id = withholding_id 
    AND tw.client_id = auth.uid()
  )
);

-- Users can insert logs for their own withholdings
CREATE POLICY "Users can insert own withholding logs" 
ON public.withholding_logs 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_withholding_logs_withholding_id ON public.withholding_logs(withholding_id);
CREATE INDEX idx_withholding_logs_created_at ON public.withholding_logs(created_at DESC);-- CRITICAL SECURITY FIX: Remove unused gemini_api_key column
-- This column stored API keys client-side which is a security risk
-- The app now uses LOVABLE_API_KEY as a secure server-side secret

ALTER TABLE public.profiles DROP COLUMN IF EXISTS gemini_api_key;-- SECURITY FIX: Restrict sent_notifications INSERT policy
-- Previously allowed any authenticated user to insert notifications for any user
-- Now restricts to service_role only (for edge functions/backend use)

DROP POLICY IF EXISTS "System can insert sent notifications" ON public.sent_notifications;

CREATE POLICY "Service role can insert sent notifications"
ON public.sent_notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- Also allow authenticated users to insert ONLY for themselves (edge case for self-notifications)
CREATE POLICY "Users can insert own notifications"
ON public.sent_notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());-- Drop the old status check constraint
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add new constraint with 'classified' status included
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'classified'::text, 'validated'::text, 'rejected'::text]));-- Table to track client invitations created by accountants
CREATE TABLE public.client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  client_nif TEXT NOT NULL,
  client_name TEXT NOT NULL,
  company_name TEXT,
  magic_link_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

-- Accountants can view their own invitations
CREATE POLICY "Accountants can view own invitations"
ON public.client_invitations
FOR SELECT
USING (accountant_id = auth.uid());

-- Accountants can insert their own invitations
CREATE POLICY "Accountants can insert own invitations"
ON public.client_invitations
FOR INSERT
WITH CHECK (accountant_id = auth.uid() AND has_role(auth.uid(), 'accountant'::app_role));

-- Accountants can update their own invitations
CREATE POLICY "Accountants can update own invitations"
ON public.client_invitations
FOR UPDATE
USING (accountant_id = auth.uid());

-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
ON public.client_invitations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_client_invitations_accountant ON public.client_invitations(accountant_id);
CREATE INDEX idx_client_invitations_email ON public.client_invitations(client_email);-- Fix 1: Block anonymous access to profiles table
-- Add base authentication requirement for all operations
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Fix 2: Block anonymous access to revenue_entries table
CREATE POLICY "Require authentication for revenue_entries"
ON public.revenue_entries
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Fix 3: Add input validation to search_available_clients function
CREATE OR REPLACE FUNCTION public.search_available_clients(search_term text)
RETURNS TABLE(id uuid, full_name text, company_name text, nif text, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate input length
  IF LENGTH(search_term) > 100 THEN
    RAISE EXCEPTION 'Search term too long';
  END IF;
  
  -- Block dangerous LIKE patterns (potential DoS)
  IF search_term ~ '[%_]{4,}' THEN
    RAISE EXCEPTION 'Invalid search pattern';
  END IF;
  
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.company_name, p.nif, p.email
  FROM profiles p
  JOIN user_roles ur ON p.id = ur.user_id
  WHERE ur.role = 'client'
    AND p.accountant_id IS NULL
    AND p.id != auth.uid()
    AND (
      p.nif ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
      OR p.full_name ILIKE '%' || search_term || '%'
      OR p.company_name ILIKE '%' || search_term || '%'
    )
  LIMIT 20;
END;
$$;

-- Fix 4: Add ownership validation to get_accountant_clients
CREATE OR REPLACE FUNCTION public.get_accountant_clients(accountant_uuid uuid)
RETURNS TABLE(id uuid, full_name text, company_name text, nif text, email text, pending_invoices bigint, validated_invoices bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate caller is the accountant or an admin
  IF accountant_uuid != auth.uid() AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Can only query own clients';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.company_name,
    p.nif,
    p.email,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status IN ('pending', 'classified')), 0) as pending_invoices,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0) as validated_invoices
  FROM profiles p
  WHERE p.accountant_id = accountant_uuid;
END;
$$;

-- Fix 5: Add NIF validation to update_ai_metrics
CREATE OR REPLACE FUNCTION public.update_ai_metrics(p_supplier_nif text, p_supplier_name text DEFAULT NULL::text, p_was_correction boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate NIF format (9 digits)
  IF p_supplier_nif !~ '^[0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid NIF format';
  END IF;
  
  -- Validate supplier name length if provided
  IF p_supplier_name IS NOT NULL AND LENGTH(p_supplier_name) > 200 THEN
    RAISE EXCEPTION 'Supplier name too long';
  END IF;

  INSERT INTO ai_metrics (
    supplier_nif, 
    supplier_name, 
    total_classifications, 
    total_corrections, 
    last_classification_at, 
    last_correction_at
  )
  VALUES (
    p_supplier_nif, 
    p_supplier_name, 
    1, 
    CASE WHEN p_was_correction THEN 1 ELSE 0 END,
    NOW(),
    CASE WHEN p_was_correction THEN NOW() ELSE NULL END
  )
  ON CONFLICT (supplier_nif) DO UPDATE SET
    total_classifications = ai_metrics.total_classifications + 1,
    total_corrections = ai_metrics.total_corrections + CASE WHEN p_was_correction THEN 1 ELSE 0 END,
    last_classification_at = NOW(),
    last_correction_at = CASE WHEN p_was_correction THEN NOW() ELSE ai_metrics.last_correction_at END,
    supplier_name = COALESCE(EXCLUDED.supplier_name, ai_metrics.supplier_name),
    updated_at = NOW();
END;
$$;-- Remove overly permissive policies that allow any authenticated user
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Require authentication for revenue_entries" ON public.revenue_entries;

-- The existing specific policies already handle access control properly:
-- profiles: owner, accountant, admin can view/update
-- revenue_entries: owner, accountant, admin can view; owner can insert/update/delete
-- No broad authentication-only policies needed-- Add INSERT policy for accountants on invoices table
CREATE POLICY "Accountants can insert client invoices"
ON public.invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = invoices.client_id
    AND profiles.accountant_id = auth.uid()
  )
);

-- Add INSERT policy for accountants on sales_invoices table
CREATE POLICY "Accountants can insert client sales invoices"
ON public.sales_invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = sales_invoices.client_id
    AND profiles.accountant_id = auth.uid()
  )
);

-- Add UPDATE policy for accountants on sales_invoices table (was missing)
CREATE POLICY "Accountants can update client sales invoices"
ON public.sales_invoices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = sales_invoices.client_id
    AND profiles.accountant_id = auth.uid()
  )
);-- Add Storage INSERT policy for accountants to upload to client folders
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
);-- Add NISS column to profiles table for Social Security quick access
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS niss VARCHAR(11) NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.niss IS 'Número de Identificação da Segurança Social (11 digits)';-- Drop and recreate functions with new signatures
DROP FUNCTION IF EXISTS public.get_accountant_clients(uuid);
DROP FUNCTION IF EXISTS public.associate_client(uuid);
DROP FUNCTION IF EXISTS public.remove_client(uuid);

-- Update associate_client function to use new table
CREATE OR REPLACE FUNCTION public.associate_client(client_uuid uuid, p_access_level text DEFAULT 'full', p_is_primary boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_accountant BOOLEAN;
  client_exists BOOLEAN;
  already_associated BOOLEAN;
BEGIN
  -- Check if current user is an accountant
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accountant'
  ) INTO is_accountant;
  
  IF NOT is_accountant THEN
    RAISE EXCEPTION 'Apenas contabilistas podem associar clientes';
  END IF;
  
  -- Check if client exists
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = client_uuid
  ) INTO client_exists;
  
  IF NOT client_exists THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  
  -- Check if already associated
  SELECT EXISTS (
    SELECT 1 FROM client_accountants 
    WHERE client_id = client_uuid AND accountant_id = auth.uid()
  ) INTO already_associated;
  
  IF already_associated THEN
    RAISE EXCEPTION 'Este cliente já está associado a si';
  END IF;
  
  -- If this is the first accountant for this client, make them primary
  IF NOT EXISTS (SELECT 1 FROM client_accountants WHERE client_id = client_uuid) THEN
    p_is_primary := true;
  END IF;
  
  -- Insert the association
  INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
  VALUES (client_uuid, auth.uid(), p_access_level, p_is_primary, auth.uid());
  
  -- Also update legacy field for backwards compatibility
  IF p_is_primary THEN
    UPDATE profiles SET accountant_id = auth.uid() WHERE id = client_uuid;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Update remove_client function to use new table
CREATE OR REPLACE FUNCTION public.remove_client(client_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_accountant BOOLEAN;
  is_associated BOOLEAN;
  was_primary BOOLEAN;
BEGIN
  -- Check if current user is an accountant
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'accountant'
  ) INTO is_accountant;
  
  IF NOT is_accountant THEN
    RAISE EXCEPTION 'Apenas contabilistas podem remover clientes';
  END IF;
  
  -- Check if client is associated with this accountant
  SELECT EXISTS (
    SELECT 1 FROM client_accountants 
    WHERE client_id = client_uuid AND accountant_id = auth.uid()
  ) INTO is_associated;
  
  IF NOT is_associated THEN
    RAISE EXCEPTION 'Este cliente não está na sua carteira';
  END IF;
  
  -- Check if was primary
  SELECT is_primary INTO was_primary
  FROM client_accountants
  WHERE client_id = client_uuid AND accountant_id = auth.uid();
  
  -- Remove association
  DELETE FROM client_accountants 
  WHERE client_id = client_uuid AND accountant_id = auth.uid();
  
  -- If was primary, update legacy field and promote another accountant if exists
  IF was_primary THEN
    UPDATE profiles SET accountant_id = (
      SELECT accountant_id FROM client_accountants 
      WHERE client_id = client_uuid 
      ORDER BY created_at ASC 
      LIMIT 1
    ) WHERE id = client_uuid;
    
    -- Make the next accountant primary if exists
    UPDATE client_accountants 
    SET is_primary = true 
    WHERE client_id = client_uuid 
    AND accountant_id = (SELECT accountant_id FROM client_accountants WHERE client_id = client_uuid ORDER BY created_at ASC LIMIT 1);
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Update get_accountant_clients to use new table with new return type
CREATE OR REPLACE FUNCTION public.get_accountant_clients(accountant_uuid uuid)
RETURNS TABLE(
  id uuid, 
  full_name text, 
  company_name text, 
  nif text, 
  email text, 
  pending_invoices bigint, 
  validated_invoices bigint,
  access_level text,
  is_primary boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate caller is the accountant or an admin
  IF accountant_uuid != auth.uid() AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Can only query own clients';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.company_name,
    p.nif,
    p.email,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status IN ('pending', 'classified')), 0) as pending_invoices,
    COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0) as validated_invoices,
    ca.access_level,
    ca.is_primary
  FROM client_accountants ca
  JOIN profiles p ON p.id = ca.client_id
  WHERE ca.accountant_id = accountant_uuid;
END;
$$;

-- Function to get client's accountants
CREATE OR REPLACE FUNCTION public.get_client_accountants(client_uuid uuid)
RETURNS TABLE(
  id uuid,
  accountant_id uuid,
  full_name text,
  company_name text,
  nif text,
  email text,
  access_level text,
  is_primary boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate caller is the client, one of the accountants, or an admin
  IF client_uuid != auth.uid() 
    AND NOT EXISTS (SELECT 1 FROM client_accountants WHERE client_id = client_uuid AND accountant_id = auth.uid())
    AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ca.id,
    ca.accountant_id,
    p.full_name,
    p.company_name,
    p.nif,
    p.email,
    ca.access_level,
    ca.is_primary,
    ca.created_at
  FROM client_accountants ca
  JOIN profiles p ON p.id = ca.accountant_id
  WHERE ca.client_id = client_uuid
  ORDER BY ca.is_primary DESC, ca.created_at ASC;
END;
$$;

-- Function for primary accountant to invite another accountant
CREATE OR REPLACE FUNCTION public.invite_accountant_to_client(
  client_uuid uuid,
  accountant_nif text,
  p_access_level text DEFAULT 'full'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_primary_accountant BOOLEAN;
  target_accountant_id UUID;
BEGIN
  -- Check if current user is the primary accountant for this client
  SELECT EXISTS (
    SELECT 1 FROM client_accountants 
    WHERE client_id = client_uuid 
    AND accountant_id = auth.uid() 
    AND is_primary = true
  ) INTO is_primary_accountant;
  
  IF NOT is_primary_accountant THEN
    RAISE EXCEPTION 'Apenas o contabilista principal pode convidar outros contabilistas';
  END IF;
  
  -- Find the accountant by NIF
  SELECT p.id INTO target_accountant_id
  FROM profiles p
  JOIN user_roles ur ON p.id = ur.user_id
  WHERE p.nif = accountant_nif AND ur.role = 'accountant';
  
  IF target_accountant_id IS NULL THEN
    RAISE EXCEPTION 'Contabilista não encontrado com este NIF';
  END IF;
  
  -- Check if already associated
  IF EXISTS (SELECT 1 FROM client_accountants WHERE client_id = client_uuid AND accountant_id = target_accountant_id) THEN
    RAISE EXCEPTION 'Este contabilista já tem acesso a este cliente';
  END IF;
  
  -- Insert association
  INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
  VALUES (client_uuid, target_accountant_id, p_access_level, false, auth.uid());
  
  RETURN TRUE;
END;
$$;-- Function for clients to remove an accountant from their profile
CREATE OR REPLACE FUNCTION public.remove_client_accountant(p_accountant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  association_exists BOOLEAN;
  was_primary BOOLEAN;
BEGIN
  -- Check if association exists for this client
  SELECT EXISTS (
    SELECT 1 FROM client_accountants 
    WHERE client_id = auth.uid() AND accountant_id = p_accountant_id
  ) INTO association_exists;
  
  IF NOT association_exists THEN
    RAISE EXCEPTION 'Este contabilista não está associado à sua conta';
  END IF;
  
  -- Check if was primary
  SELECT is_primary INTO was_primary
  FROM client_accountants
  WHERE client_id = auth.uid() AND accountant_id = p_accountant_id;
  
  -- Remove association
  DELETE FROM client_accountants 
  WHERE client_id = auth.uid() AND accountant_id = p_accountant_id;
  
  -- If was primary, update legacy field and promote another accountant if exists
  IF was_primary THEN
    UPDATE profiles SET accountant_id = (
      SELECT accountant_id FROM client_accountants 
      WHERE client_id = auth.uid() 
      ORDER BY created_at ASC 
      LIMIT 1
    ) WHERE id = auth.uid();
    
    -- Make the next accountant primary if exists
    UPDATE client_accountants 
    SET is_primary = true 
    WHERE client_id = auth.uid() 
    AND accountant_id = (
      SELECT accountant_id FROM client_accountants 
      WHERE client_id = auth.uid() 
      ORDER BY created_at ASC 
      LIMIT 1
    );
  END IF;
  
  RETURN TRUE;
END;
$$;-- Table for accountant registration requests
CREATE TABLE public.accountant_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  occ_number TEXT, -- Ordem dos Contabilistas Certificados
  cedula_number TEXT, -- Número de cédula profissional
  company_name TEXT,
  tax_office TEXT, -- Repartição de Finanças
  specializations TEXT[], -- Áreas de especialização
  years_experience INTEGER,
  motivation TEXT, -- Razão para se registar
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT, -- Notas do admin sobre a decisão
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accountant_requests ENABLE ROW LEVEL SECURITY;

-- Users can view and insert their own requests
CREATE POLICY "Users can view own request"
ON public.accountant_requests
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own request"
ON public.accountant_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update pending request"
ON public.accountant_requests
FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending');

-- Admins can view and manage all requests
CREATE POLICY "Admins can view all requests"
ON public.accountant_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all requests"
ON public.accountant_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Function for admin to approve an accountant request
CREATE OR REPLACE FUNCTION public.approve_accountant_request(request_id uuid, p_admin_notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  request_user_id UUID;
  is_admin BOOLEAN;
BEGIN
  -- Check if caller is admin
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar pedidos';
  END IF;
  
  -- Get the user_id from the request
  SELECT user_id INTO request_user_id
  FROM accountant_requests
  WHERE id = request_id AND status = 'pending';
  
  IF request_user_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;
  
  -- Update request status
  UPDATE accountant_requests
  SET 
    status = 'approved',
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = request_id;
  
  -- Grant accountant role
  INSERT INTO user_roles (user_id, role)
  VALUES (request_user_id, 'accountant')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- Function for admin to reject an accountant request
CREATE OR REPLACE FUNCTION public.reject_accountant_request(request_id uuid, p_admin_notes text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if caller is admin
  SELECT has_role(auth.uid(), 'admin') INTO is_admin;
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem rejeitar pedidos';
  END IF;
  
  -- Update request status
  UPDATE accountant_requests
  SET 
    status = 'rejected',
    admin_notes = p_admin_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado';
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to check if user has pending accountant request
CREATE OR REPLACE FUNCTION public.get_my_accountant_request()
RETURNS TABLE(
  id uuid,
  status text,
  occ_number text,
  cedula_number text,
  admin_notes text,
  created_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id,
    ar.status,
    ar.occ_number,
    ar.cedula_number,
    CASE WHEN ar.status != 'pending' THEN ar.admin_notes ELSE NULL END,
    ar.created_at,
    ar.reviewed_at
  FROM accountant_requests ar
  WHERE ar.user_id = auth.uid()
  ORDER BY ar.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to get all pending requests for admins
CREATE OR REPLACE FUNCTION public.get_pending_accountant_requests()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  occ_number text,
  cedula_number text,
  company_name text,
  tax_office text,
  specializations text[],
  years_experience integer,
  motivation text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ar.id,
    ar.user_id,
    p.full_name,
    p.email,
    ar.occ_number,
    ar.cedula_number,
    ar.company_name,
    ar.tax_office,
    ar.specializations,
    ar.years_experience,
    ar.motivation,
    ar.created_at
  FROM accountant_requests ar
  JOIN profiles p ON p.id = ar.user_id
  WHERE ar.status = 'pending'
  ORDER BY ar.created_at ASC;
END;
$$;-- Add income_code column to tax_withholdings table to persist selected income codes
ALTER TABLE public.tax_withholdings 
ADD COLUMN income_code text;-- Create upload_queue table for background uploads
CREATE TABLE public.upload_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_data TEXT NOT NULL,
  qr_content TEXT,
  upload_type TEXT NOT NULL DEFAULT 'expense',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.upload_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for upload_queue
CREATE POLICY "Users can view own uploads" ON public.upload_queue
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own uploads" ON public.upload_queue
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own uploads" ON public.upload_queue
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own uploads" ON public.upload_queue
  FOR DELETE USING (user_id = auth.uid());

-- Create user_onboarding_progress table
CREATE TABLE public.user_onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  completed_steps TEXT[] NOT NULL DEFAULT '{}',
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_onboarding_progress
CREATE POLICY "Users can view own progress" ON public.user_onboarding_progress
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own progress" ON public.user_onboarding_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress" ON public.user_onboarding_progress
  FOR UPDATE USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_user_onboarding_progress_updated_at
  BEFORE UPDATE ON public.user_onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_upload_queue_user_id ON public.upload_queue(user_id);
CREATE INDEX idx_upload_queue_status ON public.upload_queue(status);
CREATE INDEX idx_user_onboarding_progress_user_id ON public.user_onboarding_progress(user_id);-- Add RLS policies for accountants to manage client withholdings

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
);-- Criar tabela client_accountants para gerir relações contabilista-cliente
CREATE TABLE public.client_accountants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    accountant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    access_level text NOT NULL DEFAULT 'full',
    is_primary boolean NOT NULL DEFAULT false,
    invited_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(client_id, accountant_id)
);

-- Criar índices para performance
CREATE INDEX idx_client_accountants_client ON public.client_accountants(client_id);
CREATE INDEX idx_client_accountants_accountant ON public.client_accountants(accountant_id);

-- Habilitar RLS
ALTER TABLE public.client_accountants ENABLE ROW LEVEL SECURITY;

-- Políticas RLS

-- Contabilistas podem ver suas próprias associações
CREATE POLICY "Accountants can view own associations"
ON public.client_accountants
FOR SELECT
USING (accountant_id = auth.uid());

-- Clientes podem ver quem os gere
CREATE POLICY "Clients can view their accountants"
ON public.client_accountants
FOR SELECT
USING (client_id = auth.uid());

-- Admins podem ver tudo
CREATE POLICY "Admins can view all associations"
ON public.client_accountants
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Contabilistas podem criar associações
CREATE POLICY "Accountants can insert associations"
ON public.client_accountants
FOR INSERT
WITH CHECK (
    accountant_id = auth.uid() 
    AND has_role(auth.uid(), 'accountant'::app_role)
);

-- Contabilistas podem remover suas associações
CREATE POLICY "Accountants can delete own associations"
ON public.client_accountants
FOR DELETE
USING (accountant_id = auth.uid());

-- Clientes podem remover contabilistas
CREATE POLICY "Clients can delete their accountants"
ON public.client_accountants
FOR DELETE
USING (client_id = auth.uid());

-- Admins podem gerir tudo
CREATE POLICY "Admins can manage all associations"
ON public.client_accountants
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrar dados existentes: criar registos para clientes com accountant_id
INSERT INTO public.client_accountants (client_id, accountant_id, is_primary, access_level)
SELECT id, accountant_id, true, 'full'
FROM public.profiles
WHERE accountant_id IS NOT NULL
ON CONFLICT (client_id, accountant_id) DO NOTHING;

-- Actualizar função associate_client para usar a nova tabela
CREATE OR REPLACE FUNCTION public.associate_client(
    client_uuid uuid,
    p_access_level text DEFAULT 'full',
    p_is_primary boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accountant_id uuid;
BEGIN
    v_accountant_id := auth.uid();
    
    -- Verificar se é contabilista
    IF NOT has_role(v_accountant_id, 'accountant') THEN
        RAISE EXCEPTION 'Apenas contabilistas podem associar clientes';
    END IF;
    
    -- Verificar se o cliente existe
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = client_uuid) THEN
        RAISE EXCEPTION 'Cliente não encontrado';
    END IF;
    
    -- Inserir na tabela client_accountants
    INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
    VALUES (client_uuid, v_accountant_id, p_access_level, p_is_primary, v_accountant_id)
    ON CONFLICT (client_id, accountant_id) DO UPDATE
    SET access_level = EXCLUDED.access_level,
        is_primary = EXCLUDED.is_primary;
    
    -- Actualizar accountant_id no perfil se for primário
    IF p_is_primary THEN
        UPDATE profiles SET accountant_id = v_accountant_id WHERE id = client_uuid;
    END IF;
    
    RETURN true;
END;
$$;

-- Actualizar função remove_client
CREATE OR REPLACE FUNCTION public.remove_client(client_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accountant_id uuid;
BEGIN
    v_accountant_id := auth.uid();
    
    -- Remover da tabela client_accountants
    DELETE FROM client_accountants 
    WHERE client_id = client_uuid AND accountant_id = v_accountant_id;
    
    -- Se era primário, remover do perfil
    UPDATE profiles 
    SET accountant_id = NULL 
    WHERE id = client_uuid AND accountant_id = v_accountant_id;
    
    RETURN true;
END;
$$;

-- Actualizar função get_accountant_clients para usar a nova tabela
CREATE OR REPLACE FUNCTION public.get_accountant_clients(accountant_uuid uuid)
RETURNS TABLE (
    id uuid,
    full_name text,
    company_name text,
    nif text,
    email text,
    pending_invoices bigint,
    validated_invoices bigint,
    access_level text,
    is_primary boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.company_name,
        p.nif,
        p.email,
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'pending'), 0) as pending_invoices,
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0) as validated_invoices,
        ca.access_level,
        ca.is_primary
    FROM client_accountants ca
    JOIN profiles p ON p.id = ca.client_id
    WHERE ca.accountant_id = accountant_uuid;
END;
$$;

-- Actualizar função get_client_accountants
CREATE OR REPLACE FUNCTION public.get_client_accountants(client_uuid uuid)
RETURNS TABLE (
    id uuid,
    accountant_id uuid,
    full_name text,
    company_name text,
    nif text,
    email text,
    access_level text,
    is_primary boolean,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ca.id,
        ca.accountant_id,
        p.full_name,
        p.company_name,
        p.nif,
        p.email,
        ca.access_level,
        ca.is_primary,
        ca.created_at
    FROM client_accountants ca
    JOIN profiles p ON p.id = ca.accountant_id
    WHERE ca.client_id = client_uuid;
END;
$$;

-- Criar função remove_client_accountant (para clientes removerem contabilistas)
CREATE OR REPLACE FUNCTION public.remove_client_accountant(p_accountant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client_id uuid;
BEGIN
    v_client_id := auth.uid();
    
    -- Remover da tabela client_accountants
    DELETE FROM client_accountants 
    WHERE client_id = v_client_id AND accountant_id = p_accountant_id;
    
    -- Se era o accountant_id do perfil, limpar
    UPDATE profiles 
    SET accountant_id = NULL 
    WHERE id = v_client_id AND accountant_id = p_accountant_id;
    
    RETURN true;
END;
$$;-- Add all 7 income categories to tax_withholdings table
-- This migration extends the income_category constraint to support all Modelo 10 categories

-- First, drop the existing constraint
ALTER TABLE public.tax_withholdings
DROP CONSTRAINT IF EXISTS tax_withholdings_income_category_check;

-- Add the new constraint with all 7 categories
ALTER TABLE public.tax_withholdings
ADD CONSTRAINT tax_withholdings_income_category_check
CHECK (income_category IN ('A', 'B', 'E', 'F', 'G', 'H', 'R'));

-- Update table comment to reflect supported categories
COMMENT ON COLUMN public.tax_withholdings.income_category IS
'Categoria de Rendimento (Modelo 10):
A = Trabalho Dependente (salários, ordenados)
B = Trabalho Independente (recibos verdes, prestadores de serviços)
E = Rendimentos de Capitais (juros, dividendos, lucros)
F = Rendimentos Prediais (rendas de imóveis)
G = Incrementos Patrimoniais (mais-valias)
H = Pensões (reforma, velhice, invalidez, alimentos)
R = Retenções IRC (rendimentos a pessoas coletivas)';
-- DUPLICATE OF 20260116155600 - made idempotent with IF NOT EXISTS guards
-- This migration was a duplicate. The original tables were already created
-- in migration 20260116155600_580a6176-a857-4bc0-b1a9-b1644e9301f3.sql

CREATE TABLE IF NOT EXISTS upload_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL DEFAULT 2025,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB,
  confidence NUMERIC(3, 2),
  warnings TEXT[],
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_upload_queue_client_status ON upload_queue(client_id, status);
CREATE INDEX IF NOT EXISTS idx_upload_queue_status_created ON upload_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_upload_queue_processing ON upload_queue(status) WHERE status = 'processing';

ALTER TABLE upload_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own queue items" ON upload_queue;
CREATE POLICY "Users can view own queue items"
  ON upload_queue FOR SELECT USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Users can insert own queue items" ON upload_queue;
CREATE POLICY "Users can insert own queue items"
  ON upload_queue FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Users can delete own queue items" ON upload_queue;
CREATE POLICY "Users can delete own queue items"
  ON upload_queue FOR DELETE USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Service role can update queue items" ON upload_queue;
CREATE POLICY "Service role can update queue items"
  ON upload_queue FOR UPDATE USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('upload-queue', 'upload-queue', false, 5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION get_queue_stats(user_id UUID)
RETURNS TABLE (total_count BIGINT, pending_count BIGINT, processing_count BIGINT, completed_count BIGINT, failed_count BIGINT)
AS $$
BEGIN
  RETURN QUERY SELECT
    COUNT(*)::BIGINT, COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'processing')::BIGINT, COUNT(*) FILTER (WHERE status = 'completed')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT
  FROM upload_queue WHERE client_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM upload_queue WHERE status IN ('completed', 'failed') AND completed_at < now() - INTERVAL '7 days' RETURNING id
  ) SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- DUPLICATE: user_onboarding_progress already created in 20260116155600
-- This migration had a conflicting schema (step_id vs completed_steps).
-- Made idempotent - all operations use IF NOT EXISTS / DROP IF EXISTS.

CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  step_id TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON public.user_onboarding_progress(user_id);

ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can view their own onboarding progress"
  ON public.user_onboarding_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can insert their own onboarding progress"
  ON public.user_onboarding_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can update their own onboarding progress"
  ON public.user_onboarding_progress FOR UPDATE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_onboarding_progress TO authenticated;
-- Create invoice_validation_logs table for tracking validation history
CREATE TABLE IF NOT EXISTS invoice_validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('purchase', 'sales')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('validated', 'rejected', 'edited', 'classification_changed', 'created')),
  changes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_invoice_id ON invoice_validation_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_user_id ON invoice_validation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_created_at ON invoice_validation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_invoice_type ON invoice_validation_logs(invoice_type);

-- Enable RLS
ALTER TABLE invoice_validation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view logs for invoices they have access to
CREATE POLICY "Users can view validation logs for their invoices"
  ON invoice_validation_logs FOR SELECT
  USING (
    -- Check if user owns the invoice (purchase)
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_validation_logs.invoice_id
      AND invoices.client_id = auth.uid()
    )
    OR
    -- Check if user owns the invoice (sales)
    EXISTS (
      SELECT 1 FROM sales_invoices
      WHERE sales_invoices.id = invoice_validation_logs.invoice_id
      AND sales_invoices.client_id = auth.uid()
    )
    OR
    -- Accountants can see logs for their clients' invoices
    EXISTS (
      SELECT 1 FROM client_accountants ca
      JOIN invoices i ON i.client_id = ca.client_id
      WHERE i.id = invoice_validation_logs.invoice_id
      AND ca.accountant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM client_accountants ca
      JOIN sales_invoices si ON si.client_id = ca.client_id
      WHERE si.id = invoice_validation_logs.invoice_id
      AND ca.accountant_id = auth.uid()
    )
    OR
    -- User created the log entry
    user_id = auth.uid()
  );

-- Policy: Users can insert logs for invoices they have access to
CREATE POLICY "Users can insert validation logs for their invoices"
  ON invoice_validation_logs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Check if user owns the invoice (purchase)
      EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.id = invoice_validation_logs.invoice_id
        AND invoices.client_id = auth.uid()
      )
      OR
      -- Check if user owns the invoice (sales)
      EXISTS (
        SELECT 1 FROM sales_invoices
        WHERE sales_invoices.id = invoice_validation_logs.invoice_id
        AND sales_invoices.client_id = auth.uid()
      )
      OR
      -- Accountants can insert logs for their clients' invoices
      EXISTS (
        SELECT 1 FROM client_accountants ca
        JOIN invoices i ON i.client_id = ca.client_id
        WHERE i.id = invoice_validation_logs.invoice_id
        AND ca.accountant_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM client_accountants ca
        JOIN sales_invoices si ON si.client_id = ca.client_id
        WHERE si.id = invoice_validation_logs.invoice_id
        AND ca.accountant_id = auth.uid()
      )
    )
  );

-- Create function to log validation changes
CREATE OR REPLACE FUNCTION log_invoice_validation(
  p_invoice_id UUID,
  p_invoice_type TEXT,
  p_action TEXT,
  p_changes JSONB DEFAULT '[]'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO invoice_validation_logs (
    invoice_id,
    invoice_type,
    user_id,
    action,
    changes
  ) VALUES (
    p_invoice_id,
    p_invoice_type,
    auth.uid(),
    p_action,
    p_changes
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_invoice_validation TO authenticated;

COMMENT ON TABLE invoice_validation_logs IS 'Stores history of validation actions on invoices';
COMMENT ON COLUMN invoice_validation_logs.invoice_type IS 'Type of invoice: purchase or sales';
COMMENT ON COLUMN invoice_validation_logs.action IS 'Type of action: validated, rejected, edited, classification_changed, created';
COMMENT ON COLUMN invoice_validation_logs.changes IS 'JSON array of changes: [{field, old_value, new_value}]';
-- DUPLICATE: invoice_validation_logs already created in 20260117100000
-- Made idempotent with IF NOT EXISTS / DROP IF EXISTS guards.

CREATE TABLE IF NOT EXISTS public.invoice_validation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  invoice_type text NOT NULL DEFAULT 'purchase',
  user_id uuid NOT NULL,
  action text NOT NULL,
  changes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoice_validation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies (idempotent via DROP IF EXISTS)
DROP POLICY IF EXISTS "Users can view own invoice logs" ON public.invoice_validation_logs;
CREATE POLICY "Users can view own invoice logs" ON public.invoice_validation_logs
FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM invoices i WHERE i.id = invoice_validation_logs.invoice_id AND i.client_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM sales_invoices si WHERE si.id = invoice_validation_logs.invoice_id AND si.client_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN profiles p ON p.id = i.client_id
    WHERE i.id = invoice_validation_logs.invoice_id AND p.accountant_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM sales_invoices si
    JOIN profiles p ON p.id = si.client_id
    WHERE si.id = invoice_validation_logs.invoice_id AND p.accountant_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own logs" ON public.invoice_validation_logs;
CREATE POLICY "Users can insert own logs" ON public.invoice_validation_logs
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all logs" ON public.invoice_validation_logs;
DO $$ BEGIN
  CREATE POLICY "Admins can view all logs" ON public.invoice_validation_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN undefined_function THEN
  -- has_role may not exist yet, skip admin policy
  NULL;
END $$;

-- Sync legacy data (idempotent via NOT EXISTS)
INSERT INTO client_accountants (client_id, accountant_id, is_primary, access_level, invited_by)
SELECT p.id, p.accountant_id, true, 'full', p.accountant_id
FROM profiles p
WHERE p.accountant_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM client_accountants ca
  WHERE ca.client_id = p.id AND ca.accountant_id = p.accountant_id
);

CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_invoice_id ON public.invoice_validation_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_validation_logs_user_id ON public.invoice_validation_logs(user_id);
-- Add missing columns to upload_queue for background processing
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS extracted_data jsonb;
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS confidence float;
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS warnings text[];
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS fiscal_year integer DEFAULT 2025;
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS started_at timestamptz;-- Add client_id column to upload_queue for accountant workflow
-- user_id = who uploaded the file (accountant or user)
-- client_id = who the withholding belongs to (the actual client)

-- Add client_id column (nullable for backwards compatibility, defaults to user_id)
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS client_id UUID;

-- Set default value for existing rows (client_id = user_id)
UPDATE upload_queue SET client_id = user_id WHERE client_id IS NULL;

-- Make it NOT NULL after setting defaults
ALTER TABLE upload_queue ALTER COLUMN client_id SET NOT NULL;

-- Add index for efficient querying by client
CREATE INDEX IF NOT EXISTS idx_upload_queue_client_id ON upload_queue(client_id);

-- Update the process-queue function comment
COMMENT ON COLUMN upload_queue.client_id IS 'The client ID for whom the withholding is being created (may differ from user_id for accountants)';
-- Fase 2: Adicionar constraint UNIQUE para prevenir duplicados futuros
-- Primeiro criar índice único parcial (não bloqueia dados existentes com duplicados)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_withholding_doc 
ON tax_withholdings (beneficiary_nif, document_reference, fiscal_year)
WHERE document_reference IS NOT NULL;-- Remove existing partial unique index that doesn't work with UPSERT
DROP INDEX IF EXISTS public.idx_unique_withholding_doc;

-- Create proper UNIQUE constraint for UPSERT to work
ALTER TABLE public.tax_withholdings 
ADD CONSTRAINT tax_withholdings_unique_doc UNIQUE (beneficiary_nif, document_reference, fiscal_year);-- =============================================================
-- MIGRATION: Limpar duplicados Modelo 10 e normalizar referências
-- =============================================================

-- PARTE 1: Eliminar duplicados por variação de prefixo
-- (ex: "FR ATSIRE01FR/22" vs "ATSIRE01FR/22" são o mesmo documento)
WITH normalized AS (
  SELECT 
    id,
    beneficiary_nif,
    fiscal_year,
    document_reference,
    gross_amount,
    created_at,
    REGEXP_REPLACE(document_reference, '^(FR |FT |RG |NC |ND |R |F )', '', 'i') as base_ref,
    ROW_NUMBER() OVER (
      PARTITION BY beneficiary_nif, fiscal_year, 
        REGEXP_REPLACE(document_reference, '^(FR |FT |RG |NC |ND |R |F )', '', 'i')
      ORDER BY created_at DESC
    ) as rn
  FROM tax_withholdings
  WHERE fiscal_year = 2025
),
prefix_duplicates AS (
  SELECT id FROM normalized WHERE rn > 1
)
DELETE FROM tax_withholdings WHERE id IN (SELECT id FROM prefix_duplicates);

-- PARTE 2: Eliminar duplicados por sufixo -1, -2 (cópias/segundas vias)
WITH copy_refs AS (
  SELECT 
    id,
    beneficiary_nif,
    fiscal_year,
    document_reference,
    REGEXP_REPLACE(document_reference, '-\d+$', '') as base_ref,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY beneficiary_nif, fiscal_year, 
        REGEXP_REPLACE(document_reference, '-\d+$', '')
      ORDER BY created_at DESC
    ) as rn
  FROM tax_withholdings
  WHERE fiscal_year = 2025
    AND document_reference ~ '-\d+$'
)
DELETE FROM tax_withholdings WHERE id IN (
  SELECT id FROM copy_refs WHERE rn > 1
);

-- PARTE 3: Corrigir valores brutos das 2 faturas (NIF 242821243)
-- O PDF da AT indica 900€ total para estas 2 faturas
-- Proporção correta baseada nos valores de retenção (66.70 + 36.80 = 103.50)
UPDATE tax_withholdings 
SET gross_amount = CASE 
  WHEN document_reference LIKE '%2500/000023%' THEN 580.00  -- 900 * (66.7/103.5) ≈ 580
  WHEN document_reference LIKE '%2500/000037%' THEN 320.00  -- 900 * (36.8/103.5) ≈ 320
  END
WHERE beneficiary_nif = '242821243' 
  AND fiscal_year = 2025
  AND document_reference LIKE '%2500/000%';

-- PARTE 4: Normalizar todas as referências existentes (remover prefixos)
UPDATE tax_withholdings
SET document_reference = REGEXP_REPLACE(document_reference, '^(FR |FT |RG |NC |ND |R |F )', '', 'i')
WHERE fiscal_year = 2025
  AND document_reference ~ '^(FR |FT |RG |NC |ND |R |F )';-- =============================================================
-- MIGRATION: Limpar duplicados Fatura+Recibo (FT/RG pairs)
-- Na contabilidade portuguesa, FT (fatura) e RG (recibo) da mesma
-- transação não devem ambos ser declarados no Modelo 10.
-- Mantemos apenas o documento mais recente (RG, que confirma pagamento).
-- =============================================================

-- Identificar e eliminar FT quando existe RG correspondente
-- (mesmo NIF, mesmo valor, data próxima = mesma transação)
WITH ft_rg_pairs AS (
  SELECT 
    t1.id as ft_id,
    t1.document_reference as ft_ref,
    t1.gross_amount as ft_amount,
    t1.payment_date as ft_date,
    t2.id as rg_id,
    t2.document_reference as rg_ref,
    t2.payment_date as rg_date
  FROM tax_withholdings t1
  JOIN tax_withholdings t2 
    ON t1.beneficiary_nif = t2.beneficiary_nif
    AND t1.fiscal_year = t2.fiscal_year
    AND t1.gross_amount = t2.gross_amount
    AND t1.id != t2.id
    AND t1.document_reference LIKE '%FT%'
    AND t2.document_reference LIKE '%RG%'
    AND ABS(t1.payment_date::date - t2.payment_date::date) <= 7
  WHERE t1.fiscal_year = 2025
)
DELETE FROM tax_withholdings 
WHERE id IN (SELECT ft_id FROM ft_rg_pairs);

-- Também limpar pares onde temos dois documentos com mesmo NIF+valor+data
-- (tolerância de 3 dias), mantendo apenas o mais recente
WITH semantic_duplicates AS (
  SELECT 
    id,
    beneficiary_nif,
    gross_amount,
    payment_date,
    document_reference,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY beneficiary_nif, gross_amount
      ORDER BY created_at DESC
    ) as rn
  FROM tax_withholdings
  WHERE fiscal_year = 2025
    AND beneficiary_nif IN (
      SELECT beneficiary_nif 
      FROM tax_withholdings 
      WHERE fiscal_year = 2025
      GROUP BY beneficiary_nif, gross_amount
      HAVING COUNT(*) > 1
    )
)
DELETE FROM tax_withholdings 
WHERE id IN (
  SELECT id FROM semantic_duplicates 
  WHERE rn > 1
  AND beneficiary_nif IN ('220899096', '223253960')
);-- Remover o duplicado específico com sufixo -1
DELETE FROM tax_withholdings 
WHERE fiscal_year = 2025
  AND document_reference = 'ATSIRE01FR/79-1'
  AND beneficiary_nif = '213298724';-- Add phone and address columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;-- Add source_sales_invoice_id to link tax_withholdings with sales_invoices
-- This enables data reuse between Modelo 10 and IVA flows

ALTER TABLE tax_withholdings 
ADD COLUMN IF NOT EXISTS source_sales_invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tax_withholdings_source_sales_invoice 
ON tax_withholdings(source_sales_invoice_id) 
WHERE source_sales_invoice_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tax_withholdings.source_sales_invoice_id IS 
'Links to the original sales invoice when a recibo verde is imported. Enables data reuse between Modelo 10 and IVA flows.';-- 1. Credenciais AT por cliente (encriptadas)
CREATE TABLE at_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) UNIQUE NOT NULL,
  accountant_id UUID REFERENCES profiles(id) NOT NULL,
  encrypted_username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  environment TEXT DEFAULT 'test', -- 'test' ou 'production'
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'never',
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Detalhe IVA por taxa (cada linha de IVA da fatura)
CREATE TABLE invoice_vat_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  tax_code TEXT NOT NULL,           -- NOR (23%), INT (13%), RED (6%), ISE (0%)
  tax_rate DECIMAL(5,2) NOT NULL,
  tax_base DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) NOT NULL,
  dp_field INTEGER,                 -- 20, 21, 22, 23, 24
  is_deductible BOOLEAN DEFAULT TRUE,
  deductibility_percent INTEGER DEFAULT 100,
  source TEXT DEFAULT 'csv',        -- 'csv', 'api_test', 'api_prod', 'qr'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Regras de classificação (globais + por cliente)
CREATE TABLE classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_nif TEXT NOT NULL,
  supplier_name_pattern TEXT,
  client_id UUID REFERENCES profiles(id), -- NULL = regra global
  client_cae TEXT,
  classification TEXT NOT NULL,     -- ACTIVIDADE/PESSOAL/MISTA
  dp_field INTEGER,                 -- 20/21/22/23/24
  deductibility INTEGER DEFAULT 100,
  confidence INTEGER DEFAULT 80,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  is_global BOOLEAN DEFAULT FALSE,
  requires_review BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_nif, client_id)
);

-- 4. Adicionar campos à invoices se não existirem
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_activity_related BOOLEAN DEFAULT TRUE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS efatura_source TEXT DEFAULT 'manual';

-- 5. Índices para performance
CREATE INDEX idx_invoice_vat_lines_invoice ON invoice_vat_lines(invoice_id);
CREATE INDEX idx_classification_rules_nif ON classification_rules(supplier_nif);
CREATE INDEX idx_at_credentials_client ON at_credentials(client_id);

-- 6. Regras globais pré-configuradas (fornecedores conhecidos)
INSERT INTO classification_rules (supplier_nif, supplier_name_pattern, classification, dp_field, deductibility, confidence, is_global, notes) VALUES
-- Utilities (sempre dedutíveis, Campo 24)
('503504564', 'EDP%', 'ACTIVIDADE', 24, 100, 95, true, 'Electricidade'),
('503423971', 'NOS%', 'ACTIVIDADE', 24, 100, 95, true, 'Telecoms'),
('501532927', 'MEO%', 'ACTIVIDADE', 24, 100, 95, true, 'Telecoms'),
('501525480', 'VODAFONE%', 'ACTIVIDADE', 24, 100, 95, true, 'Telecoms'),
('500091241', 'EPAL%', 'ACTIVIDADE', 24, 100, 95, true, 'Água'),
-- Combustíveis (50% dedutível por defeito, pode ser ajustado)
('500220152', 'GALP%', 'ACTIVIDADE', 24, 50, 70, true, 'Combustível - viatura ligeira'),
('503217580', 'BP%', 'ACTIVIDADE', 24, 50, 70, true, 'Combustível - viatura ligeira'),
('500667820', 'REPSOL%', 'ACTIVIDADE', 24, 50, 70, true, 'Combustível - viatura ligeira'),
-- Supermercados (requer revisão manual)
('500100144', 'CONTINENTE%', 'ACTIVIDADE', NULL, NULL, 30, true, 'Supermercado - validação manual'),
('500273170', 'PINGO DOCE%', 'ACTIVIDADE', NULL, NULL, 30, true, 'Supermercado - validação manual'),
('501659300', 'LIDL%', 'ACTIVIDADE', NULL, NULL, 30, true, 'Supermercado - validação manual')
ON CONFLICT DO NOTHING;

-- 7. RLS Policies
ALTER TABLE at_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_vat_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "at_credentials_access" ON at_credentials
  FOR ALL USING (
    accountant_id = auth.uid() OR 
    client_id = auth.uid()
  );

CREATE POLICY "invoice_vat_lines_access" ON invoice_vat_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices i 
      WHERE i.id = invoice_vat_lines.invoice_id 
      AND (i.client_id = auth.uid() OR i.validated_by = auth.uid())
    )
  );

CREATE POLICY "classification_rules_read" ON classification_rules
  FOR SELECT USING (
    is_global = true OR 
    client_id = auth.uid() OR 
    created_by = auth.uid()
  );

CREATE POLICY "classification_rules_write" ON classification_rules
  FOR INSERT WITH CHECK (
    client_id = auth.uid() OR 
    created_by = auth.uid()
  );

CREATE POLICY "classification_rules_update" ON classification_rules
  FOR UPDATE USING (
    client_id = auth.uid() OR 
    created_by = auth.uid()
  );

CREATE POLICY "classification_rules_delete" ON classification_rules
  FOR DELETE USING (
    client_id = auth.uid() OR 
    created_by = auth.uid()
  );

-- 8. Trigger para updated_at
CREATE TRIGGER update_at_credentials_updated_at
  BEFORE UPDATE ON at_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_classification_rules_updated_at
  BEFORE UPDATE ON classification_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Adicionar campos para melhor auditoria e compliance fiscal
-- Baseado no feedback: separar fonte técnica de autoridade legal

-- Campo para forçar validação contabilística (confiança < 80%)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS 
  requires_accountant_validation BOOLEAN DEFAULT FALSE;

-- Campo para indicar a autoridade/confiança dos dados
-- Valores: user_uploaded, at_certified, auto_classified
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS 
  data_authority TEXT DEFAULT 'user_uploaded';

-- Índice parcial para filtrar facturas que requerem revisão
CREATE INDEX IF NOT EXISTS idx_invoices_requires_validation 
  ON invoices(requires_accountant_validation) 
  WHERE requires_accountant_validation = TRUE;

-- Comentários para documentação
COMMENT ON COLUMN invoices.requires_accountant_validation IS 'Forçar revisão contabilística quando confiança IA < 80%';
COMMENT ON COLUMN invoices.data_authority IS 'Origem dos dados: user_uploaded, at_certified, auto_classified';-- =====================================================
-- Fix Adélia's Client Management: RLS + Backfill + Sync
-- =====================================================

-- 1) DROP existing restrictive policies on profiles for accountants
DROP POLICY IF EXISTS "Accountants can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Accountants can update client profiles" ON profiles;

-- 2) CREATE new policies based on client_accountants table (many-to-many model)

-- Accountants can SELECT profiles of clients they are associated with
CREATE POLICY "Accountants can view client profiles via association"
ON profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'accountant') 
  AND EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = profiles.id
    AND ca.accountant_id = auth.uid()
  )
);

-- Accountants can UPDATE profiles of clients they are associated with (full access)
CREATE POLICY "Accountants can update client profiles via association"
ON profiles FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'accountant') 
  AND EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = profiles.id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'accountant') 
  AND EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = profiles.id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- 3) BACKFILL: Insert missing associations from profiles.accountant_id into client_accountants
INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
SELECT 
  p.id AS client_id,
  p.accountant_id AS accountant_id,
  'full' AS access_level,
  TRUE AS is_primary,
  p.accountant_id AS invited_by
FROM profiles p
WHERE p.accountant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = p.id
    AND ca.accountant_id = p.accountant_id
  );

-- 4) CREATE sync trigger function: when profiles.accountant_id changes, sync to client_accountants
CREATE OR REPLACE FUNCTION sync_accountant_id_to_client_accountants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If accountant_id is being set or changed
  IF NEW.accountant_id IS NOT NULL AND (OLD.accountant_id IS DISTINCT FROM NEW.accountant_id) THEN
    -- Unmark previous primary if different accountant
    IF OLD.accountant_id IS NOT NULL AND OLD.accountant_id != NEW.accountant_id THEN
      UPDATE client_accountants
      SET is_primary = FALSE
      WHERE client_id = NEW.id AND accountant_id = OLD.accountant_id;
    END IF;
    
    -- Upsert new primary accountant
    INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
    VALUES (NEW.id, NEW.accountant_id, 'full', TRUE, NEW.accountant_id)
    ON CONFLICT (client_id, accountant_id) DO UPDATE
    SET is_primary = TRUE, access_level = 'full';
  END IF;
  
  -- If accountant_id is being cleared
  IF NEW.accountant_id IS NULL AND OLD.accountant_id IS NOT NULL THEN
    UPDATE client_accountants
    SET is_primary = FALSE
    WHERE client_id = NEW.id AND accountant_id = OLD.accountant_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5) CREATE the trigger
DROP TRIGGER IF EXISTS trigger_sync_accountant_to_client_accountants ON profiles;
CREATE TRIGGER trigger_sync_accountant_to_client_accountants
  AFTER UPDATE OF accountant_id ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_accountant_id_to_client_accountants();
-- ============================================
-- 1) ASSOCIAR ADÉLIA AOS CLIENTES DO BILAL
-- ============================================
INSERT INTO client_accountants (client_id, accountant_id, access_level, is_primary, invited_by)
SELECT 
  ca.client_id,
  '4cbe8e41-8127-49e2-a3f7-81bbfca89926' AS accountant_id,
  'full' AS access_level,
  FALSE AS is_primary,
  '980f4331-f39d-46b7-b6f1-274f95dab9ad' AS invited_by
FROM client_accountants ca
WHERE ca.accountant_id = '980f4331-f39d-46b7-b6f1-274f95dab9ad'
  AND NOT EXISTS (
    SELECT 1 FROM client_accountants ca2
    WHERE ca2.client_id = ca.client_id
    AND ca2.accountant_id = '4cbe8e41-8127-49e2-a3f7-81bbfca89926'
  );

-- ============================================
-- 2) ATUALIZAR RLS DE INVOICES
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client invoices" ON invoices;
DROP POLICY IF EXISTS "Accountants can update client invoices" ON invoices;
DROP POLICY IF EXISTS "Accountants can insert client invoices" ON invoices;

CREATE POLICY "Accountants can view client invoices via association"
ON invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = invoices.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can update client invoices via association"
ON invoices FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can insert client invoices via association"
ON invoices FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 3) ATUALIZAR RLS DE SALES_INVOICES
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client sales invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Accountants can update client sales invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Accountants can insert client sales invoices" ON sales_invoices;

CREATE POLICY "Accountants can view client sales invoices via association"
ON sales_invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = sales_invoices.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can update client sales invoices via association"
ON sales_invoices FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = sales_invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can insert client sales invoices via association"
ON sales_invoices FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = sales_invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 4) ATUALIZAR RLS DE TAX_WITHHOLDINGS
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client withholdings" ON tax_withholdings;
DROP POLICY IF EXISTS "Accountants can update client withholdings" ON tax_withholdings;
DROP POLICY IF EXISTS "Accountants can insert client withholdings" ON tax_withholdings;
DROP POLICY IF EXISTS "Accountants can delete client withholdings" ON tax_withholdings;

CREATE POLICY "Accountants can view client withholdings via association"
ON tax_withholdings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = tax_withholdings.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can update client withholdings via association"
ON tax_withholdings FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = tax_withholdings.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can insert client withholdings via association"
ON tax_withholdings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = tax_withholdings.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can delete client withholdings via association"
ON tax_withholdings FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = tax_withholdings.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 5) ATUALIZAR RLS DE SS_DECLARATIONS
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client declarations" ON ss_declarations;

CREATE POLICY "Accountants can view client declarations via association"
ON ss_declarations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = ss_declarations.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can insert client declarations via association"
ON ss_declarations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = ss_declarations.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can update client declarations via association"
ON ss_declarations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = ss_declarations.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 6) ATUALIZAR RLS DE REVENUE_ENTRIES
-- ============================================
DROP POLICY IF EXISTS "Accountants can view client revenue entries" ON revenue_entries;

CREATE POLICY "Accountants can view client revenue entries via association"
ON revenue_entries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = revenue_entries.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Accountants can insert client revenue entries via association"
ON revenue_entries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = revenue_entries.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can update client revenue entries via association"
ON revenue_entries FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = revenue_entries.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

CREATE POLICY "Accountants can delete client revenue entries via association"
ON revenue_entries FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = revenue_entries.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
);

-- ============================================
-- 7) ATUALIZAR FUNÇÃO search_available_clients
-- ============================================
DROP FUNCTION IF EXISTS search_available_clients(text);

CREATE FUNCTION search_available_clients(search_term text)
RETURNS TABLE(
  id uuid,
  full_name text,
  nif text,
  email text,
  company_name text,
  already_associated boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.nif,
    p.email,
    p.company_name,
    EXISTS (
      SELECT 1 FROM client_accountants ca 
      WHERE ca.client_id = p.id AND ca.accountant_id = auth.uid()
    ) AS already_associated
  FROM profiles p
  WHERE 
    p.id != auth.uid()
    AND (
      p.full_name ILIKE '%' || search_term || '%'
      OR p.nif ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
      OR p.company_name ILIKE '%' || search_term || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM client_accountants ca 
      WHERE ca.client_id = p.id AND ca.accountant_id = auth.uid()
    )
  ORDER BY p.full_name
  LIMIT 20;
END;
$$;
-- Drop existing functions to allow return type change
DROP FUNCTION IF EXISTS public.get_accountant_clients(uuid);
DROP FUNCTION IF EXISTS public.search_available_clients(text);

-- Recreate get_accountant_clients with phone and address
CREATE FUNCTION public.get_accountant_clients(accountant_uuid uuid)
RETURNS TABLE(
    id uuid, 
    full_name text, 
    company_name text, 
    nif text, 
    email text, 
    phone text,
    address text,
    pending_invoices bigint, 
    validated_invoices bigint, 
    access_level text, 
    is_primary boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.company_name,
        p.nif,
        p.email,
        p.phone,
        p.address,
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'pending'), 0),
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.client_id = p.id AND i.status = 'validated'), 0),
        ca.access_level,
        ca.is_primary
    FROM client_accountants ca
    JOIN profiles p ON p.id = ca.client_id
    WHERE ca.accountant_id = accountant_uuid;
END;
$$;

-- Recreate search_available_clients with phone and address
CREATE FUNCTION public.search_available_clients(search_term text)
RETURNS TABLE(
    id uuid, 
    full_name text, 
    nif text, 
    email text, 
    company_name text, 
    phone text,
    address text,
    already_associated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.nif,
    p.email,
    p.company_name,
    p.phone,
    p.address,
    EXISTS (
      SELECT 1 FROM client_accountants ca 
      WHERE ca.client_id = p.id AND ca.accountant_id = auth.uid()
    ) AS already_associated
  FROM profiles p
  WHERE 
    p.id != auth.uid()
    AND (
      p.full_name ILIKE '%' || search_term || '%'
      OR p.nif ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
      OR p.company_name ILIKE '%' || search_term || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM client_accountants ca 
      WHERE ca.client_id = p.id AND ca.accountant_id = auth.uid()
    )
  ORDER BY p.full_name
  LIMIT 20;
END;
$$;-- Adicionar campo para email de contacto AT (usado no CSR)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS at_contact_email text;

COMMENT ON COLUMN public.profiles.at_contact_email IS 
  'Email de contacto para comunicações com a AT (usado no CSR)';-- ============================================================================
-- FASE 1: Extensão da Base de Dados para Integração AT e-Fatura Multi-Cliente
-- ============================================================================

-- 1.1 Extensão da tabela at_credentials com novos campos para certificado e credenciais
ALTER TABLE public.at_credentials
ADD COLUMN IF NOT EXISTS certificate_pfx_base64 text,
ADD COLUMN IF NOT EXISTS certificate_password_encrypted text,
ADD COLUMN IF NOT EXISTS certificate_valid_from timestamptz,
ADD COLUMN IF NOT EXISTS certificate_valid_to timestamptz,
ADD COLUMN IF NOT EXISTS at_public_key_base64 text,
ADD COLUMN IF NOT EXISTS subuser_id text,
ADD COLUMN IF NOT EXISTS portal_nif text,
ADD COLUMN IF NOT EXISTS portal_password_encrypted text;

-- Comentários para documentação
COMMENT ON COLUMN public.at_credentials.certificate_pfx_base64 IS 'Ficheiro PFX do contabilista em Base64 (encriptado)';
COMMENT ON COLUMN public.at_credentials.certificate_password_encrypted IS 'Password do PFX encriptada com AES-256-GCM';
COMMENT ON COLUMN public.at_credentials.certificate_valid_from IS 'Data início validade do certificado';
COMMENT ON COLUMN public.at_credentials.certificate_valid_to IS 'Data fim validade do certificado';
COMMENT ON COLUMN public.at_credentials.at_public_key_base64 IS 'ChaveCifraPublicaAT2027.cer em Base64 para WS-Security';
COMMENT ON COLUMN public.at_credentials.subuser_id IS 'Subutilizador AT formato NIF/num (ex: 232945993/1)';
COMMENT ON COLUMN public.at_credentials.portal_nif IS 'NIF de acesso ao Portal das Finanças (pode ser diferente do client_id)';
COMMENT ON COLUMN public.at_credentials.portal_password_encrypted IS 'Password do Portal das Finanças encriptada';

-- Índice para pesquisa por NIF do portal
CREATE INDEX IF NOT EXISTS idx_at_credentials_portal_nif 
ON public.at_credentials(portal_nif);

-- Índice para pesquisa por accountant_id (para certificados partilhados)
CREATE INDEX IF NOT EXISTS idx_at_credentials_accountant_id 
ON public.at_credentials(accountant_id);

-- 1.2 Nova Tabela at_sync_history - Histórico de sincronizações para audit trail
CREATE TABLE IF NOT EXISTS public.at_sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  accountant_id uuid REFERENCES auth.users(id),
  sync_type text NOT NULL CHECK (sync_type IN ('compras', 'vendas', 'ambos')),
  sync_method text NOT NULL CHECK (sync_method IN ('api', 'csv', 'manual')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  records_imported integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  records_skipped integer DEFAULT 0,
  records_errors integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'partial', 'error')),
  error_message text,
  error_details jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

-- Comentários
COMMENT ON TABLE public.at_sync_history IS 'Histórico de sincronizações com AT e-Fatura para audit trail';
COMMENT ON COLUMN public.at_sync_history.sync_type IS 'Tipo de sincronização: compras, vendas ou ambos';
COMMENT ON COLUMN public.at_sync_history.sync_method IS 'Método usado: api (webservice), csv (import manual) ou manual';
COMMENT ON COLUMN public.at_sync_history.metadata IS 'Metadados adicionais (ex: NIF consultado, período fiscal, etc)';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_at_sync_history_client_id ON public.at_sync_history(client_id);
CREATE INDEX IF NOT EXISTS idx_at_sync_history_accountant_id ON public.at_sync_history(accountant_id);
CREATE INDEX IF NOT EXISTS idx_at_sync_history_created_at ON public.at_sync_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_at_sync_history_status ON public.at_sync_history(status);

-- Enable RLS
ALTER TABLE public.at_sync_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies para at_sync_history
CREATE POLICY "Users can view own sync history"
ON public.at_sync_history FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Accountants can view client sync history via association"
ON public.at_sync_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = at_sync_history.client_id
    AND ca.accountant_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all sync history"
ON public.at_sync_history FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own sync history"
ON public.at_sync_history FOR INSERT
WITH CHECK (client_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Accountants can insert sync history for clients"
ON public.at_sync_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_accountants ca
    WHERE ca.client_id = at_sync_history.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
  )
  OR created_by = auth.uid()
);

CREATE POLICY "Users can update own sync history"
ON public.at_sync_history FOR UPDATE
USING (created_by = auth.uid());

-- 1.3 Tabela para armazenar configuração global do contabilista (certificados partilhados)
CREATE TABLE IF NOT EXISTS public.accountant_at_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_pfx_base64 text,
  certificate_password_encrypted text,
  certificate_cn text,
  certificate_valid_from timestamptz,
  certificate_valid_to timestamptz,
  at_public_key_base64 text,
  subuser_id text,
  subuser_password_encrypted text,
  environment text DEFAULT 'test' CHECK (environment IN ('test', 'production')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(accountant_id)
);

-- Comentários
COMMENT ON TABLE public.accountant_at_config IS 'Configuração de certificado AT do contabilista (partilhado entre clientes)';
COMMENT ON COLUMN public.accountant_at_config.certificate_cn IS 'Common Name do certificado (NIF)';
COMMENT ON COLUMN public.accountant_at_config.subuser_id IS 'ID do subutilizador WFA (ex: 232945993/1)';

-- Enable RLS
ALTER TABLE public.accountant_at_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies para accountant_at_config
CREATE POLICY "Accountants can manage own AT config"
ON public.accountant_at_config FOR ALL
USING (accountant_id = auth.uid())
WITH CHECK (accountant_id = auth.uid());

CREATE POLICY "Admins can view all AT configs"
ON public.accountant_at_config FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_accountant_at_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_accountant_at_config_updated_at ON public.accountant_at_config;
CREATE TRIGGER trigger_accountant_at_config_updated_at
BEFORE UPDATE ON public.accountant_at_config
FOR EACH ROW
EXECUTE FUNCTION update_accountant_at_config_updated_at();-- Job queue table for background AT synchronization
CREATE TABLE public.at_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message text,
  invoices_synced integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  job_batch_id uuid -- groups jobs from same "Sync All" action
);

-- Indexes for efficient queue processing
CREATE INDEX idx_sync_jobs_pending ON public.at_sync_jobs(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_sync_jobs_batch ON public.at_sync_jobs(job_batch_id) WHERE job_batch_id IS NOT NULL;
CREATE INDEX idx_sync_jobs_accountant ON public.at_sync_jobs(accountant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.at_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Accountants can view their own jobs
CREATE POLICY "Accountants can view own sync jobs"
ON public.at_sync_jobs FOR SELECT
USING (accountant_id = auth.uid());

-- Accountants can create jobs for their clients
CREATE POLICY "Accountants can create sync jobs"
ON public.at_sync_jobs FOR INSERT
WITH CHECK (
  accountant_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM client_accountants ca 
    WHERE ca.client_id = at_sync_jobs.client_id 
    AND ca.accountant_id = auth.uid()
  )
);

-- Only service role can update (from Edge Functions)
CREATE POLICY "Service role can update sync jobs"
ON public.at_sync_jobs FOR UPDATE
USING (true)
WITH CHECK (true);

-- Batch progress view for efficient UI polling
CREATE OR REPLACE FUNCTION public.get_sync_batch_progress(p_batch_id uuid)
RETURNS TABLE(
  total integer,
  pending integer,
  processing integer,
  completed integer,
  errors integer,
  total_invoices integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*)::integer as total,
    COUNT(*) FILTER (WHERE status = 'pending')::integer as pending,
    COUNT(*) FILTER (WHERE status = 'processing')::integer as processing,
    COUNT(*) FILTER (WHERE status = 'completed')::integer as completed,
    COUNT(*) FILTER (WHERE status = 'error')::integer as errors,
    COALESCE(SUM(invoices_synced), 0)::integer as total_invoices
  FROM at_sync_jobs
  WHERE job_batch_id = p_batch_id;
$$;-- Security Fix: Replace overly permissive RLS policies (USING true)
-- These policies allowed ANY authenticated user to UPDATE any row,
-- not just the service role as intended.

-- ============================================================
-- FIX 1: at_sync_jobs UPDATE policy
-- Only accountants should update their own jobs, and service role
-- should be able to update any (for background processing)
-- ============================================================

DROP POLICY IF EXISTS "Service role can update sync jobs" ON public.at_sync_jobs;

-- Accountants can update their own sync jobs (e.g., cancel)
CREATE POLICY "Accountants can update own sync jobs"
ON public.at_sync_jobs FOR UPDATE
USING (accountant_id = auth.uid())
WITH CHECK (accountant_id = auth.uid());

-- ============================================================
-- FIX 2: upload_queue UPDATE policy
-- Only the owner should update their own queue items
-- Service role bypasses RLS automatically
-- ============================================================

DROP POLICY IF EXISTS "Service role can update queue items" ON upload_queue;

-- Users can update their own queue items
CREATE POLICY "Users can update own queue items"
ON upload_queue FOR UPDATE
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

-- ============================================================
-- FIX 3: at_credentials - split FOR ALL into granular policies
-- Clients should only SELECT their own credentials, not modify them
-- ============================================================

DROP POLICY IF EXISTS "at_credentials_access" ON at_credentials;

-- Accountants have full CRUD on their managed credentials
CREATE POLICY "Accountants manage credentials"
ON at_credentials FOR ALL
USING (accountant_id = auth.uid())
WITH CHECK (accountant_id = auth.uid());

-- Clients can only view their own credentials
CREATE POLICY "Clients view own credentials"
ON at_credentials FOR SELECT
USING (client_id = auth.uid());

-- ============================================================
-- NOTE: Service role (used by Edge Functions) bypasses RLS entirely,
-- so no explicit service role policy is needed.
-- ============================================================
ALTER TABLE public.accountant_at_config ADD COLUMN IF NOT EXISTS ca_chain_pem text;-- Add CA certificate chain column to accountant_at_config
-- Stores PEM-encoded DGITA Root CA certificate(s) for AT TLS trust
-- AT uses a private Certificate Authority (DGITA) not in standard trust stores
ALTER TABLE public.accountant_at_config
ADD COLUMN IF NOT EXISTS ca_chain_pem text;
-- BUG 2 FIX: Allow 'portal' sync_method in at_sync_history
ALTER TABLE public.at_sync_history
DROP CONSTRAINT IF EXISTS at_sync_history_sync_method_check,
ADD CONSTRAINT at_sync_history_sync_method_check
CHECK (sync_method IN ('api', 'csv', 'manual', 'portal'));

COMMENT ON COLUMN public.at_sync_history.sync_method IS 'Método usado: api (webservice SOAP), csv (import manual), manual (entrada manual) ou portal (e-Fatura JSON endpoint)';

-- Drop the restrictive DELETE policy
DROP POLICY IF EXISTS "No one can delete invoices" ON public.invoices;

-- Clients can delete their own invoices
CREATE POLICY "Clients can delete own invoices"
ON public.invoices
FOR DELETE
TO authenticated
USING (client_id = auth.uid());

-- Accountants can delete client invoices via association
CREATE POLICY "Accountants can delete client invoices via association"
ON public.invoices
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM client_accountants ca
  WHERE ca.client_id = invoices.client_id
    AND ca.accountant_id = auth.uid()
    AND ca.access_level = 'full'
));
-- Add supplier_vat_id to store foreign VAT IDs (e.g., IE..., ES..., FR...) separately from PT NIF.
-- This is additive and non-breaking. We keep supplier_nif as the primary identifier for now.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS supplier_vat_id text;

-- Allow Campo 10 (Aquisições Intracomunitárias) in invoices.ai_dp_field
-- This matches the DP export logic which supports dp_field=10 for reverse charge flows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'invoices'
      AND c.conname = 'invoices_ai_dp_field_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.invoices DROP CONSTRAINT invoices_ai_dp_field_check';
  END IF;
END $$;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_ai_dp_field_check
  CHECK (ai_dp_field IN (10, 20, 21, 22, 23, 24));


-- Migration 1: Add supplier_vat_id column
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS supplier_vat_id text;

-- Migration 2: Expand ai_dp_field constraint to accept value 10
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_ai_dp_field_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_ai_dp_field_check CHECK (ai_dp_field IN (10, 20, 21, 22, 23, 24));
-- Allow explicit invoice exclusion from DP calculation with an auditable reason.
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS exclusion_reason text;


ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exclusion_reason TEXT DEFAULT NULL;
