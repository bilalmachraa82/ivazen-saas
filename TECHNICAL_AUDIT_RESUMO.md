# Relatório de Auditoria Técnica - IVAzen SaaS

Este documento fornece a visão geral da arquitetura, stack tecnológico e estrutura de pastas do projeto **IVAzen SaaS**, concebido para servir de guia de integração para novos programadores na equipa (onboarding).

## 1. Stack Tecnológico Principal

### Frontend (Aplicação Web)
*   **Framework Base:** React 18
*   **Linguagem:** TypeScript (Strict mode)
*   **Build Tool/Bundler:** Vite (configurado com PWA e divisão manual de chunks por otimização de performance)
*   **Routing:** React Router v6

### Backend e Base de Dados
*   **Infraestrutura Backend:** Supabase (BaaS)
*   **Base de Dados:** PostgreSQL (fornecido via Supabase)
*   **Segurança de Dados:** Row Level Security (RLS) habilitado no Supabase para isolar acessos entre Clientes, Contabilistas, Admins e SuperAdmins.
*   **Serviços Adicionais:** 
    *   Supabase Storage (armazenamento de ficheiros)
    *   Supabase Edge Functions / RPCs (Remote Procedure Calls em PL/pgSQL na base de dados, ex: contadores, sincronizações AT).
    *   Sistema Cron para enriquecimento noturno de dados (`pg_cron` ou jobs do Supabase).

### Styling e Componentes
*   **CSS Framework:** Tailwind CSS
*   **Design System / UI Library:** Radix UI encapsulado através da abordagem `shadcn/ui`.
*   **Manipulação de Classes:** `clsx` e `tailwind-merge` (standard `shadcn`).
*   **Íconografia:** Lucide React

### Funcionalidades Core & Componentes de Negócio
*   **Gestão de Estado Async / Fetching:** TanStack React Query v5. Utilizado intensamente com a API supabase-js (`@supabase/supabase-js`).
*   **Formulários e Validações:** React Hook Form integrado com Zod (`@hookform/resolvers/zod`).
*   **Animações:** Framer Motion (para transições UI) e Tailwind Animate.
*   **Gráficos / Reporting:** Recharts.
*   **Tratamento de Datas:** `date-fns`.
*   **Manipulação de Ficheiros:** `xlsx` (Excel/CSV), `jspdf` & `html2canvas` (PDFs), `jszip` (.zip).

### DevOps, Qualidade e Testing
*   **Error Tracking & Monitorização:** Sentry (`@sentry/react`).
*   **Testing:** Vitest para testes unitários, Playwright para testes End-to-End (E2E). Linter e Type Checking baseados no ESLint/tsc.

---

## 2. Estrutura de Domínio / Negócio (Visão Geral)

O software atua profundamente na gestão fiscal focada no regime da Autoridade Tributária em Portugal:

1.  **AT Control Center & e-Fatura:** Sincronização de dados da Autoridade Tributária.
2.  **Dashboard Hub:** Separação entre Clientes (upload de despesas/docs) e Contabilistas (Accountants) com múltiplos clientes sob sua alçada (Partner Model).
3.  **Segurança Social e Modelo 10:** Processamentos fiscais e preenchimentos.
4.  **Processos Financeiros:** Reconciliações, Calculadora IVA, Gestão de Faturas (Criação de Sales validation e imports massivos do E-fatura).

---

## 3. Notas Técnicas para o Programador

1.  **Migrações de DB (`supabase/migrations/`)**: Há várias migrations `.sql` vitais (RPCs e RLS policies) aplicadas. Alterações complexas de base de dados têm de ser feitas através de novos scripts SQL migratórios e não manualmente na dashboard online, sendo o Supabase o cérebro das rules.
2.  **Supabase RLS**: O frontend assenta totalmente na restrição Row-Level Security definida no backend. O programador precisa estudar os tokens de autenticação e os claims.
3.  **React Query State**: O estado é essencialmente server-side gerido pelo `React Query`. Mutar dados significa acionar o client Supabase e forçar uma invalidação (invalidateQueries) correspondente.
4.  **Vite Custom Chunking**: O `vite.config.ts` divide libs pesadas (jspdf, xlsx) em chunks próprios. Tem em atenção novos imports de dependências pesadas, devem ser isolados similarmente.
