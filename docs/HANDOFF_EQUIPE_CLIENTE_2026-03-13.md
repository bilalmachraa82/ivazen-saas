# Handoff Final para Equipa Cliente — 13 de março de 2026

## Veredito

O IVAzen está **pronto para demo guiada e uso real em clientes com dados carregados**.

O IVAzen **ainda não está em estado de “carteira inteira pronta sem contexto”**. O principal gap já não é o motor fiscal; é a **readiness operacional da carteira**:

- clientes sem credenciais AT funcionais
- clientes sem dados importados
- imports/syncs parciais em alguns NIFs
- necessidade de onboarding explícito para equipa nova

## O que está pronto

### Produto

- `Centro Fiscal` como hub do cliente
- `Compras` / validação IA
- `Vendas`
- `Segurança Social`
- `Modelo 10`
- `Reconciliação`
- `Centro de Importação`
- `AT Control Center`
- `Exportação`

### Qualidade técnica

- build de produção passa
- testes automatizados passam (`815/815`)
- correções de paginação >1000 aplicadas nas superfícies críticas
- sidebar de contabilista simplificada
- empty states com CTA para importação/configuração

## Clientes de referência

### Bilal — NIF `232945993`

Uso recomendado:

- `Centro Fiscal`
- `Compras / Validação`
- `Vendas`
- `Segurança Social`
- `Reconciliação`
- `Exportação IVA`

Estado:

- compras: `761`
- vendas: `25`
- total de vendas: `18.172,00 €`
- `taxpayer_kind = eni`
- `SS` calculável com dados reais

Notas:

- melhor cliente para demonstrar `SS`
- bom cliente para demonstrar `IVA` e validação IA
- `Modelo 10` não é o caso certo aqui

### CAAD — NIF `508840309`

Uso recomendado:

- `Modelo 10`
- `Reconciliação`

Estado:

- compras: `1958`
- vendas: `968`
- retenções total: `3040`
- retenções `2025`: `2608`
- retenções `2026`: `427`
- `taxpayer_kind = company`

Notas:

- melhor cliente para demonstrar `Modelo 10`
- dataset forte para revisão e aprovação
- evitar mostrar compras deste cliente na demo por nomes de fornecedor incompletos em parte dos dados importados

### Majda — NIF `232946060`

Uso recomendado:

- cliente secundário / backup

Estado:

- compras: `123`
- vendas: `22`
- total de vendas: `3.157,00 €`
- `taxpayer_kind = eni`

Notas:

- útil como caso secundário ENI
- não usar como caso principal de `IVA`
- histórico AT mostra `partial` com erro de schema (`CustomerTaxID may not be empty`), por isso não deve ser tratado como caso “sync automático limpo”

## O que ainda não está a 100%

### 1. Carteira completa

Não está provado que a maioria da carteira da Adélia esteja pronta para uso imediato.

O que acontece hoje:

- alguns clientes têm dados fortes e demonstráveis
- muitos clientes continuam sem dados úteis
- alguns clientes têm credenciais mas não sync funcional
- outros dependem de importação oficial manual

### 2. Sync AT generalizado

Não vender como capacidade atual:

- “todos os clientes sincronizam automaticamente”
- “recibos verdes são sempre recolhidos automaticamente”

Mensagem correta:

- `SOAP` quando existir e funcionar
- `CSV/Excel oficial AT` como caminho suportado para recibos verdes
- `OCR/manual` como fallback

### 3. Onboarding da equipa

Ainda não existe onboarding totalmente integrado na app.

Existe material de apoio:

- `docs/IVAzen_Guia_Adopcao_Contabilista.md`
- `docs/DEMO_SCRIPT_2026-03-09.md`
- `docs/IVAzen_Apresentacao_Demo.html`

Mas a equipa ainda precisa de um SOP claro de trabalho diário.

## Como a equipa deve usar no dia 1

### Regra principal

1. entrar na `Carteira` (`Dashboard`)
2. escolher cliente
3. trabalhar a partir do `Centro Fiscal`
4. só abrir ferramentas secundárias quando houver uma ação concreta

### Ordem recomendada por cliente

1. `Centro Fiscal`
2. ver `Inbox`
3. se faltam dados:
   - `Centro de Importação`
   - ou `AT Control Center`
4. se há compras para rever:
   - `Compras`
5. se há vendas:
   - `Vendas`
   - `Segurança Social` quando aplicável
6. se há retenções:
   - `Modelo 10`
7. confirmar:
   - `Reconciliação`
8. gerar ficheiro:
   - `Exportação`

## O que mostrar amanhã

- `Bilal` para `Centro Fiscal + Compras + Vendas + SS`
- `CAAD` para `Modelo 10`
- `Reconciliação`
- `AT Control Center`
- `Centro de Importação` como explicação de entrada de dados

## O que evitar amanhã

- clientes aleatórios sem dados
- sync AT live
- compras do `CAAD`
- usar `Majda` como caso principal
- prometer que toda a carteira já está sincronizada

## O que falta para entrega plena à equipa

### A. Obrigatório antes de dizer “100%”

- matriz da carteira:
  - `pronto`
  - `sem dados`
  - `sem credenciais`
  - `sync parcial`
  - `bloqueado`
- SOP operacional da equipa
- packaging limpo do workspace/repo para handoff

### B. Recomendado logo a seguir

- onboarding in-app
- fluxo de importação com preview mais explícito
- simplificação adicional da navegação do dia 1

### C. Evolução premium posterior

- wizard por cliente novo
- dashboard de completude da carteira
- melhoria de observabilidade operacional por cliente

## Resposta curta para a cliente

Formulação segura:

> O IVAzen já está pronto para trabalhar com clientes que tenham dados carregados e para demonstrar um fluxo completo de IVA, Segurança Social e Modelo 10. Para utilização plena em toda a carteira, ainda é necessário completar a readiness operacional de alguns clientes, sobretudo ao nível de credenciais AT e importação inicial de dados.
