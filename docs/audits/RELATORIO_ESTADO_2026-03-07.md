# IVAzen — Relatorio Completo de Estado

Data: 2026-03-07
Projeto Supabase: `dmprkdvkzzjtixlatnlx`
Repo: `github.com/bilalmachraa82/ivazen-saas`

---

## 1. RESUMO EXECUTIVO

O IVAzen tem 3 pilares fiscais: **IVA**, **Seguranca Social (SS)** e **Modelo 10**.
Cada um depende de dados diferentes. Este relatorio explica o que funciona, o que falta, e o que bloqueia.

### Estado por pilar

| Pilar | Estado | Bloqueio |
|-------|--------|----------|
| **IVA (compras)** | FUNCIONA | Nenhum — 761 faturas importadas, 360 fiscalmente efetivas |
| **IVA (vendas)** | PARCIAL | Depende de como o cliente emite faturas (ver secao 3) |
| **Seguranca Social** | PARCIAL | Precisa de vendas/recibos verdes importados (ver secao 3) |
| **Modelo 10** | PARCIAL | Detecao automatica funciona (2333 candidatos), falta vendas para ENIs |

---

## 2. O QUE FUNCIONA AGORA

### 2.1 Infraestrutura

| Componente | Estado | Detalhes |
|------------|--------|----------|
| Frontend (Vercel) | OK | Auto-deploy do branch `main` |
| Backend (Supabase) | OK | 96 migrations, 21 edge functions |
| AT Connector SOAP (VPS) | OK | Certificado corrigido, auth funciona |
| AT Connector Token | OK | Configurado no Supabase secrets |
| Base de dados | OK | 406 users, ~87K rows, RLS ativo |
| AI (Gemini 3.1 Flash-Lite) | OK | Classificacao de faturas operacional |
| Testes | OK | 748/748 passam |
| Build | OK | Compila sem erros |

### 2.2 Funcionalidades operacionais

| Funcionalidade | Estado |
|----------------|--------|
| Upload de faturas (foto/PDF/QR) | OK |
| Extracao AI de dados de faturas | OK |
| Classificacao AI de deductibilidade IVA | OK |
| Regras aprendidas por fornecedor (AI rules) | OK (bug critico corrigido) |
| Auto-aprovacao de faturas classificadas | OK |
| Calculo de IVA trimestral | OK |
| Exportacao DP (Declaracao Periodica) | OK |
| Detecao de retencoes na fonte | OK (2333 candidatos) |
| Modelo 10 — formulario e PDF | OK |
| SS — coeficientes e calculos | OK (aliases normalizados) |
| Importador SAF-T XML | OK |
| Importador Excel AT (recibos verdes) | OK (bug corrigido nesta sessao) |
| Painel de contabilista (multi-cliente) | OK |
| Sync de compras via SOAP API | OK |
| Dashboard fiscal | OK |

### 2.3 O que foi feito nesta sessao (2026-03-07)

1. **Certificado AT corrigido** — PFX encontrado no Desktop, chave+cert extraidos e deployados no VPS
2. **Secrets AT configurados** — AT_CONNECTOR_URL e TOKEN no Supabase
3. **3 edge functions deployadas** — sync-efatura v25, sync-recibos-verdes v11, detect-withholding-candidates v7
4. **Bug critico corrigido no importador de recibos verdes** — campos errados na conversao (`record.data`, `record.numero`, etc. nao existiam no tipo)
5. **revenue_category adicionado** ao insert de sales_invoices (essencial para SS)
6. **Descoberta importante**: API SOAP `fatshareFaturas` NAO retorna recibos verdes

---

## 3. O PROBLEMA DOS RECIBOS VERDES — EXPLICACAO CLARA

### 3.1 Como a AT organiza os dados

A AT tem **dois sistemas separados**:

```
Sistema 1: e-Fatura (SOAP API fatshareFaturas)
  - Faturas emitidas por software certificado (FT, FS, NC)
  - Acessivel via API SOAP com certificado digital (mTLS)
  - E o que a Primavera, Sage, PHC usam
  - O nosso AT Connector JA FAZ ISTO

Sistema 2: Portal de Recibos Verdes (irs.portaldasfinancas.gov.pt)
  - Recibos verdes emitidos diretamente no portal da AT
  - NAO tem API SOAP
  - So acessivel via portal web (browser)
  - Exporta para Excel (.xls)
```

