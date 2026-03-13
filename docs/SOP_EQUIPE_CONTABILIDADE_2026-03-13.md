# SOP — Uso da Equipa de Contabilidade no IVAzen

Data: `2026-03-13`

## Princípio-base

O IVAzen deve ser usado assim:

- `Dashboard` = carteira
- `Centro Fiscal` = hub do cliente
- `Importação` = entrada de dados
- `Reconciliação` = verificação
- `Exportação` = entregáveis

## Fluxo padrão por cliente

1. Escolher cliente no `Dashboard`
2. Abrir `Centro Fiscal`
3. Ler `Inbox`
4. Se faltarem dados:
   - `Centro de Importação`
   - ou `AT Control Center`
5. Se houver compras:
   - `Compras`
6. Se houver vendas:
   - `Vendas`
   - `Segurança Social`, quando aplicável
7. Se houver retenções:
   - `Modelo 10`
8. Confirmar:
   - `Reconciliação`
9. Gerar saída:
   - `Exportação`

## Como trabalhar IVA

### Se o cliente já tem dados

1. `Centro Fiscal`
2. confirmar compras/vendas do período
3. `Compras`
4. rever / validar
5. `Reconciliação`
6. `Exportação`

### Se o cliente não tem dados

1. `Centro de Importação`
2. usar:
   - `SOAP` quando existir
   - `CSV/Excel oficial AT`
   - `OCR/manual`, se necessário
3. voltar a `Compras`
4. rever
5. `Exportação`

## Como trabalhar Segurança Social

1. cliente ENI / trabalhador independente
2. confirmar vendas
3. abrir `Segurança Social`
4. validar trimestre
5. usar o cálculo como base de trabalho

Nota:

- `ss_declarations = 0` na base não significa erro
- a app calcula a contribuição a partir das vendas existentes

## Como trabalhar Modelo 10

1. abrir `Modelo 10`
2. confirmar lista de retenções
3. rever agrupamentos/beneficiários
4. aprovar/rejeitar conforme necessário
5. gerar ficheiro final/export

## O que fazer quando o cliente está vazio

Se o cliente mostrar zeros ou ecrãs vazios:

1. não assumir bug
2. confirmar:
   - há credenciais?
   - há dados importados?
   - o período está certo?
3. se não houver dados:
   - importar do AT
   - ou carregar ficheiro oficial

## O que não prometer ao cliente final

- sync AT automático total para toda a carteira
- recibos verdes sempre recolhidos automaticamente
- qualquer cliente aleatório pronto sem import inicial

## Clientes recomendados para formação/demo

- `Bilal machraa` — `SS + Centro Fiscal + Compras + Vendas`
- `CAAD` — `Modelo 10`
- `Justyna Alicja Rogers` — `IVA` com período correto

## Regra de ouro para a equipa

> Se há dados, trabalha-se a partir do Centro Fiscal. Se não há dados, o próximo passo é Importação ou AT Control Center.
