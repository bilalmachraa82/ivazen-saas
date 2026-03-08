# Plano Final Por Fases — IVAzen Premium Accountant

## Objetivo

Fechar o IVAzen como produto `accountant-only`, premium, auditável e operacional para:

- `IVA`
- `Segurança Social`
- `Modelo 10`

sem regressões na lógica fiscal, sem ambiguidades de contexto multi-cliente e com UX alinhada com software de contabilidade premium.

## Posição Atual

### Já fechado

- `IVA` operacional
- `SS` operacional
- `Modelo 10` operacional com review
- multi-cliente seguro
- `CAAD 2025` reconciliado `143/143` no truth set AT por beneficiário
- `taxpayer_kind`
- `Centro Fiscal do Cliente`
- `Centro de Importação`
- `schema hardening` de proveniência fiscal
- `performance / code splitting`

### O que muda agora

O produto deixa de ser tratado como híbrido `cliente final + contabilista`.
O alvo passa a ser explicitamente:

- `contabilista`
- a gerir `clientes`
- com workflows fiscais orientados a obrigação, revisão e reconciliação

## Princípios de Best Practice

### Produto

- Uma obrigação fiscal não deve depender de navegação fragmentada.
- A app deve responder rapidamente:
  - `o que falta neste cliente?`
  - `o que posso fazer agora?`
  - `o que já está reconciliado?`

### Dados

- Origem fiscal explícita, nunca implícita em `notes`.
- Estados de workflow separados de semântica fiscal.
- Qualquer automatismo fiscal deve ser auditável.
- Quando a origem é incerta, o sistema deve ser conservador.

### Operação

- Zero auto-seleção silenciosa de cliente.
- Accountant-only no core fiscal.
- Reconciliação por exceção.
- Observabilidade operacional suficiente para não depender de scripts soltos.

### Engenharia

- Fases pequenas, reversíveis e auditáveis.
- Validação por etapa, não só no fim.
- Cada fase deve ter:
  - objetivo
  - entregáveis
  - critérios de aceitação
  - espaço para challenge do Claude

## Recomendação de Método

### Validar por etapa, não no fim

Esta é a abordagem recomendada.

Razões:

- reduz blast radius
- facilita identificar causa de regressões
- protege a lógica fiscal já estabilizada
- torna a auditoria do Claude mais útil
- evita acumular 5 blocos grandes antes de descobrir que o segundo estava mal

### Cadência recomendada

1. implementar uma fase
2. correr validação técnica
3. Claude faz review/critica
4. Codex faz auditoria final
5. só depois avançar para a fase seguinte

## Roadmap Final

## Fase 0 — Release Hardening

### Objetivo

Fechar o estado atual como base de release segura.

### Entregáveis

- commit limpo do bloco atual
- deploy das migrations/funções pendentes
- tipos Supabase regenerados a partir do remoto
- smoke tests pós-deploy

### Critérios de aceitação

- build OK
- testes OK
- migrations aplicadas
- edge functions certas deployadas
- sem drift entre schema local e remoto

### Best practice

- release freeze curta
- zero mistura de refactor visual nesta fase

### Claude deve validar

- se o deploy realmente reflete o estado local
- se os tipos gerados ficaram alinhados com o schema remoto
- se existe algum residual de produção não coberto

## Fase 1 — Reconciliação Automática

### Objetivo

Dar ao contabilista uma superfície de confiança:

- `AT vs app`
- `OCR vs AT`
- `sales_invoices vs SS`
- `withholdings vs Modelo 10`

### Entregáveis

- regras de reconciliação por obrigação
- ecrã ou secção de divergências
- badges claros:
  - `reconciliado`
  - `divergência`
  - `faltam dados`
  - `revisão necessária`

### Critérios de aceitação

- divergências materialmente relevantes são visíveis sem scripts
- o `CAAD` continua a bater
- ENI e empresa mostram reconciliações diferentes mas corretas

### Best practice

- verdade oficial explícita por fluxo
- divergência tratada como primeira classe
- não esconder mismatch em métricas agregadas

### Claude deve validar

- se a source of truth está correta em cada obrigação
- se a semântica dos badges é conservadora
- se há risco de falso “OK”

## Fase 2 — Centro de Revisão / Inbox

### Objetivo

Fazer o contabilista trabalhar por exceção, não por exploração manual da app.

### Entregáveis

- inbox única para:
  - compras pendentes
  - vendas ambíguas
  - retenções candidatas
  - divergências de reconciliação
  - falhas de sync/import

### Critérios de aceitação

- qualquer bloqueio fiscal relevante aparece na inbox
- cada item tem ação clara
- resolução atualiza o estado do cockpit

### Best practice

- workflow por exceção
- fila priorizada
- cada item com origem, contexto e ação

### Claude deve validar

- se a inbox evita duplicação de sinais
- se as prioridades fazem sentido para contabilista
- se há itens em falta que ainda obrigam a “caça” manual

