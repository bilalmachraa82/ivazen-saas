# Carteira da Adélia — Readiness Operacional

Data de referência: `2026-03-13`  
Base: projeto Supabase `dmprkdvkzzjtixlatnlx`  
Âmbito: clientes associados à conta `adelia.gaspar@accountingadvantage.pt`

## Resumo executivo

A carteira da Adélia **não está pronta a 100% de forma homogénea**, mas o IVAzen já está em estado de uso real para um subconjunto relevante de clientes com dados carregados.

Contagem atual de clientes na carteira:

- clientes associados: `405`

Classificação operacional atual:

- `Prontos / com dados úteis`: `32`
- `Parciais / com dados mas situação AT imperfeita`: `220`
- `Sem dados mas sem erro forte visível`: `18`
- `Sem credenciais`: `9`
- `Bloqueados`: `126`

## Como ler estas categorias

### Prontos / com dados úteis

Clientes com dados já carregados e utilizáveis para trabalho real, mesmo quando o motivo AT recente seja `AT_EMPTY_LIST`.

Isto significa, na prática:

- já têm compras e/ou vendas e/ou retenções na app
- a equipa pode trabalhar a partir do `Centro Fiscal`

### Parciais

Clientes com dados existentes, mas com contexto AT imperfeito ou incompleto.

Exemplos:

- imports anteriores bem sucedidos, mas estado AT atual imperfeito
- syncs `partial`
- clientes com dados úteis, mas sem garantias de atualização automática limpa

### Sem dados

Clientes sem dados contabilísticos carregados na app, sem um bloqueio técnico forte claramente classificado.

### Sem credenciais

Clientes sem credenciais AT registadas.

### Bloqueados

Clientes sem dados úteis e com motivo operacional claro, como:

- `AT_AUTH_FAILED`
- `AT_SCHEMA_RESPONSE_ERROR`
- `UNKNOWN_AT_ERROR`
- outros erros técnicos/operacionais

## Exemplos concretos

### Clientes fortes para trabalho/demo

- `Bilal machraa` — NIF `232945993`
- `CAAD-Centro de Arbitragem Administrativa` — NIF `508840309`
- `Justyna Alicja Rogers` — NIF `307170730`

### Casos úteis mas parciais

- `Majda Machraa` — NIF `232946060`

## O que isto significa para a equipa

### Uso no dia 1

A equipa **não deve começar por clientes aleatórios**.

A ordem correta é:

1. abrir `Dashboard` (carteira)
2. perceber o estado do cliente
3. abrir `Centro Fiscal`
4. se o cliente estiver vazio:
   - `Centro de Importação`
   - ou `AT Control Center`

### Regra operacional

- clientes `Prontos`: usar normalmente
- clientes `Parciais`: trabalhar com cautela e validar origem dos dados
- clientes `Sem dados`: importar antes de trabalhar
- clientes `Bloqueados`: resolver credenciais/AT antes de prometer uso pleno

## Limitações importantes

1. Esta classificação é **operacional**, não jurídica/fiscal.
2. `AT_EMPTY_LIST` não significa necessariamente erro; em vários casos significa apenas ausência de documentos no canal AT consultado.
3. Um cliente com dados na app pode continuar com sync AT atual imperfeito.
4. A carteira não deve ser comunicada como “totalmente sincronizada”.

## Mensagem correta para a cliente

> O IVAzen já está pronto para trabalhar com clientes que tenham dados carregados e para a equipa operar nesses casos com IVA, Segurança Social e Modelo 10. A utilização plena em toda a carteira ainda depende da readiness operacional de alguns clientes, sobretudo ao nível de credenciais AT e importação inicial de dados.
