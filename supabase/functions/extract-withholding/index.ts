import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VERSION = '2.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXTRACTION_PROMPT = `Analisa esta imagem de um recibo ou documento fiscal português e extrai os seguintes dados em formato JSON.

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

=== REGRA CRÍTICA PARA FATURAS (NÃO RECIBOS VERDES) ===

⚠️ MUITO IMPORTANTE para FATURAS de prestadores de serviços:
- O "gross_amount" (rendimento bruto) deve ser O VALOR SOBRE O QUAL INCIDE A RETENÇÃO
- NÃO usar o valor total da fatura (que inclui IVA e outros itens)
- Se a retenção é X% de Y, então gross_amount = Y

VALIDAÇÃO ARITMÉTICA OBRIGATÓRIA:
gross_amount × (withholding_rate / 100) ≈ withholding_amount (tolerância 1€)

Exemplo CORRECTO:
- Fatura total: 2.401,62€
- Retenção indicada: 66,70€ a 11,5%
- gross_amount CORRECTO: 580€ (porque 580 × 11.5% = 66,70)
- gross_amount ERRADO: 2.401,62€ (seria 276€ de retenção, não 66,70€!)

Se não conseguires calcular o gross_amount correctamente:
1. Procura campos como "Base de incidência", "Base tributável", "Valor sujeito a retenção"
2. Se só tens a retenção e a taxa: gross_amount = withholding_amount / (withholding_rate / 100)
3. Exemplo: retenção 66,70€ a 11,5% → gross = 66,70 / 0,115 = 580€

=== FORMATO DE EXTRAÇÃO ===
{
  "beneficiary_nif": "NIF do beneficiário (quem recebeu o pagamento) - 9 dígitos",
  "beneficiary_name": "Nome do beneficiário",
  "beneficiary_address": "Morada do beneficiário (se visível)",
  "income_category": "A, B, E, F, G, H ou R - vê categorias abaixo",
  "gross_amount": número decimal do valor bruto SUJEITO A RETENÇÃO (ex: 1000.00),
  "exempt_amount": número decimal de rendimentos isentos (ex: 0.00) - valor isento de retenção,
  "dispensed_amount": número decimal de rendimentos dispensados de retenção (ex: 0.00),
  "withholding_rate": taxa de retenção em percentagem (ex: 25 para 25%),
  "withholding_amount": valor retido na fonte em decimal,
  "payment_date": "data no formato YYYY-MM-DD",
  "document_reference": "número do documento/recibo (SEM prefixos FR, FT, RG)",
  "confidence": número de 0 a 100 indicando confiança na extracção
}

Categorias de Rendimento (MODELO 10):
- A: Trabalho Dependente (salários, ordenados, vencimentos de trabalhadores por conta de outrem)
- B: Trabalho Independente (recibos verdes, prestadores de serviços, trabalhadores independentes)
- E: Rendimentos de Capitais (juros, dividendos, lucros distribuídos)
- F: Rendimentos Prediais (rendas de imóveis, arrendamento)
- G: Incrementos Patrimoniais (mais-valias de imóveis, valores mobiliários)
- H: Pensões (pensões de reforma, velhice, invalidez, alimentos)
- R: Retenções IRC (rendimentos pagos a pessoas coletivas/empresas)

Taxas de Retenção na Fonte (2025):
- Cat. A: variáveis conforme tabelas de retenção (geralmente 0-53%)
- Cat. B: 23% geral, 16.5% propriedade intelectual, 11.5% outras atividades, 20% não residentes, 0% isentos
- Cat. E: 28% geral, 35% para alguns casos específicos
- Cat. F: 25% geral, 16.5% para alguns casos
- Cat. G: variáveis conforme tipo de mais-valia
- Cat. H: variáveis conforme tabelas de pensões
- Cat. R: 25% geral para IRC

Terminologia portuguesa (ATENÇÃO):
IMPORTANTE: A partir de 2024, o Portal das Finanças mudou terminologia:
- "Base" → "Ilíquido" (ambos significam BRUTO, valor SEM descontos)
- "Ilíquido" = valor ANTES da retenção = gross_amount
- "Líquido" = valor DEPOIS da retenção

Regras importantes:
1. IMPORTANTE: O valor da retenção é mais importante que a taxa. Extrai sempre o VALOR retido.
2. VALIDAR: gross_amount × taxa ≈ withholding_amount (se não bater, recalcula o gross_amount)
3. Se não conseguires identificar algum campo, usa null ou 0 para valores numéricos
4. Rendimento líquido = valor bruto - retenção
5. Rendimentos isentos: valores que não estão sujeitos a retenção por isenção legal
6. Rendimentos dispensados: valores dispensados de retenção (ex: valor abaixo do limite)
7. Responde APENAS com o JSON, sem texto adicional`;

interface ExtractionResult {
  beneficiary_nif: string | null;
  beneficiary_name: string | null;
  beneficiary_address: string | null;
  income_category: 'A' | 'B' | 'E' | 'F' | 'G' | 'H' | 'R' | null;
  gross_amount: number | null;
  exempt_amount: number | null;
  dispensed_amount: number | null;
  withholding_rate: number | null;
  withholding_amount: number | null;
  payment_date: string | null;
  document_reference: string | null;
  confidence: number;
}

serve(async (req) => {
  console.log(`[extract-withholding v${VERSION}] Request received: ${req.method}`);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileData, mimeType } = await req.json();

    if (!fileData) {
      return new Response(
        JSON.stringify({ error: 'fileData é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting withholding data for user:', user.id);

    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      console.error('AI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de IA não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${fileData}`;

    console.log('Calling Lovable AI for withholding extraction...');

    const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de pedidos excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao processar imagem com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response content:', content);

    // Parse JSON from response
    let extractedData: ExtractionResult;
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const rawParsed = JSON.parse(jsonStr);

      // Check if document is not a valid invoice (listing/screenshot)
      if ('not_invoice' in rawParsed && rawParsed.not_invoice === true) {
        console.log('Document is a listing/screenshot - rejecting');
        return new Response(
          JSON.stringify({
            error: rawParsed.reason || 'Documento não é uma factura individual',
            not_invoice: true
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if document was marked as cancelled/annulled by AI
      if ('anulado' in rawParsed && rawParsed.anulado === true) {
        console.log('Document marked as cancelled - rejecting');
        return new Response(
          JSON.stringify({
            error: 'Documento anulado - não pode ser processado',
            anulado: true
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      extractedData = rawParsed as ExtractionResult;

      // Ensure numeric fields default to 0 if null
      extractedData.exempt_amount = extractedData.exempt_amount ?? 0;
      extractedData.dispensed_amount = extractedData.dispensed_amount ?? 0;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Não foi possível extrair dados do documento',
          raw_response: content 
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate essential fields
    if (!extractedData.beneficiary_nif && !extractedData.gross_amount) {
      return new Response(
        JSON.stringify({ 
          error: 'Campos essenciais não encontrados no documento',
          extracted: extractedData 
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully extracted withholding data:', extractedData);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: extractedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-withholding function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});