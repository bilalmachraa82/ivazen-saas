import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Portuguese IVA classification rules (high-level) based on Artigo 21 CIVA
// NOTE: This is a heuristic layer for first-pass classification. When ambiguous, reduce confidence and require review.
const IVA_RULES = `
# Regras de Dedutibilidade IVA - Artigo 21º CIVA (Portugal)

Estas regras ajudam a estimar a dedutibilidade de IVA em compras. Quando houver dúvida (ex.: viaturas, deslocações, combustível sem indicação do tipo), reduz a confiança e pede validação manual.

## DEDUTÍVEL A 100% (deductibility=100)
- Regra geral: inputs usados exclusivamente na actividade tributada (mercadorias para revenda, consumíveis, serviços profissionais, software/licenças, publicidade, equipamentos, água/electricidade/gás no estabelecimento).
- Combustíveis e despesas de viaturas apenas quando o uso/actividade se enquadra claramente nas excepções legais (ex.: transporte de mercadorias, táxis/TVDE, rent-a-car, escolas de condução, etc.).

## DEDUTÍVEL A 50% (deductibility=50)
- Combustíveis (gasóleo, GPL, gás natural, biocombustíveis) para viaturas ligeiras de passageiros quando não há prova suficiente para 100%.
- Despesas de transporte, alojamento e alimentação estritamente ligadas à ORGANIZAÇÃO de congressos/feiras/seminários (quando explicitamente identificado).

## DEDUTÍVEL A 25% (deductibility=25)
- Despesas de PARTICIPAÇÃO em congressos/feiras/seminários (quando explicitamente identificado).

## NÃO DEDUTÍVEL (deductibility=0)
- Gasolina para viaturas ligeiras de passageiros (na falta de indicação de excepção/uso enquadrado).
- Alojamento, restauração, bebidas, recepções e despesas de representação (regra geral).
- Aquisição/aluguer/manutenção de viaturas de turismo e despesas associadas quando não enquadradas nas excepções legais.
- Despesas claramente pessoais.
`;

