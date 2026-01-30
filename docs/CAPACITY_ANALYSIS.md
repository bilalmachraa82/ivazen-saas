# Análise de Capacidade de Upload em Massa
## IVA Inteligente - Modelo 10

**Data:** Janeiro 2026
**Versão:** 1.0

---

## 1. Configuração Atual

| Parâmetro | Valor Atual | Ficheiro |
|-----------|-------------|----------|
| Máximo ficheiros por lote | **50** | `BulkUploadTab.tsx:19` |
| Tamanho máximo por ficheiro | **10 MB** | `BulkUploadTab.tsx:18` |
| Processamento simultâneo | **3** documentos | `bulkProcessor.ts:10` |
| Retries por documento | **2** tentativas | `bulkProcessor.ts:11` |
| Delay entre retries | **2-4 segundos** (exponential) | `bulkProcessor.ts:12` |

---

## 2. Limites Técnicos por Componente

### 2.1 Base de Dados (Supabase)

| Tier | Conexões Simultâneas | Rows/Tabela | Storage | Egress/mês |
|------|---------------------|-------------|---------|------------|
| Free | 20 | 500K | 500 MB | 2 GB |
| Pro ($25/mês) | 60 | Ilimitado | 8 GB | 50 GB |
| Team ($599/mês) | 200 | Ilimitado | 100 GB | 200 GB |
| Enterprise | Custom | Ilimitado | Custom | Custom |

**Análise para a tabela `tax_withholdings`:**
- Cada registo: ~500 bytes (estimativa conservadora)
- **Free Tier:** 500K registos = ~100.000 clientes com 5 retenções cada
- **Pro Tier:** Efetivamente ilimitado para uso normal

**Conclusão:** ✅ A base de dados **não é bottleneck** para clientes com 100-12.000 documentos

---

### 2.2 Lovable AI Gateway (Gemini 2.5 Flash)

**Endpoint:** `https://ai.gateway.lovable.dev/v1/chat/completions`
**Modelo:** `google/gemini-2.5-flash`

| Aspeto | Limite Estimado | Impacto |
|--------|-----------------|---------|
| Rate Limit | ~60-100 RPM (requests/minuto) | Bottleneck principal |
| Tokens por request | 1000 (output) | Baixo custo por doc |
| Timeout | ~30 segundos | Retries necessários |
| Créditos | Sistema de créditos (402 = esgotado) | Custo variável |

**⚠️ BOTTLENECK PRINCIPAL:** O rate limit da API de IA é o fator limitante.

---

### 2.3 Supabase Edge Functions

| Limite | Valor | Impacto |
|--------|-------|---------|
| Timeout máximo | 150 segundos (Pro) | OK para OCR |
| Invocações/mês (Free) | 500.000 | ~16.666/dia |
| Invocações/mês (Pro) | 2.000.000 | ~66.666/dia |
| Payload máximo | 6 MB | OK (ficheiros até 10MB são comprimidos em base64) |

**Nota:** Base64 aumenta tamanho em ~33%, logo ficheiro de 10MB → ~13MB. Pode ser necessário reduzir limite de ficheiro para 4.5MB.

---

### 2.4 Browser (Client-Side)

| Recurso | Limite Prático | Impacto |
|---------|---------------|---------|
| Memória (FileReader) | ~500 MB total | 50 ficheiros × 10MB = 500MB (no limite) |
| Tabs WebSocket | 6 conexões | OK |
| localStorage | 5-10 MB | Não usado para uploads |

---

## 3. Cenários de Carga

### Cenário A: Cliente Pequeno (100 documentos/ano)

```
Configuração: MAX_FILES=50, MAX_CONCURRENT=3

Upload em 2 lotes:
- Lote 1: 50 ficheiros
- Lote 2: 50 ficheiros

Tempo por ficheiro: ~3-5 segundos (OCR + validação)
Tempo por lote: 50 ÷ 3 × 4s = ~67 segundos

TEMPO TOTAL: ~2-3 minutos
CUSTO ESTIMADO: ~$0.05-0.10 (100 × ~$0.0005-0.001 por extração)
```

✅ **Viável** com configuração atual

---

### Cenário B: Cliente Médio (1.000 documentos/ano)

```
Configuração atual: MAX_FILES=50

Upload em 20 lotes manuais:
- Tempo por lote: ~70 segundos
- Tempo total: 20 × 70s = ~23 minutos de processamento
- Com delays entre lotes: ~30-40 minutos

CUSTO ESTIMADO: ~$0.50-1.00
```

⚠️ **Viável mas tedioso** - utilizador tem de fazer 20 uploads separados

---

### Cenário C: Cliente Grande (12.000 documentos/ano)

```
Configuração atual: MAX_FILES=50

Upload em 240 lotes manuais:
- Tempo por lote: ~70 segundos
- Tempo total processamento: 240 × 70s = ~4.6 horas
- Com UI: ~5-6 horas de trabalho manual

CUSTO ESTIMADO: ~$6-12
```

❌ **Inviável** com abordagem atual - demasiado trabalho manual

---

