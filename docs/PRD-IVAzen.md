# 📋 PRD: Raquel Assistente IVA MVP
## AllSyn Accounting — Versão 2025.3 (Final)

---

## 1. Visão e Objectivos

### 1.1 Visão do Produto
**Raquel Assistente IVA** é uma aplicação que transforma a captura de facturas com QR code numa experiência automatizada e inteligente. O objectivo é reduzir em **70% o tempo** que a Raquel (e a equipa AllSyn) dedica à classificação manual de despesas para declaração periódica de IVA.

### 1.2 Objectivos do MVP (4 semanas)

| Métrica | Alvo | Método de Medição |
|---------|------|-------------------|
| Taxa de extracção QR code | >98% | Campos obrigatórios extraídos correctamente |
| Precisão de classificação IA | >90% | Correcções manuais vs. sugestões automáticas |
| Tempo médio por factura | <5s | Desde upload até classificação sugerida |
| Redução tempo Raquel | 70% | Comparação antes/depois (horas semanais) |

---

## 2. Arquitectura: PWA (Progressive Web App)

### 2.1 Justificação da Escolha

| Critério | React Native | PWA (Escolhido) |
|----------|--------------|-----------------|
| Tempo de desenvolvimento | 4-6 semanas | 2-3 semanas |
| Acesso à câmara | ✅ Nativo | ✅ MediaDevices API |
| Deploy | App Store + Play Store (revisão) | Deploy instantâneo |
| Manutenção | 2 codebases (iOS/Android) | 1 codebase web |
| Instalação cliente | Download obrigatório | Opcional (add to home) |
| Lovable compatibility | ❌ Não suportado | ✅ Totalmente suportado |

### 2.2 Stack Técnica

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Lovable Cloud (Supabase)
- **IA**: Gemini 3 Flash (BYOK - Bring Your Own Key obrigatório)
- **Storage**: Supabase Storage (imagens facturas)
- **Auth**: Supabase Auth (email + password)

---

## 3. Personas e Jornadas

### 3.1 Personas

| Persona | Perfil | Volume Mensal | Necessidade Principal |
|---------|--------|---------------|----------------------|
| **Manuel** (Café) | Dono de café, Porto, 45 anos | 80-120 facturas | Enviar facturas sem complicações |
| **Sofia** (Oficina) | Gerente de oficina, Lisboa, 38 anos | 150-200 facturas | Separar despesas pessoais vs. empresa |
| **Raquel** (Contabilista) | Contabilista AllSyn, 32 anos | 25+ clientes | Validar rapidamente e exportar dados |

### 3.2 Jornadas Simplificadas

**Cliente (3 passos)**:
1. Abre app no telemóvel → Fotografa QR code
2. Vê classificação sugerida → Confirma ou reporta erro
3. "Factura processada!" — total <5 segundos

**Raquel (4 passos)**:
1. Abre dashboard → Vê facturas pendentes de validação
2. Revê classificações (prioridade: baixa confiança)
3. Corrige se necessário → Marca como validado
4. Final do mês: exporta Excel por campos 20-24

---

## 4. Regras de Negócio IVA

### 4.1 Taxas de IVA Portugal 2025

| Região | Reduzida | Intermédia | Normal |
|--------|----------|------------|--------|
| **Continente** | 6% | 13% | 23% |
| **Açores** | 4% | 9% | 16% |
| **Madeira** | 5% | 12% | 22% |

### 4.2 Campos da Declaração Periódica — Quadro 06 (IVA Dedutível)

| Campo | Descrição Oficial | Exemplos |
|-------|-------------------|----------|
| **20** | IVA dedutível - **Imobilizado** (qualquer taxa) | Computadores >1000€, mobiliário, veículos, máquinas |
| **21** | IVA dedutível - **Existências** a taxa reduzida (6%) | Pão, leite, frutas para revenda |
| **22** | IVA dedutível - **Existências** a taxa intermédia (13%) | Vinhos, óleos para revenda em restauração |
| **23** | IVA dedutível - **Existências** a taxa normal (23%) | Café, detergentes, matéria-prima taxa normal |
| **24** | IVA dedutível - **Outros bens e serviços** | Serviços, material escritório, comunicações, combustível |

