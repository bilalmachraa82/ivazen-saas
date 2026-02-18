-- 1. Credenciais AT por cliente (encriptadas)
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
  EXECUTE FUNCTION public.update_updated_at_column();