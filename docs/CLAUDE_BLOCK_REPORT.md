# Claude Block Report

Relatório estruturado para auditoria automática do Codex.

---

## BLOCO 1 — Simplificar jornada do contabilista

- **Objetivo**: Reduzir ruído no sidebar (6→4 grupos), skip wizard para contabilistas, empty states uniformes
- **O que alterei**:
  - DashboardLayout: sidebar reorganizado de 6 para 4 grupos (Carteira, Trabalho, Importação, Sistema)
  - UnifiedOnboarding: contabilistas saltam wizard, vão direto para checklist; fix race condition (isAccountant em deps do useEffect)
  - Validation.tsx + Export.tsx: empty states dedicados para contabilista sem clientes / sem seleção
- **Ficheiros tocados**:
  - `src/components/dashboard/DashboardLayout.tsx`
  - `src/components/onboarding/UnifiedOnboarding.tsx`
  - `src/pages/Validation.tsx`
  - `src/pages/Export.tsx`
- **Validações corridas**: `npm run build` ✓, `npm test` ✓
- **Riscos/tradeoffs**: Nenhum — alterações puramente de UX, sem tocar em lógica fiscal
- **Pronto para auditoria do Codex?** Sim (auditado e aprovado, commit `a255155`)
- **Próximo passo sugerido**: N/A — bloco fechado

---

## BLOCO 2 — Readiness badges por cliente

- **Objetivo**: Mostrar estado operacional de cada cliente (ready/partial/blocked/etc.) no sidebar e dashboard
- **O que alterei**:
  - Criação de `clientReadiness.ts` — lógica pura com 6 estados, baseada em compras + vendas + retenções + credenciais AT
  - Criação de `clientReadiness.test.ts` — 19 testes unitários cobrindo todos os estados e sinais mistos
  - Criação de `useClientReadiness.ts` — hook React Query que agrega dados de 4 fontes (clients, at_credentials, sales_invoices, tax_withholdings)
  - `client-search-selector.tsx` — dot colorido por cliente quando readinessMap é fornecido
  - `DashboardLayout.tsx` — passa readinessMap ao selector de clientes (mobile + desktop)
  - `Dashboard.tsx` — mostra cards de resumo de readiness quando contabilista não tem cliente selecionado
  - **Fixes do Codex (3 rondas)**:
    1. Semantic gap: readiness agora inclui salesCount + withholdingsCount (não só invoiceCount)
    2. Truncação >1000: `countByClientId` usa `.range()` para paginar resultados
    3. Loading incompleto: `isLoading` inclui isLoadingSales + isLoadingWithholdings
- **Ficheiros tocados**:
  - `src/lib/clientReadiness.ts` (novo)
  - `src/lib/__tests__/clientReadiness.test.ts` (novo)
  - `src/hooks/useClientReadiness.ts` (novo)
  - `src/components/ui/client-search-selector.tsx`
  - `src/components/dashboard/DashboardLayout.tsx`
  - `src/pages/Dashboard.tsx`
- **Validações corridas**: `npm run build` ✓, `vitest clientReadiness.test.ts` 19/19 ✓
- **Riscos/tradeoffs**:
  - `countByClientId` faz SELECT de client_id sem agregação server-side (count via client-side loop). Para >10K rows, uma view/RPC com GROUP BY seria mais eficiente. Aceitável para portfolio atual (~400 clientes).
  - Queries de sales/withholdings dependem de RLS — se RLS não filtrar por accountant, pode trazer dados de outros contabilistas. Mitigado pelo `.in('client_id', batch)` que limita aos IDs conhecidos.
- **Pronto para auditoria do Codex?** Sim
- **Commits**: `107ac02` (feature), `dc6f78b` (fixes da 3ª auditoria)
- **Próximo passo sugerido**: BLOCO 3 — Feedback de importação
