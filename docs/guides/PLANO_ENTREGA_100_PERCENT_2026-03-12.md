# Plano Final Para Entrega a 100%

Data: 2026-03-12  
Repo: `/Users/bilal/Programaçao/ivazen-saas/ivazen-saas`  
Estado base: `main` com build e testes a passar

## Objetivo

Chegar de:

- `demo-safe`
- `forte para clientes com dados`

para:

- `entrega plena à cliente`
- `uso pela equipa sem acompanhamento constante`
- `onboarding claro`
- `operação previsível`

## O que já está pronto

- `IVA` funcional nos clientes com dados preparados
- `Segurança Social` funcional a partir de vendas válidas
- `Modelo 10` funcional com workflow de revisão
- `Centro Fiscal` como hub por cliente
- `Centro de Importação`
- `Reconciliação`
- `AT Control Center`
- correções de paginação `>1000`
- sidebar simplificada para contabilistas
- empty states com CTA básica
- build OK
- testes OK (`815/815`)

## O que ainda impede a entrega "plena"

### 1. Carteira operacional incompleta

O maior gap já não é o motor fiscal. É a operação da carteira:

- muitos clientes continuam sem dados úteis
- parte da carteira depende de credenciais AT problemáticas
- alguns clientes precisam de import oficial/manual antes de ficarem utilizáveis

Consequência:

- a app está pronta para clientes com dados
- ainda não está pronta para a equipa trabalhar qualquer cliente aleatório sem contexto

### 2. Handoff do repositório / pasta ainda não está limpo

Hoje o workspace contém material que não deve entrar num handoff bruto:

- segredos locais
- scripts de migração/debug
- pastas auxiliares
- material experimental

Entrega correta:

- `não` entregar a pasta inteira tal como está
- `sim` entregar um pacote curado

### 3. Journey ainda pode confundir equipa nova

Apesar das melhorias:

- ainda há várias superfícies operacionais (`Dashboard`, `Centro Fiscal`, `Importação`, `Reconciliação`, `AT Control Center`)
- falta tornar mais explícito:
  - `Dashboard = carteira`
  - `Centro Fiscal = home do cliente`
  - `Importação = passo inicial quando não há dados`

### 4. Importação manual ainda não é totalmente autoexplicativa

O fluxo comum “carregar documentos -> perceber o que entrou -> reconciliar” ainda precisa de:

- preview mais clara
- explicação de período
- explicação de duplicados / reconciliação

### 5. Onboarding ainda não está fechado como produto

Já existem materiais de demo e adoção, mas ainda falta transformar isso em handoff robusto:

- guia final para utilizador
- SOP interna de operação
- checklist de primeira utilização

## Critério real de "100%"

Considero o projeto a `100%` para entrega plena quando as 5 condições abaixo estiverem satisfeitas:

1. a equipa consegue abrir a app e saber por onde começar
2. a equipa sabe o que fazer quando um cliente está vazio
3. a carteira tem um estado operacional explícito por cliente
4. os materiais de apoio permitem trabalhar sem depender do autor da app
5. a pasta/repo entregue está limpa, segura e sem lixo operacional

## Plano de execução

## Fase A — Pacote de Entrega

### Objetivo

Transformar o estado atual num pacote entregável, em vez de um workspace de desenvolvimento.

### A fazer

- criar uma lista explícita do que entra no handoff
- remover ou isolar do handoff:
  - `.env`
  - scripts de debug/migração avulsos
  - storybook parcial
  - artefactos de agentes
  - material experimental
- fechar uma pasta/branch/release limpa

### Critério de aceitação

- a cliente recebe apenas o que precisa
- não há segredos locais no pacote
- não há ruído técnico que confunda a equipa

## Fase B — Estado Operacional da Carteira

### Objetivo

Parar de depender de memória tácita sobre que clientes estão prontos.

### A fazer

- definir estados por cliente:
  - `Pronto`
  - `Sem dados`
  - `Sem credenciais`
  - `Precisa de importação`
  - `Com pendências`
  - `Bloqueado`
- mostrar isso de forma visível na carteira / dashboard
- fechar um relatório inicial da carteira da cliente:
  - quem está utilizável
  - quem está bloqueado
  - porquê

