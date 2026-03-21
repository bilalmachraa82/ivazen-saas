# User Journey - Contabilista

Este documento descreve o fluxo completo de um contabilista a usar a aplicação IVAzen.

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JORNADA DO CONTABILISTA                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ONBOARDING                                                               │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ Registo → Candidatura Contabilista → Aprovação Admin → Role Activo │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  2. GESTÃO DE CLIENTES (Definições)                                         │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  ┌─────────────────┐    ┌───────────────────┐                      │     │
│  │  │  CRIAR CLIENTE  │    │ ASSOCIAR EXISTENTE│                      │     │
│  │  │  (Novo registo) │    │   (Por pesquisa)  │                      │     │
│  │  └────────┬────────┘    └─────────┬─────────┘                      │     │
│  │           │                       │                                 │     │
│  │           ▼                       ▼                                 │     │
│  │  create-client-direct      associate_client()                       │     │
│  │  (edge function)           (database function)                      │     │
│  │           │                       │                                 │     │
│  │           └───────────┬───────────┘                                │     │
│  │                       ▼                                             │     │
│  │              client_accountants                                     │     │
│  │              (tabela de relações)                                   │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  3. UPLOAD DE DOCUMENTOS                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  ┌───────────────────────────────────────────────────────────┐     │     │
│  │  │              SELECTOR DE CLIENTE (obrigatório)             │     │     │
│  │  └───────────────────────────────────────────────────────────┘     │     │
│  │                              │                                      │     │
│  │         ┌────────────────────┴────────────────────┐                │     │
│  │         ▼                                         ▼                │     │
│  │  ┌─────────────────┐                    ┌─────────────────┐       │     │
│  │  │ FACTURAS COMPRA │                    │ FACTURAS VENDA  │       │     │
│  │  │   (despesas)    │                    │   (receitas)    │       │     │
│  │  └─────────────────┘                    └─────────────────┘       │     │
│  │         │                                         │                │     │
│  │         ▼                                         ▼                │     │
│  │  invoices table                          sales_invoices table     │     │
│  │  (client_id = cliente)                   (client_id = cliente)    │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  4. VALIDAÇÃO E CLASSIFICAÇÃO                                                │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  [Filtro por Cliente] → [IA Classifica] → [Contabilista Valida]   │     │
│  │                                                                     │     │
│  │  • Classificação automática por IA                                 │     │
│  │  • Campo DP (Despesa Pessoal) sugerido                             │     │
│  │  • Dedutibilidade calculada                                        │     │
│  │  • Few-shot learning activo                                        │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  5. MODELO 10 - RETENÇÕES NA FONTE                                          │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  ┌─────────────────────────────────────────────────────────────┐   │     │
│  │  │              SELECTOR DE CLIENTE (obrigatório)               │   │     │
│  │  └─────────────────────────────────────────────────────────────┘   │     │
│  │                              │                                      │     │
│  │  ┌───────────┬───────────┬───────────┬───────────┬───────────┐    │     │
│  │  │  Manual   │ Bulk 100  │ Bulk 500+ │  Resumo   │ Exportar  │    │     │
│  │  │ Adicionar │ (local)   │ (server)  │           │   XML     │    │     │
│  │  └───────────┴───────────┴───────────┴───────────┴───────────┘    │     │
│  │                                                                     │     │
│  │  ✓ Extracção automática de dados (OCR/IA)                          │     │
│  │  ✓ Multi-cliente export para contabilistas                        │     │
│  │  ✓ Histórico de alterações                                        │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  6. RELATÓRIOS FISCAIS                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  [Selector Cliente] → [Período] → [IVA | SS | Despesas]           │     │
│  │                                                                     │     │
│  │  • Resumo IVA trimestral                                           │     │
│  │  • Cálculo Segurança Social                                        │     │
│  │  • Despesas por categoria                                          │     │
│  │  • Exportar PDF/Excel                                              │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  7. SEGURANÇA SOCIAL (Trimestral)                                           │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  • Importar receitas do cliente                                    │     │
│  │  • Calcular base contributiva                                      │     │
│  │  • Gerar guia de submissão                                         │     │
│  │  • Links para portal SS                                            │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detalhes por Etapa

### 1. Onboarding do Contabilista

**Caminho:** `/auth` → `/become-accountant` → (aguarda aprovação) → `/accountant-dashboard`

1. Utilizador cria conta normal
2. Navega para "Tornar-me Contabilista"
3. Preenche formulário com:
   - Número OCC
   - Número Cédula
   - Anos experiência
   - Especializações
