import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `Analisa esta imagem de um recibo ou documento fiscal português e extrai os seguintes dados em formato JSON:

{
  "beneficiary_nif": "NIF do beneficiário (quem recebeu o pagamento) - 9 dígitos",
  "beneficiary_name": "Nome do beneficiário",
  "beneficiary_address": "Morada do beneficiário (se visível)",
  "income_category": "A, B, E, F, G, H ou R - vê categorias abaixo",
  "gross_amount": número decimal do valor bruto total (ex: 1000.00),
  "exempt_amount": número decimal de rendimentos isentos (ex: 0.00) - valor isento de retenção,
  "dispensed_amount": número decimal de rendimentos dispensados de retenção (ex: 0.00),
  "withholding_rate": taxa de retenção em percentagem (ex: 25 para 25%),
  "withholding_amount": valor retido na fonte em decimal,
  "payment_date": "data no formato YYYY-MM-DD",
  "document_reference": "número do documento/recibo",
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

Regras importantes:
1. IMPORTANTE: O valor da retenção é mais importante que a taxa. Extrai sempre o VALOR retido.
2. Se não conseguires identificar algum campo, usa null ou 0 para valores numéricos
3. O valor bruto é o valor total antes da retenção
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de IA não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${fileData}`;

    console.log('Calling Lovable AI for withholding extraction...');

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

      extractedData = JSON.parse(jsonStr);
      
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