# IVAzen — Roadmap Premium para Contabilistas

Data: 2026-03-08
Repo: `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas`
Objetivo: fechar `IVA + Segurança Social + Modelo 10` com experiência de contabilista premium, sem perder funcionalidade nem eficiência.

## 1. Meta

Queremos que o IVAzen funcione como um cockpit fiscal de escritório:

- seguro para operar em multi-cliente
- rápido para ações repetitivas
- claro sobre o que falta em cada obrigação
- auditável quando há dados importados, OCR e fontes AT
- visualmente premium, sem parecer um painel técnico fragmentado

## 2. Regras duras de não-regressão

Nada avança para produção se falhar qualquer uma destas condições:

1. Não se perde nenhum fluxo já funcional:
- compras -> IVA
- vendas/recibos -> SS
- AT CSV / OCR -> Modelo 10

2. Não se perde performance percebida:
- mudança de cliente < 500ms para estado local e skeleton
- tabelas grandes com paginação ou virtualização
- imports longos sempre assíncronos com progresso

3. Não se perde auditabilidade:
- origem do dado sempre visível: `AT`, `OCR`, `manual`, `heurística`
- qualquer promoção fiscal fica registada

4. Não se perdem guardrails:
- sem auto-promoção cega de candidatos
- sem auto-seleção silenciosa de cliente em ações destrutivas ou fiscais

5. Cada refactor visual tem gate funcional:
- `npm test`
- `npm run build`
- smoke test manual de `IVA`, `SS`, `Modelo 10`

## 3. Estado atual resumido

### Já forte

- `IVA compras` funcional
- `IVA vendas` funcional quando entram dados
- `SS` com motor de cálculo funcional
- `Modelo 10` validado com caso real `CAAD` no caminho `OCR/manual vs CSV AT por beneficiário`
- `AT CSV` para empresa está forte
- `process-queue` e reconciliação de retenções estão bastante maduros

### Ainda não 100%

- `SS` do contabilista usa o perfil do contabilista em vez do perfil do cliente selecionado
- `Modelo 10` não tem review de candidatos linha-a-linha antes da promoção
- páginas fiscais auto-selecionam o primeiro cliente
- a app continua orientada a páginas técnicas, não a obrigações fiscais
- ainda há metadados fiscais temporários a circular por `notes`
- falta tipologia de cliente clara: `ENI`, `empresa`, `misto`

## 4. Problemas estruturais a corrigir primeiro

### P1. Contexto de cliente errado em multi-cliente

Problema:
- a página de `SS` lê `useProfile()` do utilizador autenticado
- isso contamina regras como `is_first_year` e `has_accountant_ss`

Impacto:
- o contabilista pode ver ou esconder estados errados para o cliente selecionado

Correção:
- criar `useClientFiscalProfile(clientId)`
- usar esse hook em `SocialSecurity`, `Modelo10`, `Validation`, `Reports`, `Upload`

### P1. Falta de review operacional no Modelo 10

Problema:
- os candidatos existem, mas a promoção é demasiado bulk

Impacto:
- risco operacional
- baixa confiança para escritórios

Correção:
- construir `WithholdingCandidatesReview`
- agrupado por beneficiário
- drill-down por documento
- editar, rejeitar, promover selecionados

### P1. Auto-seleção silenciosa do primeiro cliente

Problema:
- em páginas críticas, o primeiro cliente é selecionado automaticamente

Impacto:
- risco de upload, promoção ou submissão no cliente errado

Correção:
- escolha explícita obrigatória para qualquer ação fiscal mutável
- permitir “último cliente usado” só como sugestão visual, nunca como decisão silenciosa

## 5. Arquitetura de produto recomendada

## 5.1 Tipologia fiscal explícita

Adicionar ao perfil do cliente:

- `taxpayer_kind = eni | company | mixed`

Isto não substitui:
- `worker_type`
- `accounting_regime`

Complementa-os.

Uso:
- `eni`: foco em `IVA + SS`
- `company`: foco em `IVA + Modelo 10`
- `mixed`: ambos, mas com secções distintas

## 5.2 Fonte de verdade por obrigação

### IVA
- compras: `invoices` fiscalmente efetivas
- vendas: `sales_invoices` válidas

### SS
- `sales_invoices` + entradas manuais de receita apenas como complemento controlado

### Modelo 10
- `AT CSV` ou `OCR/manual`
- normalizado para `tax_withholdings`
- com `at_withholding_candidates` como staging/review

## 5.3 Proveniência fiscal persistida

Migrar de bridges temporárias para colunas próprias:

- `sales_invoices.withholding_amount_imported`
- `sales_invoices.withholding_source`
- `tax_withholdings.payer_nif`
- `tax_withholdings.withholding_status`
- `tax_withholdings.withholding_reason_text`

Objetivo:
- eliminar dependência de `notes` para lógica crítica

## 6. UX premium para contabilistas

O produto deve passar de “coleção de páginas” para “cockpit fiscal por cliente”.

## 6.1 Nova IA visual do produto

Direção:
- clara
- editorial
- sóbria
- profissional

Evitar:
- look genérico de dashboard SaaS
- excesso de badges aleatórias
- excesso de tabelas cruas sem hierarquia

### Linguagem visual

- base clara e limpa
- contraste alto
- cartões grandes com hierarquia forte
- tipografia séria
- estados com cor funcional, não decorativa
- motion mínima mas útil

### Tokens visuais sugeridos

- `--bg-shell`: cinza muito claro quente
- `--bg-panel`: branco puro
- `--bg-elevated`: branco com sombra suave
- `--text-strong`: quase preto
- `--text-muted`: cinza médio
- `--accent`: azul petróleo ou verde escuro, não roxo genérico
- `--warning`: âmbar queimado
- `--danger`: vermelho seco
- `--success`: verde escuro

