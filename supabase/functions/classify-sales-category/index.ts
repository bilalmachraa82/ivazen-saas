import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isServiceRoleToken } from "../_shared/auth.ts";
import { parseJsonFromAI } from "../_shared/parseJsonFromAI.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://ivazen-saas.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Categorias de receita para Segurança Social
const REVENUE_CATEGORIES = {
  prestacao_servicos: 'Prestação de Serviços',
  vendas: 'Vendas de Produtos/Mercadorias',
  hotelaria: 'Hotelaria',
  restauracao: 'Restauração e Similares',
  alojamento_local: 'Alojamento Local',
  producao_venda: 'Produção e Venda de Bens',
  propriedade_intelectual: 'Propriedade Intelectual/Royalties',
  comercio: 'Comércio',
  outros: 'Outros Rendimentos'
};

// CAE to category mapping (simplified)
const CAE_CATEGORY_MAP: Record<string, string> = {
  // Comércio
  '45': 'comercio',
  '46': 'comercio',
  '47': 'comercio',
  // Alojamento e Restauração
  '55': 'hotelaria',
  '56': 'restauracao',
  // Serviços
  '62': 'prestacao_servicos', // TI
  '63': 'prestacao_servicos', // TI
  '69': 'prestacao_servicos', // Contabilidade/Advocacia
  '70': 'prestacao_servicos', // Consultoria
  '71': 'prestacao_servicos', // Engenharia
  '72': 'prestacao_servicos', // I&D
  '73': 'prestacao_servicos', // Publicidade
  '74': 'prestacao_servicos', // Outras actividades
  '78': 'prestacao_servicos', // RH
  '82': 'prestacao_servicos', // Administrativos
  '85': 'prestacao_servicos', // Educação
  '86': 'prestacao_servicos', // Saúde
  '90': 'propriedade_intelectual', // Artes
  '91': 'propriedade_intelectual', // Cultura
  // Produção
  '10': 'producao_venda',
  '11': 'producao_venda',
  '13': 'producao_venda',
  '14': 'producao_venda',
  '15': 'producao_venda',
  '16': 'producao_venda',
  '25': 'producao_venda',
  '31': 'producao_venda',
  '32': 'producao_venda',
};

const SYSTEM_PROMPT = `És um assistente especializado em classificação de receitas para trabalhadores independentes em Portugal.
A tua função é analisar facturas de venda e classificá-las por categoria de receita para efeitos de Segurança Social.

## CATEGORIAS DISPONÍVEIS
- prestacao_servicos: Consultoria, formação, desenvolvimento de software, design, contabilidade, advocacia, etc.
- vendas: Venda de produtos/mercadorias físicas
- hotelaria: Serviços de alojamento em hotéis, pensões
- restauracao: Restaurantes, cafés, bares, catering
- alojamento_local: Arrendamento temporário, Airbnb
- producao_venda: Produção artesanal, manufactura e venda própria
- propriedade_intelectual: Royalties, direitos de autor, licenças
- comercio: Comércio a retalho ou grosso
- outros: Rendimentos que não se enquadram nas outras categorias

## REGRAS DE CLASSIFICAÇÃO
1. Usa o CAE do cliente como indicador principal
2. Considera o nome do cliente/empresa receptora
3. Se houver dúvida, classifica como prestacao_servicos (mais comum para TI)
4. Confiança deve reflectir a certeza da classificação

Responde APENAS com JSON válido.`;

interface SalesInvoiceData {
  customer_nif?: string;
  customer_name?: string;
  total_amount: number;
  document_type?: string;
}

interface ClientProfile {
  activity_description?: string;
  cae?: string;
  company_name?: string;
}

interface CategoryResult {
  category: string;
  confidence: number;
  reason: string;
}

