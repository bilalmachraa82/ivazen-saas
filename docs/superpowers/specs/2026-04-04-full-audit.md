# IVAzen SaaS — Full Repository Audit
**Date:** 2026-04-04 | **Auditor:** Claude Opus 4.6 | **Method:** 6 parallel agents + verified data

---

## Executive Summary

O IVAzen esta **funcionalmente completo** como produto — 36 paginas, todas com conteudo real, zero stubs. Build limpo, zero erros TS, zero lint warnings, 902 testes a passar. Mas tem **lacunas reais** em seguranca, cobertura de testes, billing, e codigo morto que impedem o rotulo "premium".

### Veredicto por area

| Area | Nota | Veredicto |
|------|------|-----------|
| Build & CI | A | Limpo: 0 erros, 0 warnings, 0 lint issues |
| Features | A- | Tudo funcional excepto billing e contact form |
| Seguranca | C+ | 2 issues HIGH, 3 MEDIUM — corrigiveis em 1-2 dias |
| Testes | D+ | 902 testes mas 97% concentrados em lib/. UI e backend ~0% |
| Codigo morto | B | ~30 ficheiros removiveis, nada critico |
| Bundle/Perf | B+ | 5.2MB total, chunks bem divididos, optimizavel |
| Edge Functions | B | 26 funcoes, todas com auth, mas code duplication e 1 stub |

---

## 1. BUILD & STATIC ANALYSIS — LIMPO

| Check | Resultado |
|-------|-----------|
| `npm run build` | PASS — 0 warnings, 0 errors, 10.56s |
| `npm run lint` | PASS — 0 warnings, 0 errors |
| `npx tsc --noEmit` | PASS — 0 errors |
| Deprecated deps | Nenhum |
| TODO/FIXME/HACK | **Zero** em todo o codebase |
| console.log prod | **Zero** (20 ocorrencias apenas em testes) |

**Nada a fazer aqui.** Codebase excepcionalmente limpo em termos estaticos.

---

## 2. SEGURANCA — 2 HIGH, 3 MEDIUM

### HIGH

**H1. JWT payload forgery em `isServiceRoleToken`**
- **Ficheiro:** `supabase/functions/_shared/auth.ts:43-51`
- **Problema:** O fallback faz `JSON.parse(atob(payloadB64))` e aceita qualquer JWT com `role: "service_role"` **sem verificar assinatura**. Um atacante pode forjar um JWT e obter acesso service-role a 12+ edge functions.
- **Fix:** Remover o fallback de decode base64. Usar `supabaseAdmin.auth.getUser(token)` se precisar de fallback.
- **Impacto:** Todas as funcoes que usam `isServiceRoleToken` (batch-classify, nightly-classify, reencrypt-credentials, detect-withholding, etc.)

**H2. `supplier_directory` sem RLS**
- **Ficheiro:** `supabase/migrations/20260318110000_create_supplier_directory.sql`
- **Problema:** Tabela com NIFs, nomes e CAEs de fornecedores acessivel a qualquer utilizador autenticado via PostgREST.
- **Fix:** Migration com `ALTER TABLE supplier_directory ENABLE ROW LEVEL SECURITY` + policy SELECT para authenticated, INSERT/UPDATE para service_role.

### MEDIUM

**M1. Service-role key hardcoded em 8 scripts locais**
- **Ficheiros:** `scripts/migration/*.mjs` (nao tracked em git, mas em disco)
- **Fix:** Refactorizar para `process.env.SUPABASE_SERVICE_KEY`

**M2. `send-push-notification` sem autorizacao**
- Qualquer utilizador autenticado pode enviar notificacoes a qualquer outro utilizador.
- Fix: Restringir a service-role/admin ou validar relacao accountant-client.

**M3. Sem rate limiting em edge functions user-facing**
- `extract-invoice-data`, `parse-credentials-pdf`, `parse-excel-with-ai` — chamadas AI ilimitadas por utilizador.
- Fix: Rate limiting por user/hora (tabela Supabase ou middleware).

### LOW (4 issues)
- `_revenue_category_cleanup_evidence` sem RLS (tabela interna)
- Edge functions nao validam tamanho do payload base64
- Import CSV nao valida valores contra CHECK constraints do DB
- CORS `*` em 5 funcoes service-role-only (impacto minimo)

---

## 3. TESTES — A MAIOR LACUNA

### Numeros reais

| Camada | Ficheiros fonte | Ficheiros testados | Cobertura |
|--------|----------------|-------------------|-----------|
| `src/lib/` (logica) | 61 | 28 (45%) | **Decente** |
| `src/hooks/` | 53 | 0 (0%) | **Zero** |
| `src/components/` | 173 | 1 (0.6%) | **Zero** |
| `src/pages/` | 36 | 0 (0%) | **Zero** |
| Edge functions | 26 | 3 ficheiros (11%) | **Quase zero** |
| **E2E (Playwright)** | — | 14 specs | **Parcial** |

