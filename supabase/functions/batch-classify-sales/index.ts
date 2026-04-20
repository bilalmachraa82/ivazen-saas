/**
 * Batch Classify Sales — cursor-based batch processing
 * Invokes classify-sales-category for sales invoices with default revenue_category.
 * Service-role only.
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isConfiguredServiceRoleToken, extractBearerToken } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Service-role auth only
    const token = extractBearerToken(req.headers.get('Authorization'));
    if (!isConfiguredServiceRoleToken(token)) {
      return new Response(
        JSON.stringify({ error: 'Service-role authentication required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      chunkSize = 100,
      dryRun = false,
      cursor = null,
      batchId = null,
    } = await req.json().catch(() => ({}));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Count total with default category
    const { count: totalDefault } = await supabase
      .from('sales_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('revenue_category', 'prestacao_servicos')
      .is('ai_category_confidence', null);

    // Fetch sales invoices with default category (never AI-classified)
    let query = supabase
      .from('sales_invoices')
      .select('id')
      .eq('revenue_category', 'prestacao_servicos')
      .is('ai_category_confidence', null)
      .order('created_at', { ascending: true })
      .limit(Math.min(chunkSize, 500));

    if (cursor) {
      const { data: cursorRow } = await supabase
        .from('sales_invoices')
        .select('created_at')
        .eq('id', cursor)
        .single();

      if (cursorRow) {
        query = query.gt('created_at', cursorRow.created_at);
      }
    }

    const { data: invoices, error: fetchError } = await query;

    if (fetchError) {
      console.error('Failed to fetch sales invoices:', fetchError);
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    if (!invoices || invoices.length === 0) {
      if (batchId) {
        await supabase
          .from('classification_batches')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', batchId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          reclassified: 0,
          unchanged: 0,
          errors: 0,
          remaining: 0,
          cursor: null,
          message: 'No sales invoices to classify',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create batch record if not resuming
    let activeBatchId = batchId;
    if (!activeBatchId) {
      const { data: batch } = await supabase
        .from('classification_batches')
        .insert({
          batch_type: 'sales',
          status: 'running',
          total_target: totalDefault || 0,
          chunk_size: chunkSize,
        })
        .select('id')
        .single();
      activeBatchId = batch?.id;
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          wouldProcess: invoices.length,
          totalDefault: totalDefault || 0,
          batchId: activeBatchId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process invoices by calling classify-sales-category
    let reclassified = 0;
    let unchanged = 0;
    let errors = 0;
    let lastProcessedId: string | null = null;

    for (const inv of invoices) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/classify-sales-category`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoice_id: inv.id }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          if (result.category?.category !== 'prestacao_servicos') {
            reclassified++;
          } else {
            unchanged++;
          }
        } else if (response.status === 429) {
          console.warn('Rate limited at sales invoice:', inv.id);
          break;
        } else {
          errors++;
        }
      } catch (err) {
        errors++;
      }

      lastProcessedId = inv.id;

      // Small delay
      await new Promise(r => setTimeout(r, 50));
    }

    const processed = reclassified + unchanged + errors;

    // Update batch progress
    if (activeBatchId) {
      const { data: currentBatch } = await supabase
        .from('classification_batches')
        .select('total_processed, total_classified, total_errors')
        .eq('id', activeBatchId)
        .single();

      await supabase
        .from('classification_batches')
        .update({
          total_processed: (currentBatch?.total_processed || 0) + processed,
          total_classified: (currentBatch?.total_classified || 0) + reclassified,
          total_errors: (currentBatch?.total_errors || 0) + errors,
          cursor_position: lastProcessedId,
        })
        .eq('id', activeBatchId);
    }

    // Count remaining
    const { count: remaining } = await supabase
      .from('sales_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('revenue_category', 'prestacao_servicos')
      .is('ai_category_confidence', null);

    console.log(`Sales batch done: ${reclassified} reclassified, ${unchanged} unchanged, ${errors} errors, ${remaining ?? '?'} remaining`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        reclassified,
        unchanged,
        errors,
        remaining: remaining || 0,
        cursor: lastProcessedId,
        batchId: activeBatchId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('batch-classify-sales error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