## 4. Limites Técnicos Máximos Teóricos

### 4.1 Máximo Absoluto por Sessão

| Componente | Limite | Cálculo |
|------------|--------|---------|
| Browser Memory | ~150 ficheiros × 10MB | 1.5 GB RAM disponível |
| API Rate Limit | ~3.600/hora | 60 RPM × 60 min |
| Edge Function Invocations | ~66.666/dia (Pro) | 2M/mês |
| Base de dados | Ilimitado (Pro) | - |

**Limite prático por hora:** ~3.000 documentos (limitado pela API de IA)

### 4.2 Configuração Otimizada Proposta

| Parâmetro | Atual | Proposto | Razão |
|-----------|-------|----------|-------|
| MAX_FILES_PER_BATCH | 50 | **200** | Reduzir uploads manuais |
| MAX_CONCURRENT | 3 | **5** | Melhor paralelização |
| MAX_FILE_SIZE | 10 MB | **5 MB** | Evitar limite payload |
| BATCH_DELAY | 0 | **500ms** | Evitar rate limiting |

---

## 5. Análise de Custos

### 5.1 Custos da Lovable AI Gateway

**Estimativa baseada em modelos similares (Gemini Flash):**

| Operação | Tokens | Custo Estimado |
|----------|--------|----------------|
| Input (imagem + prompt) | ~2.000 | $0.00015 |
| Output (JSON) | ~500 | $0.00003 |
| **Total por documento** | ~2.500 | **~$0.0002** |

### 5.2 Projeção de Custos por Volume

| Documentos | Custo AI | Supabase (Pro) | Total/mês |
|------------|----------|----------------|-----------|
| 100 | $0.02 | $25 | ~$25 |
| 1.000 | $0.20 | $25 | ~$25 |
| 10.000 | $2.00 | $25 | ~$27 |
| 100.000 | $20.00 | $25 | ~$45 |
| 1.000.000 | $200.00 | $25-599 | ~$225-800 |

**Nota:** Custos AI são estimativas. O modelo de créditos Lovable pode diferir.

### 5.3 Custos Adicionais Supabase

| Recurso | Free | Pro ($25) | Excesso |
|---------|------|-----------|---------|
| Storage | 500 MB | 8 GB | $0.021/GB |
| Egress | 2 GB | 50 GB | $0.09/GB |
| Edge Functions | 500K | 2M | $2/milhão |

---

## 6. Arquiteturas Recomendadas por Escala

### 6.1 Escala Pequena (até 500 docs/cliente)

**Manter arquitetura atual** com ajustes:

```typescript
// bulkProcessor.ts
export const BULK_CONFIG = {
  MAX_CONCURRENT: 5,      // Aumentar de 3 para 5
  MAX_RETRIES: 3,         // Aumentar de 2 para 3
  RETRY_DELAY_MS: 1000,   // Reduzir de 2000 para 1000
  BATCH_DELAY_MS: 300,    // Novo: delay entre batches
};
```

**Tempo estimado:** ~3 minutos para 100 docs

---

### 6.2 Escala Média (500-5.000 docs/cliente)

**Adicionar sistema de filas persistente:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Supabase   │────▶│   Worker    │
│   Upload    │     │   Queue     │     │  (Cron/BG)  │
└─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                          ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Storage   │     │  Lovable AI │
                    │   Bucket    │     │   Gateway   │
                    └─────────────┘     └─────────────┘
```

**Componentes:**
1. **Tabela `upload_queue`** - fila de documentos pendentes
2. **Storage bucket** - armazenar PDFs temporariamente
3. **Scheduled Edge Function** - processar fila em background
4. **Notificações** - alertar quando concluído

**Vantagens:**
- Upload instantâneo (só guarda ficheiros)
- Processamento em background
- Utilizador pode fechar browser
- Retries automáticos

**Tempo:** Upload imediato, processamento ~30min para 1000 docs

---

### 6.3 Escala Grande (5.000+ docs/cliente)

**Processamento em batch com workers dedicados:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│  Supabase   │────▶│  Multiple   │
│   (Bulk)    │     │   Storage   │     │   Workers   │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼───────────┐
                    │                         │           │
                    ▼                         ▼           ▼
              ┌──────────┐             ┌──────────┐  ┌──────────┐
              │ Worker 1 │             │ Worker 2 │  │ Worker N │
              │ (3 RPM)  │             │ (3 RPM)  │  │ (3 RPM)  │
              └──────────┘             └──────────┘  └──────────┘
```

**Opções:**
1. **Supabase Edge Functions** com pg_cron
2. **External workers** (Railway, Render, etc.)
3. **Serverless** (AWS Lambda, Cloudflare Workers)

**Custo adicional:** ~$10-50/mês para workers

---

## 7. Desafios e Mitigações

### 7.1 Rate Limiting da API de IA

| Desafio | Probabilidade | Impacto | Mitigação |
|---------|---------------|---------|-----------|
| 429 Too Many Requests | Alta | Atrasa processamento | Exponential backoff + queue |
| 402 Créditos esgotados | Média | Bloqueia totalmente | Alertas + plano créditos |
| Timeout da API | Média | Retry individual | Retry logic já implementado |

