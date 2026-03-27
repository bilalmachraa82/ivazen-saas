/**
 * Batch Classify Invoices — cursor-based batch processing
 * Invokes classify-invoice for each pending purchase invoice
 * Service-role only.
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isServiceRoleToken, extractBearerToken } from "../_shared/auth.ts";

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
    if (!isServiceRoleToken(token, supabaseServiceKey)) {
      return new Response(
        JSON.stringify({ error: 'Service-role authentication required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      chunkSize = 50,
      dryRun = false,
      cursor = null,
      batchId = null,
      prioritizeUniqueNifs = false,
    } = await req.json().catch(() => ({}));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Count total pending
    const { count: totalPending } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Fetch pending invoices (cursor-based, with optional unique NIF prioritization)
    let invoices: { id: string }[] | null = null;
    let fetchError: any = null;

    if (prioritizeUniqueNifs) {
      // Unique NIF mode: pick 1 invoice per NIF that has no existing classification rule
      // This maximizes rule creation per AI call (auto-learn creates rules for future use)
      const { data, error } = await supabase.rpc('get_unique_nif_pending_invoices', {
        p_limit: Math.min(chunkSize, 200),
      }).catch(() => ({ data: null, error: null }));

      if (data && !error) {
        invoices = data;
      } else {
        // Fallback: if RPC doesn't exist, use raw query with distinct-like approach
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('invoices')
          .select('id, supplier_nif')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(Math.min(chunkSize * 5, 1000));

        if (fallbackError) {
          fetchError = fallbackError;
        } else {
          // Deduplicate by NIF client-side
          const seenNifs = new Set<string>();
          const unique: { id: string }[] = [];
          for (const inv of (fallbackData || [])) {
            const nif = (inv.supplier_nif || '').trim();
            if (nif && seenNifs.has(nif)) continue;
            if (nif) seenNifs.add(nif);
            unique.push({ id: inv.id });
            if (unique.length >= Math.min(chunkSize, 200)) break;
          }
          invoices = unique;
        }
      }
    } else {
      // Standard cursor-based fetch
      let query = supabase
        .from('invoices')
        .select('id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(Math.min(chunkSize, 200));

      if (cursor) {
        const { data: cursorRow } = await supabase
          .from('invoices')
          .select('created_at')
          .eq('id', cursor)
          .single();

        if (cursorRow) {
          query = query.gt('created_at', cursorRow.created_at);
        }
      }

      const result = await query;
      invoices = result.data;
      fetchError = result.error;
    }

    if (fetchError) {
      console.error('Failed to fetch pending invoices:', fetchError);
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    if (!invoices || invoices.length === 0) {
      // Create/update batch record as completed
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
          classified: 0,
          errors: 0,
          remaining: 0,
          cursor: null,
          message: 'No pending invoices to classify',
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
          batch_type: 'purchase',
          status: 'running',
          total_target: totalPending || 0,
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
          totalPending: totalPending || 0,
          firstInvoiceId: invoices[0]?.id,
          lastInvoiceId: invoices[invoices.length - 1]?.id,
          batchId: activeBatchId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process invoices sequentially by calling classify-invoice
    let classified = 0;
    let errors = 0;
    let aiCalls = 0;
    let ruleCalls = 0;
    let intraCommunity = 0;
    const errorLog: { invoice_id: string; error: string }[] = [];
    let lastProcessedId: string | null = null;

    for (const inv of invoices) {
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
          classified++;
          // Track classification source for stats
          if (result.source === 'ai') aiCalls++;
          else if (result.source === 'rule') ruleCalls++;
          else if (result.source === 'intra-community-rule') intraCommunity++;
        } else if (response.status === 429) {
          // Rate limited — stop this chunk, resume later
          console.warn('Rate limited at invoice:', inv.id);
          errorLog.push({ invoice_id: inv.id, error: 'Rate limited' });
          break;
        } else {
          errors++;
          errorLog.push({
            invoice_id: inv.id,
            error: result.error || `HTTP ${response.status}`,
          });
        }
      } catch (err) {
        errors++;
        errorLog.push({
          invoice_id: inv.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      lastProcessedId = inv.id;

      // Small delay to avoid overwhelming the system
      await new Promise(r => setTimeout(r, 100));
    }

    const processed = classified + errors;

    // Update batch progress
    if (activeBatchId) {
      const { data: currentBatch } = await supabase
        .from('classification_batches')
        .select('total_processed, total_classified, total_errors, error_log')
        .eq('id', activeBatchId)
        .single();

      await supabase
        .from('classification_batches')
        .update({
          total_processed: (currentBatch?.total_processed || 0) + processed,
          total_classified: (currentBatch?.total_classified || 0) + classified,
          total_errors: (currentBatch?.total_errors || 0) + errors,
          cursor_position: lastProcessedId,
          error_log: [...(currentBatch?.error_log || []), ...errorLog].slice(-100),
        })
        .eq('id', activeBatchId);
    }

    // Count remaining
    const { count: remaining } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    console.log(`Batch chunk done: ${classified} classified, ${errors} errors, ${remaining ?? '?'} remaining`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        classified,
        errors,
        remaining: remaining || 0,
        cursor: lastProcessedId,
        batchId: activeBatchId,
        stats: { aiCalls, ruleCalls, intraCommunity },
        errorLog: errorLog.length > 0 ? errorLog : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('batch-classify-invoices error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
