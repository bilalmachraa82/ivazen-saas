import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { parseJsonFromAI } from "../_shared/parseJsonFromAI.ts";
import { isConfiguredServiceRoleToken, extractBearerToken } from "../_shared/auth.ts";

const VERSION = '5.9.1'; // SAVED guardrail + isExplicitZeroRate removal

// ── OUTCOME CODES ──
// SAVED              – extracted & inserted into tax_withholdings
// SKIPPED_DUPLICATE  – record already exists (client+nif+ref+year)
// SKIPPED_CANCELLED  – document classified as anulado with strong evidence
// NEEDS_REVIEW       – processed but not saved (low confidence, arithmetic mismatch, etc.)
// FAILED             – unrecoverable error after max retries
// NOT_INVOICE        – listagem / screenshot, not a single document

// Normalize document reference to prevent duplicates from prefix/suffix variations.
// IMPORTANT: Do NOT strip numeric suffixes from fiscal references (e.g. ATSIRE01FR/33).
// Only strip copy markers from filename fallbacks.
function normalizeDocumentReference(ref: string, isFilenameFallback = false): string {
  if (!ref) return ref;
  
  let normalized = ref.trim();
  
  // Strip angle brackets (some AI extractions wrap references in <...>)
  normalized = normalized.replace(/^</, '').replace(/>$/, '').trim();
  
  // Remove common Portuguese document type prefixes (including international variants)
  const prefixes = ['FRI ', 'FTI ', 'RGI ', 'FR ', 'FT ', 'RG ', 'NC ', 'ND ', 'R ', 'F '];
  
  for (const prefix of prefixes) {
    if (normalized.toUpperCase().startsWith(prefix)) {
      normalized = normalized.substring(prefix.length);
      break;
    }
  }
  
  // Only remove copy suffixes from FILENAME fallbacks (e.g. "recibo (1).pdf" → "recibo.pdf")
  // Never strip from AI-extracted fiscal references (they may legitimately end in numbers)
  if (isFilenameFallback) {
    normalized = normalized.replace(/\s*\(\d+\)\s*$/, '');   // " (1)" suffix
    normalized = normalized.replace(/-c[oó]pia\d*$/i, '');    // "-cópia", "-copia2"
    normalized = normalized.replace(/-copy\d*$/i, '');         // "-copy", "-copy2"
  }
  
  return normalized.trim();
}

/**
 * Detect if a reference is in ATCUD format (e.g. "JJSBPRS7-22", "ATCUD:JJXB72P7-23")
 * ATCUD = 8+ alphanumeric chars, hyphen, number(s)
 */
function isAtcudFormat(ref: string): boolean {
  if (!ref) return false;
  const cleaned = ref.replace(/^ATCUD:/i, '').trim();
  return /^[A-Z0-9]{6,}-\d+$/i.test(cleaned);
}

/**
 * Extract canonical ATSIRE series reference from filename.
 * Filename pattern: Recibo_Verde_{adquirenteNIF}_{type}_{series}_{num}_{id}.pdf
 * Example: Recibo_Verde_508840309_FR_ATSIRE01FR_22_1659.pdf → ATSIRE01FR/22
 */
function extractSeriesRefFromFilename(filename: string): string | null {
  if (!filename) return null;
  const match = filename.match(/_(FR|FT|FRI|FTI|RG|RGI)_(ATSIRE\d+\w+)_(\d+)_/i);
  if (match) return `${match[2]}/${match[3]}`;
  return null;
}

/**
 * Resolve the canonical document reference for deduplication.
 * Priority: ATSIRE series ref > filename-derived series > normalized AI ref
 * When ATCUD is replaced, it's preserved in extracted_data.atcud_original.
 */
