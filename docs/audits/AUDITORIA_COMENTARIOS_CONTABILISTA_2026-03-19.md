# Auditoria dos comentarios da contabilista

Data: 2026-03-19
Fonte funcional: `tmp/pdfs/Melhoramentos a reportar_19.03.pdf`
Objetivo: consolidar gaps reais, causas-raiz e plano de melhoria.

## Resumo executivo

Os comentarios da contabilista revelam uma mistura de:

- bugs reais de negocio
- inconsistencias entre canais de importacao
- UI que parece interativa mas nao e
- cobertura de testes demasiado superficial para fluxos contabilisticos reais
- diferenca entre "produto funcional para clientes com dados" e "carteira pronta para uso homogeneo"

Os gaps mais criticos confirmados no codigo sao:

1. prazos fiscais mostram IVA mensal e trimestral ao mesmo tempo, sem respeitar o regime do cliente
2. "Nao dedutivel" mantem o campo DP anterior no editor, apesar da regra fiscal devolver `null`
3. metricas e filtros de vendas/compras usam apenas a primeira pagina de 50 registos em varios fluxos
4. gestor de duplicados volta a pedir cliente, apesar de ja existir cliente ativo na sessao
5. documentos importados da AT usam paths placeholder diferentes dos que o dialogo reconhece, por isso a imagem aparece como indisponivel em vez de indicar corretamente "sem imagem"

## Achados por comentario

### 1. Prazos fiscais errados para o cliente

Comentario:
- aparece prazo de IVA mensal para contribuinte que so tem IVA trimestral

Achado:
- o componente de prazos cria sempre `IVA Mensal` e `IVA Trimestral` sem consumir `vat_regime` ou outro contexto do cliente

Impacto:
- falso alerta fiscal
- quebra de confianca imediata

Codigo:
- `src/components/accountant/FiscalDeadlines.tsx`

### 2. "Botoes" da carteira parecem clicaveis mas nao abrem nada

Comentario:
- os cards `733`, `726`, etc. parecem atalhos mas sao apenas informativos

Achado:
- `ZenStatsCard` e um `Card` visual sem `Link`, `Button`, `onClick` ou semantica de navegacao
- no ecrã de validacao estes cards sao usados como KPIs visuais e nao como atalhos

Impacto:
- UX enganadora
- utilizador interpreta metricas como CTA

Codigo:
- `src/components/zen/ZenStatsCard.tsx`
- `src/pages/Validation.tsx`

### 3. Periodos nas compras "nao estao como devem"

Comentario:
- os periodos mostrados nas compras nao estao claros

Achado:
- o filtro de periodo mostra o valor tecnico cru (`202602`, `202505`, etc.) em vez de um label legivel
- o conjunto de periodos e construido apenas a partir do array `invoices` ja paginado no servidor
- depois a tabela ainda faz paginacao local em cima desses 50 registos

Impacto:
- linguagem de produto desalinhada com o utilizador
- dropdown de periodos potencialmente incompleto em carteiras maiores

Codigo:
- `src/hooks/useInvoices.tsx`
- `src/components/validation/InvoiceFilters.tsx`
- `src/components/validation/InvoiceTable.tsx`

### 4. Nome do fornecedor continua ausente em varias compras

Comentario:
- detalhe da fatura mostra `Nome: N/A`

Achado:
- existe enriquecimento de `supplier_name`, mas ele ocorre no edge `classify-invoice`, isto e, quando a fatura e classificada
- se a fatura entra sem nome e ainda nao passou por esse fluxo, a UI continua a mostrar `N/A`
- existe uma tabela `supplier_directory`, mas o front nao faz fallback de leitura para preencher nomes em runtime

Impacto:
- registos importados da AT ou de certos CSVs ficam com experiencia inconsistente
- a mesma fatura pode aparecer sem nome num contexto e com nome noutro

Codigo:
- `supabase/functions/classify-invoice/index.ts`
- `supabase/migrations/20260318110000_create_supplier_directory.sql`

### 5. Imagem da fatura importada nao aparece, e agora nem ha botao para abrir

Comentario:
- faturas importadas da AT/CSV ficaram sem imagem e sem CTA coerente

Achado:
- os dialogs de compra e venda so reconhecem placeholders que comecem por `at-sync`, `efatura-csv`, `imported` ou `saft`
- o sync real grava `image_path` como `at-webservice/...` e `at-webservice-sales/...`
- resultado: o UI tenta gerar signed URL para um ficheiro que nao existe no bucket e acaba em "Imagem nao disponivel", em vez de apresentar o estado correto de documento importado electronicamente