### 7.2 Memória do Browser

| Desafio | Probabilidade | Impacto | Mitigação |
|---------|---------------|---------|-----------|
| OOM com muitos ficheiros | Alta (>100 ficheiros) | Crash browser | Limitar + processar em streams |
| Memory leaks | Baixa | Degradação | Cleanup implementado |

### 7.3 Qualidade OCR

| Desafio | Probabilidade | Impacto | Mitigação |
|---------|---------------|---------|-----------|
| Documentos mal digitalizados | Alta | Dados incorretos | Threshold de confiança |
| Formatos não-standard | Média | Extração parcial | Validação + revisão manual |
| PDFs protegidos | Baixa | Falha total | Erro claro + instrução |

### 7.4 Consistência de Dados

| Desafio | Probabilidade | Impacto | Mitigação |
|---------|---------------|---------|-----------|
| Duplicados | Média | Dados incorretos | Hash de ficheiro + validação NIF+data |
| Transações parciais | Baixa | Inconsistência | Batch inserts com transação |

---

## 8. Plano de Implementação por Fase

### Fase 1: Quick Wins (1-2 dias)

```diff
// bulkProcessor.ts
export const BULK_CONFIG = {
-  MAX_CONCURRENT: 3,
+  MAX_CONCURRENT: 5,
-  MAX_RETRIES: 2,
+  MAX_RETRIES: 3,
-  RETRY_DELAY_MS: 2000,
+  RETRY_DELAY_MS: 1000,
+  BATCH_DELAY_MS: 300,
};

// BulkUploadTab.tsx
-const MAX_FILES_PER_BATCH = 50;
+const MAX_FILES_PER_BATCH = 100;
-const MAX_FILE_SIZE = 10 * 1024 * 1024;
+const MAX_FILE_SIZE = 5 * 1024 * 1024; // Reduzir para evitar payload limits
```

**Resultado:** Duplica capacidade sem mudanças estruturais

---

### Fase 2: Sistema de Filas (1-2 semanas)

1. **Criar tabela de fila:**
```sql
CREATE TABLE upload_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id),
  file_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  fiscal_year INTEGER NOT NULL,
  extracted_data JSONB,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_upload_queue_status ON upload_queue(status, created_at);
```

2. **Modificar upload para gravar em Storage + Queue**

3. **Criar Edge Function com pg_cron:**
```sql
SELECT cron.schedule(
  'process-upload-queue',
  '*/1 * * * *', -- cada minuto
  $$SELECT net.http_post(
    'https://xxx.supabase.co/functions/v1/process-queue',
    '{}',
    headers := '{"Authorization": "Bearer xxx"}'
  )$$
);
```

---

### Fase 3: Workers Paralelos (2-4 semanas)

Para clientes enterprise com >10.000 documentos:

1. **Deploy de workers externos** (Railway/Render)
2. **Load balancing** entre workers
3. **Dashboard de progresso** em tempo real
4. **Notificações** por email/push quando concluído

---

## 9. Recomendações Finais

### Para o Caso de 12.000 Documentos

| Opção | Tempo | Custo Setup | Custo/Uso | Recomendação |
|-------|-------|-------------|-----------|--------------|
| Atual (50 ficheiros/lote) | ~6h manual | $0 | ~$12 AI | ❌ Inviável |
| Fase 1 (100 ficheiros/lote) | ~3h manual | $0 | ~$12 AI | ⚠️ Possível mas tedioso |
| Fase 2 (Queue background) | ~4h automático | 2-3 dias dev | ~$12 AI | ✅ Recomendado |
| Fase 3 (Workers paralelos) | ~1h automático | 2-4 semanas dev | ~$12 AI + $20 infra | ✅ Enterprise |

### Decisão Sugerida

1. **Implementar Fase 1 imediatamente** - ganhos rápidos
2. **Planear Fase 2 para Q1** - resolver caso de 12.000 docs
3. **Fase 3 apenas se necessário** - clientes enterprise

---

## 10. Métricas de Monitorização

Implementar tracking de:

```typescript
// Analytics events
- upload_batch_started: { files_count, total_size }
- upload_file_processed: { duration_ms, confidence, had_errors }
- upload_batch_completed: { success_count, error_count, total_duration }
- api_rate_limited: { retry_count, final_status }
- api_credits_warning: { remaining_credits }
```

---

## Resumo Executivo

| Pergunta | Resposta |
|----------|----------|
| **Máximo técnico atual?** | ~50 ficheiros/lote, ~3.000/hora |
| **BD aguenta 12.000 docs?** | ✅ Sim, sem problemas |
| **OCR aguenta?** | ⚠️ Rate limited, ~60 RPM |
| **Tempo para 12.000?** | 4-6 horas (atual), 1h (otimizado) |
| **Custo para 12.000?** | ~$12 AI + $25 Supabase Pro |
| **Principal bottleneck?** | Rate limit da API de IA |
| **Solução recomendada?** | Sistema de filas em background |
