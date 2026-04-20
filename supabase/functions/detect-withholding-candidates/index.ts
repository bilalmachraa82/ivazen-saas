/**
 * Detect Withholding Candidates — scans sales invoices (FR/FS/FS-FR)
 * for potential tax withholding entries (Modelo 10).
 * Service-role only.
 *
 * Logic:
 * - FR/FS/FS-FR documents (Fatura-Recibo / Recibos Verdes) from self-employed to companies
 *   are subject to withholding at source (retenção na fonte)
 * - If customer_nif starts with 5 (empresa) → Cat B withholding at 23% (2025+) or 25% (pre-2025)
 * - base_amount = total_amount / 1.23 (if VAT charged) or total_amount (if exempt)
 */

import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import { isConfiguredServiceRoleToken, extractBearerToken } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

// Withholding rates by year (Art. 101 CIRS)
const WITHHOLDING_RATES: Record<number, number> = {
  2024: 25.0,
  2025: 23.0,
  2026: 23.0,
};
const DEFAULT_RATE = 23.0;

/**
 * Resolve explicit withholding amount.
 * Priority: dedicated column → notes regex fallback (backward compat).
 */
function resolveExplicitWithholding(
  withholdingAmountImported: number | null | undefined,
  notes: string | null,
): number | null {
  // Prefer the proper column (set by import after schema hardening migration)
  if (withholdingAmountImported != null && Number.isFinite(withholdingAmountImported)) {
    return withholdingAmountImported;
  }
  // Fallback: parse from notes regex (pre-migration data)
  if (!notes) return null;
  const match = notes.match(/AT_SIRE_WITHHOLDING=([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
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
    if (!isConfiguredServiceRoleToken(token)) {
      return new Response(
        JSON.stringify({ error: 'Service-role authentication required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      fiscalYear = new Date().getFullYear(),
      chunkSize = 500,
      dryRun = false,
      cursor = null,
    } = await req.json().catch(() => ({}));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch FR/FS sales invoices with cursor pagination
    let query = supabase
      .from('sales_invoices')
      .select('id, client_id, document_type, document_number, document_date, customer_nif, customer_name, supplier_nif, total_amount, total_vat, base_exempt, fiscal_period, notes, withholding_amount_imported')
      .in('document_type', ['FR', 'FS', 'FS/FR'])
      .gte('document_date', `${fiscalYear}-01-01`)
      .lte('document_date', `${fiscalYear}-12-31`)
      .order('created_at', { ascending: true })
      .limit(chunkSize);

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
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          candidatesCreated: 0,
          skipped: 0,
          message: `No FR/FS invoices found for ${fiscalYear}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing candidates to avoid duplicates
    const invoiceIds = invoices.map(i => i.id);
    const { data: existingCandidates } = await supabase
      .from('at_withholding_candidates')
      .select('source_sales_invoice_id')
      .in('source_sales_invoice_id', invoiceIds);

    const existingSet = new Set(
      (existingCandidates || []).map(c => c.source_sales_invoice_id)
    );

    let candidatesCreated = 0;
    let skipped = 0;
    const candidatesToInsert: any[] = [];

    for (const inv of invoices) {
      // Skip if already processed
      if (existingSet.has(inv.id)) {
        skipped++;
        continue;
      }

      // Only create candidate if customer_nif starts with 5 (empresa)
      const customerNif = (inv.customer_nif || '').trim();
      if (!customerNif || !customerNif.startsWith('5')) {
        skipped++;
        continue;
      }

      // Calculate base amount (before VAT)
      const totalAmount = Number(inv.total_amount) || 0;
      const totalVat = Number(inv.total_vat) || 0;
      const baseExempt = Number(inv.base_exempt) || 0;

      let baseAmount: number;
      if (totalVat > 0.01) {
        // Has VAT — base = total - vat
        baseAmount = totalAmount - totalVat;
      } else if (baseExempt > 0.01) {
        // Exempt from VAT
        baseAmount = baseExempt;
      } else {
        // No VAT info — assume total is the base
        baseAmount = totalAmount;
      }

      if (baseAmount <= 0) {
        skipped++;
        continue;
      }

      // Get fiscal year from document date
      const docDate = inv.document_date;
      const docYear = docDate ? new Date(docDate).getFullYear() : fiscalYear;
      const explicitWithholding = resolveExplicitWithholding(inv.withholding_amount_imported, inv.notes);

      if (explicitWithholding !== null && explicitWithholding <= 0.009) {
        skipped++;
        continue;
      }

      const fallbackRate = WITHHOLDING_RATES[docYear] || DEFAULT_RATE;
      const withholdingAmount = explicitWithholding !== null
        ? explicitWithholding
        : Math.round(baseAmount * (fallbackRate / 100) * 100) / 100;
      const rate = explicitWithholding !== null && baseAmount > 0
        ? Math.round((withholdingAmount / baseAmount) * 10000) / 100
        : fallbackRate;

      // Confidence score based on data completeness
      let confidence = 70;
      if (customerNif.length === 9) confidence += 10;
      if (inv.customer_name) confidence += 5;
      if (inv.document_number) confidence += 5;
      if (docDate) confidence += 5;
      if (totalVat > 0) confidence += 5; // Has explicit VAT breakdown
      if (explicitWithholding !== null) confidence += 10;
      confidence = Math.min(confidence, 95);

      candidatesToInsert.push({
        client_id: inv.client_id,
        source_sales_invoice_id: inv.id,
        fiscal_year: docYear,
        payment_date: docDate,
        document_reference: inv.document_number || `FR-${inv.id.slice(0, 8)}`,
        beneficiary_nif: inv.supplier_nif, // The seller (our client) is the beneficiary
        beneficiary_name: null, // Will be filled from profile if needed
        income_category: 'B', // Cat B = Trabalho Independente
        gross_amount: baseAmount,
        withholding_amount: withholdingAmount,
        withholding_rate: rate,
        confidence_score: confidence,
        detection_reason: explicitWithholding !== null
          ? `AT explicit withholding imported from sales invoice note (${withholdingAmount.toFixed(2)} EUR)`
          : `Auto-detected: FR/FS to empresa (NIF ${customerNif}), Cat B ${rate}%`,
        detected_keys: explicitWithholding !== null
          ? ['source:at_sire', 'withholding:explicit', `customer_nif:${customerNif.slice(0, 3)}***`]
          : ['document_type:FR', `customer_nif:${customerNif.slice(0, 3)}***`],
        raw_payload: {
          document_type: inv.document_type,
          total_amount: totalAmount,
          total_vat: totalVat,
          base_exempt: baseExempt,
          base_amount: baseAmount,
          explicit_withholding: explicitWithholding,
        },
        status: 'pending',
      });
    }

    if (dryRun) {
      const lastId = invoices.length > 0 ? invoices[invoices.length - 1].id : null;
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          wouldCreate: candidatesToInsert.length,
          skipped,
          totalScanned: invoices.length,
          sampleCandidate: candidatesToInsert[0] || null,
          cursor: lastId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert candidates in batches of 50
    if (candidatesToInsert.length > 0) {
      for (let i = 0; i < candidatesToInsert.length; i += 50) {
        const batch = candidatesToInsert.slice(i, i + 50);
        const { error: insertError } = await supabase
          .from('at_withholding_candidates')
          .upsert(batch, {
            onConflict: 'client_id,beneficiary_nif,document_reference,fiscal_year',
            ignoreDuplicates: true,
          });

        if (insertError) {
          console.error('Insert error:', insertError);
        } else {
          candidatesCreated += batch.length;
        }
      }
    }

    const lastId = invoices.length > 0 ? invoices[invoices.length - 1].id : null;

    console.log(`Withholding detection done: ${candidatesCreated} candidates, ${skipped} skipped out of ${invoices.length} scanned`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: invoices.length,
        candidatesCreated,
        skipped,
        fiscalYear,
        cursor: lastId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('detect-withholding-candidates error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
