import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const CONFIG = {
  BATCH_SIZE: 50,           // Process 50 items per batch
  MAX_RETRIES: 3,           // Max retry attempts per item
  DELAY_BETWEEN_ITEMS_MS: 200, // Small delay to avoid rate limits
  MAX_TOTAL_ITEMS: 500,     // Safety limit per invocation
};

const EXTRACTION_PROMPT = `Analisa esta imagem de um documento fiscal português e extrai os dados em formato JSON.

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
   - Valor Bruto: procurar "Renda", "Serviços", "Base", "Trabalhos", "Total", "Honorários", "Base de Incidência", "Base Tributável", "Valor Tributável", "Preço Unitário", "Subtotal"
   - Retenção: procurar "IRS", "Retenção", "Ret.", "Ret.Fonte", "Prediais", "Pred.", "IRC", "Imposto Retido", "Taxa Liberatória", "Ret. IRS"
   - Categoria: F se for renda/predial, B para restantes serviços

4. DECLARAÇÃO DE RENDIMENTOS (Categoria E - Capitais):
   - Juros e dividendos têm taxa liberatória de 28%
   - Procurar "Juros", "Dividendos", "Rendimentos de Capitais"

=== REGRAS DE CÁLCULO (MUITO IMPORTANTE) ===
- gross_amount = valor ANTES de descontar retenção (Valor Bruto/Ilíquido)
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for background processing
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const results = {
      processed: 0,
      completed: 0,
      failed: 0,
      rateLimited: 0,
      items: [] as { id: string; status: string; error?: string }[]
    };

    // Helper function for delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Process items in batches until none remain (or safety limit reached)
    let totalProcessed = 0;
    let consecutiveRateLimits = 0;

    while (totalProcessed < CONFIG.MAX_TOTAL_ITEMS) {
      // Get next batch of pending items
      const { data: pendingItems, error: fetchError } = await supabase
        .from('upload_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(CONFIG.BATCH_SIZE);

      if (fetchError) {
        console.error('Error fetching queue:', fetchError);
        throw fetchError;
      }

      if (!pendingItems || pendingItems.length === 0) {
        console.log('No more pending items in queue');
        break;
      }

      console.log(`Processing batch of ${pendingItems.length} items (total so far: ${totalProcessed})`);

      // Process each item in this batch
      for (const item of pendingItems) {
        // Check if we hit too many rate limits in a row
        if (consecutiveRateLimits >= 3) {
          console.log('Too many consecutive rate limits, stopping to avoid API issues');
          return new Response(
            JSON.stringify({
              ...results,
              message: 'Paused due to rate limiting - remaining items will be processed on next invocation',
              remainingItems: pendingItems.length - results.items.length
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Mark as processing with started_at
          await supabase
          .from('upload_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // file_data already contains base64 data URL (data:mime;base64,...)
        const fileData = item.file_data;
        
        if (!fileData) {
          throw new Error('No file data found');
        }

        // Determine mime type from data URL or default to PDF
        let mimeType = 'application/pdf';
        if (fileData.startsWith('data:')) {
          const match = fileData.match(/^data:([^;]+);/);
          if (match) {
            mimeType = match[1];
          }
        }

        // Call AI for extraction
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
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
            // Rate limited - put back to pending for retry
            consecutiveRateLimits++;
            results.rateLimited++;

            await supabase
              .from('upload_queue')
              .update({
                status: 'pending',
                started_at: null,
                retry_count: item.retry_count + 1,
                error_message: 'Rate limited - will retry'
              })
              .eq('id', item.id);

            results.items.push({ id: item.id, status: 'rate_limited' });

            // Wait longer when rate limited
            await delay(2000);
            continue;
          }
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        // Success - reset rate limit counter
        consecutiveRateLimits = 0;

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

        // Calculate confidence and warnings
        const { confidence, warnings } = calculateConfidence(extractedData);

        // Get fiscal year from payment date or default
        const paymentYear = extractedData.payment_date 
          ? parseInt(extractedData.payment_date.split('-')[0]) 
          : new Date().getFullYear();

        // Update queue item as completed with extracted data
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

        // If valid data, create tax_withholding record
        // Use client_id if available (for accountant workflow), otherwise fall back to user_id
        const targetClientId = item.client_id || item.user_id;
        if (confidence > 0 && extractedData.beneficiary_nif && extractedData.gross_amount) {
          const { error: insertError } = await supabase
            .from('tax_withholdings')
            .insert({
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
              document_reference: extractedData.document_reference || item.file_name,
              fiscal_year: paymentYear,
              location_code: 'C',
              status: 'draft',
            });

          if (insertError) {
            console.error(`Error inserting withholding for ${item.id}:`, insertError);
            // Don't fail the whole item, just log
          }
        }

        results.completed++;
        results.items.push({ id: item.id, status: 'completed' });

        // Small delay between items to avoid rate limits
        await delay(CONFIG.DELAY_BETWEEN_ITEMS_MS);

      } catch (error: unknown) {
        console.error(`Error processing item ${item.id}:`, error);

        // Check if max retries reached
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

        if (isFinalFailure) {
          results.failed++;
        }
        results.items.push({ 
          id: item.id, 
          status: isFinalFailure ? 'failed' : 'retry', 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

        results.processed++;
        totalProcessed++;
      }

      console.log(`Batch complete: ${results.completed} completed, ${results.failed} failed, ${results.rateLimited} rate-limited`);
    }

    console.log(`All processing complete: ${results.completed} completed, ${results.failed} failed out of ${totalProcessed} total`);

    return new Response(
      JSON.stringify({
        ...results,
        message: totalProcessed >= CONFIG.MAX_TOTAL_ITEMS
          ? `Reached safety limit of ${CONFIG.MAX_TOTAL_ITEMS} items`
          : 'All items processed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in process-queue function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Validate Portuguese NIF checksum
function validatePortugueseNIF(nif: string): boolean {
  if (!nif || nif.length !== 9) return false;

  const digits = nif.split('').map(Number);
  if (digits.some(isNaN)) return false;

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * (9 - i);
  }

  const checkDigit = 11 - (sum % 11);
  const expectedCheck = checkDigit >= 10 ? 0 : checkDigit;

  return digits[8] === expectedCheck;
}

// Calculate confidence score
function calculateConfidence(data: Record<string, unknown>): { confidence: number; warnings: string[] } {
  let confidence = 1.0;
  const warnings: string[] = [];

  const beneficiaryNif = data.beneficiary_nif as string | undefined;
  const grossAmount = data.gross_amount as number | undefined;
  const withholdingAmount = data.withholding_amount as number | undefined;
  const beneficiaryName = data.beneficiary_name as string | undefined;
  const paymentDate = data.payment_date as string | undefined;
  const incomeCategory = data.income_category as string | undefined;

  // Critical validations
  if (!beneficiaryNif) {
    confidence = 0;
    warnings.push('NIF não encontrado');
    return { confidence, warnings };
  }

  if (!validatePortugueseNIF(beneficiaryNif)) {
    confidence = 0;
    warnings.push('NIF inválido');
    return { confidence, warnings };
  }

  if (!grossAmount || grossAmount <= 0) {
    confidence = 0;
    warnings.push('Valor bruto inválido');
    return { confidence, warnings };
  }

  if (withholdingAmount && withholdingAmount > grossAmount) {
    confidence = 0;
    warnings.push('Retenção maior que valor bruto');
    return { confidence, warnings };
  }

  // Informative validations
  if (!beneficiaryName || beneficiaryName.trim().length < 3) {
    confidence *= 0.95;
    warnings.push('Nome do beneficiário não encontrado');
  }

  if (!paymentDate) {
    confidence *= 0.90;
    warnings.push('Data de pagamento não encontrada');
  }

  const validCategories = ['A', 'B', 'E', 'F', 'G', 'H', 'R'];
  if (!incomeCategory || !validCategories.includes(incomeCategory)) {
    confidence *= 0.88;
    warnings.push('Categoria de rendimento não identificada');
  }

  return { confidence, warnings };
}
