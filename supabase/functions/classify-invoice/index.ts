import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isConfiguredServiceRoleToken, extractBearerToken } from "../_shared/auth.ts";
import { parseJsonFromAI } from "../_shared/parseJsonFromAI.ts";
import { normalizeSupplierTaxId, SAFE_GLOBAL_NIFS } from "../_shared/classificationHelpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://ivazen-saas.vercel.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Portuguese IVA classification rules (high-level) based on Arts. 20, 21, 23 CIVA
// NOTE: Heuristic layer for first-pass classification. The supplier NIF identifies the type of expense,
// but deductibility ultimately depends on the buyer's activity and regime (Art. 20/23 CIVA).
// When ambiguous, reduce confidence and require accountant review.
const IVA_RULES = `
# Regras de Dedutibilidade IVA - Arts. 20.º, 21.º e 23.º CIVA (Portugal)

Estas regras ajudam a estimar a dedutibilidade de IVA em compras. São heurísticas — a dedutibilidade final depende do enquadramento da aquisição na actividade tributada do sujeito passivo (Art. 20.º CIVA) e das exclusões do Art. 21.º CIVA. Em caso de dúvida, reduz a confiança e pede validação do contabilista.

PRINCÍPIO GERAL: O NIF do fornecedor identifica o tipo de despesa, mas não determina sozinho a dedutibilidade. Esta depende do nexo causal entre a aquisição e as operações tributáveis do adquirente. Sujeitos passivos mistos aplicam pro-rata (Art. 23.º CIVA).

## TIPICAMENTE DEDUTÍVEL A 100% (deductibility=100)
- Regra geral (Art. 20.º): inputs afectos exclusivamente à actividade tributada (mercadorias para revenda, consumíveis, serviços profissionais, software/licenças, publicidade, equipamentos).
- Água, electricidade, gás e telecomunicações no estabelecimento — tipicamente dedutíveis quando afectos à actividade tributada.
- Combustíveis e despesas de viaturas apenas quando o uso/actividade se enquadra nas excepções do Art. 21.º n.º 2 (ex.: transporte de mercadorias, táxis/TVDE, rent-a-car, escolas de condução).

## TIPICAMENTE DEDUTÍVEL A 50% (deductibility=50)
- Combustíveis (gasóleo, GPL, gás natural, biocombustíveis) para viaturas ligeiras de passageiros, na ausência de prova de enquadramento nas excepções do Art. 21.º n.º 2.
- Despesas de transporte, alojamento e alimentação ligadas à ORGANIZAÇÃO de congressos/feiras/seminários (quando explicitamente identificado).

## DEDUTÍVEL A 25% (deductibility=25)
- Despesas de PARTICIPAÇÃO em congressos/feiras/seminários (quando explicitamente identificado).

## REGRA GERAL NÃO DEDUTÍVEL (deductibility=0)
- Gasolina para viaturas ligeiras de passageiros (Art. 21.º n.º 1 al. b), na ausência de excepção).
- Alojamento, restauração, bebidas, recepções e despesas de representação (Art. 21.º n.º 1 al. c/d — regra geral, excepto quando ligadas a congressos/feiras).
- Aquisição/aluguer/manutenção de viaturas de turismo quando não enquadradas nas excepções do Art. 21.º n.º 2.
- Despesas claramente pessoais ou sem nexo com a actividade tributada.
`;

