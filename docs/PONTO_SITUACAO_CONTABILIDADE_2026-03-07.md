# Ponto de Situacao Contabilidade - 7 de marco de 2026

## Objetivo

Fechar o fluxo operacional para usar dados importados no IVAzen com fiabilidade fiscal em tres pilares:

- IVA
- Seguranca Social
- Modelo 10

Este documento resume o estado real do projeto apos validacao com dados reais do NIF `232945993`.

## Estado Atual

### 1. IVA

- Compras auto-aprovadas ja contam fiscalmente atraves da regra central de estado fiscal efetivo.
- Vendas importadas da AT pela nova app `Faturas e Recibos` entram em `sales_invoices`.
- Para `2026-Q1`, o estado real validado foi:
  - vendas importadas: `4`
  - IVA liquidado: `0.00 EUR`
  - compras fiscalmente efetivas: `14`
  - IVA dedutivel: `96.66 EUR`
  - saldo IVA do trimestre: `-96.66 EUR`

### 2. Seguranca Social

- O import do CSV real da nova app AT foi validado e cria `sales_invoices` corretamente.
- Para o NIF `232945993`, foram importados `25` documentos elegiveis:
  - `15` `FR`
  - `10` `FT`
- Calculo validado com perfil atual:
  - regime: `simplified`
  - taxa SS: `21.4%`
  - sem outro emprego
  - nao primeiro ano
- Resultado `2026-Q1`:
  - receita: `3889.00 EUR`
  - rendimento relevante: `2722.30 EUR`
  - base mensal: `907.43 EUR`
  - contribuicao estimada: `194.19 EUR`

### 3. Modelo 10

- O CSV oficial exportado pela nova app AT foi analisado para `2025` e `2026`.
- Nos ficheiros reais do NIF `232945993`, os campos de retencao vieram sempre a `0`.
- Resultado correto para este caso:
  - `at_withholding_candidates = 0`
  - `tax_withholdings = 0`
  - `Modelo 10` deve permanecer vazio para estes dados importados

## O que foi corrigido

- Suporte ao CSV atual da AT em `src/lib/csvParser.ts`
- Import de vendas/SS com metadados AT em `src/hooks/useSocialSecurity.tsx`
- Conversao de recibos para vendas em `src/components/social-security/RevenueImporter.tsx`
- Guardrail no importador antigo de Modelo 10 em `src/lib/atRecibosParser.ts`
- Protecao contra falsos positivos de retencao em `supabase/functions/detect-withholding-candidates/index.ts`
- Testes para CSV SIRE e guardrails de Modelo 10

## Validacao Feita

- `npm run build` passou
- `npm test` passou com `751/751`
- `deno check supabase/functions/detect-withholding-candidates/index.ts` passou

Validacao real de negocio:

- antes do patch, `13` documentos `FR` do caso real podiam gerar candidatos falsos de retencao so por heuristica
- depois do patch, esses documentos ficam explicitamente marcados com `AT_SIRE_WITHHOLDING=0.00`
- com isso, o sistema deixa de fabricar `Modelo 10` indevido
- na base de dados do cliente validado, os `25` documentos importados da AT ficaram atualizados com esse marcador explicito

## Recomendacoes de Uso pela Contabilidade

### Regra operacional

Usar sempre a seguinte ordem:

1. importar compras
2. importar vendas/recibos da AT
3. validar IVA
4. validar SS
5. so depois verificar Modelo 10

### Boa pratica para contabilistas

- Nao assumir que `FR para empresa` implica automaticamente retencao.
- Confiar primeiro no valor explicito da AT; so usar heuristica quando a origem nao trouxer esse dado.
- Tratar `Modelo 10` como fluxo de excecao e confirmacao, nao como derivacao cega.
- Rever sempre documentos anulados e recibos `RG/RC` fora do ledger principal para evitar dupla contagem.
- Usar o CSV da nova app AT para vendas/SS; nao usar o importador antigo de Modelo 10 para esse ficheiro.

### Recomendações de produto

- Separar na UI os conceitos:
  - `Validado manualmente`
  - `Fiscalmente efetivo`
- Mostrar na pagina de vendas a origem do documento:
  - `SAF-T`
  - `AT Faturas e Recibos`
  - `Import manual`
- Mostrar no centro fiscal quando a retencao veio:
  - explicita da origem
  - inferida por heuristica
- Bloquear promocao para `tax_withholdings` quando a origem AT diz `0`

## O que falta melhorar

- Adaptar o fluxo de `Modelo 10` para ler diretamente o formato novo da AT quando existirem retencoes reais.
- Criar uma coluna dedicada para retencao importada em `sales_invoices`, em vez de depender de `notes`.
- Adicionar um dashboard de reconciliacao por trimestre:
  - compras
  - vendas
  - SS
  - retencoes
- Criar smoke test E2E do fluxo:
  - import CSV AT
  - cria `sales_invoices`
  - calcula SS
  - verifica candidatos de retencao

## Conclusao

Para o caso real validado:

- `IVA`: funcional
- `SS`: funcional
- `Modelo 10`: corretamente vazio, porque nao existem retencoes reais na origem AT importada

O principal ganho desta iteracao foi passar de um sistema que podia inventar retencoes para um sistema que respeita o valor oficial da AT.
