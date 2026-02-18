-- ============================================================================
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
EXECUTE FUNCTION update_accountant_at_config_updated_at();