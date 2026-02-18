import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const VERSION = '4.1.1'; // Parallel processing + duplicate prevention + CORS fix

// Normalize document reference to prevent duplicates from prefix/suffix variations
function normalizeDocumentReference(ref: string): string {
  if (!ref) return ref;
  
  // Remove common Portuguese document type prefixes
  // FR = Fatura/Recibo, FT = Fatura, RG = Recibo, NC = Nota de Crédito, ND = Nota de Débito
  const prefixes = ['FR ', 'FT ', 'RG ', 'NC ', 'ND ', 'R ', 'F '];
  let normalized = ref.trim();
  
  for (const prefix of prefixes) {
    if (normalized.toUpperCase().startsWith(prefix)) {
      normalized = normalized.substring(prefix.length);
      break;
    }
  }
  
  // Remove copy suffixes like -1, -2 (indicating duplicate uploads)
  normalized = normalized.replace(/-\d+$/, '');
  
  return normalized.trim();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Configuration - OPTIMIZED for parallel processing
const CONFIG = {
  BATCH_SIZE: 15,             // Items to fetch per batch
  PARALLEL_WORKERS: 5,        // Process 5 items concurrently (major speedup!)
  MAX_RETRIES: 3,             // Max retry attempts per item
  DELAY_BETWEEN_BATCHES_MS: 100, // Small delay between parallel batches
  MAX_TOTAL_ITEMS: 200,       // Safety limit per invocation
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

2. DOCUMENTOS ANULADOS (REJEITAR):
Se o documento tiver indicação de estar anulado, cancelado ou revogado:
- Marca de água "ANULADO", "CANCELADO", "REVOGADO"
- Campo "Estado" ou "Status" com valor "Anulado"
- Carimbo ou texto "ANULADO" em qualquer parte
- Documento riscado ou com indicação de anulação

Neste caso, responde APENAS com:
{"anulado": true, "confidence": 100}

3. CÓPIAS E SEGUNDAS VIAS (PROCESSAR NORMALMENTE):
⚠️ NÃO consideres como anulado:
- "Segunda Via", "2ª Via", "Duplicado"
- "Cópia", "Cópia certificada"
- "Reimpressão"

Estes são documentos VÁLIDOS - apenas cópias do original. Processa normalmente.

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
  "beneficiary_nif": "NIF do prestador (9 dígitos)",
  "beneficiary_name": "Nome do prestador",
  "beneficiary_address": "Morada (se visível)",
  "income_category": "B, F, E, H ou R",
  "gross_amount": número (ex: 1000.00),
  "exempt_amount": número (ex: 0.00),
  "dispensed_amount": número (ex: 0.00),
  "withholding_rate": percentagem (ex: 23),
  "withholding_amount": número (ex: 230.00),
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
}

// Calculate confidence based on extracted data
// deno-lint-ignore no-explicit-any
function calculateConfidence(data: Record<string, any>): { confidence: number; warnings: string[] } {
  const warnings: string[] = [];
  let confidence = 100;

  // Required fields
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

  // Optional but recommended fields
  if (!data.beneficiary_name) {
    warnings.push('Nome do beneficiário não encontrado');
    confidence -= 5;
  }

  if (!data.withholding_rate && Number(data.withholding_amount) > 0) {
    warnings.push('Taxa de retenção não identificada');
    confidence -= 5;
  }

  // Category validation
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
): Promise<{ status: string; error?: string }> {
  try {
    // Mark as processing
    await supabase
      .from('upload_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    const fileData = item.file_data;
    if (!fileData) {
      throw new Error('No file data found');
    }

    // Call AI for extraction
    const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              { type: 'image_url', image_url: { url: fileData } }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        // Rate limited - put back to pending
        await supabase
          .from('upload_queue')
          .update({
            status: 'pending',
            started_at: null,
            retry_count: item.retry_count + 1,
            error_message: 'Rate limited - will retry'
          })
          .eq('id', item.id);
        return { status: 'rate_limited' };
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON response
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const extractedData = JSON.parse(jsonStr);

    // Check if document is not a valid invoice
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
        })
        .eq('id', item.id);
      return { status: 'completed', error: 'Não é factura' };
    }

    // Check if document was cancelled
    if (extractedData.anulado === true) {
      await supabase
        .from('upload_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          extracted_data: extractedData,
          confidence: 0,
          warnings: ['Documento anulado - ignorado automaticamente'],
          error_message: 'Documento anulado',
        })
        .eq('id', item.id);
      return { status: 'completed', error: 'Documento anulado' };
    }

    // Calculate confidence and warnings
    const { confidence, warnings } = calculateConfidence(extractedData);

    // Get fiscal year
    const paymentYear = extractedData.payment_date 
      ? parseInt(extractedData.payment_date.split('-')[0]) 
      : new Date().getFullYear();

    // Update queue item
    await supabase
      .from('upload_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        extracted_data: extractedData,
        confidence: confidence,
        warnings: warnings,
        fiscal_year: paymentYear,
        error_message: null,
      })
      .eq('id', item.id);

    // Create tax_withholding if valid
    const targetClientId = item.client_id || item.user_id;
    const canSave = confidence > 0 && extractedData.beneficiary_nif && extractedData.gross_amount;

    if (canSave) {
      // NORMALIZE document reference to prevent duplicates from prefix variations
      const rawReference = extractedData.document_reference || item.file_name;
      const docReference = normalizeDocumentReference(rawReference);
      
      console.log(`[process-queue] Normalized ref: "${rawReference}" → "${docReference}"`);
      
      // Check for semantic duplicate (same NIF + date + similar amount)
      // This catches duplicates even when document references are completely different
      const { data: existingByContent } = await supabase
        .from('tax_withholdings')
        .select('id, document_reference, gross_amount')
        .eq('client_id', targetClientId)
        .eq('beneficiary_nif', extractedData.beneficiary_nif)
        .eq('payment_date', extractedData.payment_date)
        .eq('fiscal_year', paymentYear)
        .maybeSingle();

      if (existingByContent) {
        // Check if amounts match (within 1€ tolerance for rounding differences)
        const amountDiff = Math.abs(
          Number(existingByContent.gross_amount) - Number(extractedData.gross_amount)
        );
        
        if (amountDiff < 1) {
          console.log(`[process-queue] Semantic duplicate found: ${existingByContent.document_reference} ≈ ${docReference}`);
          
          // Update queue item as skipped
          await supabase
            .from('upload_queue')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString(),
              warnings: [...warnings, `Documento duplicado detectado - já existe registo com mesma data/valor (ref: ${existingByContent.document_reference})`],
              error_message: 'Duplicado semântico - ignorado',
            })
            .eq('id', item.id);
          
          return { status: 'completed', error: 'Duplicado semântico' };
        }
      }
      
      const { error: upsertError } = await supabase
        .from('tax_withholdings')
        .upsert(
          {
            client_id: targetClientId,
            beneficiary_nif: extractedData.beneficiary_nif,
            beneficiary_name: extractedData.beneficiary_name || null,
            beneficiary_address: extractedData.beneficiary_address || null,
            income_category: extractedData.income_category || 'B',
            gross_amount: extractedData.gross_amount,
            exempt_amount: extractedData.exempt_amount || 0,
            dispensed_amount: extractedData.dispensed_amount || 0,
            withholding_rate: extractedData.withholding_rate || null,
            withholding_amount: extractedData.withholding_amount || 0,
            payment_date: extractedData.payment_date || new Date().toISOString().split('T')[0],
            document_reference: docReference,
            fiscal_year: paymentYear,
            location_code: 'C',
            status: 'draft',
          },
          {
            onConflict: 'beneficiary_nif,document_reference,fiscal_year',
            ignoreDuplicates: false,
          }
        );

      if (upsertError) {
        console.error(`Error upserting withholding for ${item.id}:`, upsertError);
        throw new Error(`Upsert failed: ${upsertError.message}`);
      }

      return { status: 'completed' };
    } else {
      // Document processed but NOT saved
      const rejectionReasons: string[] = [];
      if (confidence === 0) rejectionReasons.push('Falha na validação crítica');
      if (!extractedData.beneficiary_nif) rejectionReasons.push('NIF do beneficiário não encontrado');
      if (!extractedData.gross_amount) rejectionReasons.push('Valor bruto não encontrado ou inválido');

      await supabase
        .from('upload_queue')
        .update({
          status: 'needs_review',
          error_message: `Documento processado mas NÃO guardado: ${rejectionReasons.join(', ')}`,
          warnings: [...warnings, `⚠️ ATENÇÃO: Este documento NÃO foi guardado no Modelo 10 porque: ${rejectionReasons.join(', ')}`],
        })
        .eq('id', item.id);

      return { status: 'needs_review', error: rejectionReasons.join(', ') };
    }
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
      })
      .eq('id', item.id);

    return { 
      status: isFinalFailure ? 'failed' : 'pending', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
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
    completed: 0,
    failed: 0,
    rateLimited: 0,
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  let totalProcessed = 0;
  let consecutiveRateLimits = 0;
  const startTime = Date.now();

  while (totalProcessed < CONFIG.MAX_TOTAL_ITEMS) {
    // Get next batch
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

    console.log(`Processing batch of ${pendingItems.length} items in parallel (total so far: ${totalProcessed})`);

    // Split into parallel chunks
    const chunks = chunkArray(pendingItems as QueueItem[], CONFIG.PARALLEL_WORKERS);
    
    for (const chunk of chunks) {
      if (consecutiveRateLimits >= 5) {
        console.log('Too many rate limits, stopping');
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[process-queue v${VERSION}] Stopped after ${elapsed}s:`, results);
        return;
      }

      // Process chunk items IN PARALLEL
      const chunkResults = await Promise.all(
        chunk.map(item => processItem(item, supabase, apiKey))
      );

      // Aggregate results
      let rateLimitedInChunk = 0;
      for (const result of chunkResults) {
        if (result.status === 'rate_limited') {
          rateLimitedInChunk++;
          results.rateLimited++;
        } else if (result.status === 'completed' || result.status === 'needs_review') {
          results.completed++;
        } else if (result.status === 'failed') {
          results.failed++;
        }
        results.processed++;
        totalProcessed++;
      }

      // If most of the chunk was rate limited, back off
      if (rateLimitedInChunk >= chunk.length / 2) {
        consecutiveRateLimits++;
        await delay(2000);
      } else {
        consecutiveRateLimits = 0;
      }

      // Small delay between parallel batches
      await delay(CONFIG.DELAY_BETWEEN_BATCHES_MS);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[process-queue v${VERSION}] Parallel processing complete in ${elapsed}s:`, results);
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
    // Require auth (preflight OPTIONS has no auth, so verify_jwt is disabled in config.toml)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize backend clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user identity using the provided JWT
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

    // Service client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      throw new Error('AI_API_KEY not configured');
    }

    // Get count of pending items for the response
    const { count: pendingCount } = await supabase
      .from('upload_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Generate job ID
    const jobId = crypto.randomUUID();

    // Start background processing using EdgeRuntime.waitUntil
    // This allows the response to return immediately while processing continues
    const processingPromise = processQueueInBackground(supabase, AI_API_KEY);
    
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(processingPromise);
      console.log(`[process-queue v${VERSION}] Background processing started via waitUntil`);
    } else {
      // Fallback: Just start the promise (but response may timeout)
      console.log(`[process-queue v${VERSION}] EdgeRuntime.waitUntil not available, using fallback`);
      processingPromise.catch(err => console.error('Background processing error:', err));
    }

    // Return immediately with job info
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
