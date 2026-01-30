import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extraction prompt for invoice data
const EXTRACTION_PROMPT = `Extrai dados desta factura portuguesa. Responde APENAS com JSON válido (sem markdown):
{"supplier_nif":"123456789","supplier_name":"Nome"|null,"customer_nif":"987654321"|null,"document_date":"2025-01-15","document_number":"FT 2025/123"|null,"document_type":"FT"|null,"atcud":"ABCD1234"|null,"base_reduced":0,"vat_reduced":0,"base_intermediate":0,"vat_intermediate":0,"base_standard":100.00,"vat_standard":23.00,"base_exempt":0,"total_vat":23.00,"total_amount":123.00,"fiscal_region":"PT","fiscal_period":"202501","confidence":85}

Taxas IVA: 6% (reduced), 13% (intermediate), 23% (standard), isento (exempt). Se não conseguires extrair supplier_nif, document_date ou total_amount, usa confidence:0.`;

interface ExtractionResult {
  supplier_nif: string;
  supplier_name?: string | null;
  customer_nif?: string | null;
  document_date: string;
  document_number?: string | null;
  document_type?: string | null;
  atcud?: string | null;
  base_reduced?: number;
  vat_reduced?: number;
  base_intermediate?: number;
  vat_intermediate?: number;
  base_standard?: number;
  vat_standard?: number;
  base_exempt?: number;
  total_vat?: number;
  total_amount: number;
  fiscal_region?: string;
  fiscal_period?: string;
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
        JSON.stringify({ error: 'fileData is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting invoice data for user:', user.id);
    console.log('Mime type:', mimeType);

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço AI não configurado. Contacte o suporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Using Lovable AI Gateway with gemini-2.5-flash');
    
    // Prepare base64 data
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        temperature: 0.1,
        max_tokens: 4096
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
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI response:', content.substring(0, 500));

    // Parse JSON from response
    let extractedData: ExtractionResult;
    try {
      // First try direct parse
      extractedData = JSON.parse(content);
    } catch {
      // Fallback: handle markdown code blocks if present
      let jsonContent = content;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim();
      }
      
      // Try to extract JSON object
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in content:', content.substring(0, 300));
        throw new Error('No JSON found in AI response');
      }
      
      try {
        extractedData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Content:', jsonMatch[0].substring(0, 300));
        throw new Error('Invalid JSON in AI response');
      }
    }

    // Validate required fields - with fallback for NIF
    let supplierNif: string | undefined = extractedData.supplier_nif;
    
    // NIF fallback: try to extract from raw content if missing or invalid
    if (!supplierNif || supplierNif.length !== 9) {
      console.log('NIF not found by AI, trying fallback regex...');
      
      // Try to find NIF patterns in the AI response
      const nifPatterns = [
        /NIF[:\s]*(\d{9})/i,
        /NIPC[:\s]*(\d{9})/i,
        /Contribuinte[:\s]*(\d{9})/i,
        /PT\s*(\d{9})/,
        /(?:^|\s)(\d{9})(?:\s|$)/,
      ];
      
      let foundNif: string | undefined = undefined;
      for (const pattern of nifPatterns) {
        const match = content.match(pattern);
        if (match && match[1] && match[1].length === 9) {
          foundNif = match[1];
          // SECURITY: Don't log actual NIF values
          console.log('NIF found via fallback regex');
          break;
        }
      }
      
      // Validate NIF with Portuguese checksum
      if (foundNif && foundNif.length === 9) {
        const digits = foundNif.split('').map(Number);
        const weights = [9, 8, 7, 6, 5, 4, 3, 2, 1];
        const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
        const isValidNif = sum % 11 === 0;
        
        if (isValidNif) {
          supplierNif = foundNif;
        } else {
          // SECURITY: Don't log actual NIF values
          console.log('NIF validation failed (checksum)');
        }
      }
      
      if (!supplierNif || supplierNif.length !== 9) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Não foi possível extrair o NIF do fornecedor. Verifique se a imagem está legível.',
            data: extractedData 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Update the extracted data with the found NIF
      extractedData.supplier_nif = supplierNif;
    }

    if (!extractedData.total_amount || extractedData.total_amount <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível extrair o valor total',
          data: extractedData 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Don't log sensitive data (NIF, amounts)
    console.log('Extraction successful for document:', extractedData.document_number || 'unknown');

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        model: 'gemini-2.5-flash'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in extract-invoice-data function:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
