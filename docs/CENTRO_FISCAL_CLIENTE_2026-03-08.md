# Centro Fiscal do Cliente — 2026-03-08

## Objetivo

Adicionar uma superfície única e segura para contabilistas e clientes verem, por cliente, o estado de:

- IVA
- Segurança Social
- Modelo 10
- origem dos dados
- próxima ação recomendada

Sem refatorar os workflows existentes e sem reintroduzir fallbacks silenciosos de cliente.

## O que foi implementado

### 1. Página nova

Criada a página:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/pages/ClientFiscalCenter.tsx`

Características:

- funciona para cliente normal e para contabilista
- para contabilista, exige cliente explícito
- mostra cabeçalho do cliente, `taxpayer_kind` e NIF
- permite selecionar `ano + trimestre`
- mostra 3 cards principais:
  - IVA
  - Segurança Social
  - Modelo 10
- mostra bloco de origem dos dados
- mostra bloco de próximas ações
- mostra atalhos rápidos para sync/import/export
- mostra atalho explícito para reconciliação

### 2. Hook isolado de métricas

Criado:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useClientFiscalCenter.tsx`

O hook agrega, por cliente:

- perfil fiscal mínimo
- credenciais e histórico AT
- período fiscal ativo (`ano + trimestre`)
- compras do período: total, pendentes, efetivas, baixa confiança
- vendas do período: total, prontas, pendentes, receita pronta
- SS: declarações e receita do trimestre selecionado
- Modelo 10: ano fiscal ativo, retenções e candidatos pendentes

Isto evita mexer nos hooks já usados pelas páginas fiscais existentes.

### 3. Integração na app

Foram atualizados:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/App.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/dashboard/DashboardLayout.tsx`
- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/dashboard/Breadcrumbs.tsx`

Resultado:

- nova rota `/centro-fiscal`
- novo item de navegação `Centro Fiscal`
- breadcrumb com metadata correta

### 4. Correção transversal encontrada durante a implementação

Foi corrigido:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/hooks/useTaxpayerKind.tsx`

Bug resolvido:

- o hook ainda podia herdar `selectedClientId` antigo em contexto não-contabilista
- agora só usa `selectedClientId` quando o utilizador é realmente contabilista

Isto reduz risco de contexto errado na navegação adaptada por `taxpayer_kind`.

### 5. Refinamento operacional após auditoria

Depois da primeira auditoria independente, foram feitos mais 3 ajustes:

- clientes normais deixaram de ter links para `/efatura`
- o cockpit passa a trabalhar por trimestre para `IVA` e `SS`
- o card de `Segurança Social` passou a mostrar receita do período em vez de só contagem de documentos

## Validação feita

### Build

- `npm run build` — passou

### Testes

- `npm test` — `35` suites, `815` testes, `0` falhas

## Compatibilidade / não regressão

A implementação foi desenhada para ser aditiva:

- não remove páginas existentes
- não altera o cálculo de IVA
- não altera o cálculo de SS
- não altera o pipeline do Modelo 10
- não altera schema nem edge functions

O único ajuste transversal foi a correção segura em `useTaxpayerKind`.

Foi também criada a utilidade:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/fiscalQuarter.ts`

com testes em:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/lib/__tests__/fiscalQuarter.test.ts`

## O que continua por fazer

Isto fecha o cockpit fiscal base, mas ainda não fecha o bloco “premium final” completo.

Faltam:

- Centro de Importação unificado
- schema hardening de metadados fiscais
- code-splitting/manualChunks para reduzir chunks grandes
- refinamento visual e operacional do cockpit com mais drill-down por obrigação

## O que ficou deliberadamente fora

Continuam fora desta ronda:

- `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas/src/components/WhatsAppButton.tsx`
- alterações de marketing/branding não fiscais
- ficheiros de diagnóstico e utilitários `untracked`

Decisão:

- não apagar
- não commitar por omissão
- não misturar marketing/tooling com o fecho fiscal