Impacto:
- parece regressao
- utilizador conclui que a app perdeu funcionalidade

Codigo:
- `src/components/validation/InvoiceDetailDialog.tsx`
- `src/components/sales/SalesInvoiceDetailDialog.tsx`
- `supabase/functions/sync-efatura/index.ts`

### 6. Regra "Nao dedutivel" esta a mandar para Campo 24

Comentario:
- ao escolher `Classificacao -> Nao dedutivel`, o DP nao devia ser preenchido

Achado:
- a regra fiscal esta correta: `inferDpField("Nao dedutivel")` devolve `dpField = null`
- o bug esta no editor: quando o resultado e `null`, o estado local `dpField` fica com o valor anterior
- na validacao, esse valor antigo e enviado para a BD

Impacto:
- erro fiscal real
- faturas nao dedutiveis podem contaminar apuramento/exportacao

Codigo:
- `src/lib/classificationRules.ts`
- `src/components/validation/ClassificationEditor.tsx`

### 7. Falta opcao "Nao contabilizar"

Comentario:
- querem manter a fatura no sistema, mas exclui-la totalmente do apuramento

Achado:
- existe `rejected` / `Excluida`, mas isso mistura exclusao de classificacao com exclusao contabilistica
- ja ha sinais no export de uma futura nocao de exclusao (`exclusion_reason`), mas o workflow nao esta exposto como acao clara de produto

Impacto:
- equipa obrigada a usar workarounds semanticos
- historico documental e semantica fiscal ficam misturados

Codigo:
- `src/hooks/useExport.tsx`
- `src/pages/Validation.tsx`

### 8. Organizar por estado / fornecedor / NIF

Comentario:
- pedem organizacao alternativa aos cards resumo

Achado:
- existe pesquisa por fornecedor/NIF e filtro por estado
- nao existe ordenacao por fornecedor nem por estado
- os cards resumo nao ligam ao filtro correspondente

Impacto:
- funcionalidade parcialmente existente, mas pouco descobrivel
- utilizador nao sente que consegue "trabalhar a lista"

Codigo:
- `src/components/validation/InvoiceFilters.tsx`
- `src/components/validation/InvoiceTable.tsx`

### 9. Duplicados pede novamente o cliente

Comentario:
- o ecrã de duplicados devia assumir o cliente em que ja estamos

Achado:
- o gestor de duplicados usa `localClientId` proprio e ignora o cliente selecionado globalmente

Impacto:
- repeticao desnecessaria
- quebra do modelo mental "cliente ativo"

Codigo:
- `src/components/validation/DuplicateManager.tsx`

### 10. Totais e numero de faturas validadas nas vendas estao errados

Comentario:
- ecrã mostra `50 validadas` e `1104.41 EUR` mesmo depois de importar mais vendas

Achado:
- `useSalesInvoices` faz query paginada com `PAGE_SIZE = 50`
- `SalesValidation` calcula as metricas diretamente sobre `invoices`, que sao apenas a pagina atual
- o ecrã nao expoe controlo de paginacao
- os periodos em vendas tambem sao construidos apenas a partir dessa pagina

Impacto:
- KPI errado
- falso negativo apos importacao de ficheiro historico
- utilizador assume que a importacao falhou quando os dados apenas nao estao refletidos na primeira pagina

Codigo:
- `src/hooks/useSalesInvoices.tsx`
- `src/pages/SalesValidation.tsx`
- `src/components/sales/SalesInvoiceTable.tsx`

### 11. Importacao CSV de vendas tem qualidade de dados fraca

Comentario relacionado:
- carregou ficheiro de vendas de janeiro, mas o comportamento continuou estranho

Achado:
- no importador CSV, quando o registo e interpretado como venda:
  - `supplier_nif` recebe `effectiveClientId` em vez do NIF fiscal do cliente
  - `customer_nif` fica forçado a `999999990`
  - `customer_name` fica `null`
- isto degrada pesquisa, deduplicacao e legibilidade

Impacto:
- vendas importadas com metadados pobres
- experiencia de validacao fraca mesmo quando a importacao corre

Codigo:
- `src/components/efatura/EFaturaCSVImporter.tsx`

## Porque isto passou apesar de "tantos testes"

### 1. Os testes cobrem mais o motor do que o workflow real

