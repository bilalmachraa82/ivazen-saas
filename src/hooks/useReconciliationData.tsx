import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSalesInvoiceRevenueAmount } from '@/lib/socialSecurityRevenue';

const AT_SOURCES = ['at_csv', 'at_sire', 'at_sire_detection'] as const;

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
        atWithholdingsCountRes,
        ocrWithholdingsCountRes,
        nifMismatchRows,
        salesRows,
        ssRes,
        withholdingsCountRes,
        candidatesRes,
      ] = await Promise.all([
        // Purchases from AT (efatura_source = webservice or csv_portal) — count only
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .in('efatura_source', ['webservice', 'csv_portal']),
        // Purchases from manual upload/OCR — count only
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .or('efatura_source.is.null,efatura_source.not.in.(webservice,csv_portal)'),
        // Modelo 10 AT-source withholdings — count only (no row data needed)
        supabase
          .from('tax_withholdings')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('fiscal_year', fiscalYear)
          .in('import_source', [...AT_SOURCES]),
        // Modelo 10 OCR/manual withholdings — count only (no row data needed)
        supabase
          .from('tax_withholdings')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('fiscal_year', fiscalYear)
          .or('import_source.is.null,import_source.not.in.(at_csv,at_sire,at_sire_detection)'),
        // NIF mismatch detection — minimal columns: beneficiary_nif + import_source + withholding_amount
        // Single query fetching all withholdings for client-side NIF grouping (≤1000 rows per client-year typical)
        supabase
          .from('tax_withholdings')
          .select('beneficiary_nif, import_source, withholding_amount')
          .eq('client_id', clientId)
          .eq('fiscal_year', fiscalYear)
          .limit(5000),
        // Sales revenue — only the columns needed for getSalesInvoiceRevenueAmount()
        supabase
          .from('sales_invoices')
          .select('base_reduced, base_intermediate, base_standard, base_exempt, total_amount, total_vat, document_type, revenue_category')
          .eq('client_id', clientId)
          .eq('status', 'validated')
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .limit(5000),
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
      const divergentCount = 0; // Full divergence needs detail query (done in panel)
      const purchasesStatus = totalPurchases === 0
        ? 'no_data' as const
        : uploadCount > 0 && atCount === 0
          ? 'warning' as const
          : 'ok' as const;

      // --- Modelo 10 reconciliation ---
      const atSourceCount = atWithholdingsCountRes.count ?? 0;
      const ocrSourceCount = ocrWithholdingsCountRes.count ?? 0;

      // NIF mismatch detection — group the minimal rows by NIF and source
      const allWithholdings = nifMismatchRows.data ?? [];
      const atByNif = new Map<string, number>();
      const ocrByNif = new Map<string, number>();
      allWithholdings.forEach(r => {
        const nif = r.beneficiary_nif || '';
        const amt = Number(r.withholding_amount || 0);
        const isAT = AT_SOURCES.includes(r.import_source as typeof AT_SOURCES[number]);
        if (isAT) {
          atByNif.set(nif, (atByNif.get(nif) || 0) + amt);
        } else {
          ocrByNif.set(nif, (ocrByNif.get(nif) || 0) + amt);
        }
      });
      let nifMismatchCount = 0;
      const allNifs = new Set([...atByNif.keys(), ...ocrByNif.keys()]);
      allNifs.forEach(nif => {
        const atAmt = atByNif.get(nif) || 0;
        const ocrAmt = ocrByNif.get(nif) || 0;
        if (Math.abs(atAmt - ocrAmt) > 1) nifMismatchCount++;
      });
      const modelo10Status =
        atSourceCount === 0 && ocrSourceCount === 0
          ? 'no_data' as const
          : nifMismatchCount > 0
            ? 'warning' as const
            : 'ok' as const;

      // --- SS reconciliation ---
      const allSales = salesRows.data ?? [];
      const salesRevenue = allSales.reduce((sum, row) => {
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
          atSourceCount,
          ocrSourceCount,
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
