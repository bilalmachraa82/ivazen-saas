# Guia Completo: Migração de Dados Lovable Cloud → Supabase

## Contexto Atual

- **Projeto Lovable**: usa Supabase por baixo (ID: `oqvvtcfvjkghrwaatprx`)
- **Novo Supabase**: `dmprkdvkzzjtixlatnlx` (schema já aplicado, 94 migrations)
- **Frontend**: Vercel em https://ivazen-saas.vercel.app
- **Edge Functions**: 17 funções deployed no novo Supabase
- **AI**: Migrado para Google Gemini direto (AI_API_KEY configurada)

O que falta: migrar **dados** (users, tabelas, storage) do Lovable para o novo Supabase.

---

## PARTE A — Exportar Dados do Lovable Cloud

### A1. Exportar Lista de Users

1. Abre o teu projeto no Lovable (https://lovable.dev)
2. Clica em **Cloud** (ícone de nuvem no menu lateral)
3. Clica na tab **Users**
4. Para CADA utilizador na lista:
   - Anota o **UUID** (coluna ID — formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - Anota o **email**
   - Anota a **data de criação** (se visível)
5. Guarda num ficheiro `users.json` neste formato:

```json
[
  {"id": "uuid-completo-aqui", "email": "email@exemplo.com"},
  {"id": "outro-uuid-aqui", "email": "outro@exemplo.com"}
]
```

Coloca em: `scripts/migration/users.json`

> **Nota**: As passwords NÃO são exportáveis. Os users terão de fazer reset de password.

---

### A2. Exportar Tabelas (CSV)

1. No Lovable, clica em **Cloud** → tab **Database**
2. Vais ver a lista de todas as tabelas

**Exporta CADA tabela que tenha dados** (clica na tabela → botão **Export CSV**):

#### Tabelas PRIORITÁRIAS (quase de certeza têm dados):

| # | Tabela | Descrição |
|---|--------|-----------|
| 1 | `profiles` | Perfis dos utilizadores |
| 2 | `user_roles` | Roles (client/accountant/admin) |
| 3 | `invoices` | Faturas uploadadas (tabela principal!) |
| 4 | `invoice_vat_lines` | Linhas de IVA por fatura |
| 5 | `tax_withholdings` | Retenções (Modelo 10) |
| 6 | `sales_invoices` | Faturas de vendas/recibos |
| 7 | `at_credentials` | Credenciais AT dos clientes |
| 8 | `client_accountants` | Relações contabilista↔cliente |
| 9 | `classification_rules` | Regras de classificação AI aprendidas |
| 10 | `classification_examples` | Exemplos de classificação |
| 11 | `category_preferences` | Preferências de categorias |
| 12 | `revenue_entries` | Entradas de receita |

#### Tabelas SECUNDÁRIAS (podem ter dados):

| # | Tabela | Descrição |
|---|--------|-----------|
| 13 | `accountant_at_config` | Config certificados AT |
| 14 | `accountant_requests` | Pedidos de conta contabilista |
| 15 | `client_invitations` | Convites pendentes |
| 16 | `notification_preferences` | Preferências de notificações |
| 17 | `push_subscriptions` | Subscriptions push notifications |
| 18 | `user_onboarding_progress` | Progresso onboarding |
| 19 | `ss_declarations` | Declarações Seg. Social |
| 20 | `invoice_validation_logs` | Logs de validação |
| 21 | `withholding_logs` | Logs de retenções |
| 22 | `upload_queue` | Fila de uploads |
| 23 | `sent_notifications` | Notificações enviadas |

#### Tabelas de SYNC AT (podem estar vazias se não usaste o sync):

| # | Tabela | Descrição |
|---|--------|-----------|
| 24 | `at_sync_history` | Histórico de syncs AT |
| 25 | `at_sync_jobs` | Jobs de sync |
| 26 | `at_sync_year_overrides` | Overrides por ano |
| 27 | `at_sync_override_audit` | Audit de overrides |
| 28 | `at_sync_automation_runs` | Runs automáticos |
| 29 | `at_withholding_candidates` | Candidatos retenção AT |

#### Tabelas de SISTEMA (provavelmente vazias ou não críticas):

| # | Tabela | Descrição |
|---|--------|-----------|
| 30 | `partners` | Parceiros (pode estar vazia) |
| 31 | `ai_metrics` | Métricas AI (regenerável) |
| 32 | `internal_webhook_keys` | Chaves webhook internas |

**DICA**: Se uma tabela mostrar 0 rows no Lovable, não precisas de a exportar.

**Onde guardar**: Coloca TODOS os CSVs em `scripts/migration/csv/`
Nomeia cada ficheiro exactamente como a tabela: `profiles.csv`, `invoices.csv`, etc.

---

### A3. Exportar Storage (ficheiros)

1. No Lovable, clica em **Cloud** → tab **Storage**
2. Vais ver os buckets:
   - **invoices** — PDFs e imagens de faturas uploadadas (IMPORTANTE!)
   - **upload-queue** — ficheiros pendentes
   - **partner-logos** — logos de parceiros
3. Para o bucket **invoices**:
   - Entra em cada pasta (são organizadas por user ID)
   - Descarrega TODOS os ficheiros (click → Download)
   - Mantém a estrutura de pastas igual
4. Repete para **upload-queue** e **partner-logos** se tiverem ficheiros

**Onde guardar**: Cria pasta `scripts/migration/storage/invoices/`, etc.

---

## PARTE B — Importar no Novo Supabase

### B1. Abrir o Supabase SQL Editor

1. Vai a https://supabase.com/dashboard/project/dmprkdvkzzjtixlatnlx
2. No menu lateral, clica em **SQL Editor**

---

### B2. Desativar Constraints (OBRIGATÓRIO antes de importar)

Cola e executa este SQL no SQL Editor:

```sql
-- Desativar triggers em TODAS as tabelas
ALTER TABLE public.profiles DISABLE TRIGGER ALL;
ALTER TABLE public.user_roles DISABLE TRIGGER ALL;
ALTER TABLE public.invoices DISABLE TRIGGER ALL;
ALTER TABLE public.invoice_vat_lines DISABLE TRIGGER ALL;
ALTER TABLE public.invoice_validation_logs DISABLE TRIGGER ALL;
ALTER TABLE public.tax_withholdings DISABLE TRIGGER ALL;
ALTER TABLE public.withholding_logs DISABLE TRIGGER ALL;
ALTER TABLE public.at_withholding_candidates DISABLE TRIGGER ALL;
ALTER TABLE public.sales_invoices DISABLE TRIGGER ALL;
ALTER TABLE public.revenue_entries DISABLE TRIGGER ALL;
ALTER TABLE public.ss_declarations DISABLE TRIGGER ALL;
ALTER TABLE public.at_credentials DISABLE TRIGGER ALL;
ALTER TABLE public.accountant_at_config DISABLE TRIGGER ALL;
ALTER TABLE public.accountant_requests DISABLE TRIGGER ALL;
ALTER TABLE public.client_accountants DISABLE TRIGGER ALL;
ALTER TABLE public.client_invitations DISABLE TRIGGER ALL;
ALTER TABLE public.category_preferences DISABLE TRIGGER ALL;
ALTER TABLE public.classification_rules DISABLE TRIGGER ALL;
ALTER TABLE public.classification_examples DISABLE TRIGGER ALL;
ALTER TABLE public.notification_preferences DISABLE TRIGGER ALL;
ALTER TABLE public.push_subscriptions DISABLE TRIGGER ALL;
ALTER TABLE public.sent_notifications DISABLE TRIGGER ALL;
ALTER TABLE public.user_onboarding_progress DISABLE TRIGGER ALL;
ALTER TABLE public.upload_queue DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_history DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_jobs DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_year_overrides DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_override_audit DISABLE TRIGGER ALL;
ALTER TABLE public.at_sync_automation_runs DISABLE TRIGGER ALL;
ALTER TABLE public.partners DISABLE TRIGGER ALL;
ALTER TABLE public.ai_metrics DISABLE TRIGGER ALL;

-- Desativar verificação de foreign keys (CRUCIAL!)
SET session_replication_role = 'replica';

SELECT 'PRONTO — Constraints desativadas!' AS status;
```

Deves ver: `PRONTO — Constraints desativadas!`

---

### B3. Criar Users com os Mesmos UUIDs

Para CADA utilizador que anotaste no passo A1, cola este SQL no SQL Editor (um por utilizador):

```sql
-- UTILIZADOR 1: substituir os valores
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'COLAR-UUID-DO-LOVABLE-AQUI',           -- UUID exacto do Lovable
  'authenticated',
  'authenticated',
  'COLAR-EMAIL-AQUI',                      -- email do utilizador
  crypt('IVAzen-Temp-2026!', gen_salt('bf')), -- password temporária
  now(),
  now(), now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}'
);
```

**Repete para cada utilizador**, mudando apenas o UUID e o email.

**Exemplo com 3 utilizadores**:
```sql
-- User 1
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'abc12345-1111-2222-3333-444444444444', 'authenticated', 'authenticated', 'joao@empresa.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

-- User 2
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'def67890-5555-6666-7777-888888888888', 'authenticated', 'authenticated', 'maria@contab.pt', crypt('IVAzen-Temp-2026!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

-- User 3 ...
```

**Verificar** (cola e executa):
```sql
SELECT id, email, created_at FROM auth.users ORDER BY created_at;
```

Deves ver todos os utilizadores com os UUIDs originais do Lovable.

---

### B4. Importar CSVs (tabela a tabela)

1. No Supabase, clica em **Table Editor** (menu lateral)
2. Para CADA tabela COM dados:

   a. Clica no nome da tabela (ex: `profiles`)
   b. Clica no botão **Insert** (dropdown) → **Import data from CSV**
   c. Seleciona o ficheiro CSV correspondente (ex: `profiles.csv`)
   d. Clica **Import**

**ORDEM de importação** (respeita dependências):

```
PRIMEIRO (Tier 1 — sem dependências):
  1. profiles
  2. user_roles
  3. partners

SEGUNDO (Tier 2 — dependem de profiles):
  4. invoices
  5. tax_withholdings
  6. sales_invoices
  7. at_credentials
  8. accountant_at_config
  9. accountant_requests
  10. notification_preferences
  11. category_preferences
  12. classification_rules
  13. classification_examples
  14. user_onboarding_progress
  15. ss_declarations
  16. revenue_entries
  17. upload_queue

TERCEIRO (Tier 3 — dependem de profiles x2):
  18. client_accountants
  19. client_invitations

QUARTO (Tier 4 — dependem de tabelas anteriores):
  20. invoice_vat_lines (depende de invoices)
  21. invoice_validation_logs (depende de invoices)
  22. withholding_logs (depende de tax_withholdings)
  23. at_sync_history
  24. at_sync_jobs (depende de at_sync_history)
  25. at_sync_year_overrides
  26. at_sync_override_audit
  27. at_sync_automation_runs
  28. at_withholding_candidates
  29. sent_notifications
```

> **Se der erro de foreign key**: Como desativámos as constraints no passo B2, não deveria dar erro. Se mesmo assim der, anota o erro e diz-me.

---

### B5. Reativar Constraints

Depois de importar TODOS os CSVs, cola e executa no SQL Editor:

```sql
-- Reativar verificação de foreign keys
SET session_replication_role = 'origin';

-- Reativar triggers em TODAS as tabelas
ALTER TABLE public.profiles ENABLE TRIGGER ALL;
ALTER TABLE public.user_roles ENABLE TRIGGER ALL;
ALTER TABLE public.invoices ENABLE TRIGGER ALL;
ALTER TABLE public.invoice_vat_lines ENABLE TRIGGER ALL;
ALTER TABLE public.invoice_validation_logs ENABLE TRIGGER ALL;
ALTER TABLE public.tax_withholdings ENABLE TRIGGER ALL;
ALTER TABLE public.withholding_logs ENABLE TRIGGER ALL;
ALTER TABLE public.at_withholding_candidates ENABLE TRIGGER ALL;
ALTER TABLE public.sales_invoices ENABLE TRIGGER ALL;
ALTER TABLE public.revenue_entries ENABLE TRIGGER ALL;
ALTER TABLE public.ss_declarations ENABLE TRIGGER ALL;
ALTER TABLE public.at_credentials ENABLE TRIGGER ALL;
ALTER TABLE public.accountant_at_config ENABLE TRIGGER ALL;
ALTER TABLE public.accountant_requests ENABLE TRIGGER ALL;
ALTER TABLE public.client_accountants ENABLE TRIGGER ALL;
ALTER TABLE public.client_invitations ENABLE TRIGGER ALL;
ALTER TABLE public.category_preferences ENABLE TRIGGER ALL;
ALTER TABLE public.classification_rules ENABLE TRIGGER ALL;
ALTER TABLE public.classification_examples ENABLE TRIGGER ALL;
ALTER TABLE public.notification_preferences ENABLE TRIGGER ALL;
ALTER TABLE public.push_subscriptions ENABLE TRIGGER ALL;
ALTER TABLE public.sent_notifications ENABLE TRIGGER ALL;
ALTER TABLE public.user_onboarding_progress ENABLE TRIGGER ALL;
ALTER TABLE public.upload_queue ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_history ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_jobs ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_year_overrides ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_override_audit ENABLE TRIGGER ALL;
ALTER TABLE public.at_sync_automation_runs ENABLE TRIGGER ALL;
ALTER TABLE public.partners ENABLE TRIGGER ALL;
ALTER TABLE public.ai_metrics ENABLE TRIGGER ALL;

SELECT 'PRONTO — Constraints reativadas!' AS status;
```

---

### B6. Verificar Contagens

Cola e executa no SQL Editor para confirmar que os dados estão lá:

```sql
SELECT 'auth.users' AS tabela, count(*) AS rows FROM auth.users
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
UNION ALL SELECT 'invoices', count(*) FROM public.invoices
UNION ALL SELECT 'invoice_vat_lines', count(*) FROM public.invoice_vat_lines
UNION ALL SELECT 'tax_withholdings', count(*) FROM public.tax_withholdings
UNION ALL SELECT 'sales_invoices', count(*) FROM public.sales_invoices
UNION ALL SELECT 'revenue_entries', count(*) FROM public.revenue_entries
UNION ALL SELECT 'at_credentials', count(*) FROM public.at_credentials
UNION ALL SELECT 'client_accountants', count(*) FROM public.client_accountants
UNION ALL SELECT 'classification_rules', count(*) FROM public.classification_rules
UNION ALL SELECT 'category_preferences', count(*) FROM public.category_preferences
UNION ALL SELECT 'at_sync_history', count(*) FROM public.at_sync_history
UNION ALL SELECT 'at_withholding_candidates', count(*) FROM public.at_withholding_candidates
ORDER BY tabela;
```

**Compara** estes números com o que tinhas no Lovable. Devem ser iguais.

---

### B7. Upload Storage Files

1. No Supabase, clica em **Storage** (menu lateral)
2. Os buckets já existem: `invoices`, `upload-queue`, `partner-logos`
3. Para o bucket **invoices**:
   - Recria a mesma estrutura de pastas que tinhas no Lovable
   - Upload todos os ficheiros que descarregaste no passo A3
4. Repete para os outros buckets se necessário

---

### B8. Configurar Auth

1. No Supabase, vai a **Authentication** → **URL Configuration**
2. Adiciona:
   - **Site URL**: `https://ivazen.aiparati.pt` (ou `https://ivazen-saas.vercel.app`)
   - **Redirect URLs**:
     - `https://ivazen.aiparati.pt/**`
     - `https://ivazen-saas.vercel.app/**`
     - `https://*.vercel.app/**` (para preview deployments)
     - `http://localhost:8080/**` (para desenvolvimento local)

3. Vai a **Authentication** → **Providers** → **Email**
   - Certifica que "Confirm email" está **desligado** para testes
   - (Liga depois em produção)

---

### B9. Testar

1. Abre https://ivazen-saas.vercel.app
2. Faz login com um email migrado + password temporária: `IVAzen-Temp-2026!`
3. Verifica:
   - Os dados do utilizador aparecem?
   - As faturas estão lá?
   - As classificações estão correctas?
   - As imagens/PDFs carregam? (depende do storage)

---

## PARTE C — Pós-Migração

### C1. Reset de Passwords

Os utilizadores precisam de mudar a password. Opções:
- Cada um usa "Esqueci a password" no login
- Ou envia convite email via Supabase Authentication → Send magic link

### C2. DNS do Domínio

Se `ivazen.aiparati.pt` não está a resolver:
1. No teu registar de domínio (onde compraste `aiparati.pt`)
2. Adiciona CNAME record:
   - **Name**: `ivazen`
   - **Value**: `cname.vercel-dns.com`
3. No Vercel > Project Settings > Domains, verifica que está configurado

### C3. Desligar o Lovable Cloud

Só depois de confirmar que TUDO funciona no novo setup:
1. Verifica todos os dados
2. Testa todas as funcionalidades
3. Depois podes cancelar o Lovable
