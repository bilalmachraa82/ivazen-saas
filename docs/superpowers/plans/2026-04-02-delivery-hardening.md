# Delivery Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remover os blockers de runtime que impedem a entrega e depois fechar a remediação operacional live.

**Architecture:** a correção é feita em duas fases. Primeiro estabilizamos o runtime com fixes pequenos e testes de regressão. Depois fazemos deploy e atacamos o estado live com reruns controlados e nova auditoria.

**Tech Stack:** React, Vite, Vitest, Playwright, Supabase Edge Functions, scripts Node, Vercel

---

### Task 1: Guardar `ZenEmptyState` contra variants sem suporte

**Files:**
- Create: `src/components/zen/__tests__/ZenEmptyState.test.tsx`
- Modify: `src/components/zen/ZenEmptyState.tsx`

- [ ] **Step 1: Write the failing test**

Add a regression test that renders `ZenEmptyState` with `variant="success"` and expects no throw.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/zen/__tests__/ZenEmptyState.test.tsx`

- [ ] **Step 3: Write minimal implementation**

Add `success` and `warning` styles to the variant map and a safe fallback to `default`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/zen/__tests__/ZenEmptyState.test.tsx`

- [ ] **Step 5: Commit**

Optional local checkpoint commit after green.

### Task 2: Remove the blocking legacy onboarding from `Validation`

**Files:**
- Create: `src/lib/__tests__/validationRuntimeGuard.test.ts`
- Modify: `src/pages/Validation.tsx`

- [ ] **Step 1: Write the failing test**

Add a source-level regression test asserting that `Validation.tsx` no longer imports or mounts `OnboardingTour`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/validationRuntimeGuard.test.ts`

- [ ] **Step 3: Write minimal implementation**

Remove the `OnboardingTour` import and JSX mount from `Validation.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/validationRuntimeGuard.test.ts`

- [ ] **Step 5: Commit**

Optional local checkpoint commit after green.

### Task 3: Re-run repo verification

**Files:**
- Modify: none expected

- [ ] **Step 1: Run focused tests**

Run:
- `npm test -- --run src/components/zen/__tests__/ZenEmptyState.test.tsx`
- `npm test -- --run src/lib/__tests__/validationRuntimeGuard.test.ts`

- [ ] **Step 2: Run full repo checks**

Run:
- `npm test -- --run`
- `npm run lint`
- `npm run build`

- [ ] **Step 3: Fix any regressions**

If failures appear, fix the smallest root cause only and rerun the failed command.

### Task 4: Deploy and browser revalidation

**Files:**
- Modify: none expected unless regression found

- [ ] **Step 1: Create preview or production deployment**

Use the existing Vercel workflow already linked to this repo.

- [ ] **Step 2: Revalidate critical browser flows**

Check:
- login
- select `Agostinho`
- `Trabalho > Compras`
- `Importadas 24h -> Pendentes`
- `Reconciliação`
- client search `mario -> Mário`

- [ ] **Step 3: Only continue to live remediation if runtime is green**

Do not mix runtime bugs with data remediation.

### Task 5: Live operational remediation

**Files:**
- Modify: only if diagnostics reveal a real code bug
- Use existing scripts/functions first

- [ ] **Step 1: Inspect AT failure population**

Query and group `at_credentials.last_sync_status` and recent reason codes.

- [ ] **Step 2: Rerun safe recovery flows**

Use the existing AT sync infrastructure for controlled reruns rather than ad-hoc SQL edits.

- [ ] **Step 3: Execute VIES enrichment batches**

Use `scripts/run-vies-enrichment.mjs` and/or `enrich-supplier-vies` in bounded batches.

- [ ] **Step 4: Re-measure live counts**

Recheck:
- `at_credentials`
- `supplier_directory source='vies'`
- invoices with business NIF and `supplier_name IS NULL`

### Task 6: Final delivery audit

**Files:**
- Modify: none expected

- [ ] **Step 1: Re-run the premium audit subset**

Repeat the failed checks from the last audit.

- [ ] **Step 2: Produce a delivery verdict**

Mark each previous blocker as fixed, partially fixed, or still blocked with evidence.