Os testes unitarios de regras passam:

- `classificationRules.test.ts` valida que `Nao dedutivel -> dpField null`
- `fiscalDeadlines.test.ts` valida calculo abstrato de prazos

Mas falta teste de integracao entre:

- regra fiscal -> editor UI -> persistencia
- cliente ativo -> duplicados
- dataset grande -> metricas de vendas
- import placeholder -> dialogo de detalhe

### 2. Os e2e existentes sao superficiais

Os specs Playwright atuais verificam sobretudo:

- a pagina abre
- filtros existem
- o dialogo abre
- ha texto de classificacao

Nao verificam:

- se o prazo mostrado bate certo com o regime do cliente
- se "Nao dedutivel" limpa mesmo o DP
- se metricas de vendas batem com o total global
- se o cliente ativo e herdado no tab de duplicados
- se importacoes AT aparecem com estado correto de imagem placeholder

### 3. Houve uma sobreposicao de mensagens internas

Os docs internos ja diziam duas coisas ao mesmo tempo:

- produto forte para clientes com dados
- carteira ainda nao esta pronta de forma homogenea

O problema foi de comunicacao e criterio de prontidao:

- parte da equipa leu "funciona" como "pronto para toda a carteira"
- na pratica, varios fluxos ainda dependem do tipo de cliente, origem dos dados e import inicial

## Plano de melhoria recomendado

### P0 - corrigir esta semana

1. Prazos por cliente
- fazer `FiscalDeadlines` receber `vat_regime` e mostrar apenas o regime aplicavel
- esconder prazos irrelevantes para o cliente atual

2. Bug fiscal "Nao dedutivel"
- permitir `dpField = null` no editor
- desativar select DP quando classificacao = `Nao dedutivel`
- garantir persistencia nula e cobertura de teste UI

3. Metricas de vendas
- separar lista paginada de metricas agregadas
- calcular KPIs com query agregada ou `fetchAllPages`
- expor paginacao real se a lista continuar paginada

4. Placeholder de imagem
- alinhar regex do front com todos os prefixes reais:
  - `at-webservice/`
  - `at-webservice-sales/`
  - `at-portal-recibos/`
  - outros canais oficiais

5. Duplicados herdar cliente ativo
- substituir `localClientId` pelo estado global do cliente selecionado

### P1 - proxima iteracao

6. Periodos legiveis e completos
- mostrar `Fev 2026`, `Mai 2025`, etc.
- construir lista de periodos a partir de query dedicada, nao do page slice atual

7. Fornecedor enrichment no read path
- fallback em leitura para `supplier_directory`
- job de backfill para faturas antigas sem nome

8. Lista de compras/vendas mais operavel
- sort por fornecedor
- sort por estado
- click nos cards resumo a aplicar filtros

9. O conceito "Nao contabilizar"
- criar estado explicito de exclusao contabilistica
- manter documento e historico, mas excluir do export/apuramento

### P2 - hardening de produto

10. Regras de prontidao e handoff
- distinguir claramente:
  - "cliente com dados"
  - "cliente pronto para operacao"
  - "carteira pronta"

11. Matriz de QA por origem de dados
- testar separadamente:
  - OCR/PDF
  - AT SOAP
  - CSV e-Fatura
  - Excel recibos verdes
  - SAF-T

12. E2E com assertions de negocio
- cliente trimestral nao ve IVA mensal
- "Nao dedutivel" nao grava DP
- import historico altera KPI global
- duplicados assume cliente ativo
- placeholders oficiais nao tentam abrir imagem inexistente

## Ordem de execucao sugerida

1. corrigir `Nao dedutivel`
2. corrigir metricas de vendas
3. corrigir prazos fiscais por regime
4. corrigir placeholders de imagem
5. corrigir cliente herdado em duplicados
6. melhorar periodos e organizacao da lista
7. introduzir "Nao contabilizar"
8. reforcar testes E2E de negocio

## Conclusao

Os gaps nao significam que "nada funciona". Significam que o produto esta num estado intermédio:

- motor fiscal e varios imports ja existem
- mas ainda ha fissuras entre regra, UI, origem dos dados e expectativa operacional da contabilista

O maior erro nao foi apenas tecnico. Foi de criterio de release:

- demasiado peso em testes de logica e smoke
- pouca validacao de workflows reais de contabilista, com dados reais e multiplos canais
- comunicacao interna por vezes mais otimista do que o estado operacional efetivo