// System prompt for classification
const SYSTEM_PROMPT = `És um contabilista certificado português especializado em classificação de facturas para IVA.
A tua função é analisar dados de facturas e pré-classificá-las segundo o CIVA (Arts. 20.º, 21.º e 23.º).
A classificação é uma sugestão inicial — a validação final cabe ao contabilista certificado.

${IVA_RULES}

## CAMPOS DA DECLARAÇÃO PERIÓDICA (DP) - IVA DEDUTÍVEL
- Campo 20: Imobilizado (activo fixo tangível - equipamentos >1000€, mobiliário, viaturas afectas à actividade)
- Campo 21: Existências taxa reduzida 6% (mercadorias para revenda)
- Campo 23: Existências taxa intermédia 13% (vinhos, óleos para revenda)
- Campo 22: Existências taxa normal 23% (café, mercadorias taxa normal)
- Campo 24: Outros bens e serviços (serviços, consumíveis, material escritório, comunicações, combustíveis)

## FORNECEDORES PORTUGUESES CONHECIDOS - CLASSIFICAÇÃO INDICATIVA
O NIF identifica o fornecedor e o tipo provável de despesa. A dedutibilidade indicada assume afectação à actividade tributada (Art. 20.º CIVA). O contabilista valida o enquadramento final.

### ÁGUA (tipicamente: ACTIVIDADE, dp_field: 24, deductibility: 100)
- Vimagua (NIF 504812578), Águas do Porto (NIF 504075156), EPAL (NIF 500077568)
- AdP - Águas de Portugal, Indaqua, Águas de Gaia, Águas de Coimbra
- Entidades com "Água" ou "Águas" no nome

### ELECTRICIDADE (tipicamente: ACTIVIDADE, dp_field: 24, deductibility: 100)
- EDP Comercial (NIF 503504564), EDP Serviço Universal (NIF 504172577)
- Endesa (NIF 503207430), Iberdrola (NIF 509534401), Galp Power (NIF 513445311)
- Goldenergy (NIF 509846830), Coopernico, Luzboa, SU Electricidade (NIF 510329490)
- Entidades com "Energia", "Electricidade" ou "Power" no nome

### GÁS (tipicamente: ACTIVIDADE, dp_field: 24, deductibility: 100)
- Galp Gás Natural, Lisboagás (NIF 503474705)
- Entidades com "Gás" no nome

### TELECOMUNICAÇÕES (tipicamente: ACTIVIDADE, dp_field: 24, deductibility: 100)
- NOS (NIF 504453513), MEO/PT (NIF 500019020), Vodafone (NIF 502530830)
- NOWO (NIF 505280740), Digi (NIF 517424334)

### COMBUSTÍVEIS (tipicamente: ACTIVIDADE, dp_field: 24, deductibility: 50)
- GALP (NIF 504960847), BP (NIF 502130800), Repsol (NIF 503358375)
- Cepsa (NIF 503245064), Prio (NIF 503667790)
- Regra geral para viaturas ligeiras de passageiros: 50% (gasóleo/GPL/GNV), 0% (gasolina) — Art. 21.º n.º 1 al. b)
- Pode ser 100% se enquadrado nas excepções do Art. 21.º n.º 2 (transporte mercadorias, táxis, etc.)

### SOFTWARE / CLOUD (tipicamente: ACTIVIDADE, dp_field: 24, deductibility: 100)
- Google Ireland (VAT IE6388047V), Microsoft Ireland (VAT IE8256796U)
- Amazon/AWS, Adobe, Dropbox, Zoom, Slack, GitHub, Atlassian
- Tipicamente afecto à actividade — sujeitos passivos mistos podem requerer pro-rata (Art. 23.º)

### CONTABILIDADE / CONSULTORIA (tipicamente: ACTIVIDADE, dp_field: 24, deductibility: 100)
- Entidades com "Contabilidade", "Consultoria", "Advocacia", "Advogados" no nome
- Serviços profissionais tipicamente afectos à actividade

### ELEVADORES / MANUTENÇÃO EDIFÍCIO (tipicamente: ACTIVIDADE, dp_field: 24, deductibility: 100)
- OTIS, Schindler, ThyssenKrupp, KONE
- Entidades de manutenção de edifícios/elevadores — tipicamente afectos ao estabelecimento

## ORIENTAÇÕES DE CLASSIFICAÇÃO
1. NUNCA classifiques água, electricidade ou telecomunicações como "Combustível" — são categorias distintas
2. Água, electricidade e telecomunicações no estabelecimento são tipicamente 100% dedutíveis quando afectas à actividade tributada
3. Combustível sem detalhe suficiente: assume 50% para gasóleo/GPL/GNV e 0% para gasolina (viaturas ligeiras passageiros), e baixa a confiança
4. Software/Cloud de empresas estrangeiras (Google, Microsoft): tipicamente ACTIVIDADE, Campo 24 — confirmar afectação
5. A classificação por fornecedor é indicativa. A dedutibilidade final depende do enquadramento do sujeito passivo
6. Quando o contexto é ambíguo ou o sujeito passivo pode ter regime misto (Art. 23.º CIVA), reduz a confiança para < 85

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
- A actividade do cliente (CAE/descrição) — fundamental para determinar o nexo causal
- O contexto da despesa
- O regime do sujeito passivo (se disponível)
`;