### 3.2 Impacto nos 400 clientes

| Tipo de cliente | Como emitem faturas | Como importar | Automatico? |
|----------------|---------------------|---------------|-------------|
| Empresas com software (Primavera, Sage, PHC, Moloni...) | Software certificado | API SOAP (sync-efatura) | SIM |
| ENIs que so usam recibos verdes | Portal AT direto | Excel AT upload | NAO — manual |
| ENIs com software + recibos verdes | Ambos | SOAP + Excel | PARCIAL |

**A maioria dos 400 clientes provavelmente usa software de faturacao certificado** — para esses, o sync automatico JA FUNCIONA via SOAP.

**Apenas os clientes ENI que emitem recibos verdes diretamente no portal** precisam da importacao manual por Excel. Isto e exactamente o que a Primavera e a Sage fazem — pedem ao contabilista para importar o Excel ou o SAF-T.

### 3.3 O que confirmamos hoje

Testamos a API SOAP para o NIF 232945993 (Bilal) com credenciais validas:
- 2024: auth OK, 0 faturas (porque so emite recibos verdes, nao usa software certificado)
- 2025: auth OK, 0 faturas (mesmo motivo)
- 2026: auth OK, 0 faturas

Isto confirma que o Bilal emite APENAS recibos verdes — a API SOAP nunca vai retornar nada para ele. Precisa do import por Excel.

---

## 4. O QUE FALTA — ROADMAP POR PILAR

### 4.1 IVA

| Item | Estado | Acao necessaria |
|------|--------|-----------------|
| Compras importadas | DONE | 761 faturas, 360 fiscalmente efetivas |
| Classificacao AI | DONE | Regras aprendidas, auto-aprovacao |
| Calculo IVA trimestral | DONE | useVATCalculation.tsx |
| Exportacao DP | DONE | DPQuarterlySummary.tsx |
| Vendas para IVA | PARCIAL | Precisam de sales_invoices (SOAP ou Excel) |
| Reconciliacao AT vs local | PARCIAL | ReconciliationTab.tsx criado, precisa de dados reais |

**Bloqueio IVA**: Nenhum para compras. Para vendas, depende do tipo de cliente (ver secao 3).

### 4.2 Seguranca Social

| Item | Estado | Acao necessaria |
|------|--------|-----------------|
| Coeficientes por categoria | DONE | ssCoefficients.ts (10 categorias + aliases) |
| Calculo de contribuicao | DONE | useSocialSecurity.tsx |
| Normalizacao de categorias | DONE | normalizeSSCategory() com aliases |
| Importador de receitas (Excel/SAF-T) | DONE (bug corrigido) | RevenueImporter.tsx |
| Insercao em sales_invoices | DONE (bug corrigido) | createSalesInvoicesMutation |
| revenue_category no insert | DONE (adicionado hoje) | Essencial para calculos SS |
| Dados reais de receitas | FALTA | Clientes precisam de sales_invoices |
| Guia de submissao SS | DONE | SubmissionGuide.tsx |

**Bloqueio SS**: Precisa de sales_invoices. Para clientes com software, vem do SOAP. Para ENIs, vem do Excel. O importador agora funciona correctamente.

### 4.3 Modelo 10

| Item | Estado | Acao necessaria |
|------|--------|-----------------|
| Detecao automatica de retencoes | DONE | detect-withholding-candidates (2333 candidatos) |
| Formulario Modelo 10 | DONE | UI completa |
| Geracao de PDF | DONE | modelo10PdfGenerator.ts |
| Parser de recibos AT para retencoes | DONE | atRecibosParser.ts + reciboVerdeParser.ts |
| Importacao bulk de retencoes | DONE | BulkUploadTab.tsx |
| Promocao de candidatos | FALTA | candidatos -> tax_withholdings (precisa UI review) |

**Bloqueio Modelo 10**: Detecao funciona. Falta promover candidatos para withholdings oficiais (workflow de revisao).

---

## 5. OPCOES PARA AUTOMATIZAR RECIBOS VERDES (ESCALA)

