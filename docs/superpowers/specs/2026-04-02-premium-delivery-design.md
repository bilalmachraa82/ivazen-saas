# Premium Delivery Design

## Goal

Levar o IVAzen a um estado de entrega premium para a cliente, com evidência fresca em quatro frentes ao mesmo tempo:

1. source tree reproduzível e auditável;
2. rollout live completo em Supabase, frontend e AT connector;
3. remediação operacional dos dados críticos já existentes;
4. fecho dos riscos de escala mais visíveis para carteiras grandes.

## Scope

### Track A: Source Hardening

- consolidar o worktree atual num release tree reproduzível;
- manter apenas os ficheiros úteis já preparados localmente;
- garantir `npm run verify:release` verde no tree exato a enviar.

### Track B: Platform Rollout

- aplicar a migration remota em falta `20260402010000_add_nightly_enrichment_crons.sql`;
- deployar a edge function `nightly-classify`;
- verificar que o inventário remoto de functions e secrets corresponde ao esperado;
- garantir que o frontend auditado é o que fica em produção;
- deployar o AT connector com Chromium para suportar o fallback Playwright.

### Track C: Live Remediation

- executar um último batch VIES controlado para o residual de NIFs de empresa;
- aceitar como não-bloqueante o backlog AT cujo root cause é password expirada no Portal AT;
- recontar `at_credentials`, `supplier_directory`, `invoices` com métricas antes/depois;
- deixar a app em estado operacional verificável, não apenas “codigo pronto”.

### Track D: Scale Hardening

- remover os usos bloqueantes de `fetchAllPages` nos hooks críticos de exploração diária;
- trocar o padrão “fetch everything then filter locally” por paginação e pesquisa server-side;
- manter `fetchAllPages` apenas nos fluxos de export e nos fluxos explicitamente batch.

## Release Strategy

### 1. Freeze the release artifact first

O estado atual do repositório contém alterações locais úteis que ainda não estão committed. O primeiro passo é promover apenas o conjunto validado para git, para que o deploy live deixe de depender de um worktree sujo.

### 2. Deploy code before live mutations

Nenhuma remediação live deve correr antes de:

- a migration de cron existir remotamente;
- `nightly-classify` estar deployada;
- o connector Playwright estar disponível no VPS.

Caso contrário, qualquer melhoria conseguida por batches manuais degrada outra vez na noite seguinte.

### 3. Bounded operational writes

As remediações live devem ser feitas em batches pequenos, com métricas antes/depois, para manter rollback mental simples e para distinguir melhoria real de ruído operacional.

### 4. Performance after runtime correctness

A paginação server-side é parte do “premium delivery” porque o gabinete tem carteiras grandes. Mesmo não sendo o primeiro blocker de produção, entra nesta entrega porque o comportamento atual degrada a UX em uso diário.

## Design Decisions

### Release tree

O release tree a promover deve incluir os deltas locais úteis já existentes:

- copy final de `Landing`;
- guardrail de `Validation`;
- hardening de `ZenEmptyState`;
- helper `invoiceSearch`;
- extração de `connectorFallback`;
- testes de regressão correspondentes;
- drift relevante de lockfiles.

Os ficheiros de planning em `docs/superpowers/` não fazem parte da entrega do produto.

### Supabase rollout

O rollout Supabase é considerado completo apenas se:

- `migration list --linked` deixar de mostrar drift para `20260402010000`;
- `functions list` passar a incluir `nightly-classify`;
- os crons noturnos ficarem ativos via migration, e não apenas descritos no código local.

### AT connector

O serviço atual já serve o caminho SOAP de invoices. O gap real é o recibos-verdes SPA fallback. A solução é promover o image path com `Dockerfile.playwright` e correr o connector com Chromium instalado, sem mexer no contrato HTTP do serviço.

### Data remediation

O objetivo não é zerar todos os `supplier_name IS NULL`, porque muitos pertencem a NIFs pessoais não cobertos por VIES. O objetivo de entrega é:

- eliminar ou reduzir fortemente o residual de NIFs empresariais ainda sem enrichment;
- deixar o restante backlog claramente classificado entre “VIES”, “nif.pt” e “não aplicável”.

### Large-portfolio scale

Os hooks críticos a corrigir nesta entrega são:

- `src/hooks/useInvoices.tsx`
- `src/hooks/useSalesInvoices.tsx`
- `src/hooks/useReconciliationData.tsx`
- `src/hooks/useAccountant.tsx`
- `src/hooks/useClientFiscalCenter.tsx`

Nestes pontos, a página deve deixar de depender de arrays completos para operar no modo normal de navegação.

## Success Criteria

A entrega premium só fica concluída quando todas estas condições forem verdade ao mesmo tempo:

- o tree enviado está committed e reproduzível;
- `npm run verify:release` passa no tree final;
- a migration `20260402010000` está aplicada no projeto remoto;
- `nightly-classify` está deployada e ativa;
- o AT connector Playwright está deployado no VPS;
- a contagem live de `supplier_directory.source in ('vies','nif_pt')` melhora e o residual empresarial baixa;
- os fluxos principais deixam de depender de `fetchAllPages` nos hooks críticos;
- existe uma auditoria final com evidência fresca local + live.

## Rollback

- Source: revert normal por commit, nunca reset destrutivo.
- Supabase schema: forward-fix preferido; nada de rollback destrutivo.
- Edge functions: redeploy da versão anterior se necessário.
- VPS connector: manter tag anterior do container pronta para restart rápido.

## Out Of Scope

- refatoração ampla do produto não ligada à entrega;
- limpeza total de dados históricos não empresariais;
- otimizações cosméticas sem impacto em entrega, fiabilidade ou escala.