> ⚠️ **NOTA**: Campos 21-23 são diferenciados por **taxa de IVA**, não por tipo de existência. O CAE fornece contexto mas **não determina** a dedutibilidade (Art. 21º CIVA aplica-se universalmente).

### 4.3 Regras de Dedutibilidade — Art. 21º CIVA

| Categoria | Dedutibilidade | Campo | Notas Legais |
|-----------|----------------|-------|--------------|
| **Matéria-prima actividade** | 100% | 21/22/23 | Conforme taxa aplicável |
| **Equipamento profissional >1000€** | 100% | 20 | Imobilizado (vida útil >1 ano) |
| **Material escritório** | 100% | 24 | Papel, tinteiros, consumíveis |
| **Serviços profissionais** | 100% | 24 | Contabilista, advogado, consultor |
| **Comunicações** | 100% | 24 | Telefone, internet, correios |
| **Energia (local trabalho)** | 100% | 24 | Electricidade, gás, água |
| **Gasóleo (viaturas ligeiras passageiros)** | **50%** | 24 | Art. 21º nº1 al. b) |
| **Gasóleo (viaturas mercadorias/táxi)** | **100%** | 24 | Viaturas de transporte |
| **GPL, GN, biocombustíveis** | **50%** | 24 | Viaturas ligeiras passageiros |
| **Electricidade (veículos eléctricos)** | **100%** | 24 | Sem limitação |
| **Gasolina (viaturas)** | **0%** | — | Nunca dedutível |
| **Gasolina (geradores, motosserras)** | **100%** | 24 | Máquinas/equipamentos, não viaturas |
| **Portagens** | **Proporcional** | 24 | Se viatura afecta à actividade |
| **Viagens/alojamento** | **25%** (ou 0%) | 24 | Só com factura de organizador de eventos |
| **Despesas representação** | **0%** | — | Art. 21º nº1 al. d) |
| **Despesas luxo/lazer** | **0%** | — | Nunca dedutível |

### 4.4 Casos Práticos de Classificação

| Cenário | Classificação | Campo | Justificação |
|---------|---------------|-------|--------------|
| Café compra café para servir | ACTIVIDADE 100% | 23 | Existência taxa normal (23%) |
| Café compra vinho para servir | ACTIVIDADE 100% | 22 | Existência taxa intermédia (13%) |
| Café compra pão para servir | ACTIVIDADE 100% | 21 | Existência taxa reduzida (6%) |
| Oficina compra ferramentas 500€ | ACTIVIDADE 100% | 24 | <1000€ → Outros bens |
| Oficina compra elevador 5000€ | ACTIVIDADE 100% | 20 | Imobilizado |
| Consultor gasóleo carro misto | ACTIVIDADE 50% | 24 | Ligeiro passageiros |
| Transportador gasóleo carrinha | ACTIVIDADE 100% | 24 | Viatura mercadorias |
| Agricultor gasolina motosserra | ACTIVIDADE 100% | 24 | Equipamento, não viatura |
| Freelancer almoço sozinho | PESSOAL 0% | — | Despesa pessoal |
| Empresa catering evento clientes | PESSOAL 0% | — | Despesa representação |

---

## 5. Estrutura do QR Code PT (Portaria 195/2020)

### 5.1 Campos Obrigatórios

| Código | Descrição | Formato | Exemplo |
|--------|-----------|---------|---------|
| **A** | NIF Emitente | 9 dígitos | `A:123456789` |
| **B** | NIF Cliente | 9 dígitos ou "999999990" | `B:999999990` |
| **C** | País Cliente | ISO 3166-1 alpha-2 | `C:PT` |
| **D** | Tipo Documento | FT/FS/FR/NC/ND | `D:FT` |
| **E** | Estado Documento | N/A/F/R/S | `E:N` |
| **F** | Data | YYYYMMDD | `F:20250115` |
| **G** | Identificador Único | Série + Nº | `G:FT AB2025/35` |
| **H** | ATCUD | Código AT + Sequencial | `H:CSDF7T5H-35` |
| **I1** | Espaço Fiscal | PT/PT-AC/PT-MA | `I1:PT` |
| **N** | Total Documento | Decimal | `N:408.50` |
| **Q** | Hash (4 caracteres) | Base64 | `Q:ABCD` |
| **R** | Nº Certificado Software | Numérico | `R:1234` |