### O que IS bem testado (902 testes)
- Calculos fiscais (IVA, SS, Modelo 10 formulas)
- Validacao NIF/NISS
- Parsers com testes (eFatura, AT recibos, universal import)
- Motor de regras de classificacao
- Encryption utilities
- Sync retry/health logic

### O que NAO esta testado
- **Todos os 53 hooks** — 12,372 linhas sem qualquer teste
- **Todos os 173 componentes** — ~35,000 linhas sem teste
- **Todas as 36 paginas** — ~15,000 linhas sem teste
- **23 de 26 edge functions** — incluindo sync-efatura, process-queue, batch-classify
- Parsers criticos: invoiceSystemParser (966 linhas), reconciliationEngine (790), csvParser (728), reciboVerdeParser (716)
- Geradores: modelo10ExcelGenerator (583), pdfGenerator (359)

### E2E — Flows que faltam
- Upload completo com OCR/AI extraction end-to-end
- Gestao de credenciais AT e sync
- Exports (PDF, Excel, SAF-T)
- Modelo 10 bulk upload e processamento
- Reconciliacao
- Gestao de clientes (add/edit/delete)
- Import center (CSV, Excel, recibos verdes)
- Isolamento de dados accountant-client (verificacao RLS)

### Coverage tool
`@vitest/coverage-v8` **nao esta instalado**. Nao ha metricas de cobertura reais (line/branch/statement).

---

## 4. FEATURES — QUASE TUDO COMPLETO

### Completo (funcional e ligado)
- Upload de facturas (QR, camera, ficheiro, bulk, SAF-T, offline)
- Validacao de compras e vendas com classificacao AI
- Modelo 10 (pipeline completo, 100% match com AT oficial)
- Reports com export PDF/Excel
- Dashboard com onboarding, stats, deadlines fiscais
- Workflow multi-cliente para contabilistas
- Gestao de credenciais AT e sync (CSV, API test, API producao)
- SAF-T XML export
- Reconciliacao (AT, Modelo 10, SS)
- Calculadora SS e IVA
- Admin panel (users, accountants, partners, super admin)
- PWA com suporte offline
- Social Security com todos os coeficientes

### PARCIAL
| Feature | Estado | O que falta |
|---------|--------|-------------|
| Contact form (`/contact`) | UI existe | Submissao simulada com `setTimeout`, nao ligada a backend |
| Push notifications | Edge function existe | So guarda em DB, nunca envia (Web Push/VAPID nao implementado) |
| Google OAuth | Codigo existe | Botao comentado — "aguardando configuracao OAuth" |

### MISSING (inexistente)
| Feature | Impacto | Notas |
|---------|---------|-------|
| **Billing / Stripe** | CRITICO para monetizacao | Landing mostra 3 tiers (Gratis/Pro/Enterprise) mas zero implementacao de pagamento, paywall, ou enforcement de limites |
| **CI/CD pipeline** | Medio | GitHub token sem scope `workflow`, nao pode push .github/workflows/ |
| **Sentry user correlation** | Baixo | `Sentry.setUser()` nao chamado — erros sem contexto de utilizador |

---

## 5. CODIGO MORTO — ~30 FICHEIROS REMOVIVEIS

### Lib files mortos (7 + 5 testes)
| Ficheiro | Motivo |
|----------|--------|
| `src/lib/atInvoiceMapper.ts` | Zero imports. Forma ilha morta com wsSecurityUtils. |
| `src/lib/wsSecurityUtils.ts` | So importado pelo atInvoiceMapper (tambem morto). WS-Security redeclarado nas edge functions. |
| `src/lib/design-tokens.ts` | Zero imports externos. Tailwind faz tudo. |
| `src/lib/documentTypeDetector.ts` | So importado pelo proprio teste. |
| `src/lib/encryptionUtils.ts` | So importado pelo proprio teste. Encryption e server-side. |
| `src/lib/nifAggregator.ts` | So importado pelo proprio teste. 11 exports nao usados. |
| `src/lib/portugalTaxRates2026.ts` | So importado pelo proprio teste. |
| `src/lib/viesHelpers.ts` | So importado pelo proprio teste. VIES e server-side. |

### Hooks mortos
| Ficheiro | Motivo |
|----------|--------|
| `src/hooks/usePartners.tsx` | Zero imports em todo o codebase |
| `src/hooks/use-toast.ts` + cadeia | Substituido por Sonner (72 ficheiros usam sonner) |
| `src/hooks/use-mobile.tsx` | So importado por sidebar.tsx (tambem nao usado) |

### Componentes mortos
| Ficheiro | Motivo |
|----------|--------|
| `src/components/modelo10/BulkUploadTab.tsx` | Zero referencias |
| `src/components/modelo10/BulkUploadBanner.tsx` | Zero referencias |
| `src/components/NavLink.tsx` | Zero imports externos |
| 15x shadcn/ui components | Gerados mas nunca usados (aspect-ratio, avatar, breadcrumb, calendar, carousel, context-menu, drawer, hover-card, input-otp, menubar, navigation-menu, resizable, sidebar, toggle-group, toaster) |

