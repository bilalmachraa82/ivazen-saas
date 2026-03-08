# IVAzen — Entrega Final de Validação

Data: 2026-03-08
Repo: `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas`
Branch: `codex/claude-handoff-fiscal-at`

## Objetivo desta entrega

Fechar a entrega operacional para contabilistas com foco em:

- `IVA`
- `Segurança Social`
- `Modelo 10`

com validação técnica real, menos risco operacional em multi-cliente e uma base de UX mais premium.

## O que ficou fechado

### 1. IVA

- compras auto-aprovadas contam fiscalmente
- widgets de IVA já não mostram estados enganadores quando o contabilista não selecionou cliente
- flows de upload/validação já não trabalham silenciosamente no cliente errado

### 2. Segurança Social

- a página de `SS` deixou de usar implicitamente o perfil do contabilista
- o cálculo passa a depender do cliente selecionado
- a contribuição apresentada usa o cálculo efetivo do hook, incluindo isenção quando aplicável
- o fluxo fica bloqueado até existir escolha explícita de cliente
- o hook passou a usar perfil fiscal scoped do cliente, não apenas correção visual na página

### 3. Modelo 10

- o import atual da AT para empresa ficou funcional para `CSV/Excel`
- o `process-queue` ganhou guardrails para:
  - referência canónica
  - distinção `prestador` vs `adquirente`
  - retenção zero legal
  - verificação `SAVED => tax_withholding persistido`
- o caso real `CAAD 2025` ficou reconciliado a `143/143` beneficiários no truth set do CSV agregado por beneficiário
- a diferença residual do IRS fica em `0,07 €`, tratada como arredondamento do agregado por beneficiário
- foi criada uma tab real de revisão de candidatos antes da promoção final

## Validação executada

### Build e testes

- `npm run build` passou
- `npm test` passou
  - `33` suites
  - `790` testes
- `deno check supabase/functions/process-queue/index.ts` passou

### Observação de performance

- o build continua a avisar sobre chunks grandes em páginas pesadas como `Modelo10`, `Upload`, `Dashboard` e `AdminCertificates`
- isto não bloqueia a entrega funcional, mas é o próximo alvo claro para otimização com code-splitting

### Validação funcional

- `CAAD 2025`
  - `OCR/manual vs AT CSV por beneficiário`: `143/143`
  - delta base: `0,00 €`
  - delta IRS: `0,07 €`

### Nota importante sobre a AT

Há duas leituras válidas e diferentes:

- agregado anual oficial AT: `1.013.911,80 €`
- soma do CSV agregado por beneficiário: `1.013.911,83 €`

A entrega técnica do `143/143` compara contra o `CSV agregado por beneficiário`, não contra o agregado anual oficial.

## Melhorias de produto implementadas nesta fase

### Segurança operacional multi-cliente

- removida auto-seleção silenciosa do primeiro cliente em páginas fiscais críticas
- introduzido `resolveScopedClientId()` para distinguir:
  - cliente explícito
  - ausência explícita de cliente
  - fallback controlado para o próprio utilizador
- `e-Fatura`, `Upload`, `SS`, `Validation` e `Modelo 10` já exigem contexto explícito de cliente no fluxo de contabilista
- os importadores auxiliares (`bulk`, `SAF-T`, `AT recibos`, `email`) passaram a respeitar `cliente explícito` internamente

### Review de candidatos no Modelo 10

- nova tab `Candidatos`
- agrupamento por beneficiário
- drill-down por documento
- filtros por estado
- seleção bulk
- rejeição e promoção seguras
- indicadores de origem e confiança

### UX premium base

- menos risco de operar no cliente errado
- estados vazios explícitos
- chamadas à ação orientadas ao próximo passo
- menos dependência de páginas técnicas separadas

## O que ainda não está fechado a 100%

Estes pontos não bloqueiam a entrega funcional de amanhã, mas continuam como melhoria clara de produto:

1. `taxpayer_kind = eni | company | mixed`
- ainda não existe como campo explícito
- hoje a app continua a inferir demasiado a partir de `worker_type` e `accounting_regime`

2. cockpit fiscal unificado por cliente
- ainda não existe um `Centro Fiscal do Cliente`
- o fluxo continua distribuído por páginas

3. origem fiscal em schema próprio
- ainda existem metadados temporários fora do modelo final ideal

4. edição individual de candidato
- a review atual permite ver, rejeitar e promover
- ainda não existe editor completo de campos por linha

5. code-splitting das páginas mais pesadas
- continua a existir margem para melhorar tempo de carregamento inicial

## Estado final por obrigação

### IVA

Estado: `operacional`

### Segurança Social

Estado: `operacional`, com contexto de cliente corrigido

### Modelo 10

Estado: `operacional com review`, tecnicamente validado no caso real `CAAD`

## Commits relevantes desta fase

- `ecd6850` `fix: support AT SIRE sales import and modelo 10 guardrails`
- `ccd84f5` `chore: tighten CAAD modelo 10 audit scripts`
- `66b9c83` `docs: add premium accountant roadmap`
- `fdf78a0` `fix: harden accountant client flows and modelo 10 review`
- `23d3f6f` `fix: finalize modelo 10 import and ocr guardrails`

## Recomendações imediatas para próxima fase

1. introduzir `taxpayer_kind`
2. construir `Centro Fiscal do Cliente`
3. unificar importações num `Centro de Importação`
4. mover proveniência fiscal crítica para colunas próprias
5. completar edição individual de candidato no `Modelo 10`
6. reduzir chunks pesados com `dynamic import` e `manualChunks`

## Resumo executivo

O produto já não está no estado de protótipo disperso.

Fica agora com:

- fluxos fiscais principais utilizáveis
- validação técnica forte
- caso real reconciliado no `Modelo 10`
- menos risco operacional para contabilista
- base correta para uma evolução premium de cockpit fiscal
