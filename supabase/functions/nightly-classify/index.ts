/**
 * Nightly Classify — rules-first (free) then AI for remaining invoices and sales.
 *
 * Designed to run on a nightly cron schedule. Three phases:
 *   Phase 1: Apply classification_rules to up to 200 unclassified purchase invoices (free, no AI).
 *   Phase 2: Call classify-invoice AI for up to 30 still-unclassified invoices.
 *   Phase 3: Call classify-sales-category AI for up to 30 sales with no revenue_category.
 *
 * Service-role only.
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isServiceRoleToken, extractBearerToken } from "../_shared/auth.ts";
import { normalizeSupplierTaxId, SAFE_GLOBAL_NIFS } from "../_shared/classificationHelpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

interface RuleRow {
  id: string;
  supplier_nif: string;
  client_id: string | null;
  classification: string;
  dp_field: number | null;
  deductibility: number | null;
  confidence: number;
  usage_count: number;
  is_global: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Service-role auth only
    const token = extractBearerToken(req.headers.get('Authorization'));
    if (!isServiceRoleToken(token, supabaseServiceKey)) {
      return new Response(
        JSON.stringify({ error: 'Service-role authentication required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional overrides from body
    const {
      rulesLimit = 200,
      aiLimit = 30,
      salesLimit = 30,
    } = await req.json().catch(() => ({}));

    // ================================================================
    // PHASE 1 — Rules-only pass (free, no AI calls)
    // ================================================================
    console.log('[nightly-classify] Phase 1: rules-only pass');

    const { data: pendingInvoices, error: pendingError } = await supabase
      .from('invoices')
      .select('id, supplier_nif, client_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(Math.min(rulesLimit, 500));

    if (pendingError) {
      console.error('[nightly-classify] Failed to fetch pending invoices:', pendingError);
      throw new Error(`Fetch pending error: ${pendingError.message}`);
    }

    let rulesApplied = 0;

    for (const inv of (pendingInvoices || [])) {
      const normalizedNif = normalizeSupplierTaxId(inv.supplier_nif || '');
      if (!normalizedNif) continue;

      // Try client-specific rule first
      let rule: RuleRow | null = null;

      const { data: clientRule } = await supabase
        .from('classification_rules')
        .select('id, supplier_nif, client_id, classification, dp_field, deductibility, confidence, usage_count, is_global')
        .eq('supplier_nif', normalizedNif)
        .eq('client_id', inv.client_id)
        .gte('confidence', 70)
        .order('usage_count', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (clientRule) {
        rule = clientRule as RuleRow;
      } else {
        // Try global rule (higher threshold)
        const { data: globalRule } = await supabase
          .from('classification_rules')
          .select('id, supplier_nif, client_id, classification, dp_field, deductibility, confidence, usage_count, is_global')
          .eq('supplier_nif', normalizedNif)
          .eq('is_global', true)
          .gte('confidence', 85)
          .order('usage_count', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (globalRule) {
          rule = globalRule as RuleRow;
        } else if (SAFE_GLOBAL_NIFS.has(normalizedNif)) {
          // Cross-client fallback for safe suppliers only
          const { data: crossClientRule } = await supabase
            .from('classification_rules')
            .select('id, supplier_nif, client_id, classification, dp_field, deductibility, confidence, usage_count, is_global')
            .eq('supplier_nif', normalizedNif)
            .gte('confidence', 70)
            .order('usage_count', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (crossClientRule) {
            rule = crossClientRule as RuleRow;
          }
        }
      }

      if (!rule) continue;

      // Apply rule — same update shape as classify-invoice
      const isCrossClient = rule.client_id !== inv.client_id;
      const autoApprove = !isCrossClient && rule.confidence >= 90 && (rule.usage_count || 0) >= 3;

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          ai_classification: rule.classification,
          ai_dp_field: rule.dp_field,
          ai_deductibility: rule.deductibility,
          ai_confidence: rule.confidence,
          ai_reason: `Regra automática por NIF (nightly, ${isCrossClient ? 'cross-client seguro' : rule.is_global ? 'global' : 'cliente'})`,
          status: 'classified',
          classification_source: 'rule',
          requires_accountant_validation: !autoApprove,
        })
        .eq('id', inv.id);

      if (updateError) {
        console.error(`[nightly-classify] Rule update failed for ${inv.id}:`, updateError.message);
        continue;
      }

      // Bump rule usage_count
      await supabase
        .from('classification_rules')
        .update({
          usage_count: (rule.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', rule.id);

      rulesApplied++;
    }

    console.log(`[nightly-classify] Phase 1 done: ${rulesApplied} rules applied`);

    // ================================================================
    // PHASE 2 — AI pass for still-unclassified purchase invoices
    // ================================================================
    console.log('[nightly-classify] Phase 2: AI classification pass');

    const { data: aiPending, error: aiPendingError } = await supabase
      .from('invoices')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(Math.min(aiLimit, 100));

    if (aiPendingError) {
      console.error('[nightly-classify] Failed to fetch AI-pending invoices:', aiPendingError);
      throw new Error(`AI fetch error: ${aiPendingError.message}`);
    }

    let aiClassified = 0;
    let aiErrors = 0;

    for (const inv of (aiPending || [])) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/classify-invoice`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoice_id: inv.id }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          aiClassified++;
        } else if (response.status === 429) {
          console.warn('[nightly-classify] Rate limited during AI pass, stopping');
          break;
        } else {
          aiErrors++;
          console.error(`[nightly-classify] AI classify failed for ${inv.id}:`, result.error || `HTTP ${response.status}`);
        }
      } catch (err) {
        aiErrors++;
        console.error(`[nightly-classify] AI call error for ${inv.id}:`, err instanceof Error ? err.message : 'Unknown error');
      }

      // 500ms delay between AI calls to avoid overwhelming the system
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`[nightly-classify] Phase 2 done: ${aiClassified} AI classified, ${aiErrors} errors`);

    // ================================================================
    // PHASE 3 — Sales classification pass
    // ================================================================
    console.log('[nightly-classify] Phase 3: sales classification pass');

    const { data: salesPending, error: salesPendingError } = await supabase
      .from('sales_invoices')
      .select('id')
      .is('revenue_category', null)
      .order('created_at', { ascending: true })
      .limit(Math.min(salesLimit, 100));

    if (salesPendingError) {
      console.error('[nightly-classify] Failed to fetch pending sales:', salesPendingError);
      throw new Error(`Sales fetch error: ${salesPendingError.message}`);
    }

    let salesClassified = 0;
    let salesErrors = 0;

    for (const sale of (salesPending || [])) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/classify-sales-category`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoice_id: sale.id }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          salesClassified++;
        } else if (response.status === 429) {
          console.warn('[nightly-classify] Rate limited during sales pass, stopping');
          break;
        } else {
          salesErrors++;
          console.error(`[nightly-classify] Sales classify failed for ${sale.id}:`, result.error || `HTTP ${response.status}`);
        }
      } catch (err) {
        salesErrors++;
        console.error(`[nightly-classify] Sales call error for ${sale.id}:`, err instanceof Error ? err.message : 'Unknown error');
      }

      // 500ms delay between AI calls
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`[nightly-classify] Phase 3 done: ${salesClassified} sales classified, ${salesErrors} errors`);

    // ================================================================
    // SUMMARY
    // ================================================================
    const summary = {
      success: true,
      rulesApplied,
      aiClassified,
      aiErrors,
      salesClassified,
      salesErrors,
      totalProcessed: rulesApplied + aiClassified + salesClassified,
    };

    console.log('[nightly-classify] Complete:', JSON.stringify(summary));

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('[nightly-classify] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