### Critério de aceitação

- a equipa sabe logo em que clientes pode trabalhar
- deixa de abrir clientes aleatórios e cair em ecrãs vazios sem contexto

## Fase C — Simplificação Final da Journey

### Objetivo

Eliminar a sensação de “menus infinitos”.

### Modelo alvo

- `Dashboard` = carteira
- `Centro Fiscal` = home do cliente
- `Importação` = entrada de dados
- `Reconciliação` = verificação
- `AT Control Center` = operação/diagnóstico
- `Compras`, `Vendas`, `SS`, `Modelo 10`, `Apuramento` = ferramentas de trabalho

### A fazer

- rever sidebar final do contabilista
- garantir que os itens do menu principal são apenas os necessários no dia 1
- esconder ou secundarizar utilitários e vistas de consulta
- melhorar copy:
  - “sem dados”
  - “importe do AT”
  - “configure credenciais”
  - “este período não tem movimento”

### Critério de aceitação

- um utilizador novo percebe em menos de 10 segundos:
  - onde está
  - em que cliente está
  - o que fazer a seguir

## Fase D — Fluxo de Importação Claro

### Objetivo

Fechar o maior ponto de dúvida de uso diário.

### A fazer

- clarificar a diferença entre:
  - dados AT já existentes
  - documentos recém-carregados
  - documentos ainda em revisão
- melhorar o preview dos imports manuais
- tornar explícito quando há:
  - duplicados
  - reconciliação necessária
  - dados no período errado

### Critério de aceitação

- a contabilista percebe o que entrou
- percebe o que ainda falta rever
- não conclui erradamente que “a app perdeu documentos”

## Fase E — Onboarding e Formação

### Objetivo

Garantir adoção real pela equipa da cliente.

### Entregáveis mínimos

- guia PDF final
- página/guia online simples
- SOP “como trabalhar IVA”
- SOP “como trabalhar SS”
- SOP “como trabalhar Modelo 10”
- SOP “o que fazer quando o cliente não tem dados”

### Critério de aceitação

- a equipa consegue trabalhar sem depender do criador da app
- a demo transforma-se em manual de uso

## Fase F — Runbook Operacional

### Objetivo

Tornar explícito o que é software e o que é operação.

### A fazer

- definir rotina para:
  - credenciais AT
  - importações oficiais
  - resolução de clientes vazios
  - reconciliação antes de exportar
- registar limites conhecidos:
  - não prometer sync live geral quando não existe
  - usar CSV/Excel oficial AT quando esse é o caminho suportado

### Critério de aceitação

- a cliente sabe operar o produto sem promessas erradas
- a equipa sabe quando usar sync, quando usar import oficial e quando usar fallback manual

## Prioridade recomendada

### Antes da entrega formal

1. Fase A — Pacote de Entrega
2. Fase B — Estado Operacional da Carteira
3. Fase E — Onboarding e Formação
4. Fase F — Runbook Operacional

### Logo a seguir

5. Fase C — Simplificação Final da Journey
6. Fase D — Fluxo de Importação Claro

## Estimativa realista

### Para ficar entregável com confiança

- `1 a 2 dias`

Inclui:

- pacote limpo
- docs de adoção
- classificação da carteira
- SOP de uso

### Para ficar "100% premium final"

- `3 a 5 dias`

Inclui:

- simplificação final da navegação
- melhor fluxo de importação
- polish final de onboarding

## Decisão de entrega

### Posso entregar amanhã?

`Sim`, para demo guiada e arranque assistido.

### Posso entregar hoje a pasta para a equipa usar plenamente sem contexto?

`Ainda não`.

### O que falta para eu dizer "sim" sem reservas?

- pacote limpo
- carteira classificada por readiness
- onboarding final
- SOP operacional

## Resumo executivo

O projeto já passou a linha de:

- `funciona`
- `é demonstrável`
- `fecha os cálculos principais`

O que falta agora não é refazer o produto.

O que falta é:

- fechar a entrega
- fechar a adoção
- fechar a operação real da carteira

É isso que transforma o IVAzen de `demo forte` em `produto utilizável pela equipa da cliente`.