interface InvoiceData {
  supplier_nif: string;
  supplier_name?: string;
  supplier_cae?: string;
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

Deno.serve(async (req) => {
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Extract bearer token
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Check if caller is service-role (for batch processing)
    const isServiceRole = isConfiguredServiceRoleToken(token);

    // Use service role client for DB operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    let user: { id: string } | null = null;
    if (!isServiceRole) {
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) {
        console.error('[classify-invoice] Auth failed:', authError?.message);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      user = authUser;
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

    // Authorization: service-role bypasses, otherwise user must own/be accountant/admin
    if (!isServiceRole) {
      let isAuthorized = invoice.client_id === user!.id;
      if (!isAuthorized) {
        const { data: userRoleRows, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user!.id);
        if (roleError) {
          console.error('Role lookup error:', roleError);
          return new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userRoles = new Set((userRoleRows || []).map((r: { role: string }) => r.role));
        const isAdmin = userRoles.has('admin');
        if (isAdmin) {
          isAuthorized = true;
        } else {
          const { data: accountantLink, error: accountantLinkError } = await supabase
            .from('client_accountants')
            .select('client_id')
            .eq('client_id', invoice.client_id)
            .eq('accountant_id', user!.id)
            .limit(1)
            .maybeSingle();
          if (accountantLinkError) {
            console.error('Client-accountant lookup error:', accountantLinkError);
            return new Response(
              JSON.stringify({ error: 'Forbidden' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          isAuthorized = Boolean(accountantLink);
        }
      }

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: no access to this invoice' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const clientData: ClientData = invoice.profiles || {};
    const rawNif = (invoice.supplier_nif || '').trim();
    const ruleSupplierTaxId = normalizeSupplierTaxId(rawNif);

    // ============================================================
    // NIF ENRICHMENT: If supplier_name is missing, look it up from
    // existing data (other invoices, classification_rules, examples)
    // ============================================================
    let enrichedSupplierName: string | null = invoice.supplier_name || null;

    if (!enrichedSupplierName && ruleSupplierTaxId) {
      console.log(`[enrich] supplier_name missing for NIF ***${ruleSupplierTaxId.slice(-3)}, looking up...`);

      // Single lookup: supplier_directory (aggregates all sources)
      const { data: dirEntry } = await supabase
        .from('supplier_directory')
        .select('name, cae, source')
        .eq('nif', ruleSupplierTaxId)
        .maybeSingle();

      if (dirEntry?.name) {
        enrichedSupplierName = dirEntry.name;
        // Also pick up CAE if invoice doesn't have one
        if (!invoice.supplier_cae && dirEntry.cae) {
          invoice.supplier_cae = dirEntry.cae;
        }
        console.log(`[enrich] Found in supplier_directory: ${enrichedSupplierName} (source: ${dirEntry.source})`);
      }

      // Backfill onto the current invoice
      if (enrichedSupplierName && !invoice.supplier_name) {
        const backfill: Record<string, unknown> = { supplier_name: enrichedSupplierName };
        if (dirEntry?.cae && !invoice.supplier_cae) backfill.supplier_cae = dirEntry.cae;
        await supabase
          .from('invoices')
          .update(backfill)
          .eq('id', invoice_id);
        console.log(`[enrich] Backfilled supplier data for invoice ${invoice_id}`);
      }
    }

    const invoiceData: InvoiceData = {
      supplier_nif: invoice.supplier_nif,
      supplier_name: enrichedSupplierName,
      supplier_cae: invoice.supplier_cae || undefined,
      total_amount: invoice.total_amount,
      total_vat: invoice.total_vat,
      base_standard: invoice.base_standard,
      base_reduced: invoice.base_reduced,
      base_intermediate: invoice.base_intermediate,
      base_exempt: invoice.base_exempt,
      document_type: invoice.document_type,
    };

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
      console.log(`Intra-community NIF detected → Campo 10`);
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
        requires_accountant_validation: false, // Deterministic rule, high confidence
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
        .gte('confidence', 70)
        .order('usage_count', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (clientRule) {
        rule = clientRule;
      } else {
        // Fallback to global rule (keep higher threshold for safety)
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
        } else if (!SAFE_GLOBAL_NIFS.has(ruleSupplierTaxId)) {
          // Cross-client blocked — NIF not in safe whitelist (utilities/telecoms only)
          console.log(`[cross-client] Blocked — NIF ***${ruleSupplierTaxId?.slice(-3)} not in safe whitelist`);
        } else {
          // Cross-client fallback: only for safe suppliers (utilities/telecoms)
          const { data: crossClientRule } = await supabase
            .from('classification_rules')
            .select('*')
            .eq('supplier_nif', ruleSupplierTaxId)
            .gte('confidence', 70)
            .order('usage_count', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (crossClientRule) {
            rule = crossClientRule;
            console.log(`[cross-client] Using safe rule from client ${crossClientRule.client_id} for supplier ***${ruleSupplierTaxId?.slice(-3)}`);
          }
        }
      }

      if (rule) {
        console.log(`Deterministic classification for supplier ***${ruleSupplierTaxId?.slice(-3)}: ${rule.classification} (rule ID: ${rule.id})`);

        // Auto-approve only for same-client rules with high confidence AND well-tested (≥3 uses)
        // Cross-client rules always require accountant validation (Art. 20-21-23 CIVA)
        const isCrossClient = rule.client_id !== invoice.client_id;
        const autoApprove = !isCrossClient && rule.confidence >= 90 && (rule.usage_count || 0) >= 3;

        // Update invoice with rule-based classification
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            ai_classification: rule.classification,
            ai_dp_field: rule.dp_field,
            ai_deductibility: rule.deductibility,
            ai_confidence: rule.confidence,
            ai_reason: `Regra automática por NIF (${isCrossClient ? 'cross-client seguro' : rule.is_global ? 'global' : 'cliente'})`,
            status: 'classified',
            requires_accountant_validation: !autoApprove,
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

        const ruleSource = isCrossClient ? 'cross-client seguro' : rule.is_global ? 'global' : 'cliente';
        return new Response(
          JSON.stringify({
            success: true,
            classification: {
              classification: rule.classification,
              dp_field: rule.dp_field,
              deductibility: rule.deductibility,
              confidence: rule.confidence,
              reason: `Regra automática por NIF (${ruleSource})`,
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

    // Build supplier CAE context for the prompt
    const supplierCaeInfo = invoiceData.supplier_cae
      ? `- CAE Fornecedor: ${invoiceData.supplier_cae} (IMPORTANTE: indica o sector de actividade do fornecedor, usa para inferir o tipo de despesa)`
      : '- CAE Fornecedor: Desconhecido';

    // Build the user prompt
    const userPrompt = `Classifica a seguinte factura:

## DADOS DA FACTURA
- NIF Fornecedor: ${invoiceData.supplier_nif}
- Nome Fornecedor: ${invoiceData.supplier_name || 'Desconhecido'}
${supplierCaeInfo}
- Tipo Documento: ${invoiceData.document_type || 'Factura'}
- Valor Total: €${invoiceData.total_amount.toFixed(2)}
- IVA Total: €${(invoiceData.total_vat || 0).toFixed(2)}
- Base Taxa Normal (23%): €${(invoiceData.base_standard || 0).toFixed(2)}
- Base Taxa Intermédia (13%): €${(invoiceData.base_intermediate || 0).toFixed(2)}
- Base Taxa Reduzida (6%): €${(invoiceData.base_reduced || 0).toFixed(2)}
- Base Isenta: €${(invoiceData.base_exempt || 0).toFixed(2)}

## REFERÊNCIA CAE → CLASSIFICAÇÃO
- CAE 01-03: Agricultura → produção agrícola
- CAE 10-33: Indústria → existências ou outros bens
- CAE 35: Electricidade/Gás → ACTIVIDADE, Campo 24, 100%
- CAE 36-39: Água/Resíduos → ACTIVIDADE, Campo 24, 100%
- CAE 45-47: Comércio → existências (revenda) ou outros bens
- CAE 49-53: Transportes → ACTIVIDADE, Campo 24, 100%
- CAE 55-56: Alojamento/Restauração → ACTIVIDADE, Campo 24, 0% (regra geral)
- CAE 58-63: Informação/Comunicação → ACTIVIDADE, Campo 24, 100%
- CAE 64-66: Actividades financeiras → ACTIVIDADE, Campo 24, 100%
- CAE 68: Imobiliário → depende do contexto
- CAE 69-75: Consultoria/Profissionais → ACTIVIDADE, Campo 24, 100%
- CAE 77-82: Serviços administrativos → ACTIVIDADE, Campo 24, 100%
- CAE 85: Educação → ACTIVIDADE, Campo 24, 100%
- CAE 86-88: Saúde → ACTIVIDADE, Campo 24, 100%
- CAE 90-93: Cultura/Desporto → depende do contexto
- CAE 94-96: Outros serviços → ACTIVIDADE, Campo 24, 100%

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

    console.log('No rule found for supplier ***' + (ruleSupplierTaxId?.slice(-3) || '???'), '- calling AI for classification...');

    // Use OpenRouter AI Gateway
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
        model: 'gemini-3.1-flash-lite-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        reasoning_effort: 'high'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);

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

    // Parse the JSON response using robust shared parser
    let classification: ClassificationResult;
    try {
      classification = parseJsonFromAI<ClassificationResult>(aiContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Raw:', aiContent?.slice(0, 300));
      classification = {
        classification: 'PESSOAL',
        dp_field: 24,
        deductibility: 0,
        confidence: 20,
        reason: 'Classificação provisória (AI parse error) - verificar manualmente'
      };
    }

    // Normalize AI output to avoid DB constraint failures and inconsistent values.
    // (DB constraints: dp_field IN (10,20,21,22,23,24), deductibility IN (0,25,50,100), classification IN (...))
    const allowedClassifications = new Set(['ACTIVIDADE', 'PESSOAL', 'MISTA']);
    if (!allowedClassifications.has(classification.classification)) {
      console.warn('AI returned invalid classification:', classification.classification, '- defaulting to ACTIVIDADE');
      classification.classification = 'ACTIVIDADE';
      classification.confidence = Math.min(Number(classification.confidence) || 0, 50);
      classification.reason = `${classification.reason || ''} (classification normalizada)`.trim();
    }

    // PESSOAL invoices are non-deductible: no DP field, 0% deductibility
    if (classification.classification === 'PESSOAL') {
      classification.dp_field = null;
      classification.deductibility = 0;
    }

    const allowedDpFields = new Set([20, 21, 22, 23, 24]);
    if (classification.dp_field !== null && !allowedDpFields.has(classification.dp_field)) {
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

    // MISTA always needs human review (Art. 21 CIVA — partial deductibility)
    const needsReview = classification.confidence < 85 || classification.classification === 'MISTA';

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
        requires_accountant_validation: needsReview,
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
            confidence: Math.min(classification.confidence, 80), // Cap at 80 — above 70 lookup threshold
            client_id: invoice.client_id,
            is_global: false,
            created_by: user?.id || null,
            notes: `Auto-learned from AI: ${classification.reason}`,
            usage_count: 1,
            last_used_at: new Date().toISOString(),
          }, {
            onConflict: 'supplier_nif,client_id',
            ignoreDuplicates: true, // Don't overwrite existing rules with higher confidence
          });
        console.log('Saved new classification rule for supplier ***' + (ruleSupplierTaxId?.slice(-3) || '???'));
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
        model: 'gemini-3.1-flash-lite-preview',
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
