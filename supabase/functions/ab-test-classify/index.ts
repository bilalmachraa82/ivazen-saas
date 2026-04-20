import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isConfiguredServiceRoleToken } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// SYSTEM PROMPT with Few-Shot Examples (balanced)
// ============================================================
const SYSTEM_PROMPT = `És um contabilista certificado português. Classifica facturas para dedutibilidade de IVA segundo o CIVA Artigo 21º.

## REGRAS ABSOLUTAS
- Água/Electricidade/Gás/Telecom = ACTIVIDADE, Campo 24, 100%
- Combustível gasóleo/GPL viaturas ligeiras = ACTIVIDADE, Campo 24, 50%
- Gasolina viaturas ligeiras = PESSOAL, 0%
- Restauração/Alojamento (regra geral) = PESSOAL, 0%
- Software/Cloud = ACTIVIDADE, Campo 24, 100%
- Imobilizado >1000€ = ACTIVIDADE, Campo 20, 100%
- Existências taxa 6% = Campo 21, Existências taxa 13% = Campo 23, Existências taxa 23% = Campo 22
- Outros bens e serviços = Campo 24

## CAMPOS DP (Declaração Periódica)
- 20: Imobilizado (activo fixo >1000€)
- 21: Existências taxa reduzida 6%
- 22: Existências taxa normal 23%
- 23: Existências taxa intermédia 13%
- 24: Outros bens e serviços

## NIFs CONHECIDOS
- Água: 504812578 (Vimagua), 504075156 (Águas do Porto), 500077568 (EPAL)
- Electricidade: 503504564 (EDP Comercial), 504172577 (EDP SU), 503207430 (Endesa), 509534401 (Iberdrola)
- Gás: 503474705 (Lisboagás)
- Telecom: 504453513 (NOS), 500019020 (MEO), 502530830 (Vodafone)
- Combustível: 504960847 (GALP), 502130800 (BP), 503358375 (Repsol)
- Software: Google (IE6388047V), Microsoft (IE8256796U)

## EXEMPLOS

EXEMPLO 1: NIF 503504564, EDP Comercial, €187.45, IVA €34.72 (23%), CAE 62010
→ {"classification":"ACTIVIDADE","dp_field":24,"deductibility":100,"confidence":98,"reason":"Electricidade EDP, 100% dedutível"}

EXEMPLO 2: NIF 504960847, GALP, €65.00, IVA €14.95 (23%), CAE 70100
→ {"classification":"ACTIVIDADE","dp_field":24,"deductibility":50,"confidence":95,"reason":"Combustível - 50% dedutível viatura ligeira"}

EXEMPLO 3: NIF 509999999, Restaurante O Manel, €32.50, IVA €4.22 (13%), CAE 62010
→ {"classification":"PESSOAL","dp_field":24,"deductibility":0,"confidence":90,"reason":"Restauração - não dedutível (Art. 21 CIVA)"}

EXEMPLO 4: NIF 500100144, Continente, €245.30, IVA mista 6%+23%, CAE 56101
→ {"classification":"ACTIVIDADE","dp_field":21,"deductibility":100,"confidence":80,"reason":"Supermercado para restaurante - mercadorias existências"}

EXEMPLO 5: NIF 513755490, Microsoft Ireland, €120.00, Base isenta, CAE 62010
→ {"classification":"ACTIVIDADE","dp_field":24,"deductibility":100,"confidence":95,"reason":"Software cloud intracomunitário, 100% dedutível"}

EXEMPLO 6: NIF desconhecido, €15.00, IVA €2.85 (23%), sem CAE
→ {"classification":"MISTA","dp_field":24,"deductibility":0,"confidence":50,"reason":"Fornecedor e actividade desconhecidos, requer validação manual"}

EXEMPLO 7: NIF 502130800, BP, €45.00, IVA €10.35 (23%), CAE 49320
→ {"classification":"ACTIVIDADE","dp_field":24,"deductibility":100,"confidence":90,"reason":"Combustível para empresa de transporte de mercadorias, 100% dedutível"}`;

