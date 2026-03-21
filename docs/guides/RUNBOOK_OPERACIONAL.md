# Runbook Operacional — IVAzen

Data: 2026-03-21
Versao: 1.0

## Objectivo

Guia dia-a-dia para a equipa de contabilidade. Cobre credenciais AT, importacao de dados, reconciliacao trimestral, Modelo 10 anual e Seguranca Social.

Para o fluxo padrao por cliente, consultar tambem:
- In-app: `/guide` (Guia do Contabilista)
- Doc: `docs/SOP_EQUIPE_CONTABILIDADE_2026-03-13.md`

---

## 1. Configuracao de Cliente (uma vez)

### 1.1 Criar/Editar Cliente
1. Ir a `Definicoes` → separador "Clientes"
2. Clicar "Editar" no cliente
3. Preencher:
   - **Cadencia IVA**: `mensal` ou `trimestral` (afecta prazos e alertas)
   - **Tipo de contribuinte**: ENI, Empresa ou Misto (afecta obrigacoes visiveis)
   - **NIF**: obrigatorio, validacao automatica

### 1.2 Credenciais AT
1. `Definicoes` → separador "Credenciais AT"
2. Inserir NIF + password do portal da Autoridade Tributaria
3. As credenciais sao encriptadas no servidor — nunca sao guardadas em texto claro
4. A sincronizacao AT usa estas credenciais para importar compras automaticamente

### 1.3 Regime Art. 53 (isentos)
- Configurar cadencia IVA como `trimestral`
- SS nao se aplica
- A app nao gera alertas de IVA para periodos onde nao ha obrigacao

---

## 2. Importacao de Dados

### 2.1 Compras (automatico ou manual)
| Metodo | Origem | Caminho |
|--------|--------|---------|
| Sincronizacao AT | Automatica (se credenciais configuradas) | Automatico |
| SIRE CSV | Download do portal AT | Centro de Importacao |
| Upload manual | PDF/imagem da fatura | Upload → OCR + IA |
| SAF-T XML | Software de facturacao | Upload |

### 2.2 Vendas / Recibos Verdes (sempre manual)
**A AT NAO fornece vendas via API. Vendas sao sempre importacao manual.**

1. Cliente vai ao portal AT → "Recibos Verdes" → "Emitidos"
2. Descarrega o ficheiro Excel
3. Contabilista importa via Centro de Importacao → "Importar Recibos Verdes"

### 2.3 Retencoes (Modelo 10)
1. Download do ficheiro SIRE do portal AT
2. Centro de Importacao → importar SIRE CSV
3. Ou upload manual de documentos de retencao → OCR

---

## 3. Validacao Diaria

### 3.1 Compras
1. `Compras` (Validacao) → filtrar por **"Ultimas 24h"** para ver recentes
2. Verificar classificacao IA: tipo IVA, campo DP, dedutibilidade
3. Facturas nao dedutiveis → clicar "Excluir" (Nao contabilizar) — mantém no sistema mas exclui do calculo IVA
4. Para excluir em massa: Selecionar → escolher facturas → "Nao contabilizar"
5. Para re-classificar: Selecionar → "Reclassificar" → IA re-analisa

### 3.2 Vendas
1. `Vendas` → verificar categoria de receita (Servicos, Vendas, Outros)
2. Validar → confirma o registo

### 3.3 Notas sobre dados AT
- Facturas importadas da AT **nao tem imagem** — esperado (AT nao fornece PDF)
- NIF `999999990` = consumidor final — nome nao pode ser resolvido
- Nomes de fornecedores sao enriquecidos automaticamente quando possiveis via directorio

---

## 4. Reconciliacao Trimestral

Para detalhes tecnicos, consultar: `docs/RUNBOOK_RECONCILIACAO_TRIMESTRAL.md`

### Resumo do processo
1. Confirmar que todas as compras do trimestre estao importadas e validadas
2. Confirmar que todas as vendas estao importadas e validadas
3. Ir a `Reconciliacao` → verificar correspondencia AT vs app
4. Separador "Divergencias" → resolver diferencas
5. Ir a `Exportacao` → gerar Excel da Declaracao Periodica
6. Verificar os 4 sheets: Resumo DP, Detalhe, Lista Facturas, Lista Vendas

### Checklist pre-entrega
- [ ] Todas as compras validadas (0 pendentes)
- [ ] Todas as vendas validadas
- [ ] Reconciliacao AT sem divergencias criticas
- [ ] Exportacao gerada e revista
- [ ] Valores batem com o portal AT

---

## 5. Modelo 10 (Anual, ate 25 Junho)

### Fluxo
1. Importar retencoes do ano inteiro via SIRE CSV
2. `Modelo 10` → separador "Retencoes" → verificar por beneficiario
3. Separador "Candidatos" → retencoes detectadas automaticamente
4. Separador "Resumo" → totais por categoria (A, B, E, F, G, H, R)
5. Separador "Exportar" → gerar PDF ou ficheiro para submissao

### Validacao cruzada
- Comparar totais IVAzen vs AT oficial (portal SIRE)
- Meta: 0.00 EUR de divergencia
- Referencia: `docs/MODELO10_E2E_AUDIT_2026-03-07.md` — validacao 143/143 beneficiarios

---

## 6. Seguranca Social (Trimestral, ENI)

### Aplica-se a
- Empresarios em Nome Individual (ENI)
- Trabalhadores independentes com rendimentos > 0

### Calculo
1. `Seguranca Social` → selecionar trimestre
2. Rendimento bruto do trimestre N
3. Coeficiente por actividade (ex.: 0.70 para servicos)
4. Base tributavel = rendimento * coeficiente
5. Contribuicao = base * 21.4%
6. **Trimestre N determina contribuicoes de N+1**

### Periodos
| Rendimentos | Contribuicoes |
|-------------|---------------|
| Jan-Mar (Q1) | Jul-Set (Q3) |
| Abr-Jun (Q2) | Out-Dez (Q4) |
| Jul-Set (Q3) | Jan-Mar (Q1+1) |
| Out-Dez (Q4) | Abr-Jun (Q2+1) |

---

## 7. Resolucao de Problemas

| Problema | Causa provavel | Solucao |
|----------|---------------|---------|
| Vendas nao aparecem | Importacao manual necessaria | Importar Excel recibos verdes do portal AT |
| Centro Fiscal a zeros | Dados nao importados | Importar compras + vendas |
| Alerta IVA mensal errado | Cadencia IVA mal configurada | Definicoes → Editar cliente → mudar cadencia |
| Fornecedor so mostra NIF | Importacao AT sem nome | Normal — enriquecimento automatico quando possivel |
| Fatura sem imagem | Importada da AT (sem PDF) | Normal — AT nao fornece imagens |
| Duplicados apos re-import | Importacao repetida | Compras → separador Duplicados → Eliminar |
| SS mostra 0 contribuicoes | Cliente nao e ENI | Verificar tipo contribuinte |

---

## 8. Contactos e Escalonamento

- **Suporte tecnico**: Bilal Machraa (WhatsApp)
- **Contabilista responsavel**: Adelia Gaspar
- **URL producao**: https://ivazen.aiparati.pt
- **Documentacao deploy**: `docs/release/DEPLOY_RUNBOOK.md`
- **Limitacoes conhecidas**: `docs/release/KNOWN_LIMITATIONS.md`
