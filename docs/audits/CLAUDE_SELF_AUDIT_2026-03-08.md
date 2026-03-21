# IVAzen — Self-Audit para Claude Code

Data: 2026-03-08
Repo: `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas`
Branch: `codex/claude-handoff-fiscal-at`

Este ficheiro resume o que foi implementado nesta ronda final, o que foi validado e o que continua por fazer para considerar o produto "premium" para contabilistas.

## Objetivo desta ronda

Fechar os gaps mais perigosos sem regredir funcionalidade:

- contexto multi-cliente em fluxos fiscais
- review real do `Modelo 10`
- tipologia fiscal do cliente (`taxpayer_kind`)
- guardrails no pipeline AT/OCR do `Modelo 10`
- documentação suficiente para auditoria externa do branch

## O que foi implementado

### 1. Segurança multi-cliente

Foi removida a operação silenciosa no cliente errado nas áreas mais críticas.

Ficheiros-chave:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/clientScope.ts`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useClientFiscalProfile.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/SocialSecurity.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/Validation.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/Upload.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/EFaturaSync.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/Export.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/Modelo10.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/upload/BulkInvoiceUpload.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/upload/SAFTInvoiceImporter.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/modelo10/ATRecibosImporter.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/modelo10/EmailNotificationImporter.tsx`

Resultado:

- contabilistas deixam de cair implicitamente no primeiro cliente
- importações e syncs exigem contexto explícito
- `SS` deixa de usar o perfil do contabilista em vez do cliente
- `Export` deixou de ficar vazio sem instrução quando falta cliente

### 2. Modelo 10 — import AT/OCR e reconciliação

Foi endurecido o pipeline para reduzir drift entre `upload_queue`, `OCR`, `AT CSV` e `tax_withholdings`.

Ficheiros-chave:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/modelo10/ATRecibosImporter.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/atRecibosParser.ts`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/process-queue/index.ts`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/__tests__/canonicalReference.test.ts`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/__tests__/modelo10Convergence.test.ts`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/__tests__/modelo10Pipeline.test.ts`

Resultado validado:

- caso real `CAAD 2025` reconciliado a `143/143` beneficiários contra o `CSV AT agregado por beneficiário`
- delta base: `0,00 €`
- delta IRS: `0,07 €`

Nota importante:

- o `143/143` compara contra o `truth set` do CSV AT por beneficiário
- o agregado anual oficial AT continua a ser `1.013.911,80 €`
- a soma do CSV por beneficiário dá `1.013.911,83 €` por arredondamento acumulado

### 3. Modelo 10 — review operacional dentro da app

Foi criada uma camada de review real para candidatos antes da promoção final.

Ficheiros-chave:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useWithholdingCandidates.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/modelo10/WithholdingCandidatesReview.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/modelo10/EditWithholdingCandidateDialog.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/review-withholding-candidate/index.ts`

Capacidades agora disponíveis:

- listar candidatos por beneficiário com drill-down por documento
- promover ou rejeitar em bulk
- editar individualmente um candidato antes da promoção
- registar audit trail de revisão no candidato

Nota:

- a edge function `review-withholding-candidate` já foi deployada no projeto `dmprkdvkzzjtixlatnlx`

### 4. `taxpayer_kind`

Foi introduzida a tipologia fiscal do cliente para melhorar a UX e a prioridade das obrigações.

Ficheiros-chave:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/migrations/20260308120000_add_taxpayer_kind.sql`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/taxpayerKind.ts`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/__tests__/taxpayerKind.test.ts`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useTaxpayerKind.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/settings/EditClientDialog.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/dashboard/DashboardLayout.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useProfile.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/integrations/supabase/types.ts`

Comportamento:

- `eni` → prioridade visual a `IVA + SS`
- `company` → prioridade visual a `IVA + Modelo 10`
- `mixed` → tudo primário
- `null` → fallback neutro

Correções já incluídas:

- inferência via `sales_invoices.client_id` em vez de `user_id`
- uso também de `ss_declarations` como sinal
- opção explícita `Auto-detectar`
- o dashboard já não atenua a sidebar com base no perfil errado quando o contabilista ainda não escolheu cliente

## Validação executada

### Build e testes

- `npm run build` passou
- `npm test` passou
  - `34` suites
  - `812` testes
- `deno check /Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/process-queue/index.ts` passou
- `deno check /Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/review-withholding-candidate/index.ts` passou

### Estado operacional remoto desta ronda

- migration `20260308120000_add_taxpayer_kind.sql` aplicada no projeto `dmprkdvkzzjtixlatnlx`
- edge function `review-withholding-candidate` deployada no projeto `dmprkdvkzzjtixlatnlx`

## O que fica efetivamente pronto para entrega

### IVA

Estado: `operacional`

- compras contam corretamente
- fluxos de contabilista já não trabalham no cliente errado

### Segurança Social

Estado: `operacional`

- cálculo scoped ao cliente
- UI bloqueia corretamente quando falta cliente em contexto de contabilista

### Modelo 10

Estado: `operacional com review`

- import AT empresa validado
- pipeline OCR/manual validado no caso `CAAD`
- review de candidatos disponível
- edição individual disponível e deployada

## O que ainda falta para chamar "100% premium"

Nada disto invalida a entrega funcional. São os blocos seguintes de produto:

1. `Centro Fiscal do Cliente`
- uma superfície única por cliente com `IVA`, `SS`, `Modelo 10`, estado e próxima ação

2. `Centro de Importação`
- unificar `AT SOAP`, `CSV/Excel AT`, `PDF/OCR`, `SAF-T`

3. schema hardening
- mover metadados fiscais temporários para colunas próprias

4. performance frontend
- code-splitting nas páginas mais pesadas

## Self-audit honesto

### O que considero fechado

- contexto multi-cliente crítico
- reconciliação técnica forte do `Modelo 10`
- base de UX fiscal por tipo de cliente

### O que considero ainda parcial

- cockpit premium unificado
- centro de importação
- schema hardening
- performance frontend em páginas mais pesadas

### O que não foi removido por prudência

Existem muitos ficheiros `untracked` de diagnóstico, scripts de análise, docs HTML, `.claude`, `.storybook`, `.github` e utilitários locais.

Não foram apagados nesta ronda para evitar destruir material potencialmente útil do utilizador.

## Commits relevantes

- `ecd6850` `fix: support AT SIRE sales import and modelo 10 guardrails`
- `ccd84f5` `chore: tighten CAAD modelo 10 audit scripts`
- `66b9c83` `docs: add premium accountant roadmap`
- `fdf78a0` `fix: harden accountant client flows and modelo 10 review`
- `23d3f6f` `fix: finalize modelo 10 import and ocr guardrails`
- `f4c7399` `fix: scope import flows to explicit accountant clients`
- `c839983` `fix: correct taxpayer kind inference and selection ux`
- `2573362` `feat: finalize taxpayer kind and modelo 10 review editing`

## Perguntas certas para auditoria externa

Se o Claude quiser auditar este estado, as perguntas úteis são:

1. há mais algum fallback silencioso de cliente fora dos fluxos já corrigidos?
2. a edge function `review-withholding-candidate` tem o mínimo certo de validação, segurança e audit trail?
3. `taxpayer_kind` deve inferir-se com mais sinais, ou está suficientemente estável?
4. o próximo passo com mais valor é mesmo o `Centro Fiscal do Cliente`, ou existe algum gap funcional mais prioritário?