// JSON Schema for structured output
const RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "invoice_classification",
    strict: true,
    schema: {
      type: "object",
      properties: {
        classification: {
          type: "string",
          enum: ["ACTIVIDADE", "PESSOAL", "MISTA"],
        },
        dp_field: {
          type: "integer",
          enum: [20, 21, 22, 23, 24],
        },
        deductibility: {
          type: "integer",
          enum: [0, 25, 50, 100],
        },
        confidence: {
          type: "integer",
        },
        reason: {
          type: "string",
        },
      },
      required: ["classification", "dp_field", "deductibility", "confidence", "reason"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!isConfiguredServiceRoleToken(token)) {
      return new Response(JSON.stringify({ error: 'Service-role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      invoiceIds,                      // array of invoice IDs (max 10)
      model = 'gemini-3.1-flash-lite-preview',      // model name
      reasoningEffort = null,           // null | 'none' | 'minimal' | 'low' | 'medium' | 'high'
      useStructuredOutput = true,       // use response_format schema
    } = body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return new Response(JSON.stringify({ error: 'invoiceIds required (array, max 10)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invoiceIds.length > 10) {
      return new Response(JSON.stringify({ error: 'Max 10 invoices per request to avoid timeout' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch invoices
    const { data: invoices, error: fetchErr } = await supabase
      .from('invoices')
      .select('id, supplier_nif, supplier_name, document_type, total_amount, total_vat, base_standard, base_intermediate, base_reduced, base_exempt, document_date, client_id')
      .in('id', invoiceIds);

    if (fetchErr || !invoices) {
      return new Response(JSON.stringify({ error: 'Failed to fetch invoices', detail: fetchErr }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pre-fetch client profiles
    const clientIds = [...new Set(invoices.map(i => i.client_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, company_name, cae, activity_description')
      .in('id', clientIds);
    const clientMap = new Map((profiles || []).map(p => [p.id, p]));

    // Process each invoice
    const results = [];
    for (const inv of invoices) {
      const client = clientMap.get(inv.client_id) || {};

      const userPrompt = `Classifica esta factura:
NIF: ${inv.supplier_nif}
Fornecedor: ${inv.supplier_name || 'Desconhecido'}
Tipo: ${inv.document_type || 'FT'}
Total: €${(inv.total_amount || 0).toFixed(2)}
IVA: €${(inv.total_vat || 0).toFixed(2)}
Base 23%: €${(inv.base_standard || 0).toFixed(2)}
Base 13%: €${(inv.base_intermediate || 0).toFixed(2)}
Base 6%: €${(inv.base_reduced || 0).toFixed(2)}
Base isenta: €${(inv.base_exempt || 0).toFixed(2)}
Empresa: ${client.company_name || 'N/A'}
CAE: ${client.cae || 'N/A'}
Actividade: ${client.activity_description || 'N/A'}`;

      const apiBody: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      };

      // Add reasoning effort
      if (reasoningEffort) {
        apiBody.reasoning_effort = reasoningEffort;
      }

      // Add structured output
      if (useStructuredOutput) {
        apiBody.response_format = RESPONSE_SCHEMA;
      }

      const startTime = Date.now();

      try {
        const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(apiBody),
        });

        const totalTime = Date.now() - startTime;

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          results.push({
            invoiceId: inv.id, supplierNif: inv.supplier_nif, supplierName: inv.supplier_name,
            amount: inv.total_amount, vat: inv.total_vat,
            success: false, error: `${aiResponse.status}: ${errText.substring(0, 300)}`, totalTime,
          });
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;
        const finishReason = aiData.choices?.[0]?.finish_reason;
        const usage = aiData.usage || {};

        let parsed = null;
        let jsonValid = false;
        let schemaValid = false;

        if (content) {
          let cleanContent = content.trim();
          if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
          }
          try {
            parsed = JSON.parse(cleanContent);
            jsonValid = true;
          } catch {
            const match = cleanContent.match(/\{[\s\S]*\}/);
            if (match) {
              try { parsed = JSON.parse(match[0]); jsonValid = true; } catch { /* skip */ }
            }
          }

          if (parsed) {
            schemaValid = ['ACTIVIDADE', 'PESSOAL', 'MISTA'].includes(parsed.classification) &&
                          [20, 21, 22, 23, 24].includes(parsed.dp_field) &&
                          [0, 25, 50, 100].includes(parsed.deductibility) &&
                          typeof parsed.confidence === 'number' &&
                          typeof parsed.reason === 'string';
          }
        }

        results.push({
          invoiceId: inv.id, supplierNif: inv.supplier_nif, supplierName: inv.supplier_name,
          amount: inv.total_amount, vat: inv.total_vat,
          success: true, jsonValid, schemaValid, result: parsed,
          rawContent: content?.substring(0, 500), finishReason, totalTime,
          inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0,
        });
      } catch (err) {
        results.push({
          invoiceId: inv.id, supplierNif: inv.supplier_nif, amount: inv.total_amount,
          success: false, error: err.message, totalTime: Date.now() - startTime,
        });
      }

      // Rate limit between requests
      await new Promise(r => setTimeout(r, 300));
    }

    // Summary
    const ok = results.filter(r => r.success);
    const jsonOk = ok.filter(r => r.jsonValid).length;
    const schemaOk = ok.filter(r => r.schemaValid).length;
    const totalIn = ok.reduce((s, r) => s + (r.inputTokens || 0), 0);
    const totalOut = ok.reduce((s, r) => s + (r.outputTokens || 0), 0);
    const avgTime = ok.length > 0 ? Math.round(ok.reduce((s, r) => s + r.totalTime, 0) / ok.length) : 0;
    const avgConf = ok.filter(r => r.result).length > 0
      ? Math.round(ok.filter(r => r.result).reduce((s, r) => s + (r.result?.confidence || 0), 0) / ok.filter(r => r.result).length)
      : 0;

    const isFlashLite = model.includes('3.1');
    const inputRate = isFlashLite ? 0.25 : 0.30;
    const outputRate = isFlashLite ? 1.50 : 2.50;
    const cost = (totalIn / 1e6) * inputRate + (totalOut / 1e6) * outputRate;

    const classDist: Record<string, number> = {};
    const dpDist: Record<string, number> = {};
    const dedDist: Record<string, number> = {};
    for (const r of ok) {
      if (r.result) {
        classDist[r.result.classification] = (classDist[r.result.classification] || 0) + 1;
        dpDist[r.result.dp_field] = (dpDist[r.result.dp_field] || 0) + 1;
        dedDist[r.result.deductibility] = (dedDist[r.result.deductibility] || 0) + 1;
      }
    }

    return new Response(JSON.stringify({
      summary: {
        model, reasoningEffort, useStructuredOutput,
        total: invoices.length, success: ok.length, errors: results.length - ok.length,
        jsonValidRate: `${((jsonOk / (ok.length || 1)) * 100).toFixed(1)}%`,
        schemaValidRate: `${((schemaOk / (ok.length || 1)) * 100).toFixed(1)}%`,
        avgTimeMs: avgTime, avgConfidence: avgConf,
        totalInputTokens: totalIn, totalOutputTokens: totalOut,
        sampleCost: `$${cost.toFixed(4)}`,
        projectedCost166K: `$${(cost / (ok.length || 1) * 166000).toFixed(2)}`,
        classificationDist: classDist, dpFieldDist: dpDist, deductibilityDist: dedDist,
      },
      results,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
