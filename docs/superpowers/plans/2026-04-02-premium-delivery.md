# Premium Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fechar os blockers de entrega premium do IVAzen até estado auditável de produção, incluindo source tree, rollout live, remediação de dados e escala.

**Architecture:** a execução decorre em seis tarefas ordenadas. Primeiro congelamos um artefacto de release reproduzível. Depois alinhamos Supabase e VPS com o estado do código. Só então fazemos writes live controlados e fechamos a paginação server-side dos hooks críticos. Terminamos com auditoria final local + live.

**Tech Stack:** Git, React, TypeScript, Vite, Vitest, Supabase CLI, Supabase Edge Functions, REST API, Docker, VPS AT connector

---

### Task 1: Freeze the releasable source tree

**Files:**
- Modify: `src/components/zen/ZenEmptyState.tsx`
- Modify: `src/hooks/useInvoices.tsx`
- Modify: `src/pages/Landing.tsx`
- Modify: `src/pages/Validation.tsx`
- Modify: `supabase/functions/sync-efatura/index.ts`
- Create: `src/components/zen/__tests__/ZenEmptyState.test.tsx`
- Create: `src/lib/__tests__/auditClosure.test.ts`
- Create: `src/lib/__tests__/invoiceSearch.test.ts`
- Create: `src/lib/__tests__/validationRuntimeGuard.test.ts`
- Create: `src/lib/invoiceSearch.ts`
- Create: `supabase/functions/_shared/connectorFallback.ts`
- Create: `supabase/functions/_shared/connectorFallback.test.ts`
- Modify: `package-lock.json`
- Modify: `services/at-connector/package-lock.json`

- [ ] **Step 1: Inspect the local diff and keep only delivery files**

Run:

```bash
git status --short
git diff --stat -- src/pages/Landing.tsx src/hooks/useInvoices.tsx src/pages/Validation.tsx src/components/zen/ZenEmptyState.tsx supabase/functions/sync-efatura/index.ts package-lock.json services/at-connector/package-lock.json
```

Expected:
- only the delivery files above are prepared for commit;
- planning docs in `docs/superpowers/` stay out of the product commit.

- [ ] **Step 2: Run focused regression checks before staging**

Run:

```bash
npm test -- --run src/components/zen/__tests__/ZenEmptyState.test.tsx
npm test -- --run src/lib/__tests__/auditClosure.test.ts
npm test -- --run src/lib/__tests__/invoiceSearch.test.ts
npm test -- --run src/lib/__tests__/validationRuntimeGuard.test.ts
npm test -- --run supabase/functions/_shared/connectorFallback.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 3: Run the full release gate on the exact release tree**

Run:

```bash
npm run verify:release
```

Expected:
- build succeeds;
- tests pass;
- lint passes;
- smoke gate exits `0` even without demo env.

- [ ] **Step 4: Commit the releasable tree**

Run:

```bash
git add src/components/zen/ZenEmptyState.tsx src/hooks/useInvoices.tsx src/pages/Landing.tsx src/pages/Validation.tsx supabase/functions/sync-efatura/index.ts src/components/zen/__tests__/ZenEmptyState.test.tsx src/lib/__tests__/auditClosure.test.ts src/lib/__tests__/invoiceSearch.test.ts src/lib/__tests__/validationRuntimeGuard.test.ts src/lib/invoiceSearch.ts supabase/functions/_shared/connectorFallback.ts supabase/functions/_shared/connectorFallback.test.ts package-lock.json services/at-connector/package-lock.json
git commit -m "feat: freeze premium delivery runtime and sync hardening"
```

Expected: one commit that reproduces the intended release artifact.

### Task 2: Align the remote Supabase project

**Files:**
- Modify: none expected
- Deploy from: `supabase/functions/nightly-classify/index.ts`
- Apply: `supabase/migrations/20260402010000_add_nightly_enrichment_crons.sql`

- [ ] **Step 1: Verify remote drift before rollout**

Run:

```bash
supabase migration list --linked
supabase functions list --project-ref dmprkdvkzzjtixlatnlx
supabase secrets list --project-ref dmprkdvkzzjtixlatnlx
```

Expected:
- migration `20260402010000` still missing remotely before rollout;
- `nightly-classify` absent or outdated;
- required secrets present.

- [ ] **Step 2: Deploy the missing edge function**

Run:

```bash
supabase functions deploy nightly-classify --project-ref dmprkdvkzzjtixlatnlx
```

Expected: deploy succeeds without changing function contracts.

- [ ] **Step 3: Apply the pending cron migration**

Run:

```bash
supabase db push --project-ref dmprkdvkzzjtixlatnlx
```

Expected:
- remote migration list becomes aligned;
- cron migration is applied exactly once.

- [ ] **Step 4: Re-verify remote alignment**

Run:

```bash
supabase migration list --linked
supabase functions list --project-ref dmprkdvkzzjtixlatnlx | rg "nightly-classify|enrich-supplier-vies"
```

Expected:
- `20260402010000` appears both local and remote;
- `nightly-classify` and `enrich-supplier-vies` are active remotely.

### Task 3: Run bounded live supplier enrichment remediation

**Files:**
- Modify: none expected
- Use: `scripts/run-vies-enrichment.mjs`

- [ ] **Step 1: Measure the current live baseline**

Run:

```bash
./scripts/at_connector_healthcheck.sh
```

And record, via service-role REST or equivalent admin query:

```text
supplier_directory source='vies'
supplier_directory source='nif_pt'
invoices with supplier_name IS NULL and business NIF
```

- [ ] **Step 2: Dry-run the final VIES batch**

Run:

```bash
node scripts/run-vies-enrichment.mjs --dry-run --limit=200
```

Expected: a bounded candidate list, not an unbounded backfill.

- [ ] **Step 3: Execute the bounded VIES batch**

Run:

```bash
node scripts/run-vies-enrichment.mjs --limit=200
```

Expected:
- only unresolved business NIFs are touched;
- the script reports enriched / not found / error counts.

- [ ] **Step 4: Re-measure the live counts**

Re-run the same baseline metrics and confirm:
- business-NIF missing-name count decreased;
- `source='vies'` increased materially.

### Task 4: Deploy the Playwright-capable AT connector to the VPS

**Files:**
- Modify: `services/at-connector/Dockerfile.playwright`
- Verify: `services/at-connector/src/index.js`
- Verify: `services/at-connector/src/playwrightScraper.js`

- [ ] **Step 1: Build the connector image locally**

Run:

```bash
cd services/at-connector
docker build -f Dockerfile.playwright -t at-connector:3.0.0 .
```

Expected: image builds with Chromium installed.

- [ ] **Step 2: Verify the container starts locally**

Run:

```bash
docker run --rm -p 8787:8787 \
  --env-file /etc/ivazen/at/connector.env \
  -e CHROMIUM_PATH=/usr/bin/chromium \
  -v /etc/ivazen/at/certs:/certs:ro \
  at-connector:3.0.0
