-- =============================================
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