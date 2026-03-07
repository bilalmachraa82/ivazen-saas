# Handoff Técnico para Claude

Data: 2026-03-07
Repo: `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas`
Projeto Supabase: `dmprkdvkzzjtixlatnlx`
NIF alvo de validação: `232945993`

## Objetivo

Fechar o fluxo real para:

- IVA com compras já importadas
- SS a partir de vendas/recibos verdes
- Modelo 10 a partir de retenções detetadas nos dados importados

## Resumo executivo

Do lado do código local, o trabalho principal ficou feito e validado:

- compras auto-aprovadas passaram a ter uma definição fiscal central
- vários cálculos e dashboards passaram a usar essa definição
- o fluxo de SS passou a normalizar aliases de categorias de receita
- o sync de vendas ganhou retry com fallback WFA em respostas vazias
- o sync de recibos verdes passou a tentar primeiro a via oficial `/v1/invoices` e só depois o portal scraper
- a deteção de retenções foi alargada para considerar `FS/FR`

O que não consegui fechar não foi código. Foi operação:

- `supabase functions deploy` falhou daqui com `401 Unauthorized`
- a função ativa `sync-efatura` em produção respondeu `CONNECTOR_NOT_CONFIGURED`
- a função ativa `sync-recibos-verdes` continuou a devolver `AT_EMPTY_LIST` para o NIF `232945993`

Conclusão direta:

- o branch local ficou tecnicamente preparado
- o ciclo real `AT -> sales_invoices -> SS -> Modelo 10` ainda não ficou fechado porque as funções corrigidas não foram deployadas e/ou o connector AT não está configurado no ambiente ativo

## Alterações feitas localmente

### 1. Regra fiscal central para compras

Novo ficheiro:

- [src/lib/fiscalStatus.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/fiscalStatus.ts)

Funções introduzidas:

- `isFiscallyEffectivePurchase`
- `isPurchasePendingReview`
- `applyFiscallyEffectivePurchaseFilter`

Regra usada:

- conta fiscalmente se `status = validated`
- ou se `status = classified` e `requires_accountant_validation = false`

### 2. Consumo da regra fiscal em UI e cálculos

Ficheiros alterados:

- [src/hooks/useVATCalculation.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useVATCalculation.tsx)
- [src/components/dashboard/FiscalSummary.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/dashboard/FiscalSummary.tsx)
- [src/pages/Reports.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/Reports.tsx)
- [src/hooks/useAccountant.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useAccountant.tsx)
- [src/pages/AccountantDashboard.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/AccountantDashboard.tsx)
- [src/components/accountant/AggregatedFiscalSummary.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/accountant/AggregatedFiscalSummary.tsx)
- [src/components/accountant/AggregatedMetricsWidget.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/accountant/AggregatedMetricsWidget.tsx)
- [src/components/accountant/RevenueExpenseCharts.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/accountant/RevenueExpenseCharts.tsx)
- [src/pages/EFaturaSync.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/EFaturaSync.tsx)
- [src/hooks/useExport.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useExport.tsx)
- [src/pages/Export.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/Export.tsx)

### 3. Normalização de categorias para SS

Ficheiros alterados:

- [src/lib/ssCoefficients.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/ssCoefficients.ts)
- [src/hooks/useSocialSecurity.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useSocialSecurity.tsx)
- [src/lib/__tests__/ssCoefficients.test.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/__tests__/ssCoefficients.test.ts)

Aliases adicionados:

- `restauracao -> hotelaria`
- `alojamento_local -> hotelaria`
- `producao_venda -> producao_agricola`
- `propriedade_intelectual -> prop_intelectual`
- `comercio -> vendas`

### 4. Retry WFA em vendas

Ficheiro alterado:

- [supabase/functions/sync-efatura/index.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/sync-efatura/index.ts)

Mudança:

- quando `vendas` vem vazia com a credencial primária e existe fallback WFA válido, a função tenta novamente com o fallback em vez de assumir logo `AT_EMPTY_LIST`