// System prompt for classification
const SYSTEM_PROMPT = `És um contabilista certificado português especializado em classificação de facturas para IVA.
A tua função é analisar dados de facturas e classificá-las segundo o Código do IVA (CIVA), especificamente o Artigo 21º sobre dedutibilidade.

${IVA_RULES}

## CAMPOS DA DECLARAÇÃO PERIÓDICA (DP) - IVA DEDUTÍVEL
- Campo 20: Imobilizado (activo fixo tangível - equipamentos >1000€, mobiliário, viaturas afectas à actividade)
- Campo 21: Existências taxa reduzida 6% (mercadorias para revenda)
- Campo 23: Existências taxa intermédia 13% (vinhos, óleos para revenda)
- Campo 22: Existências taxa normal 23% (café, mercadorias taxa normal)
- Campo 24: Outros bens e serviços (serviços, consumíveis, material escritório, comunicações, combustíveis)

## FORNECEDORES PORTUGUESES CONHECIDOS - CLASSIFICAÇÃO OBRIGATÓRIA
Quando identificares estes fornecedores pelo NIF ou nome, DEVES usar a classificação indicada:

### ÁGUA (classification: ACTIVIDADE, dp_field: 24, deductibility: 100)
- Vimagua (NIF 504812578), Águas do Porto (NIF 504075156), EPAL (NIF 500077568)
- AdP - Águas de Portugal, Indaqua, Águas de Gaia, Águas de Coimbra
- Qualquer entidade com "Água" ou "Águas" no nome

### ELECTRICIDADE (classification: ACTIVIDADE, dp_field: 24, deductibility: 100)
- EDP Comercial (NIF 503504564), EDP Serviço Universal (NIF 504172577)
- Endesa (NIF 503207430), Iberdrola (NIF 509534401), Galp Power (NIF 513445311)
- Goldenergy (NIF 509846830), Coopernico, Luzboa, SU Electricidade (NIF 510329490)
- Qualquer entidade com "Energia", "Electricidade" ou "Power" no nome

### GÁS (classification: ACTIVIDADE, dp_field: 24, deductibility: 100)
- Galp Gás Natural, Lisboagás (NIF 503474705)
- Qualquer entidade com "Gás" no nome

### TELECOMUNICAÇÕES (classification: ACTIVIDADE, dp_field: 24, deductibility: 100)
- NOS (NIF 504453513), MEO/PT (NIF 500019020), Vodafone (NIF 502530830)
- NOWO (NIF 505280740), Digi (NIF 517424334)

### COMBUSTÍVEIS (classification: ACTIVIDADE, dp_field: 24, deductibility: 50)
- GALP (NIF 504960847), BP (NIF 502130800), Repsol (NIF 503358375)
- Cepsa (NIF 503245064), Prio (NIF 503667790)
- ATENÇÃO: Combustível é SEMPRE 50% dedutível para viaturas ligeiras de passageiros

### SOFTWARE / CLOUD (classification: ACTIVIDADE, dp_field: 24, deductibility: 100)
- Google Ireland (VAT IE6388047V), Microsoft Ireland (VAT IE8256796U)
- Amazon/AWS, Adobe, Dropbox, Zoom, Slack, GitHub, Atlassian

### CONTABILIDADE / CONSULTORIA (classification: ACTIVIDADE, dp_field: 24, deductibility: 100)
- Qualquer entidade com "Contabilidade", "Consultoria", "Advocacia", "Advogados" no nome

### ELEVADORES / MANUTENÇÃO EDIFÍCIO (classification: ACTIVIDADE, dp_field: 24, deductibility: 100)
- OTIS, Schindler, ThyssenKrupp, KONE
- Qualquer entidade de manutenção de edifícios/elevadores

## REGRAS CRÍTICAS
1. NUNCA classifiques água, electricidade ou telecomunicações como "Combustível"
2. Água e electricidade são SEMPRE 100% dedutíveis para actividade profissional
3. Combustível: se não houver detalhe suficiente, assume 50% para gasóleo/GPL/GNV e 0% para gasolina (viaturas ligeiras passageiros) e baixa a confiança
4. Software/Cloud de empresas estrangeiras (Google, Microsoft) = ACTIVIDADE, Campo 24, 100%
5. Se o fornecedor é claramente de uma categoria acima, usa essa classificação independentemente de outros dados

## OUTPUT ESPERADO
Deves classificar cada factura com:
1. classification: "ACTIVIDADE" (dedutível), "PESSOAL" (não dedutível), ou "MISTA" (parcialmente dedutível)
2. dp_field: 20 (imobilizado), 21 (existências 6%), 23 (existências 13%), 22 (existências 23%), ou 24 (outros bens e serviços)
3. deductibility: percentagem de dedutibilidade (0, 25, 50, ou 100)
4. confidence: nível de confiança de 0 a 100
5. reason: justificação breve da classificação

Analisa cuidadosamente:
- O NIF do fornecedor (identifica o tipo de negócio)
- O nome do fornecedor (identifica a categoria de serviço)
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

function normalizeSupplierTaxIdForRules(raw: string): string | null {
  const s = (raw || '').trim().toUpperCase();
  if (!s) return null;

  // Keep only alphanumerics to normalize common OCR separators (spaces, dots, slashes).
  const alnum = s.replace(/[^A-Z0-9]/g, '');

  // PT VAT can appear as "PT123456789". Our rules store PT NIF as 9 digits.
  if (/^PT\d{9}$/.test(alnum)) return alnum.slice(2);

  // PT NIF: 9 digits
  if (/^\d{9}$/.test(alnum)) return alnum;

  // Foreign VAT ID: 2-letter country prefix + alphanumerics.
  if (/^[A-Z]{2}[A-Z0-9]{2,}$/.test(alnum)) return alnum;

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // EU country prefixes for intra-community acquisition detection
    const EU_NIF_PREFIXES = [
      'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES',
      'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
      'NL', 'PL', 'RO', 'SE', 'SI', 'SK',
    ];

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

    // Use service role for database operations
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
    const rawNif = (invoice.supplier_nif || '').trim();
    const ruleSupplierTaxId = normalizeSupplierTaxIdForRules(rawNif);

    // ============================================================
    // INTRA-COMMUNITY CHECK (reverse charge):
    // Only treat as Campo 10/11 when the supplier has an EU VAT ID AND the invoice does NOT have VAT charged.
    // This avoids misclassifying OSS/local VAT invoices from EU suppliers (e.g. Google charging PT VAT 23%).
    // ============================================================
    const upperNif = rawNif.toUpperCase();
    const isEuVatId = EU_NIF_PREFIXES.some(prefix => upperNif.startsWith(prefix));

    const vatTotal = Number(invoice.total_vat || 0);
    const hasChargedVat =
      vatTotal > 0.01 ||
      Number(invoice.vat_standard || 0) > 0.01 ||
      Number(invoice.vat_intermediate || 0) > 0.01 ||
      Number(invoice.vat_reduced || 0) > 0.01;

    const isReverseChargeLike = isEuVatId && !hasChargedVat;

    if (isReverseChargeLike) {
      console.log(`Intra-community NIF detected: ${rawNif} → Campo 10`);
      const intraResult = {
        classification: 'ACTIVIDADE' as const,
        dp_field: 10,
        deductibility: 100,
        confidence: 95,
        reason: `Aquisição intracomunitária (NIF ${rawNif.slice(0, 2)}) — reverse charge, Campo 10/11`,
      };

      await supabase.from('invoices').update({
        ai_classification: intraResult.classification,
        ai_dp_field: intraResult.dp_field,
        ai_deductibility: intraResult.deductibility,
        ai_confidence: intraResult.confidence,
        ai_reason: intraResult.reason,
        status: 'classified',
      }).eq('id', invoice_id);

      return new Response(
        JSON.stringify({ success: true, classification: intraResult, source: 'intra-community-rule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // DETERMINISTIC LOOKUP: Check classification_rules before AI
    // Priority: client-specific rules > global rules
    // ============================================================
    if (ruleSupplierTaxId) {
      // Try client-specific rule first
      let rule = null;
      
      const { data: clientRule } = await supabase
        .from('classification_rules')
        .select('*')
        .eq('supplier_nif', ruleSupplierTaxId)
        .eq('client_id', invoice.client_id)
        .gte('confidence', 85)
        .order('usage_count', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (clientRule) {
        rule = clientRule;
      } else {
        // Fallback to global rule
        const { data: globalRule } = await supabase
          .from('classification_rules')
          .select('*')
          .eq('supplier_nif', ruleSupplierTaxId)
          .eq('is_global', true)
          .gte('confidence', 85)
          .order('usage_count', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (globalRule) {
          rule = globalRule;
        }
      }

      if (rule) {
        console.log(`Deterministic classification for supplier ${ruleSupplierTaxId}: ${rule.classification} (rule ID: ${rule.id})`);

        // Update invoice with rule-based classification
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            ai_classification: rule.classification,
            ai_dp_field: rule.dp_field,
            ai_deductibility: rule.deductibility,
            ai_confidence: rule.confidence,
            ai_reason: `Regra automática por NIF (${rule.is_global ? 'global' : 'cliente'})`,
            status: 'classified',
          })
          .eq('id', invoice_id);

        if (updateError) {
          console.error('Failed to update invoice with rule:', updateError);
          throw new Error('Failed to save classification');
        }

        // Update rule usage count
        await supabase
          .from('classification_rules')
          .update({
            usage_count: (rule.usage_count || 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', rule.id);

        return new Response(
          JSON.stringify({
            success: true,
            classification: {
              classification: rule.classification,
              dp_field: rule.dp_field,
              deductibility: rule.deductibility,
              confidence: rule.confidence,
              reason: `Regra automática por NIF (${rule.is_global ? 'global' : 'cliente'})`,
            },
            source: 'rule',
            rule_id: rule.id,
            message: 'Invoice classified via deterministic rule (no AI call)'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ============================================================
    // AI CLASSIFICATION: No rule found, call Gemini
    // ============================================================

    // Fetch similar classification examples (Few-Shot Learning)
    const sanitizedActivity = (clientData.activity_description || '').replace(/['"\\%;,()]/g, '');

    let examples: ClassificationExample[] = [];
    if (ruleSupplierTaxId) {
      const { data: nifExamples } = await supabase
        .from('classification_examples')
        .select('*')
        .eq('supplier_nif', ruleSupplierTaxId)
        .limit(3);
      if (nifExamples) examples.push(...(nifExamples as ClassificationExample[]));
    }
    if (sanitizedActivity && examples.length < 5) {
      const { data: activityExamples } = await supabase
        .from('classification_examples')
        .select('*')
        .eq('client_activity', sanitizedActivity)
        .limit(5 - examples.length);
      if (activityExamples) examples.push(...(activityExamples as ClassificationExample[]));
    }

    // Build few-shot examples for the prompt
    let fewShotSection = '';
    if (examples.length > 0) {
      fewShotSection = '\n\n## EXEMPLOS DE CLASSIFICAÇÕES ANTERIORES (Few-Shot Learning)\n';
      for (const ex of examples) {
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
  "deductibility": 0 | 25 | 50 | 100,
  "confidence": 0-100,
  "reason": "explicação breve"
}`;

    console.log('No rule found for supplier', ruleSupplierTaxId, '- calling AI for classification...');

    // Use Lovable AI Gateway
    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      console.error('AI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço AI não configurado. Contacte o suporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
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
      classification = JSON.parse(aiContent);
    } catch {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      try {
        classification = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        classification = {
          classification: 'ACTIVIDADE',
          dp_field: 24,
          deductibility: 100,
          confidence: 50,
          reason: 'Classificação automática - verificar manualmente'
        };
      }
    }

    // Normalize AI output to avoid DB constraint failures and inconsistent values.
    // (DB constraints: dp_field IN (20,21,22,23,24), deductibility IN (0,25,50,100), classification IN (...))
    const allowedClassifications = new Set(['ACTIVIDADE', 'PESSOAL', 'MISTA']);
    if (!allowedClassifications.has(classification.classification)) {
      console.warn('AI returned invalid classification:', classification.classification, '- defaulting to ACTIVIDADE');
      classification.classification = 'ACTIVIDADE';
      classification.confidence = Math.min(Number(classification.confidence) || 0, 50);
      classification.reason = `${classification.reason || ''} (classification normalizada)`.trim();
    }

    const allowedDpFields = new Set([20, 21, 22, 23, 24]);
    if (!allowedDpFields.has(classification.dp_field)) {
      console.warn('AI returned invalid dp_field:', classification.dp_field, '- defaulting to 24');
      classification.dp_field = 24;
      classification.confidence = Math.min(Number(classification.confidence) || 0, 50);
      classification.reason = `${classification.reason || ''} (dp_field normalizado)`.trim();
    }

    const allowedDeductibility = new Set([0, 25, 50, 100]);
    if (!allowedDeductibility.has(classification.deductibility)) {
      const fallback = classification.classification === 'PESSOAL' ? 0 : 100;
      console.warn('AI returned invalid deductibility:', classification.deductibility, '- defaulting to', fallback);
      classification.deductibility = fallback;
      classification.confidence = Math.min(Number(classification.confidence) || 0, 50);
      classification.reason = `${classification.reason || ''} (deductibility normalizado)`.trim();
    }

    // Clamp confidence to 0-100 integer
    const confNum = Number(classification.confidence);
    classification.confidence = Number.isFinite(confNum)
      ? Math.max(0, Math.min(100, Math.round(confNum)))
      : 50;

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

    // ============================================================
    // LEARN: Save AI result as new classification rule (confidence 75)
    // So next time the same supplier is classified deterministically
    // ============================================================
    if (ruleSupplierTaxId && classification.confidence >= 70) {
      try {
        await supabase
          .from('classification_rules')
          .upsert({
            supplier_nif: ruleSupplierTaxId,
            supplier_name_pattern: invoiceData.supplier_name || null,
            classification: classification.classification,
            dp_field: classification.dp_field,
            deductibility: classification.deductibility,
            confidence: Math.min(classification.confidence, 75), // Cap at 75 for AI-learned rules
            client_id: invoice.client_id,
            is_global: false,
            created_by: user.id,
            notes: `Auto-learned from AI: ${classification.reason}`,
            usage_count: 1,
            last_used_at: new Date().toISOString(),
          }, {
            onConflict: 'supplier_nif,client_id',
            ignoreDuplicates: true, // Don't overwrite existing rules with higher confidence
          });
        console.log('Saved new classification rule for supplier', ruleSupplierTaxId);
      } catch (ruleError) {
        // Non-fatal: log and continue
        console.warn('Could not save classification rule:', ruleError);
      }
    }

    console.log('Invoice classified successfully:', invoice_id);

    return new Response(
      JSON.stringify({
        success: true,
        classification,
        source: 'ai',
        model: 'gemini-2.5-flash',
        message: 'Invoice classified successfully via AI'
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
