import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Portuguese IVA classification rules based on Article 21 CIVA
const IVA_RULES = `
# Regras de Dedutibilidade IVA - Artigo 21º CIVA (2025/2026)

## DEDUTÍVEL A 100% (Campo 20/21/22/23/24 DP)
- Matérias-primas e mercadorias para revenda
- Material de escritório e consumíveis
- Serviços de contabilidade, consultoria, advocacia
- Publicidade e marketing
- Reparações e manutenção de equipamentos
- Comunicações (telefone, internet) - uso exclusivo profissional
- Software e licenças
- Equipamentos informáticos
- Água, luz, gás - estabelecimento comercial

## DEDUTÍVEL A 50% (Campo 24 DP - metade do valor)
- Combustíveis gasóleo/GPL/GNV para viaturas ligeiras de passageiros
- Despesas com viaturas ligeiras passageiros (reparação, seguros, portagens)
- Comunicações (telefone, internet) - uso misto

## NÃO DEDUTÍVEL (Campo 23 DP - IVA suportado não dedutível)
- Gasolina para viaturas (SEMPRE não dedutível)
- Despesas de representação e hotelaria
- Alimentação e bebidas (consumo próprio)
- Despesas pessoais
- Viaturas de turismo (aquisição, aluguer) - quando não afectas exclusivamente

## ISENTO (Sem campo DP)
- Serviços de saúde
- Serviços de educação
- Serviços bancários e financeiros

## REGRAS ESPECIAIS
- Transportes de mercadorias (carrinhas): 100% dedutível
- Táxis e TVDE (uso profissional): 100% dedutível
- Electricidade veículos eléctricos: 100% dedutível
- GPL/GNV viaturas mercadorias: 100% dedutível
- Gasolina para máquinas/geradores: 100% dedutível
`;

// System prompt for classification
const SYSTEM_PROMPT = `És um assistente especializado em classificação de facturas para IVA em Portugal.
A tua função é analisar dados de facturas e classificá-las segundo o Código do IVA (CIVA), especificamente o Artigo 21º sobre dedutibilidade.

${IVA_RULES}

## CAMPOS DA DECLARAÇÃO PERIÓDICA (DP) - IVA DEDUTÍVEL
- Campo 20: Imobilizado (activo fixo tangível - equipamentos >1000€, mobiliário, viaturas afectas à actividade)
- Campo 21: Existências taxa reduzida 6% (mercadorias para revenda)
- Campo 22: Existências taxa intermédia 13% (vinhos, óleos para revenda)
- Campo 23: Existências taxa normal 23% (café, mercadorias taxa normal) OU IVA não dedutível
- Campo 24: Outros bens e serviços (serviços, consumíveis, material escritório, comunicações, combustíveis)

## OUTPUT ESPERADO
Deves classificar cada factura com:
1. classification: "ACTIVIDADE" (dedutível), "PESSOAL" (não dedutível), ou "MISTA" (parcialmente dedutível)
2. dp_field: 20 (imobilizado), 21 (existências 6%), 22 (existências 13%), 23 (existências 23% ou não dedutível), ou 24 (outros)
3. deductibility: percentagem de dedutibilidade (0, 50, ou 100)
4. confidence: nível de confiança de 0 a 100
5. reason: justificação breve da classificação

Analisa cuidadosamente:
- O NIF do fornecedor (identifica o tipo de negócio)
- A actividade do cliente (CAE/descrição)
- O contexto da despesa
`;

interface InvoiceData {
  supplier_nif: string;
  supplier_name?: string;
  total_amount: number;
  total_vat?: number;
  base_standard?: number;
  base_reduced?: number;
  base_intermediate?: number;
  base_exempt?: number;
  document_type?: string;
}

interface ClientData {
  activity_description?: string;
  cae?: string;
  company_name?: string;
}

interface ClassificationExample {
  supplier_nif: string;
  supplier_name?: string;
  expense_category?: string;
  client_activity?: string;
  final_classification: string;
  final_dp_field?: number;
  final_deductibility?: number;
  reason?: string;
}

interface ClassificationResult {
  classification: 'ACTIVIDADE' | 'PESSOAL' | 'MISTA';
  dp_field: number;
  deductibility: number;
  confidence: number;
  reason: string;
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's auth to verify identity
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: 'invoice_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations (RLS will filter based on invoice ownership)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice data with client profile
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, profiles!invoices_client_id_fkey(activity_description, cae, company_name)')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error('Invoice fetch error:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invoiceData: InvoiceData = {
      supplier_nif: invoice.supplier_nif,
      supplier_name: invoice.supplier_name,
      total_amount: invoice.total_amount,
      total_vat: invoice.total_vat,
      base_standard: invoice.base_standard,
      base_reduced: invoice.base_reduced,
      base_intermediate: invoice.base_intermediate,
      base_exempt: invoice.base_exempt,
      document_type: invoice.document_type,
    };