4. Admin aprova candidatura
5. Role `accountant` é atribuída

### 2. Gestão de Clientes

**Caminho:** `/settings` → Tab "Gestão de Clientes"

**Criar Novo Cliente:**
```
CreateClientDialog → create-client-direct (edge function)
                   → Cria utilizador auth
                   → Cria perfil
                   → Insere em client_accountants
                   → Gera magic link
```

**Associar Cliente Existente:**
```
Pesquisa por NIF/Nome → associate_client (RPC)
                      → Insere em client_accountants
                      → Actualiza profiles.accountant_id se primário
```

### 3. Upload de Documentos

**Caminho:** `/upload`

Para contabilistas:
1. Selector de cliente aparece no topo
2. Escolher tipo: Compra ou Venda
3. Upload via:
   - Câmara (scan QR)
   - Ficheiro (imagem/PDF)
   - Input manual QR
4. Documento associado ao `client_id` seleccionado

### 4. Validação

**Caminho:** `/validation` (Compras) | `/sales-validation` (Vendas)

Para contabilistas:
1. Filtro por cliente
2. Ver sugestões IA
3. Corrigir se necessário
4. Validar em batch

### 5. Modelo 10

**Caminho:** `/modelo10`

Para contabilistas:
1. Selector de cliente obrigatório
2. Tabs disponíveis:
   - **Retenções:** Lista de todas as retenções do cliente
   - **Adicionar:** Formulário manual ou extracção IA
   - **Bulk (100):** Upload batch processado localmente
   - **Bulk (500+):** Upload batch processado em servidor
   - **Resumo:** Totais por categoria
   - **Dashboard:** Gráficos
   - **Exportar:** XML para AT
   - **Multi-Cliente:** Exportar vários clientes de uma vez
   - **Histórico:** Log de alterações

### 6. Relatórios

**Caminho:** `/reports`

Para contabilistas:
1. Selector de cliente (ou "Todos")
2. Selector de período (trimestre ou ano)
3. Tabs: IVA | Segurança Social | Despesas
4. Exportar em PDF ou Excel

### 7. Segurança Social

**Caminho:** `/social-security`

Para contabilistas:
1. Selector de cliente
2. Importar receitas
3. Calcular contribuição
4. Submeter declaração

---

## Modelo de Dados

### Tabela: `client_accountants`

Gere a relação N:N entre contabilistas e clientes.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| client_id | uuid | FK → profiles |
| accountant_id | uuid | FK → profiles |
| access_level | text | 'full' ou 'read_only' |
| is_primary | boolean | Se é o contabilista principal |
| invited_by | uuid | Quem criou a associação |
| created_at | timestamp | Data criação |

### RLS Policies

- Contabilistas vêem e gerem as suas associações
- Clientes vêem quem os gere
- Admins vêem tudo

---

## Funções de Base de Dados

| Função | Propósito |
|--------|-----------|
| `associate_client(client_uuid, access_level, is_primary)` | Associar cliente existente |
| `remove_client(client_uuid)` | Remover cliente da carteira |
| `get_accountant_clients(accountant_uuid)` | Listar clientes do contabilista |
| `get_client_accountants(client_uuid)` | Listar contabilistas do cliente |
| `remove_client_accountant(accountant_id)` | Cliente remove contabilista |
| `search_available_clients(search_term)` | Pesquisar clientes para associar |

---

## Segurança

### RLS em Tabelas de Dados

Todas as tabelas de dados (invoices, sales_invoices, tax_withholdings, etc.) têm políticas que permitem:
- Utilizador aceder aos próprios dados (`client_id = auth.uid()`)
- Contabilista aceder aos dados dos clientes associados (`profiles.accountant_id = auth.uid()`)
- Admin aceder a tudo (`has_role(auth.uid(), 'admin')`)

### Verificações

- Role `accountant` verificada via `has_role()`
- Associações validadas via `client_accountants`
- Dados sensíveis protegidos por RLS

---

## Próximos Passos Sugeridos

1. ✅ Criar tabela `client_accountants` - **FEITO**
2. ✅ Actualizar funções RPC - **FEITO**
3. ✅ Adicionar selector cliente em Reports - **FEITO**
4. ✅ CTA criar cliente em Modelo 10 - **FEITO**
5. 🔲 Dashboard agregado para contabilistas
6. 🔲 Notificações de prazos fiscais
7. 🔲 Facturação para contabilistas (Stripe)