```

Expected: process boots cleanly and serves health locally.

- [ ] **Step 3: Deploy to the VPS**

Run:

```bash
ssh -i ~/.ssh/jarvis_vps ubuntu@137.74.112.68
cd /opt/iva-inteligente-mvp/services/at-connector
docker build -f Dockerfile.playwright -t at-connector:3.0.0 .
docker stop at-connector && docker rm at-connector
docker run -d --name at-connector --restart=unless-stopped \
  -p 127.0.0.1:8787:8787 \
  --env-file /etc/ivazen/at/connector.env \
  -e CHROMIUM_PATH=/usr/bin/chromium \
  -v /etc/ivazen/at/certs:/certs:ro \
  at-connector:3.0.0
```

Expected: connector restarts on the VPS with Chromium available.

- [ ] **Step 4: Verify health and recibos-verdes path**

Run:

```bash
curl -s http://137.74.112.68:8788/health
```

Then run a real or controlled `recibos-verdes` request with the connector token and confirm the Playwright path is available for fallback.

### Task 5: Replace blocking `fetchAllPages` usage in the critical hooks

**Files:**
- Modify: `src/hooks/useInvoices.tsx`
- Modify: `src/hooks/useSalesInvoices.tsx`
- Modify: `src/hooks/useReconciliationData.tsx`
- Modify: `src/hooks/useAccountant.tsx`
- Modify: `src/hooks/useClientFiscalCenter.tsx`
- Create: `src/lib/__tests__/serverPaginationHooks.test.ts` if new helper logic is extracted
- Create or modify: shared pagination helpers under `src/lib/`

- [ ] **Step 1: Write failing tests for extracted pagination logic**

Add coverage for:
- page-bound queries using `.range(from, to)`;
- exact counts coming from Supabase metadata instead of full-array length;
- search terms staying server-side for normal navigation.

- [ ] **Step 2: Implement a shared server-pagination helper**

Use the existing Supabase pattern:

```ts
const { data, count, error } = await supabase
  .from('table')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(from, to);
```

Extract the repeated range/count wiring into a small helper when it reduces duplication.

- [ ] **Step 3: Update `useInvoices.tsx` and `useSalesInvoices.tsx` first**

Keep:
- server-side search for 2+ chars;
- local fallback only for the 1-char assistive case;
- `totalCount` sourced from server count, not fetched array size.

- [ ] **Step 4: Update accountant/reconciliation/client-center hooks**

For daily navigation flows, return paged rows and server-derived counts instead of materialising the whole dataset.

Keep `fetchAllPages` only where the flow is explicitly batch/export oriented.

- [ ] **Step 5: Verify the targeted tests and full repo checks**

Run:

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: no regression and no new full-fetch dependency on the critical screens.

### Task 6: Final release verification and publication

**Files:**
- Modify: none expected unless verification reveals a concrete bug

- [ ] **Step 1: Push the release commit**

Run:

```bash
git push origin main
```

Expected: CI triggers from the exact committed tree.

- [ ] **Step 2: Verify CI and production deployment**

Run:

```bash
gh run list --limit 3
```

And confirm the public deployment uses the pushed commit.

- [ ] **Step 3: Run the final premium audit subset**

Verify again:
- `npm run verify:release`
- branch protection
- remote Supabase migration/function alignment
- AT connector health
- live `at_credentials` counts
- live supplier enrichment counts
- critical browser flows on `https://ivazen.aitipro.com`

- [ ] **Step 4: Produce the delivery verdict**

Record PASS / FAIL / PARTIAL for the final criteria and only call the delivery complete if all blocking items are green.
