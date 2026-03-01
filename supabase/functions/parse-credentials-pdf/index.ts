/**
 * Parse Credentials PDF Edge Function
 * Extracts NIF and password data from PDF files using AI
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ExtractedCredential {
  nif: string;
  password: string;
  name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação obrigatória' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'PDF base64 é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      throw new Error('AI_API_KEY não está configurada');
    }

    // Call Gemini Flash to extract credentials from PDF
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
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
              {
                type: 'text',
                text: `Analisa este documento PDF e extrai TODAS as credenciais de clientes.

INSTRUÇÕES:
1. Procura por tabelas ou listas com NIFs (Números de Identificação Fiscal portugueses - 9 dígitos)
2. Para cada NIF, encontra a password/senha associada
3. Também extrai o nome do cliente se disponível

FORMATO DE RESPOSTA (JSON):
Devolve APENAS um array JSON válido, sem markdown ou texto extra:
[
  {"nif": "123456789", "password": "ABC123", "name": "Nome Cliente"},
  {"nif": "987654321", "password": "XYZ789", "name": "Outro Cliente"}
]

REGRAS:
- NIFs devem ter exactamente 9 dígitos numéricos
- Passwords exactamente como aparecem no documento
- Se não encontrares nenhuma credencial, devolve: []
- NÃO inventes dados - extrai apenas o que existe no documento`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit excedido. Tenta novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes para processamento de IA.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    console.log('AI Response:', content.substring(0, 500));

    // Parse JSON from response (handle markdown code blocks)
    let credentials: ExtractedCredential[] = [];

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

      credentials = JSON.parse(jsonStr);

      // Validate and clean credentials
      credentials = credentials
        .filter(c => c && typeof c === 'object')
        .map(c => ({
          nif: String(c.nif || '').replace(/\D/g, ''),
          password: String(c.password || '').trim(),
          name: c.name ? String(c.name).trim() : undefined,
        }))
        .filter(c => c.nif.length === 9 && c.password.length > 0);

    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      return new Response(
        JSON.stringify({
          error: 'Não foi possível extrair credenciais do PDF',
          details: 'O formato do documento pode não ser suportado',
          rawContent: content.substring(0, 200)
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted ${credentials.length} credentials from PDF`);

    return new Response(
      JSON.stringify({
        credentials,
        count: credentials.length,
        success: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse credentials PDF error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro ao processar PDF',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