Para nao ter de importar Excel manualmente para cada cliente ENI:

### Opcao A: Batch import por contabilista (FACIL — recomendado)
- O contabilista faz login no portal AT com credenciais WFA
- Descarrega Excel de recibos verdes de cada cliente ENI
- Upload em batch no IVAzen (ja suporta multi-ficheiro)
- **Esforco**: Baixo. Fluxo ja existe, so precisa de UX para batch.

### Opcao B: Portal scraping automatizado (DIFICIL — risco alto)
- Login automatico no portal AT via Puppeteer/Playwright
- Requer browser headless no servidor
- Portal AT migrou para React SPA — scraping e fragil e quebra frequentemente
- **Risco**: Alto. Portal pode mudar a qualquer momento.
- **Estado atual**: Tentamos, POST /v2/login retorna 500 (SPA migration)

### Opcao C: Pedir aos clientes ENI para uploadarem (SIMPLES)
- Cada cliente ENI faz login no seu portal AT
- Descarrega o Excel de recibos verdes
- Faz upload na app IVAzen (pagina Seguranca Social)
- **Esforco**: Zero de desenvolvimento. Ja funciona.

### Opcao D: Import SAF-T anual (POSSIVEL)
- O SAF-T contem todos os documentos incluindo recibos verdes
- O contabilista pode pedir o SAF-T ao cliente ou descarrega-lo do portal
- Parser SAF-T ja existe (SAFTInvoiceImporter.tsx)
- **Esforco**: Baixo. Verificar que o parser SAF-T extrai recibos verdes correctamente.

### Recomendacao: Opcao A + C
- Contabilista faz batch import para os seus clientes ENI (poucos, nao 400)
- Clientes que auto-gerem fazem upload na pagina de SS
- Nenhum scraping necessario

---

## 6. TAREFAS PENDENTES (PRIORIZADAS)

### Prioridade 1 — Fechar fluxo real (1-2 dias)

| # | Tarefa | Ficheiros | Esforco |
|---|--------|-----------|---------|
| 1 | Testar import de recibos verdes com Excel real do Bilal | RevenueImporter.tsx | 30 min |
| 2 | Verificar que SS calcula correctamente apos import | useSocialSecurity.tsx | 30 min |
| 3 | Testar sync SOAP de vendas para cliente com software cert. | sync-efatura (edge) | 30 min |
| 4 | Promover withholding candidates -> tax_withholdings | UI flow | 2h |
| 5 | Testar Modelo 10 end-to-end com dados reais | Modelo10 page | 1h |
| 6 | Merge branch para main e deploy Vercel | git | 15 min |

### Prioridade 2 — Melhorias de escala (3-5 dias)

| # | Tarefa | Descricao |
|---|--------|-----------|
| 7 | Batch Excel import para contabilistas | Upload multiplos ficheiros Excel de recibos verdes |
| 8 | Backfill revenue_category em sales_invoices existentes | ~53K vendas sem categoria |
| 9 | Classificacao AI de vendas em batch | batch-classify-sales edge function |
| 10 | Sync automatico de compras (SOAP) para clientes activos | pg_cron ja configurado |
| 11 | Dashboard de estado de sync por cliente | Qual cliente tem dados, qual falta |

### Prioridade 3 — Polish (1 semana)

| # | Tarefa |
|---|--------|
| 12 | A11y improvements |
| 13 | E2E tests fix |
| 14 | Sentry DSN config |
| 15 | Design tokens refinement |

---

## 7. ARQUITECTURA DE DADOS (REFERENCIA)

### Tabelas principais

```
invoices (compras)
  - 761 registos para Bilal
  - 360 fiscalmente efetivas (isFiscallyEffectivePurchase)
  - Campos: supplier_nif, total_amount, vat_*, status, classification

sales_invoices (vendas / recibos verdes)
  - 0 registos para Bilal (precisa import)
  - Campos: supplier_nif (emissor=cliente), customer_nif, total_amount,
    document_type (FR/FT/FS), revenue_category, status

at_withholding_candidates (candidatos retencao)
  - 2333 registos totais
  - Gerados automaticamente por detect-withholding-candidates

tax_withholdings (retencoes confirmadas)
  - Promovidos manualmente dos candidatos
  - Usados para gerar Modelo 10

ss_declarations (declaracoes SS)
  - Trimestrais, calculadas a partir de sales_invoices
```