## Fase 3 — Accountant-Only Pivot Completo

### Objetivo

Alinhar o produto inteiro com a visão atual:

- contabilista como utilizador principal
- cliente como entidade gerida

### Entregáveis

- revisão das rotas core fiscais
- revisão de copy e labels ainda centrados no cliente final
- remoção/ocultação de caminhos híbridos desnecessários

### Critérios de aceitação

- o core fiscal é coerente com accountant-only
- não há CTAs a levar para experiências fora da visão atual
- zero regressão no multi-cliente

### Best practice

- foco de produto claro
- menos estados mentais
- menos UX híbrida

### Claude deve validar

- se o pivot está a ser feito no momento certo
- se há dead code que deve sair
- se ainda sobra algum path híbrido importante

## Fase 4 — Observabilidade Operacional

### Objetivo

Dar saúde operacional nativa ao produto.

### Entregáveis

- health de syncs/imports por cliente
- retries e falhas recentes visíveis
- estado de dead letters / needs review
- última execução por canal

### Critérios de aceitação

- o estado operacional deixa de depender de scripts locais
- o contabilista ou admin percebe falhas sem terminal

### Best practice

- sistemas fiscais automatizados precisam de visibilidade de falha
- health separado de negócio

### Claude deve validar

- se a observabilidade cobre os canais reais
- se não se inventa “saúde” onde não há tracking suficiente

## Fase 5 — Refinamento do Centro Fiscal

### Objetivo

Transformar o cockpit num verdadeiro centro executivo.

### Entregáveis

- drill-down melhor por obrigação
- timeline de importações/revisões/submissões
- status semanticamente mais precisos
- alertas mais ricos por cliente

### Critérios de aceitação

- o cockpit responde à maior parte das perguntas operacionais
- reduz navegação lateral para páginas técnicas

### Best practice

- cockpit premium = clareza, não decoração
- densidade informativa com hierarquia forte

### Claude deve validar

- se a página continua operacional e não virou dashboard genérico
- se os números e labels permanecem corretos

## Fase 6 — Polimento Premium Visual e A11y

### Objetivo

Dar acabamento de produto premium sem degradar velocidade nem clareza.

### Entregáveis

- consistência visual entre cockpit, importação e revisão
- ajustes de contraste, foco, densidade, spacing
- motion discreta e funcional
- revisão de acessibilidade

### Critérios de aceitação

- visual mais premium
- UX mais limpa
- sem perder velocidade nem legibilidade

### Best practice

- premium em software de contabilidade = confiança e clareza
- evitar visual “marketing” em áreas operacionais

### Claude deve validar

- se o polimento melhora realmente a experiência
- se não entrou ruído visual

## Fase 7 — QA Final e Go-Live

### Objetivo

Fechar a entrega com prova operacional, não só técnica.

### Cenários obrigatórios

- `ENI real`
- `empresa real`
- `misto`

### Smoke tests obrigatórios

- `importação -> revisão -> IVA`
- `vendas -> SS`
- `retenções -> Modelo 10`
- `reconciliação -> resolução -> cockpit`

### Critérios de aceitação

- sem regressões
- sem blockers de role/contexto
- sem semântica enganadora
- outputs fiscais corretos

### Claude deve validar

- se os testes cobrem mesmo o uso real
- se ainda há edge cases relevantes sem prova

## Ordem Recomendada

1. `Fase 0 — Release hardening`
2. `Fase 1 — Reconciliação automática`
3. `Fase 2 — Centro de revisão / inbox`
4. `Fase 3 — Accountant-only pivot completo`
5. `Fase 4 — Observabilidade operacional`
6. `Fase 5 — Refinamento do Centro Fiscal`
7. `Fase 6 — Polimento premium visual e A11y`
8. `Fase 7 — QA final e go-live`

## O Que Falta Para Entregar

### Entregável com confiança

Basta fechar:

- `Fase 0`
- smoke tests finais
- revisão final do Claude + auditoria do Codex

### Roadmap premium completo

Exige fechar as `Fases 1 a 7`.

## Decisão Recomendada

### Curto prazo

Entregar o produto após:

- commit/deploy do estado atual
- validação final

### Médio prazo

Continuar por fases, com Claude a implementar e Codex a auditar.

Esta é a forma mais segura de chegar a um produto premium sem estragar o que já está certo.

## Espaço para Challenge do Claude

Em cada fase, o Claude deve responder explicitamente:

1. `Concordo com a fase e a ordem?`
2. `Há algum pré-requisito em falta?`
3. `Há uma alternativa com melhor rácio valor/risco?`
4. `Há algum ponto não alinhado com best practice de software de contabilidade premium?`
5. `O que eu implementaria diferente, se houver?`

## Espaço para Auditoria Final do Codex

Em cada fase, o Codex deve auditar:

- regressões
- semântica fiscal
- multi-cliente
- alinhamento accountant-only
- coerência da UX
- se a fase ficou realmente fechada