### Layout premium

- largura confortável em desktop
- densidade alta, mas com respiro
- cabeçalho sticky por cliente
- filtros secundários recolhidos
- secções com títulos fortes e subtítulos curtos

## 6.2 Journey alvo da contabilista

### Nível 1: Carteira

Página: `Painel do Contabilista`

Deve responder:
- que clientes precisam de atenção hoje
- que obrigação falta em cada cliente
- que origem de dados falhou

Não deve responder só:
- quantas faturas existem

### Nível 2: Centro Fiscal do Cliente

Nova página principal por cliente:

- cabeçalho com:
  - nome
  - NIF
  - tipologia fiscal
  - período ativo
  - estado geral

- 3 cards principais:
  - `IVA`
  - `Segurança Social`
  - `Modelo 10`

Cada card mostra:
- estado
- origem dos dados
- última atualização
- divergências
- CTA principal

### Nível 3: Inbox de revisão

Uma inbox única para o contabilista:

- compras pendentes
- vendas ambíguas
- retenções candidatas
- divergências AT vs local
- dados em falta

Prioridade por risco fiscal, não por módulo técnico.

### Nível 4: Workbench por obrigação

#### IVA
- reconciliar compras/vendas
- ver saldo
- exportar DP

#### SS
- importar receitas
- rever categorias
- validar base contributiva
- preparar submissão

#### Modelo 10
- rever candidatos
- fechar beneficiários
- exportar

## 7. Roadmap executável

## Fase 0 — Segurança e contexto

Objetivo:
- impedir erros operacionais antes de mexer no design

Trabalho:
- criar `useClientFiscalProfile(clientId)`
- corrigir `SocialSecurity` para não usar o perfil do contabilista
- alinhar `Validation` e `Upload` com contexto explícito de cliente
- remover auto-seleção silenciosa do primeiro cliente

Critério de aceitação:
- um contabilista nunca vê estado fiscal de cliente calculado a partir do próprio perfil
- uma ação fiscal não corre sem cliente explicitamente selecionado

## Fase 1 — Review do Modelo 10

Objetivo:
- fechar a última peça operacional forte

Trabalho:
- nova tab `Candidatos`
- tabela agrupada por beneficiário
- expansão por documento
- ações:
  - aprovar selecionados
  - rejeitar selecionados
  - editar
  - filtrar por origem/confiança

Critério de aceitação:
- o contabilista consegue fechar `Modelo 10` sem sair da app
- cada exceção fica tratada com segurança

## Fase 2 — Tipologia fiscal do cliente

Objetivo:
- mostrar o produto certo para o cliente certo

Trabalho:
- adicionar `taxpayer_kind`
- adaptar navegação e CTAs por tipo

Critério de aceitação:
- `ENI` não vê `Modelo 10` como fluxo principal sem contexto
- `empresa` não vê `SS` como obrigação central

## Fase 3 — Centro Fiscal do Cliente

Objetivo:
- substituir navegação técnica por navegação orientada a obrigação

Trabalho:
- nova página hub
- cards por obrigação
- estado por origem de dados
- timeline de eventos fiscais

Critério de aceitação:
- em menos de 10 segundos o contabilista percebe:
  - o que está OK
  - o que falta
  - qual é o próximo passo

## Fase 4 — Centro de Importação

Objetivo:
- unificar entrada de dados

Trabalho:
- juntar:
  - `SOAP`
  - `CSV/Excel AT`
  - `PDF/OCR`
  - `SAF-T`
- mostrar:
  - última execução
  - confiança
  - throughput
  - erros

Critério de aceitação:
- o contabilista não precisa de adivinhar em que página importar cada coisa

## Fase 5 — Hardening de schema e reconciliação

Objetivo:
- tirar lógica frágil de `notes`

Trabalho:
- migrations para proveniência fiscal
- reconciliação automática por obrigação
- auditoria de drift

Critério de aceitação:
- a origem de cada valor fiscal está persistida e consultável

## 8. Otimização de performance e eficiência

### Regras

- tabelas grandes sempre com paginação ou virtualização
- queries por cliente com chaves de cache explícitas
- invalidation fina, nunca global sem necessidade
- imports longos em background com polling controlado
- charts só quando visíveis

### Não mexer sem benchmark

- `Modelo 10` com milhares de linhas
- `AT Control Center`
- `AccountantDashboard`

### Medidas

- tempo de abertura do cliente
- tempo até “pronto para ação”
- nº de cliques até export
- nº de erros por import

## 9. Definição de “100%”

Só considero o produto a 100% para contabilistas quando:

1. `IVA`
- compras e vendas entram corretamente
- reconciliação e export funcionam

2. `SS`
- usa o perfil fiscal do cliente certo
- receitas entram por via adequada
- cálculo e submissão ficam consistentes

3. `Modelo 10`
- `AT CSV` e `OCR/manual` convergem
- existe review operacional
- promoção e export são auditáveis

4. `UX`
- a contabilista percebe o estado de um cliente sem navegar por 5 páginas
- a próxima ação recomendada está sempre visível

5. `Design`
- look and feel consistente
- profissional
- com hierarquia visual clara

## 10. Próximo passo recomendado

Se o objetivo é maximizar valor sem regressões, a ordem é:

1. corrigir contexto de cliente em `SS`
2. remover auto-seleção silenciosa
3. construir `WithholdingCandidatesReview`
4. introduzir `taxpayer_kind`
5. construir `Centro Fiscal do Cliente`
6. construir `Centro de Importação`

Isto dá:
- segurança operacional primeiro
- produtividade real depois
- polish premium por cima de uma base sólida