### 5. Recibos verdes: oficial primeiro, scraper depois

Ficheiro alterado:

- [supabase/functions/sync-recibos-verdes/index.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/sync-recibos-verdes/index.ts)

Mudanças principais:

- tentativa inicial via `AT_CONNECTOR_URL` + `AT_CONNECTOR_TOKEN` em `/v1/invoices`
- filtragem de documentos `FR/FS`
- fallback para portal scraper apenas se a via oficial não trouxer recibos verdes
- inserção de `sales_invoices` com totais e breakdown de IVA
- função deixa de exigir logo `portal_nif/password` se a via oficial puder correr com WFA

### 6. Retenções / Modelo 10

Ficheiro alterado:

- [supabase/functions/detect-withholding-candidates/index.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/detect-withholding-candidates/index.ts)

Mudança:

- a deteção deixou de ficar limitada a uma combinação estreita e passou a aceitar `FS/FR`

### 7. Testes adicionados

Novo ficheiro:

- [src/lib/__tests__/fiscalStatus.test.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/__tests__/fiscalStatus.test.ts)

### 8. Ficheiros novos necessários para clone/build limpo

Estes ficheiros estavam fora do git e são necessários:

- [src/components/export/DPQuarterlySummary.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/export/DPQuarterlySummary.tsx)
- [src/components/validation/ReconciliationTab.tsx](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/validation/ReconciliationTab.tsx)
- [supabase/functions/_shared/parseJsonFromAI.ts](/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/supabase/functions/_shared/parseJsonFromAI.ts)

## Validação feita

Executado com sucesso:

```bash
npm test
npm run build
deno check supabase/functions/sync-efatura/index.ts
deno check supabase/functions/sync-recibos-verdes/index.ts
deno check supabase/functions/detect-withholding-candidates/index.ts
```

Resultados observados:

- `npm test`: `748/748` testes passaram
- `npm run build`: passou
- `deno check`: passou nos 3 entrypoints acima

## Estado remoto real observado

### Produção atual ainda não reflete este patch

Funções ativas vistas via CLI:

- `sync-efatura` versão `24`
- `sync-recibos-verdes` versão `10`
- `detect-withholding-candidates` versão `6`

### Teste remoto do NIF `232945993`

Script usado:

```bash
node scripts/migration/test-vendas-sync.mjs
node scripts/migration/test-recibos-sync.mjs
```

Resultado de `sync-efatura`:

```json
{
  "success": false,
  "error": "AT connector não configurado. Configure AT_CONNECTOR_URL e AT_CONNECTOR_TOKEN.",
  "reasonCode": "CONNECTOR_NOT_CONFIGURED"
}
```

Resultado de `sync-recibos-verdes`:

```json
{
  "success": true,
  "reasonCode": "AT_EMPTY_LIST",
  "message": "No recibos verdes found in this period",
  "inserted": 0
}
```

Estado observado para o cliente:

- `sales_invoices`: `0`
- `FR` do cliente no sistema: `0`

## Credenciais e sinais relevantes

No teste remoto:

- existe linha de `at_credentials` para o cliente
- `portal_nif = 232945993`
- `subuser_id = NULL` nessa linha
- existe `accountant_at_config` ativa com `subuser_id = 232945993/1`

Sinal que merece revisão:

- a associação entre `at_credentials.accountant_id` e `accountant_at_configs.accountant_id` parece inconsistente no diagnóstico que corria daqui

Eu considero provável que haja um problema de contexto WFA/subutilizador, mas deixo isso aberto para revalidação por quem tenha acesso total ao ambiente.

## Secrets que as funções esperam

### `sync-efatura`

- `AT_CONNECTOR_URL`
- `AT_CONNECTOR_TOKEN`
- `AT_CONNECTOR_TIMEOUT_MS` opcional
- `AT_CONNECTOR_MAX_RETRIES` opcional
- `AT_CONNECTOR_RETRY_BASE_MS` opcional
- `AT_CONNECTOR_CA_CERT` ou `AT_CONNECTOR_CA_CERT_B64` opcional
- `AT_ENCRYPTION_KEY`
- `AT_ENCRYPTION_KEY_FALLBACK` opcional
- `AT_ALLOW_ACCOUNTANT_FALLBACK`