    const clientData: ClientData = invoice.profiles || {};

    // Fetch similar classification examples (Few-Shot Learning)
    // Sanitize inputs to prevent SQL injection - remove special characters
    const sanitizedNif = (invoice.supplier_nif || '').replace(/[^0-9]/g, '');
    const sanitizedActivity = (clientData.activity_description || '').replace(/['"\\%;]/g, '');
    
    const { data: examples } = await supabase
      .from('classification_examples')
      .select('*')
      .or(`supplier_nif.eq."${sanitizedNif}",client_activity.eq."${sanitizedActivity}"`)
      .limit(5);

    // Build few-shot examples for the prompt
    let fewShotSection = '';
    if (examples && examples.length > 0) {
      fewShotSection = '\n\n## EXEMPLOS DE CLASSIFICAÇÕES ANTERIORES (Few-Shot Learning)\n';
      for (const ex of examples as ClassificationExample[]) {
        fewShotSection += `
Fornecedor: ${ex.supplier_name || ex.supplier_nif}
Categoria: ${ex.expense_category || 'N/A'}
Actividade Cliente: ${ex.client_activity || 'N/A'}
Classificação: ${ex.final_classification}
Campo DP: ${ex.final_dp_field || 'N/A'}
Dedutibilidade: ${ex.final_deductibility || 0}%
Razão: ${ex.reason || 'N/A'}
---`;
      }
    }

    // Build the user prompt
    const userPrompt = `Classifica a seguinte factura:

## DADOS DA FACTURA
- NIF Fornecedor: ${invoiceData.supplier_nif}
- Nome Fornecedor: ${invoiceData.supplier_name || 'Desconhecido'}
- Tipo Documento: ${invoiceData.document_type || 'Factura'}
- Valor Total: €${invoiceData.total_amount.toFixed(2)}
- IVA Total: €${(invoiceData.total_vat || 0).toFixed(2)}
- Base Taxa Normal (23%): €${(invoiceData.base_standard || 0).toFixed(2)}
- Base Taxa Intermédia (13%): €${(invoiceData.base_intermediate || 0).toFixed(2)}
- Base Taxa Reduzida (6%): €${(invoiceData.base_reduced || 0).toFixed(2)}
- Base Isenta: €${(invoiceData.base_exempt || 0).toFixed(2)}

## DADOS DO CLIENTE
- Empresa: ${clientData.company_name || 'N/A'}
- CAE: ${clientData.cae || 'N/A'}
- Actividade: ${clientData.activity_description || 'N/A'}
${fewShotSection}

Responde APENAS com um objecto JSON válido no seguinte formato:
{
  "classification": "ACTIVIDADE" | "PESSOAL" | "MISTA",
  "dp_field": 20 | 21 | 22 | 23 | 24,
  "deductibility": 0 | 50 | 100,
  "confidence": 0-100,
  "reason": "explicação breve"
}`;

    console.log('Calling Lovable AI for classification...');

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço AI não configurado. Contacte o suporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de pedidos excedido. Aguarde alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos AI esgotados. Contacte o administrador.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content in AI response');
    }

    console.log('AI response:', aiContent);

    // Parse the JSON response
    let classification: ClassificationResult;
    try {
      // First try direct parse
      classification = JSON.parse(aiContent);
    } catch {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      try {
        classification = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        // Default classification if parsing fails
        classification = {
          classification: 'ACTIVIDADE',
          dp_field: 24,
          deductibility: 100,
          confidence: 50,
          reason: 'Classificação automática - verificar manualmente'
        };
      }
    }

    // Update the invoice with AI classification
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        ai_classification: classification.classification,
        ai_dp_field: classification.dp_field,
        ai_deductibility: classification.deductibility,
        ai_confidence: classification.confidence,
        ai_reason: classification.reason,
        status: 'classified',
      })
      .eq('id', invoice_id);

    if (updateError) {
      console.error('Failed to update invoice:', updateError);
      throw new Error('Failed to save classification');
    }

    console.log('Invoice classified successfully:', invoice_id);

    return new Response(
      JSON.stringify({
        success: true,
        classification,
        model: 'gemini-2.5-flash',
        message: 'Invoice classified successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in classify-invoice function:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