### Edge function deprecated
- `fetch-efatura-portal` — retorna 410 Gone. Pode ser eliminada.

---

## 6. EDGE FUNCTIONS — DUPLICACAO E QUALIDADE

### Code duplication (deve ser extraido para `_shared/`)
| Codigo duplicado | Onde | Fix |
|-----------------|------|-----|
| `encryptPassword` / `encryptSecret` | import-client-credentials, reencrypt-credentials, upload-at-certificate | Extrair para `_shared/encrypt.ts` |
| `normalizeSupplierTaxId` + `SAFE_GLOBAL_NIFS` | classify-invoice, nightly-classify | Extrair para `_shared/classificationHelpers.ts` |
| JSON parsing custom | parse-credentials-pdf | Usar `_shared/parseJsonFromAI.ts` |

### Issues pontuais
| Funcao | Issue |
|--------|-------|
| `ab-test-classify` | Modelo AI stale: `gemini-2.5-flash` (todos os outros usam 3.1) |
| `create-client-direct` | URL hardcoded `https://ivazen.aitipro.com` (dominio antigo) |
| `create-client-direct` | Retorna HTTP 200 em erros (deveria ser 500) |
| `batch-classify-sales` | Swallows errors silently no catch block |
| `send-push-notification` | Stub — so guarda, nunca envia. Sem autorizacao. |

---

## 7. BUNDLE & PERFORMANCE

### Top 5 chunks (maiores)
| Chunk | Raw | Gzip |
|-------|-----|------|
| vendor-xlsx | 424 KB | 141 KB |
| vendor-pdf | 389 KB | 126 KB |
| BarChart (recharts) | 374 KB | 103 KB |
| Modelo10 | 369 KB | 98 KB |
| vendor-crypto | 283 KB | 75 KB |

**Total dist:** 5.2 MB | **CSS:** 166 KB (25 KB gzip)
**PWA precache:** 131 entries, 5 MB

### Optimizacoes possiveis
- xlsx e pdf-lib sao os maiores vendors — considerar lazy-load apenas quando export e pedido
- recharts/BarChart 374 KB — grande para graficos. Alternativa mais leve: chart.js ou lightweight charting
- Modelo10 369 KB — pagina unica pesada, pode beneficiar de code splitting interno

---

## 8. PLANO DE ACCAO PRIORITIZADO

### P0 — Seguranca (fazer AGORA)
1. Fix `isServiceRoleToken` JWT fallback (H1) — **1 ficheiro, 10 linhas**
2. Add RLS a `supplier_directory` (H2) — **1 migration**
3. Fix autorizacao em `send-push-notification` (M2) — **5 linhas**

### P1 — Monetizacao (fazer esta semana)
4. Integrar Stripe (checkout, subscricoes, webhook, paywall middleware)
5. Enforcement de limites por plano (Gratis: 50 facturas/mes, Pro: ilimitado)

### P2 — Qualidade de codigo (fazer este mes)
6. Instalar `@vitest/coverage-v8` e estabelecer baseline
7. Testar os 5 parsers criticos sem cobertura (invoiceSystemParser, reconciliationEngine, csvParser, reciboVerdeParser, modelo10ExcelGenerator)
8. Remover codigo morto (~30 ficheiros)
9. Extrair duplicacoes em edge functions para `_shared/`
10. Fix URL hardcoded em `create-client-direct`
11. Fix modelo AI stale em `ab-test-classify`

### P3 — Robustez (proximo mes)
12. Rate limiting em edge functions user-facing
13. Testes de hooks criticos (useInvoices, useAuth, useSocialSecurity)
14. E2E para flows que faltam (upload+OCR, AT sync, exports)
15. CI/CD pipeline (resolver scope do GitHub token)
16. Sentry.setUser() para correlacao de erros
17. Contact form ligado a backend (email service)
18. Google OAuth configuracao

### P4 — Nice-to-have
19. Optimizacao de bundle (lazy xlsx/pdf, alternativa a recharts)
20. Push notifications reais (VAPID + Web Push)
21. Remover `fetch-efatura-portal` deprecated

---

## Notas finais

Este **nao e um projecto em mau estado**. O build esta limpo, as features estao implementadas, a logica fiscal esta validada contra dados reais da AT. Os 902 testes que existem cobrem a logica mais critica (calculos fiscais, validacao NIF, parsers core).

As lacunas sao claras e corrigiveis:
- **Seguranca P0** resolve-se em **1 dia** (3 fixes pontuais)
- **Billing** e o blocker real para monetizacao — e um projecto de **1-2 semanas**
- **Testes** precisam de investimento gradual, priorizando parsers e hooks criticos
- **Codigo morto** limpa-se em **2 horas**

A distancia entre "funcional" e "premium" e mensuravel e fechavel.