### `sync-recibos-verdes`

- `AT_CONNECTOR_URL`
- `AT_CONNECTOR_TOKEN`
- `AT_PORTAL_CONNECTOR_URL` opcional
- `AT_PORTAL_CONNECTOR_TOKEN` opcional
- `AT_CONNECTOR_CA_CERT` ou `AT_CONNECTOR_CA_CERT_B64` opcional
- `AT_ENCRYPTION_KEY`
- `AT_ENCRYPTION_KEY_FALLBACK` opcional

## O que falta para fechar de facto o objetivo

### Bloco 1. Deploy e ambiente

1. Garantir `SUPABASE_ACCESS_TOKEN` com permissão de deploy no projeto `dmprkdvkzzjtixlatnlx`
2. Confirmar que o deploy deixa de falhar com `401 Unauthorized`
3. Repor ou validar secrets do connector AT no ambiente ativo
4. Deployar:
   - `sync-efatura`
   - `sync-recibos-verdes`
   - `detect-withholding-candidates`

### Bloco 2. Execução real do NIF

1. Correr sync de vendas para `2025` e `2026`
2. Correr sync de recibos verdes para `2025` e `2026`
3. Confirmar criação de `sales_invoices`
4. Verificar tipos documentais reais importados (`FR`, `FS`, `FT`)

### Bloco 3. Pós-importação

1. Classificar vendas
2. Confirmar `revenue_category` coerente com o motor de SS
3. Gerar `withholding_candidates`
4. Promover candidatos para `tax_withholdings`
5. Validar UI final:
   - IVA
   - SS
   - Modelo 10

## O que eu acho que isto resolve

Se o deploy e as secrets forem corrigidos, eu espero que este patch resolva:

- compras auto-aprovadas passam a contar no IVA e nos resumos fiscais
- vendas/recibos verdes deixam de depender exclusivamente do scraper frágil
- o sync de vendas deixa de desistir cedo demais quando a credencial base devolve vazio
- SS deixa de falhar por aliases de categoria
- Modelo 10 passa a ter base para candidatos de retenção quando existirem vendas elegíveis

## O que eu não afirmo sem nova validação

Eu não afirmo ainda que:

- o problema do NIF `232945993` seja apenas WFA
- o conector oficial devolva imediatamente todos os `FR` esperados depois do deploy
- o fluxo inteiro feche sem mais ajustes de dados ou permissões

Essas são as áreas onde o Claude deve sentir liberdade para:

- rever a minha leitura
- auditar a associação entre cliente, contabilista e subutilizador
- confirmar secrets ativas
- inspecionar logs do connector/edge functions
- concluir por si se o bloqueio principal é `deploy`, `secrets`, `WFA`, `connector`, ou combinação destes fatores

## Comandos úteis

```bash
cd /Users/bilal/Programaçao/ivazen-saas/ivazen-saas

supabase functions list --project-ref dmprkdvkzzjtixlatnlx

supabase functions deploy sync-efatura --project-ref dmprkdvkzzjtixlatnlx
supabase functions deploy sync-recibos-verdes --project-ref dmprkdvkzzjtixlatnlx
supabase functions deploy detect-withholding-candidates --project-ref dmprkdvkzzjtixlatnlx

node scripts/migration/test-vendas-sync.mjs
node scripts/migration/test-recibos-sync.mjs
node scripts/migration/check-data-state.mjs
```

## Nota final

Este handoff tenta ser factual e útil, não dogmático.

O meu entendimento é:

- o código local ficou num ponto bom
- o que falta está principalmente no ambiente remoto

Mas o Claude deve sentir-se à vontade para contrariar esta conclusão se, com acesso total, encontrar evidência mais forte.