Deno.serve(async (req) => {
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Check if caller is service-role (for batch processing)
    const isServiceRole = isServiceRoleToken(token, supabaseServiceKey);

    let user: { id: string } | null = null;
    if (!isServiceRole) {
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) {
        console.error('Auth error in classify-sales-category:', authError?.message);
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
    const supabase = supabaseAdmin;

    // Fetch sales invoice data with client profile
    const { data: invoice, error: invoiceError } = await supabase
      .from('sales_invoices')
      .select('*, profiles!sales_invoices_client_id_fkey(activity_description, cae, company_name)')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error('Sales invoice fetch error:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Sales invoice not found' }),
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
          JSON.stringify({ error: 'Forbidden: no access to this sales invoice' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const invoiceData: SalesInvoiceData = {
      customer_nif: invoice.customer_nif,
      customer_name: invoice.customer_name,
      total_amount: invoice.total_amount,
      document_type: invoice.document_type,
    };

    const clientProfile: ClientProfile = invoice.profiles || {};

    // First, try rule-based classification using CAE
    let ruleBasedCategory: string | null = null;
    if (clientProfile.cae) {
      const caePrefix = clientProfile.cae.substring(0, 2);
      ruleBasedCategory = CAE_CATEGORY_MAP[caePrefix] || null;
    }

    // If CAE gives high confidence result, use it
    if (ruleBasedCategory) {
      const result: CategoryResult = {
        category: ruleBasedCategory,
        confidence: 85,
        reason: `Classificado automaticamente com base no CAE ${clientProfile.cae}`
      };

      // Update the sales invoice
      const { error: updateError } = await supabase
        .from('sales_invoices')
        .update({
          revenue_category: result.category,
          ai_category_confidence: result.confidence,
        })
        .eq('id', invoice_id);

      if (updateError) {
        console.error('Failed to update sales invoice:', updateError);
        throw new Error('Failed to save category');
      }

      console.log('Sales invoice categorized (rule-based):', invoice_id, result.category);

      return new Response(
        JSON.stringify({
          success: true,
          category: result,
          method: 'rule-based',
          message: 'Categoria atribuída com base no CAE'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fall back to AI classification
    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      // If no AI available, default to prestacao_servicos
      const defaultResult: CategoryResult = {
        category: 'prestacao_servicos',
        confidence: 50,
        reason: 'Categoria padrão - serviço AI não disponível'
      };

      await supabase
        .from('sales_invoices')
        .update({
          revenue_category: defaultResult.category,
          ai_category_confidence: defaultResult.confidence,
        })
        .eq('id', invoice_id);

      return new Response(
        JSON.stringify({
          success: true,
          category: defaultResult,
          method: 'default',
          message: 'Categoria padrão atribuída'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build AI prompt
    const userPrompt = `Classifica a seguinte factura de venda por categoria de receita:

## DADOS DA FACTURA
- NIF Cliente: ${invoiceData.customer_nif || 'N/A'}
- Nome Cliente: ${invoiceData.customer_name || 'Desconhecido'}
- Tipo Documento: ${invoiceData.document_type || 'Factura'}
- Valor Total: €${invoiceData.total_amount.toFixed(2)}

## DADOS DO EMISSOR (Trabalhador Independente)
- Empresa: ${clientProfile.company_name || 'N/A'}
- CAE: ${clientProfile.cae || 'N/A'}
- Actividade: ${clientProfile.activity_description || 'N/A'}

Responde APENAS com JSON:
{
  "category": "prestacao_servicos" | "vendas" | "hotelaria" | "restauracao" | "alojamento_local" | "producao_venda" | "propriedade_intelectual" | "comercio" | "outros",
  "confidence": 0-100,
  "reason": "explicação breve"
}`;

    console.log('Calling AI for sales category classification...');

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

      // Fall back to default
      const fallbackResult: CategoryResult = {
        category: 'prestacao_servicos',
        confidence: 50,
        reason: 'Erro no serviço AI - categoria padrão'
      };

      await supabase
        .from('sales_invoices')
        .update({
          revenue_category: fallbackResult.category,
          ai_category_confidence: fallbackResult.confidence,
        })
        .eq('id', invoice_id);

      return new Response(
        JSON.stringify({
          success: true,
          category: fallbackResult,
          method: 'fallback',
          message: 'Categoria padrão atribuída após erro'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content in AI response');
    }

    console.log('AI response:', aiContent);

    // Parse the JSON response using robust shared parser
    let categoryResult: CategoryResult;
    try {
      categoryResult = parseJsonFromAI<CategoryResult>(aiContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Raw:', aiContent?.slice(0, 300));
      categoryResult = {
        category: 'prestacao_servicos',
        confidence: 30,
        reason: 'Classificação automática (AI parse error) - verificar manualmente'
      };
    }

    // Validate category
    const validCategories = Object.keys(REVENUE_CATEGORIES);
    if (!validCategories.includes(categoryResult.category)) {
      categoryResult.category = 'prestacao_servicos';
    }

    // Update the sales invoice
    const { error: updateError } = await supabase
      .from('sales_invoices')
      .update({
        revenue_category: categoryResult.category,
        ai_category_confidence: categoryResult.confidence,
      })
      .eq('id', invoice_id);

    if (updateError) {
      console.error('Failed to update sales invoice:', updateError);
      throw new Error('Failed to save category');
    }

    console.log('Sales invoice categorized (AI):', invoice_id, categoryResult.category);

    return new Response(
      JSON.stringify({
        success: true,
        category: categoryResult,
        method: 'ai',
        message: 'Categoria classificada com IA'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in classify-sales-category function:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