### 5.2 Campos de Bases Tributáveis e IVA

| Código | Descrição | Taxa |
|--------|-----------|------|
| **I2** | Base Isenta | 0% |
| **I3** | Base Taxa Reduzida | 6% |
| **I4** | IVA Taxa Reduzida | 6% |
| **I5** | Base Taxa Intermédia | 13% |
| **I6** | IVA Taxa Intermédia | 13% |
| **I7** | Base Taxa Normal | 23% |
| **I8** | IVA Taxa Normal | 23% |
| **O** | Total IVA | Soma |

---

## 6. Requisitos Funcionais

### 6.1 Módulo: Captura (PWA)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F1.1 | Acesso à câmara via MediaDevices API | P0 |
| F1.2 | Detecção automática de QR code | P0 |
| F1.3 | Feedback visual quando QR detectado | P0 |
| F1.4 | Upload de imagem da galeria | P1 |
| F1.5 | Modo offline com sync posterior | P2 |

### 6.2 Módulo: Processamento OCR (Edge Function)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F2.1 | Parsear QR code estruturado PT | P0 |
| F2.2 | Validar NIF (check digit) | P0 |
| F2.3 | Extrair todas as bases I2-I8 | P0 |
| F2.4 | Detectar região fiscal (PT/PT-AC/PT-MA) | P0 |
| F2.5 | Fallback OCR texto se QR ilegível | P1 |

### 6.3 Módulo: Classificação IA (Lovable AI)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F3.1 | Classificar ACTIVIDADE vs. PESSOAL vs. MISTA | P0 |
| F3.2 | Mapear para campo DP correcto (20-24) | P0 |
| F3.3 | Calcular % dedutibilidade | P0 |
| F3.4 | Indicar confiança (0-100%) | P0 |
| F3.5 | Fornecer justificação legível | P0 |

### 6.4 Módulo: Aprendizagem Contínua (Few-Shot Learning)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F3.6 | Guardar exemplos validados em tabela dedicada | P0 |
| F3.7 | Pesquisar exemplos similares por NIF fornecedor + categoria | P0 |
| F3.8 | Incluir 3-5 exemplos similares no prompt IA | P0 |
| F3.9 | Monitorar taxa de correcções para medir melhoria | P1 |

**Implementação Few-Shot Learning:**

```sql
-- Tabela de exemplos validados
CREATE TABLE classification_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_nif TEXT NOT NULL,
  supplier_name TEXT,
  expense_category TEXT, -- "combustivel", "material_escritorio", etc.
  client_activity TEXT,  -- Descrição actividade do cliente
  final_classification TEXT NOT NULL, -- ACTIVIDADE/PESSOAL/MISTA
  final_dp_field INTEGER,
  final_deductibility INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_examples_supplier ON classification_examples(supplier_nif);
CREATE INDEX idx_examples_category ON classification_examples(expense_category);
```

**Fluxo de Classificação:**
1. Nova factura chega → Extrair NIF fornecedor e detectar categoria
2. Query: `SELECT * FROM classification_examples WHERE supplier_nif = $1 OR expense_category = $2 LIMIT 5`
3. Incluir exemplos no prompt: "Aqui estão classificações anteriores validadas para contexto..."
4. IA classifica com base nas regras + exemplos
5. Após validação manual → Guardar como novo exemplo

### 6.5 Módulo: Dashboard Validação (Web)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F4.1 | Lista de facturas por cliente/período | P0 |
| F4.2 | Filtro por estado (pendente/validado) | P0 |
| F4.3 | Vista lado-a-lado: imagem + dados | P0 |
| F4.4 | Editar classificação manualmente | P0 |
| F4.5 | Alerta visual se confiança <80% | P0 |
| F4.6 | Atalhos teclado (Enter=validar, E=editar) | P1 |