// deno-lint-ignore no-explicit-any
function resolveCanonicalReference(extractedData: Record<string, any>, filename: string): string {
  const aiRef = extractedData.document_reference || '';
  const normalizedAiRef = normalizeDocumentReference(String(aiRef));

  // If AI already returned a series reference, use it
  if (normalizedAiRef.startsWith('ATSIRE')) {
    return normalizedAiRef;
  }

  // If AI returned ATCUD format, try to reconstruct from filename
  if (isAtcudFormat(aiRef)) {
    const fromFilename = extractSeriesRefFromFilename(filename);
    if (fromFilename) {
      // Preserve the original ATCUD for auditability
      extractedData.atcud_original = aiRef;
      console.log(`[process-queue] ATCUD→Series: "${aiRef}" → "${fromFilename}" (from filename)`);
      return fromFilename;
    }
    // No filename match — use ATCUD as-is (fallback)
    return normalizedAiRef;
  }

  // For any other format, try filename extraction first
  const fromFilename = extractSeriesRefFromFilename(filename);
  if (fromFilename && !normalizedAiRef.startsWith('ATSIRE')) {
    extractedData.atcud_original = aiRef || undefined;
    return fromFilename;
  }

  // Final fallback: use normalized AI ref or filename
  if (normalizedAiRef) return normalizedAiRef;
  return normalizeDocumentReference(filename, true);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://ivazen-saas.vercel.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Configuration
const CONFIG = {
  BATCH_SIZE: 15,
  PARALLEL_WORKERS: 5,
  MAX_RETRIES: 3,
  DELAY_BETWEEN_BATCHES_MS: 100,
  MAX_TOTAL_ITEMS: 200,
};

const EXTRACTION_PROMPT = `Analisa esta imagem de um documento fiscal português e extrai os dados em formato JSON.

=== DOCUMENTOS NÃO PROCESSÁVEIS ===

1. LISTAGENS E SCREENSHOTS DO PORTAL (REJEITAR):
Se o documento for uma LISTAGEM ou TABELA com múltiplos documentos:
- Título "Consultar Faturas e Recibos" ou similar
- Tabela com várias linhas de documentos
- "N.º de Resultados", "Pesquisar", menus do portal
- Screenshots de ecrã do portal AT

Neste caso, responde APENAS com:
{"not_invoice": true, "reason": "Listagem de documentos - não é uma factura individual", "confidence": 0}

2. DOCUMENTOS ANULADOS:
Se o documento contiver marcas visuais claras de anulação (carimbo "ANULADO", marca de água "CANCELADO",
riscos diagonais sobre todo o documento), devolve os dados extraídos normalmente MAS adiciona:
  "possibly_cancelled": true
  "cancellation_evidence": "descrição breve da evidência visual"

Se NÃO houver marcas visuais claras de anulação, NÃO coloques possibly_cancelled.
EXTRAI SEMPRE todos os campos financeiros independentemente de anulação.

3. CÓPIAS E SEGUNDAS VIAS (PROCESSAR NORMALMENTE):
⚠️ NÃO consideres como anulado:
- "Segunda Via", "2ª Via", "Duplicado"
- "Cópia", "Cópia certificada"
- "Reimpressão"

Estes são documentos VÁLIDOS - apenas cópias do original. Processa normalmente.

=== IDENTIFICAÇÃO DO PRESTADOR vs ADQUIRENTE (CRÍTICO) ===

Num recibo verde ou factura portuguesa existem SEMPRE dois intervenientes:
- TRANSMITENTE / PRESTADOR DE SERVIÇOS = quem emite o recibo e presta o serviço
- ADQUIRENTE = quem paga pelo serviço e retém o imposto

⚠️ REGRA ABSOLUTA:
- beneficiary_nif = NIF do TRANSMITENTE / PRESTADOR (quem recebe o rendimento)
- payer_nif = NIF do ADQUIRENTE (quem paga e retém imposto)
- NUNCA usar o NIF do adquirente como beneficiary_nif

Como distinguir nos documentos:
1. RECIBOS VERDES (Portal das Finanças):
   - Secção "TRANSMITENTE" ou "PRESTADOR DE SERVIÇOS" → beneficiary_nif, beneficiary_name
   - Secção "ADQUIRENTE" → payer_nif
   - O TRANSMITENTE é tipicamente uma pessoa singular (NIF começa por 1, 2 ou 3)
   - O ADQUIRENTE é tipicamente uma empresa (NIF começa por 5)

2. FATURAS/RECIBOS DE PRESTADORES:
   - O EMITENTE da factura = prestador → beneficiary_nif
   - O CLIENTE / DESTINATÁRIO = adquirente → payer_nif

3. RECIBOS DE RENDA:
   - O SENHORIO (proprietário) = prestador → beneficiary_nif
   - O INQUILINO = adquirente → payer_nif

=== RETENÇÃO NA FONTE: ZERO LEGÍTIMO vs ERRO ===

Alguns documentos têm legitimamente retenção = 0,00€. Isto NÃO é erro de extração.

Quando o documento diz EXPLICITAMENTE:
- "Sem retenção - Art.101º, n.º 1 do CIRS" (rendimentos < 15.000€/ano)
- "Sem retenção" com referência legal
- "Isento" ou "Dispensado de retenção" com base legal
- withholding_rate = 0% indicado no documento

Nestes casos, devolve:
  "withholding_rate": 0,
  "withholding_amount": 0,
  "withholding_status": "no_withholding_legal",
  "withholding_reason_text": "texto exacto do documento (ex: Sem retenção - Art.101º, n.º1 do CIRS)"

Se o documento tem taxa > 0% mas o valor de retenção parece 0 ou está em falta:
  "withholding_status": "withholding_expected",
  "withholding_reason_text": "taxa indicada mas valor não legível"

Se o documento simplesmente não menciona retenção:
  "withholding_status": "unknown"

=== ONDE ENCONTRAR OS VALORES ===

1. RECIBOS VERDES (Portal das Finanças - Categoria B):
   - Valor Bruto: "valor dos trabalhos" na 1ª linha
   - Retenção: "Retenção na fonte IRS" na penúltima linha
   - Base de Incidência: normalmente 100% do valor
   - Categoria: B (Trabalho Independente)

2. RECIBOS DE RENDA ELECTRÓNICOS (Portal das Finanças - Categoria F):
   - Valor Bruto: campo "Valor", "Renda" ou "Renda Mensal" no final
   - Retenção: campo "Retenção de IRS" ou "Retenção IRS" no final
   - Categoria: F (Rendimentos Prediais)

3. FATURAS/RECIBOS DE PRESTADORES (cartórios, mecânicos, serviços):
   - Valor Bruto: procurar "Renda", "Serviços", "Base", "Trabalhos", "Total", "Honorários", "Base de Incidência", "Base Tributável", "Valor Tributável", "Preço Unitário", "Subtotal", "Ilíquido", "GrossTotal"
   - Retenção: procurar "IRS", "Retenção", "Ret.", "Ret.Fonte", "Prediais", "Pred.", "IRC", "Imposto Retido", "Taxa Liberatória", "Ret. IRS", "Valor de Retenção"
   - Categoria: F se for renda/predial, B para restantes serviços

4. FATURAS DE SOFTWARE DE CONTABILIDADE (PHC, Primavera, Sage, Moloni, InvoiceXpress):
   - Valor Bruto: "Valor Ilíquido", "Ilíquido", "Base Trib.", "GrossTotal", "Valor antes de retenção"
   - Retenção: "Valor de Retenção de IRS", "Retenção Fonte", "Imposto Retido"
   - Valor Líquido: "Valor Final", "Total a Pagar", "Líquido após IRS"

5. DECLARAÇÃO DE RENDIMENTOS (Categoria E - Capitais):
   - Juros e dividendos têm taxa liberatória de 28%
   - Procurar "Juros", "Dividendos", "Rendimentos de Capitais"

=== TERMINOLOGIA PORTUGUESA (ATENÇÃO) ===
IMPORTANTE: A partir de 2024, o Portal das Finanças mudou terminologia:
- "Base" → "Ilíquido" (ambos significam BRUTO, valor SEM descontos)
- "Ilíquido" = valor ANTES da retenção = gross_amount
- "Líquido" = valor DEPOIS da retenção

=== REGRAS DE CÁLCULO (MUITO IMPORTANTE) ===
- gross_amount = valor ANTES de descontar retenção (pode aparecer como "Bruto", "Base", "Ilíquido", "Valor dos trabalhos")
- withholding_amount = imposto retido na fonte
- Valor Líquido = gross_amount - withholding_amount

Se APENAS tiver valor líquido ("importância recebida", "valor a receber"):
  gross_amount = valor_liquido / (1 - taxa_retencao)
  withholding_amount = gross_amount - valor_liquido

Exemplos de cálculo:
- Líquido 770€, taxa 23% → Bruto = 770/0.77 = 1000€, Retenção = 230€
- Líquido 750€, taxa 25% → Bruto = 750/0.75 = 1000€, Retenção = 250€
- Líquido 720€, taxa 28% → Bruto = 720/0.72 = 1000€, Retenção = 280€

=== SEPARADORES DECIMAIS PORTUGUESES (CRÍTICO) ===
Em documentos portugueses:
- O PONTO (.) é separador de MILHARES (ex: "1.234" = mil duzentos e trinta e quatro)
- A VÍRGULA (,) é separador DECIMAL (ex: "1.234,56" = 1234.56)

⚠️ ERROS COMUNS A EVITAR:
- "2.758,80" → gross_amount: 2758.80 (CORRECTO)
- "2.758,80" → gross_amount: 27588.0 (ERRADO! Não ignorar o ponto!)
- "23.456,45" → gross_amount: 23456.45 (CORRECTO)
- "23.456,45" → gross_amount: 234564.5 (ERRADO!)

VALIDAÇÃO: Para recibos verdes portugueses, valores brutos típicos são entre 100€ e 10.000€.
Valores acima de 10.000€ são RAROS e devem ser verificados duas vezes.
Se o gross_amount > 10.000 e a withholding_rate é 23%, confirma que leste os separadores correctamente.

=== TAXAS DE RETENÇÃO POR CATEGORIA ===
Categoria B (Trabalho Independente):
- 23% - Taxa geral (2025) para profissões do Art. 151º CIRS
- 25% - Taxa geral (2024 e anteriores)
- 11.5% - Atividades NÃO listadas na Portaria 1011/2001
- 16.5% - Propriedade intelectual/industrial
- 20% - Não residentes habituais

Categoria F (Rendimentos Prediais):
- 25% - Arrendamento habitacional
- 28% - Arrendamento comercial/não-habitacional

Categoria E (Capitais):
- 28% - Juros, dividendos, mais-valias (taxa liberatória)

Categoria R (IRC):
- Varia conforme tipo de rendimento

ISENTO (0%): Se rendimentos anuais < €15.000 (Art. 101º-B CIRS)

=== FORMATO JSON ===
{
  "beneficiary_nif": "NIF do TRANSMITENTE/PRESTADOR (9 dígitos) — NUNCA o NIF do adquirente",
  "beneficiary_name": "Nome do TRANSMITENTE/PRESTADOR",
  "beneficiary_address": "Morada do prestador (se visível)",
  "payer_nif": "NIF do ADQUIRENTE (9 dígitos)",
  "income_category": "B, F, E, H ou R",
  "gross_amount": número (ex: 1000.00),
  "exempt_amount": número (ex: 0.00),
  "dispensed_amount": número (ex: 0.00),
  "withholding_rate": percentagem (ex: 23, ou 0 se isento),
  "withholding_amount": número (ex: 230.00, ou 0 se isento),
  "withholding_status": "no_withholding_legal" | "withholding_expected" | "unknown",
  "withholding_reason_text": "texto exacto do documento sobre retenção (ex: Sem retenção - Art.101º, n.º1 do CIRS)",
  "payment_date": "YYYY-MM-DD",
  "document_reference": "número do documento",
  "confidence": 0-100
}

Responde APENAS com JSON válido.`;

// Types for queue items
interface QueueItem {
  id: string;
  file_data: string;
  file_name: string;
  client_id: string;
  user_id: string;
  retry_count: number;
  status: string;
  extracted_data?: Record<string, unknown> | null;
}

/**
 * SANITY CHECK: Detect catastrophic decimal errors ONLY.
 * Only auto-correct when there is STRONG arithmetic proof (gross*rate/100 ≈ wh within ±1€).
 * For smaller mismatches, mark NEEDS_REVIEW instead of auto-correcting.
 */
// deno-lint-ignore no-explicit-any
function applySanityChecks(data: Record<string, any>): { data: Record<string, any>; corrections: string[]; needsReview: boolean } {
  const corrections: string[] = [];
  let needsReview = false;
  let gross = Number(data.gross_amount) || 0;
  let wh = Number(data.withholding_amount) || 0;
  const rate = Number(data.withholding_rate) || 0;

  // Check 1: Gross suspiciously high (> 50,000€) — try scale correction with STRONG proof
  if (gross > 50000 && rate > 0) {
    for (const factor of [100, 1000]) {
      const grossFixed = gross / factor;
      const whFixed = wh / factor;
      const expectedWh = grossFixed * rate / 100;
      if (Math.abs(expectedWh - whFixed) < 1) {
        corrections.push(`CORRECÇÃO DECIMAL: gross ${gross} → ${grossFixed}, withholding ${wh} → ${whFixed} (erro escala ${factor}x)`);
        data.gross_amount = grossFixed;
        data.withholding_amount = whFixed;
        gross = grossFixed;
        wh = whFixed;
        break;
      }
    }
  }

  // Check 2: Arithmetic validation — gross * rate/100 ≈ withholding
  // Do NOT auto-correct; just flag for review if delta > 1€
  if (rate > 0 && gross > 0 && wh > 0) {
    const expectedWh = gross * rate / 100;
    const delta = Math.abs(expectedWh - wh);
    if (delta > 1) {
      corrections.push(`ALERTA ARITMÉTICO: esperado ${expectedWh.toFixed(2)}€ retenção, extraído ${wh.toFixed(2)}€ (delta ${delta.toFixed(2)}€)`);
      needsReview = true;
    }
  }

  return { data, corrections, needsReview };
}

// Calculate confidence based on extracted data
// deno-lint-ignore no-explicit-any
function calculateConfidence(data: Record<string, any>): { confidence: number; warnings: string[] } {
  const warnings: string[] = [];
  let confidence = 100;

  if (!data.beneficiary_nif || String(data.beneficiary_nif).length !== 9) {
    warnings.push('NIF inválido ou não encontrado');
    confidence -= 40;
  }

  if (!data.gross_amount || Number(data.gross_amount) <= 0) {
    warnings.push('Valor bruto não encontrado');
    confidence -= 30;
  }

  if (!data.payment_date) {
    warnings.push('Data de pagamento não encontrada');
    confidence -= 15;
  }

  if (!data.beneficiary_name) {
    warnings.push('Nome do beneficiário não encontrado');
    confidence -= 5;
  }

  if (!data.withholding_rate && Number(data.withholding_amount) > 0) {
    warnings.push('Taxa de retenção não identificada');
    confidence -= 5;
  }

  const validCategories = ['A', 'B', 'E', 'F', 'G', 'H', 'R'];
  if (!data.income_category || !validCategories.includes(String(data.income_category))) {
    warnings.push('Categoria de rendimento não identificada');
    confidence -= 10;
  }

  return { confidence: Math.max(0, confidence), warnings };
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// Process a single queue item
async function processItem(
  item: QueueItem,
  supabase: SupabaseClient,
  apiKey: string
): Promise<{ status: string; outcomeCode: string; error?: string }> {
  try {
    // Mark as processing
    await supabase
      .from('upload_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    // ── ALWAYS do fresh AI extraction (recovery path disabled by default) ──
    const fileData = item.file_data;
    if (!fileData) {
      throw new Error('No file data found');
    }

    const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-lite-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              { type: 'image_url', image_url: { url: fileData } }
            ]
          }
        ],
        max_tokens: 2048,
        reasoning_effort: 'high',
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        await supabase
          .from('upload_queue')
          .update({
            status: 'pending',
            started_at: null,
            retry_count: item.retry_count + 1,
            error_message: 'Rate limited - will retry'
          })
          .eq('id', item.id);
        return { status: 'rate_limited', outcomeCode: 'RATE_LIMITED' };
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON response using shared robust parser
    // Handles: markdown blocks, reasoning tokens, XML tags, multiple objects
    // deno-lint-ignore no-explicit-any
    const extractedData: Record<string, any> = parseJsonFromAI(content);

    // ── NOT_INVOICE ──
    if (extractedData.not_invoice === true) {
      await supabase
        .from('upload_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          extracted_data: extractedData,
          confidence: 0,
          warnings: ['Não é uma factura - ignorado automaticamente'],
          error_message: extractedData.reason || 'Documento não é uma factura individual',
          outcome_code: 'NOT_INVOICE',
        })
        .eq('id', item.id);
      return { status: 'completed', outcomeCode: 'NOT_INVOICE' };
    }

    // ── SKIPPED_CANCELLED ──
    // If AI returns possibly_cancelled WITH cancellation_evidence AND has valid data,
    // mark as SKIPPED_CANCELLED — do NOT insert into tax_withholdings
    if (extractedData.possibly_cancelled === true && extractedData.cancellation_evidence && extractedData.beneficiary_nif) {
      const rawRef = extractedData.document_reference || item.file_name;
      const isFileFallback = !extractedData.document_reference;
      const normRef = normalizeDocumentReference(String(rawRef), isFileFallback);
      await supabase
        .from('upload_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          extracted_data: extractedData,
          confidence: extractedData.confidence || 0,
          warnings: [`Documento anulado com evidência: ${extractedData.cancellation_evidence}`],
          error_message: null,
          outcome_code: 'SKIPPED_CANCELLED',
          normalized_doc_ref: normRef,
        })
        .eq('id', item.id);
      console.log(`[process-queue v${VERSION}] SKIPPED_CANCELLED: ${item.id} (${extractedData.cancellation_evidence})`);
      return { status: 'completed', outcomeCode: 'SKIPPED_CANCELLED' };
    }

    // ── No data extracted (anulado without NIF) ──
    if (!extractedData.beneficiary_nif && !extractedData.gross_amount) {
      await supabase
        .from('upload_queue')
        .update({
          status: 'needs_review',
          processed_at: new Date().toISOString(),
          extracted_data: extractedData,
          confidence: 0,
          warnings: ['AI não conseguiu extrair dados financeiros'],
          error_message: 'NEEDS_REVIEW: Dados insuficientes',
          outcome_code: 'NEEDS_REVIEW',
        })
        .eq('id', item.id);
      return { status: 'needs_review', outcomeCode: 'NEEDS_REVIEW' };
    }

    // ── SANITY CHECKS ──
    const { data: sanitizedData, corrections, needsReview: arithmeticNeedsReview } = applySanityChecks(extractedData);
    if (corrections.length > 0) {
      console.log(`[process-queue v${VERSION}] Sanity for ${item.id}:`, corrections);
      Object.assign(extractedData, sanitizedData);
    }

    // ── CONFIDENCE ──
    const { confidence, warnings } = calculateConfidence(extractedData);
    warnings.push(...corrections);

    const paymentYear = extractedData.payment_date 
      ? parseInt(String(extractedData.payment_date).split('-')[0]) 
      : new Date().getFullYear();

    const canSave = confidence > 0 && extractedData.beneficiary_nif && extractedData.gross_amount;

    // If arithmetic validation failed, mark as NEEDS_REVIEW — do NOT insert into tax_withholdings
    if (arithmeticNeedsReview && canSave) {
      const rawRef = extractedData.document_reference || item.file_name;
      const isFileFallback = !extractedData.document_reference;
      const normRef = normalizeDocumentReference(String(rawRef), isFileFallback);
      await supabase
        .from('upload_queue')
        .update({
          status: 'needs_review',
          processed_at: new Date().toISOString(),
          extracted_data: extractedData,
          confidence,
          warnings: [...warnings, '⚠️ Discrepância aritmética - requer revisão manual'],
          error_message: 'NEEDS_REVIEW: Falha validação aritmética',
          outcome_code: 'NEEDS_REVIEW',
          normalized_doc_ref: normRef,
          fiscal_year: paymentYear,
        })
        .eq('id', item.id);
      
      // NO upsert — accountant must review and manually approve
      console.log(`[process-queue v${VERSION}] NEEDS_REVIEW (no upsert): ${item.id} ref=${normRef}`);
      return { status: 'needs_review', outcomeCode: 'NEEDS_REVIEW' };
    }

    if (!canSave) {
      const rejectionReasons: string[] = [];
      if (confidence === 0) rejectionReasons.push('Falha na validação crítica');
      if (!extractedData.beneficiary_nif) rejectionReasons.push('NIF não encontrado');
      if (!extractedData.gross_amount) rejectionReasons.push('Valor bruto não encontrado');

      await supabase
        .from('upload_queue')
        .update({
          status: 'needs_review',
          processed_at: new Date().toISOString(),
          extracted_data: extractedData,
          confidence,
          warnings: [...warnings, `⚠️ NÃO guardado: ${rejectionReasons.join(', ')}`],
          error_message: `NEEDS_REVIEW: ${rejectionReasons.join(', ')}`,
          outcome_code: 'NEEDS_REVIEW',
        })
        .eq('id', item.id);
      return { status: 'needs_review', outcomeCode: 'NEEDS_REVIEW' };
    }

    // ── VALIDATION: adquirente NIF misattribution ──
    // Filename pattern: Recibo_Verde_{adquirenteNIF}_{type}_{series}_{num}_{id}.pdf
    const adquirenteMatch = item.file_name?.match(/Recibo_Verde_(\d{9})_/);
    const filenameAdquirenteNif = adquirenteMatch?.[1];

    // Cross-check: if AI returned payer_nif, verify it matches the filename adquirente
    if (filenameAdquirenteNif && extractedData.payer_nif && extractedData.payer_nif !== filenameAdquirenteNif) {
      warnings.push(`⚠️ payer_nif AI (${extractedData.payer_nif}) ≠ adquirente filename (${filenameAdquirenteNif})`);
    }

    // Auto-correct: if AI set beneficiary_nif = adquirente and also returned a different payer_nif,
    // the payer_nif is likely the correct beneficiary (role swap)
    if (filenameAdquirenteNif && extractedData.beneficiary_nif === filenameAdquirenteNif) {
      // Check if AI also returned a payer_nif that's different — if so, they're swapped
      if (extractedData.payer_nif && extractedData.payer_nif !== filenameAdquirenteNif) {
        console.log(`[process-queue v${VERSION}] AUTO-FIX role swap: beneficiary ${extractedData.beneficiary_nif} → ${extractedData.payer_nif}`);
        const realBeneficiary = extractedData.payer_nif;
        extractedData.payer_nif = extractedData.beneficiary_nif;
        extractedData.beneficiary_nif = realBeneficiary;
        // Swap names too if available
        if (extractedData.beneficiary_name && extractedData.payer_name) {
          const tmpName = extractedData.beneficiary_name;
          extractedData.beneficiary_name = extractedData.payer_name;
          extractedData.payer_name = tmpName;
        }
        warnings.push('🔄 Corrigido automaticamente: NIF beneficiário/adquirente estavam trocados');
      } else {
        // No payer_nif to swap with — flag for review
        const normRef = resolveCanonicalReference(extractedData, item.file_name);
        console.log(`[process-queue v${VERSION}] NEEDS_REVIEW: beneficiary_nif=${extractedData.beneficiary_nif} matches adquirente from filename`);
        await supabase.from('upload_queue').update({
          status: 'needs_review',
          processed_at: new Date().toISOString(),
          extracted_data: extractedData,
          confidence,
          warnings: [...warnings, '⚠️ NIF do beneficiário igual ao NIF do adquirente no ficheiro — provável erro de extração'],
          error_message: 'NEEDS_REVIEW: beneficiary_nif = adquirente NIF (role confusion)',
          outcome_code: 'NEEDS_REVIEW',
          normalized_doc_ref: normRef,
          fiscal_year: paymentYear,
        }).eq('id', item.id);
        return { status: 'needs_review', outcomeCode: 'NEEDS_REVIEW' };
      }
    }

    // ── VALIDATION: withholding_amount = 0 with positive base ──
    // Skip if: exempt, cancelled, or AI confirmed legal zero withholding with textual evidence
    // NOTE: withholding_rate=0 alone is NOT sufficient — requires withholding_status="no_withholding_legal"
    const isFullyExempt = extractedData.exempt_amount && extractedData.exempt_amount >= extractedData.gross_amount;
    const isCancelled = extractedData.possibly_cancelled === true;
    const isLegalZeroWithholding = extractedData.withholding_status === 'no_withholding_legal';
    if (extractedData.gross_amount > 0 && (!extractedData.withholding_amount || extractedData.withholding_amount === 0) && !isFullyExempt && !isCancelled && !isLegalZeroWithholding) {
      const normRef = resolveCanonicalReference(extractedData, item.file_name);
      console.log(`[process-queue v${VERSION}] NEEDS_REVIEW: gross_amount=${extractedData.gross_amount} but withholding_amount=0`);
      await supabase.from('upload_queue').update({
        status: 'needs_review',
        processed_at: new Date().toISOString(),
        extracted_data: extractedData,
        confidence,
        warnings: [...warnings, '⚠️ Valor bruto > 0 mas retenção = 0 — verificar se o documento tem retenção IRS'],
        error_message: 'NEEDS_REVIEW: gross_amount > 0 but withholding_amount = 0',
        outcome_code: 'NEEDS_REVIEW',
        normalized_doc_ref: normRef,
        fiscal_year: paymentYear,
      }).eq('id', item.id);
      return { status: 'needs_review', outcomeCode: 'NEEDS_REVIEW' };
    }

    // Log legal zero withholding acceptance
    if (isLegalZeroWithholding) {
      console.log(`[process-queue v${VERSION}] LEGAL ZERO WITHHOLDING accepted: ${item.id} nif=${extractedData.beneficiary_nif} reason="${extractedData.withholding_reason_text || 'n/a'}"`);
    }

    // ── DEDUPE CHECK (with client_id) ──
    const targetClientId = item.client_id || item.user_id;
    const docReference = resolveCanonicalReference(extractedData, item.file_name);

    console.log(`[process-queue v${VERSION}] Canonical ref: "${extractedData.document_reference || item.file_name}" → "${docReference}"`);

    const { data: existingRecord } = await supabase
      .from('tax_withholdings')
      .select('id, document_reference')
      .eq('client_id', targetClientId)
      .eq('beneficiary_nif', extractedData.beneficiary_nif)
      .eq('document_reference', docReference)
      .eq('fiscal_year', paymentYear)
      .maybeSingle();

    if (existingRecord) {
      // ── SKIPPED_DUPLICATE ──
      await supabase
        .from('upload_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          extracted_data: extractedData,
          confidence,
          warnings: [...warnings, `Duplicado semântico de ${docReference} (NIF ${extractedData.beneficiary_nif})`],
          error_message: null,
          outcome_code: 'SKIPPED_DUPLICATE',
          normalized_doc_ref: docReference,
          fiscal_year: paymentYear,
        })
        .eq('id', item.id);
      console.log(`[process-queue v${VERSION}] SKIPPED_DUPLICATE: ${item.id} → ${docReference}`);
      return { status: 'completed', outcomeCode: 'SKIPPED_DUPLICATE' };
    }

    // ── UPSERT (SAVED) ──
    await upsertWithholding(supabase, extractedData, targetClientId, docReference, paymentYear);

    // ── GUARDRAIL: verify the TW was actually persisted ──
    const { data: verifyTw } = await supabase
      .from('tax_withholdings')
      .select('id')
      .eq('client_id', targetClientId)
      .eq('beneficiary_nif', extractedData.beneficiary_nif)
      .eq('document_reference', docReference)
      .eq('fiscal_year', paymentYear)
      .maybeSingle();

    if (!verifyTw) {
      // Upsert silently skipped or failed — do NOT mark as SAVED
      console.error(`[process-queue v${VERSION}] GUARDRAIL: upsert completed but TW not found! item=${item.id} ref=${docReference} nif=${extractedData.beneficiary_nif}`);
      await supabase
        .from('upload_queue')
        .update({
          status: 'needs_review',
          processed_at: new Date().toISOString(),
          extracted_data: extractedData,
          confidence,
          warnings: [...warnings, '⚠️ GUARDRAIL: upsert executado mas tax_withholding não encontrado — possível conflito de deduplicação'],
          error_message: 'NEEDS_REVIEW: SAVED guardrail failed — TW not persisted',
          outcome_code: 'NEEDS_REVIEW',
          normalized_doc_ref: docReference,
          fiscal_year: paymentYear,
        })
        .eq('id', item.id);
      return { status: 'needs_review', outcomeCode: 'NEEDS_REVIEW' };
    }

    await supabase
      .from('upload_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        extracted_data: extractedData,
        confidence,
        warnings: warnings.length > 0 ? warnings : null,
        error_message: null,
        outcome_code: 'SAVED',
        normalized_doc_ref: docReference,
        fiscal_year: paymentYear,
      })
      .eq('id', item.id);

    return { status: 'completed', outcomeCode: 'SAVED' };

  } catch (error: unknown) {
    console.error(`Error processing item ${item.id}:`, error);

    const newRetryCount = item.retry_count + 1;
    const isFinalFailure = newRetryCount >= CONFIG.MAX_RETRIES;

    await supabase
      .from('upload_queue')
      .update({
        status: isFinalFailure ? 'failed' : 'pending',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        processed_at: isFinalFailure ? new Date().toISOString() : null,
        started_at: null,
        retry_count: newRetryCount,
        outcome_code: isFinalFailure ? 'FAILED' : null,
      })
      .eq('id', item.id);

    return { 
      status: isFinalFailure ? 'failed' : 'pending', 
      outcomeCode: isFinalFailure ? 'FAILED' : 'PENDING',
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// deno-lint-ignore no-explicit-any
async function upsertWithholding(supabase: SupabaseClient, data: Record<string, any>, clientId: string, docReference: string, fiscalYear: number) {
  const { error: upsertError } = await supabase
    .from('tax_withholdings')
    .upsert(
      {
        client_id: clientId,
        beneficiary_nif: data.beneficiary_nif,
        beneficiary_name: data.beneficiary_name || null,
        beneficiary_address: data.beneficiary_address || null,
        income_category: data.income_category || 'B',
        gross_amount: data.gross_amount,
        exempt_amount: data.exempt_amount || 0,
        dispensed_amount: data.dispensed_amount || 0,
        withholding_rate: data.withholding_rate || null,
        withholding_amount: data.withholding_amount || 0,
        payment_date: data.payment_date || new Date().toISOString().split('T')[0],
        document_reference: docReference,
        fiscal_year: fiscalYear,
        location_code: 'C',
        status: 'draft',
        import_source: 'ocr',
        payer_nif: data.payer_nif || null,
        withholding_reason_text: data.withholding_reason_text || null,
        withholding_semantic_status: data.withholding_status || null,
      },
      {
        onConflict: 'client_id,beneficiary_nif,document_reference,fiscal_year',
        ignoreDuplicates: true,
      }
    );

  if (upsertError) {
    throw new Error(`Upsert failed: ${upsertError.message}`);
  }
}

// Helper to chunk array into groups
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Background processing function with PARALLEL execution
async function processQueueInBackground(
  supabase: SupabaseClient,
  apiKey: string
): Promise<void> {
  console.log(`[process-queue v${VERSION}] Starting PARALLEL background processing (${CONFIG.PARALLEL_WORKERS} workers)...`);
  
  // Auto-recover stuck items (processing for more than 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: stuckItems, error: stuckError } = await supabase
    .from('upload_queue')
    .update({ status: 'pending', started_at: null })
    .eq('status', 'processing')
    .lt('started_at', fiveMinutesAgo)
    .select('id');
  
  if (!stuckError && stuckItems && stuckItems.length > 0) {
    console.log(`[process-queue v${VERSION}] Recovered ${stuckItems.length} stuck items`);
  }
  
  const results = {
    processed: 0,
    saved: 0,
    duplicates: 0,
    cancelled: 0,
    needsReview: 0,
    failed: 0,
    rateLimited: 0,
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  let totalProcessed = 0;
  let consecutiveRateLimits = 0;
  const startTime = Date.now();

  while (totalProcessed < CONFIG.MAX_TOTAL_ITEMS) {
    const { data: pendingItems, error: fetchError } = await supabase
      .from('upload_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(CONFIG.BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching queue:', fetchError);
      break;
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log('No more pending items');
      break;
    }

    console.log(`Processing batch of ${pendingItems.length} items (total so far: ${totalProcessed})`);

    const chunks = chunkArray(pendingItems as QueueItem[], CONFIG.PARALLEL_WORKERS);
    
    for (const chunk of chunks) {
      if (consecutiveRateLimits >= 5) {
        console.log('Too many rate limits, stopping');
        break;
      }

      const chunkResults = await Promise.all(
        chunk.map(item => processItem(item, supabase, apiKey))
      );

      let rateLimitedInChunk = 0;
      for (const result of chunkResults) {
        if (result.status === 'rate_limited') {
          rateLimitedInChunk++;
          results.rateLimited++;
        } else {
          switch (result.outcomeCode) {
            case 'SAVED': results.saved++; break;
            case 'SKIPPED_DUPLICATE': results.duplicates++; break;
            case 'SKIPPED_CANCELLED': results.cancelled++; break;
            case 'NEEDS_REVIEW': results.needsReview++; break;
            case 'FAILED': results.failed++; break;
          }
        }
        results.processed++;
        totalProcessed++;
      }

      if (rateLimitedInChunk >= chunk.length / 2) {
        consecutiveRateLimits++;
        await delay(2000);
      } else {
        consecutiveRateLimits = 0;
      }

      await delay(CONFIG.DELAY_BETWEEN_BATCHES_MS);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[process-queue v${VERSION}] Complete in ${elapsed}s:`, results);
}

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

// Main serve handler
Deno.serve(async (req) => {
  console.log(`[process-queue v${VERSION}] Request received: ${req.method}`);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Accept both user JWT and service-role token (consistent with other edge functions)
    const token = extractBearerToken(authHeader);
    const isServiceRole = isConfiguredServiceRoleToken(token);

    if (!isServiceRole) {
      const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });

      const { data: { user }, error: authError } = await userSupabase.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      throw new Error('AI_API_KEY not configured');
    }

    const { count: pendingCount } = await supabase
      .from('upload_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const jobId = crypto.randomUUID();

    const processingPromise = processQueueInBackground(supabase, AI_API_KEY);
    
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(processingPromise);
    } else {
      processingPromise.catch(err => console.error('Background processing error:', err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        status: 'processing',
        pending_count: pendingCount || 0,
        message: 'Processamento iniciado em background',
        version: VERSION,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error(`[process-queue v${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        version: VERSION,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