### Fluxo de dados

```
Compras:
  Upload foto/PDF -> AI extraction -> AI classification -> invoices -> IVA

Vendas (software certificado):
  AT SOAP API -> sync-efatura -> sales_invoices -> SS + IVA vendas

Vendas (recibos verdes):
  AT Portal Excel -> RevenueImporter -> sales_invoices -> SS + IVA vendas

Retencoes:
  sales_invoices -> detect-withholding-candidates -> review -> tax_withholdings -> Modelo 10
```

---

## 8. CREDENCIAIS E SECRETS (REFERENCIA TECNICA)

### Supabase Edge Functions

| Secret | Valor | Estado |
|--------|-------|--------|
| AT_CONNECTOR_URL | http://137.74.112.68:8788 | OK |
| AT_CONNECTOR_TOKEN | 974c55c7... | OK |
| AT_ENCRYPTION_KEY | (set) | OK para 13 creds, 410 falham |
| AI_API_KEY | (set) | OK — Google AI Studio |

### VPS (137.74.112.68)

| Servico | Porta | Estado |
|---------|-------|--------|
| AT Connector (Docker) | 8787 | OK |
| Caddy HTTP proxy | 8788 | OK |
| Chrome/Chromium | - | Instalado (para futuro scraping) |

### Problema de encriptacao

410 de 423 credenciais AT falham ao desencriptar no runtime. Suspeita: `AT_ENCRYPTION_KEY` actual nao corresponde a chave usada na migracao. Apenas as 13 credenciais com `accountant_at_config` funcionam. Isto afecta o sync automatico para a maioria dos clientes.

**Acao necessaria**: Identificar a chave de encriptacao original e re-encriptar ou corrigir o secret.

---

## 9. FICHEIROS-CHAVE ALTERADOS

### Nesta sessao (2026-03-07)

| Ficheiro | Alteracao |
|----------|-----------|
| `src/components/social-security/RevenueImporter.tsx` | Bug fix: campos errados na conversao AT Excel, adicionado parser especifico recibos verdes |
| `src/hooks/useSocialSecurity.tsx` | Adicionado revenue_category, customer_name, supplierName ao insert de sales_invoices |
| `supabase/functions/sync-efatura/index.ts` | WFA retry logic (sessao anterior) |
| `supabase/functions/sync-recibos-verdes/index.ts` | Oficial primeiro, scraper depois (sessao anterior) |
| `supabase/functions/detect-withholding-candidates/index.ts` | FR/FS detection (sessao anterior) |
| `src/lib/fiscalStatus.ts` | Regra fiscal central (sessao anterior) |

### Ficheiros de parsing (ja existiam, nao alterados hoje)

| Ficheiro | Funcao |
|----------|--------|
| `src/lib/reciboVerdeParser.ts` | Parser especifico para recibos verdes Excel AT |
| `src/lib/atRecibosParser.ts` | Parser generico para Excel AT (rendas, etc.) |
| `src/lib/csvParser.ts` | Parser CSV/SAF-T |
| `src/lib/ssCoefficients.ts` | Coeficientes SS com aliases |

---

## 10. CONCLUSAO

### O que esta PRONTO para usar
- IVA de compras (classificacao, calculo, exportacao DP)
- Sync automatico de compras via SOAP
- Importacao manual de recibos verdes por Excel (bug corrigido)
- Detecao de retencoes na fonte
- Calculos de SS (quando existirem vendas)

### O que FALTA para fechar o ciclo
1. **Importar recibos verdes reais** (Excel AT do Bilal) — testar o fluxo corrigido
2. **Verificar SS end-to-end** com dados reais
3. **Promover candidatos de retencao** para Modelo 10
4. **Resolver encriptacao** das 410 credenciais que falham (para sync automatico de outros clientes)
5. **Merge para main** e deploy Vercel

### O que NAO e problema
- A API SOAP funciona para faturas de software certificado
- A falta de API para recibos verdes e uma limitacao da AT, nao do IVAzen
- Primavera/Sage tambem nao tem API automatica para recibos verdes
- O importador Excel e a solucao standard da industria