### 6.6 Módulo: Exportação

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F5.1 | Agregar IVA por campo 20-24 | P0 |
| F5.2 | Exportar Excel (.xlsx) | P0 |
| F5.3 | Filtrar por período fiscal | P0 |
| F5.4 | Separar por taxa IVA (6/13/23%) | P0 |
| F5.5 | Exportar CSV | P1 |

---

## 7. Modelo de Dados

```sql
-- Perfis de utilizadores
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  company_name TEXT,
  nif TEXT UNIQUE,
  cae TEXT,
  activity_description TEXT,
  vat_regime TEXT DEFAULT 'normal',
  accountant_id UUID REFERENCES profiles(id),
  role TEXT DEFAULT 'client' CHECK (role IN ('client', 'accountant', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Facturas
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) NOT NULL,
  
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
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMPTZ,
  
  -- Estado
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  image_path TEXT NOT NULL,
  fiscal_period TEXT, -- "2025-01"
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exemplos de classificação para Few-Shot Learning
CREATE TABLE classification_examples (
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
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_period ON invoices(fiscal_period);
CREATE INDEX idx_examples_supplier ON classification_examples(supplier_nif);
CREATE INDEX idx_examples_category ON classification_examples(expense_category);
```

---

## 8. Requisitos Não-Funcionais

### 8.1 Segurança e RGPD

| Requisito | Implementação |
|-----------|---------------|
| Autenticação | Supabase Auth (email + password) |
| Autorização | Row Level Security (RLS) |
| Encriptação | HTTPS + Storage encriptado |
| Localização dados | Supabase região UE |
| Retenção | 10 anos (obrigação fiscal) |
| Direito ao esquecimento | Funcionalidade de exportação/eliminação |

### 8.2 Performance

| Métrica | SLA |
|---------|-----|
| OCR + Classificação | <5s p95 |
| Dashboard load time | <2s |
| Export Excel | <10s para 500 facturas |

---

## 9. Roadmap MVP (4 Semanas)

| Semana | Entregas |
|--------|----------|
| **S1** | Setup Lovable Cloud, schema DB, autenticação, UI base (dashboard skeleton) |
| **S2** | Edge Function OCR (parser QR), captura móvel (PWA câmara), upload imagens |
| **S3** | Classificação IA (Lovable AI + Few-Shot), dashboard validação completo |
| **S4** | Exportação Excel, testes com 50 facturas reais, deploy produção |

---

## 10. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| QR codes danificados | Alto | Fallback OCR texto + input manual |
| Classificação errada | Alto | Revisão obrigatória se confiança <80% |
| Legislação muda | Médio | Regras em tabela configurável |
| PWA não funciona em Safari antigo | Baixo | Fallback upload ficheiro |
| Few-shot não melhora precisão | Médio | Monitorar taxa correcções, ajustar prompts |

---

## 11. Métricas de Sucesso

### 11.1 Métricas de Produto

| Métrica | Baseline | Target MVP | Medição |
|---------|----------|------------|---------|
| Tempo por factura (Raquel) | ~2 min | <30s | Cronometragem |
| Taxa de classificação correcta | 0% (manual) | >90% | Correcções/Total |
| Facturas processadas/dia | ~50 | >200 | Contagem DB |

### 11.2 Métricas de Aprendizagem

| Métrica | Fórmula | Target |
|---------|---------|--------|
| Taxa de correcção | Correcções / Total validações | <10% após 500 exemplos |
| Precisão por categoria | Correctas[cat] / Total[cat] | >95% por categoria |
| Exemplos acumulados | COUNT(classification_examples) | >1000 em 3 meses |

---

## 12. Checklist de Validação

### Com Contabilista (Raquel/OCC)
- [ ] Validar mapeamento campos 20-24 com 10 exemplos reais
- [ ] Confirmar regras gasóleo/gasolina por tipo viatura
- [ ] Testar classificação com facturas de 3 clientes diferentes
- [ ] Verificar formato Excel compatível com software AT

### Técnico
- [ ] Testar parser QR com 20 facturas reais
- [ ] Benchmark tempo OCR + classificação
- [ ] Verificar RLS policies funcionam correctamente
- [ ] Load test com 100 uploads simultâneos
- [ ] Testar few-shot learning com 50 exemplos

---

*Versão 2025.3 — Última actualização: 2025-12-07*
