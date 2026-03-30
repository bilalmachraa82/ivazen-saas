import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/supabasePagination';
import { getSalesInvoiceRevenueAmount } from '@/lib/socialSecurityRevenue';

export interface ReconciliationSummary {
  purchases: {
    atCount: number;
    uploadCount: number;
    divergentCount: number;
    status: 'ok' | 'warning' | 'error' | 'no_data';
  };
  modelo10: {
    atSourceCount: number;
    ocrSourceCount: number;
    nifMismatchCount: number;
    status: 'ok' | 'warning' | 'error' | 'no_data';
  };
  ss: {
    salesRevenue: number;
    declaredRevenue: number | null;
    delta: number;
    status: 'ok' | 'warning' | 'error' | 'no_data';
  };
  withholdings: {
    totalCount: number;
    pendingCandidates: number;
    status: 'ok' | 'warning' | 'no_data';
  };
}

interface UseReconciliationDataOptions {
  clientId: string | null | undefined;
  fiscalYear: number;
  quarter: number;
  rangeStart: string;
  rangeEnd: string;
}

export function useReconciliationData(options: UseReconciliationDataOptions) {
  const { clientId, fiscalYear, quarter, rangeStart, rangeEnd } = options;

  return useQuery({
    queryKey: ['reconciliation-summary', clientId, fiscalYear, quarter],
    queryFn: async (): Promise<ReconciliationSummary> => {
      if (!clientId) throw new Error('clientId required');

      const [
        atPurchasesRes,
        uploadPurchasesRes,
        atRows,
        ocrRows,
        salesRows,
        ssRes,
        withholdingsCountRes,
        candidatesRes,
      ] = await Promise.all([
        // Purchases from AT (efatura_source = webservice or csv_portal)
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .in('efatura_source', ['webservice', 'csv_portal']),
        // Purchases from manual upload/OCR (efatura_source = manual, null, or any non-AT value)
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .or('efatura_source.is.null,efatura_source.not.in.(webservice,csv_portal)'),
        // Modelo 10 withholdings from AT source (fetchAllPages to avoid 1000-row cap)
        fetchAllPages<{ beneficiary_nif: string; withholding_amount: number }>(
          (from, to) =>
            supabase
              .from('tax_withholdings')
              .select('beneficiary_nif, withholding_amount')
              .eq('client_id', clientId)
              .eq('fiscal_year', fiscalYear)
              .in('import_source', ['at_csv', 'at_sire', 'at_sire_detection'])
              .range(from, to),
        ),
        // Modelo 10 withholdings from OCR/manual (fetchAllPages to avoid 1000-row cap)
        // Use .or() to include NULL import_source (legacy rows) + any non-AT source
        fetchAllPages<{ beneficiary_nif: string; withholding_amount: number }>(
          (from, to) =>
            supabase
              .from('tax_withholdings')
              .select('beneficiary_nif, withholding_amount')
              .eq('client_id', clientId)
              .eq('fiscal_year', fiscalYear)
              .or('import_source.is.null,import_source.not.in.(at_csv,at_sire,at_sire_detection)')
              .range(from, to),
        ),
        // Sales revenue for the quarter (fetchAllPages to avoid 1000-row cap)
        fetchAllPages<{
          base_reduced: number | null;
          base_intermediate: number | null;
          base_standard: number | null;
          base_exempt: number | null;
          total_amount: number | null;
          total_vat: number | null;
          document_type: string | null;
          revenue_category: string | null;
        }>(
          (from, to) =>
            supabase
              .from('sales_invoices')
              .select('base_reduced, base_intermediate, base_standard, base_exempt, total_amount, total_vat, document_type, revenue_category')
              .eq('client_id', clientId)
              .eq('status', 'validated')
              .gte('document_date', rangeStart)
              .lte('document_date', rangeEnd)
              .range(from, to),
        ),
        // SS declaration for the quarter
        supabase
          .from('ss_declarations')
          .select('total_revenue, status')
          .eq('client_id', clientId)
          .eq('period_quarter', `${fiscalYear}-Q${quarter}`)
          .maybeSingle(),
        // Total withholdings count
        supabase
          .from('tax_withholdings')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('fiscal_year', fiscalYear),
        // Pending candidates
        supabase
          .from('at_withholding_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('fiscal_year', fiscalYear)
          .eq('status', 'pending'),
      ]);

      // --- Purchases reconciliation ---
      const atCount = atPurchasesRes.count ?? 0;
      const uploadCount = uploadPurchasesRes.count ?? 0;
      const totalPurchases = atCount + uploadCount;
      // Rough divergent estimation: if both sources exist but counts differ significantly
      const divergentCount = 0; // Full divergence needs detail query (done in panel)
      const purchasesStatus = totalPurchases === 0
        ? 'no_data' as const
        : uploadCount > 0 && atCount === 0
          ? 'warning' as const
          : 'ok' as const;

      // --- Modelo 10 reconciliation ---
      // atRows and ocrRows are already full arrays from fetchAllPages
      const atByNif = new Map<string, number>();
      atRows.forEach(r => {
        const nif = r.beneficiary_nif || '';
        atByNif.set(nif, (atByNif.get(nif) || 0) + Number(r.withholding_amount || 0));
      });
      const ocrByNif = new Map<string, number>();
      ocrRows.forEach(r => {
        const nif = r.beneficiary_nif || '';
        ocrByNif.set(nif, (ocrByNif.get(nif) || 0) + Number(r.withholding_amount || 0));
      });
      let nifMismatchCount = 0;
      const allNifs = new Set([...atByNif.keys(), ...ocrByNif.keys()]);
      allNifs.forEach(nif => {
        const atAmt = atByNif.get(nif) || 0;
        const ocrAmt = ocrByNif.get(nif) || 0;
        if (Math.abs(atAmt - ocrAmt) > 1) nifMismatchCount++;
      });
      const modelo10Status =
        atRows.length === 0 && ocrRows.length === 0
          ? 'no_data' as const
          : nifMismatchCount > 0
            ? 'warning' as const
            : 'ok' as const;

      // --- SS reconciliation ---
      const salesRevenue = salesRows.reduce((sum, row) => {
        return sum + getSalesInvoiceRevenueAmount(row);
      }, 0);
      const declaredRevenue = ssRes.data?.total_revenue ?? null;
      const ssDelta = declaredRevenue != null ? Math.abs(salesRevenue - declaredRevenue) : 0;
      const ssStatus =
        salesRevenue === 0 && declaredRevenue == null
          ? 'no_data' as const
          : declaredRevenue == null
            ? 'warning' as const
            : ssDelta > 100
              ? 'error' as const
              : ssDelta > 1
                ? 'warning' as const
                : 'ok' as const;

      // --- Withholdings ---
      const totalWCount = withholdingsCountRes.count ?? 0;
      const pendingC = candidatesRes.count ?? 0;
      const wStatus =
        totalWCount === 0 && pendingC === 0
          ? 'no_data' as const
          : pendingC > 0
            ? 'warning' as const
            : 'ok' as const;

      return {
        purchases: { atCount, uploadCount, divergentCount, status: purchasesStatus },
        modelo10: {
          atSourceCount: atRows.length,
          ocrSourceCount: ocrRows.length,
          nifMismatchCount,
          status: modelo10Status,
        },
        ss: { salesRevenue, declaredRevenue, delta: ssDelta, status: ssStatus },
        withholdings: { totalCount: totalWCount, pendingCandidates: pendingC, status: wStatus },
      };
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });
}
