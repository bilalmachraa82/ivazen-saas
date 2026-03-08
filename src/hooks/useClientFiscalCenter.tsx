import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveScopedClientId } from '@/lib/clientScope';
import { applyFiscallyEffectivePurchaseFilter } from '@/lib/fiscalStatus';
import { useTaxpayerKind } from '@/hooks/useTaxpayerKind';

const PENDING_PURCHASE_FILTER =
  'status.eq.pending,and(status.eq.classified,requires_accountant_validation.is.true),and(status.eq.classified,requires_accountant_validation.is.null)';

interface ClientSummary {
  id: string;
  full_name: string | null;
  company_name: string | null;
  nif: string | null;
  vat_regime: string | null;
  worker_type: string | null;
  taxpayer_kind: string | null;
}

interface SyncEntry {
  created_at: string;
  sync_type: 'compras' | 'vendas' | 'ambos';
  sync_method: 'api' | 'csv' | 'manual' | 'portal';
  status: 'pending' | 'running' | 'success' | 'partial' | 'error';
  records_imported: number;
  records_errors: number;
}

export interface ClientFiscalCenterData {
  client: ClientSummary | null;
  at: {
    hasCredentials: boolean;
    lastSyncStatus: string | null;
    lastSyncAt: string | null;
    lastSyncError: string | null;
    recentSyncs: SyncEntry[];
  };
  purchases: {
    total: number;
    pending: number;
    effective: number;
    lowConfidence: number;
  };
  sales: {
    total: number;
    ready: number;
    pending: number;
  };
  ss: {
    declarationCount: number;
    latestDeclarationQuarter: string | null;
    latestDeclarationStatus: string | null;
    latestRevenue: number | null;
  };
  modelo10: {
    fiscalYear: number;
    withholdingsCount: number;
    pendingCandidates: number;
  };
}

export function useClientFiscalCenter(forClientId?: string | null) {
  const { user } = useAuth();
  const effectiveClientId = resolveScopedClientId(forClientId, user?.id);
  const { taxpayerKind, isLoading: isLoadingTaxpayerKind } = useTaxpayerKind(forClientId);

  const query = useQuery({
    queryKey: ['client-fiscal-center', effectiveClientId],
    queryFn: async (): Promise<ClientFiscalCenterData | null> => {
      if (!effectiveClientId) return null;

      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      const [
        clientRes,
        atCredentialsRes,
        syncHistoryRes,
        purchasesTotalRes,
        purchasesPendingRes,
        purchasesEffectiveRes,
        purchasesLowConfidenceRes,
        salesTotalRes,
        salesReadyRes,
        ssCountRes,
        latestSsRes,
        withholdingsCurrentRes,
        withholdingsPreviousRes,
        candidatesCurrentRes,
        candidatesPreviousRes,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, company_name, nif, vat_regime, worker_type, taxpayer_kind')
          .eq('id', effectiveClientId)
          .maybeSingle(),
        supabase
          .from('at_credentials')
          .select('last_sync_status, last_sync_at, last_sync_error')
          .eq('client_id', effectiveClientId)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('at_sync_history')
          .select('created_at, sync_type, sync_method, status, records_imported, records_errors')
          .eq('client_id', effectiveClientId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .or(PENDING_PURCHASE_FILTER),
        applyFiscallyEffectivePurchaseFilter(
          supabase
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', effectiveClientId),
        ),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .lt('ai_confidence', 80)
          .neq('status', 'validated'),
        supabase
          .from('sales_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId),
        supabase
          .from('sales_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .in('status', ['validated', 'classified']),
        supabase
          .from('ss_declarations')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId),
        supabase
          .from('ss_declarations')
          .select('period_quarter, status, total_revenue')
          .eq('client_id', effectiveClientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('tax_withholdings')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .eq('fiscal_year', currentYear),
        supabase
          .from('tax_withholdings')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .eq('fiscal_year', previousYear),
        supabase
          .from('at_withholding_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .eq('fiscal_year', currentYear)
          .eq('status', 'pending'),
        supabase
          .from('at_withholding_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .eq('fiscal_year', previousYear)
          .eq('status', 'pending'),
      ]);

      const currentModelo10Activity =
        (withholdingsCurrentRes.count ?? 0) + (candidatesCurrentRes.count ?? 0);
      const previousModelo10Activity =
        (withholdingsPreviousRes.count ?? 0) + (candidatesPreviousRes.count ?? 0);

      const modelo10FiscalYear =
        currentModelo10Activity > 0 || previousModelo10Activity === 0
          ? currentYear
          : previousYear;

      const withholdingsCount =
        modelo10FiscalYear === currentYear
          ? (withholdingsCurrentRes.count ?? 0)
          : (withholdingsPreviousRes.count ?? 0);

      const pendingCandidates =
        modelo10FiscalYear === currentYear
          ? (candidatesCurrentRes.count ?? 0)
          : (candidatesPreviousRes.count ?? 0);

      const salesTotal = salesTotalRes.count ?? 0;
      const salesReady = salesReadyRes.count ?? 0;

      return {
        client: (clientRes.data || null) as ClientSummary | null,
        at: {
          hasCredentials: !!atCredentialsRes.data,
          lastSyncStatus: atCredentialsRes.data?.last_sync_status ?? null,
          lastSyncAt: atCredentialsRes.data?.last_sync_at ?? null,
          lastSyncError: atCredentialsRes.data?.last_sync_error ?? null,
          recentSyncs: (syncHistoryRes.data || []) as SyncEntry[],
        },
        purchases: {
          total: purchasesTotalRes.count ?? 0,
          pending: purchasesPendingRes.count ?? 0,
          effective: purchasesEffectiveRes.count ?? 0,
          lowConfidence: purchasesLowConfidenceRes.count ?? 0,
        },
        sales: {
          total: salesTotal,
          ready: salesReady,
          pending: Math.max(0, salesTotal - salesReady),
        },
        ss: {
          declarationCount: ssCountRes.count ?? 0,
          latestDeclarationQuarter: latestSsRes.data?.period_quarter ?? null,
          latestDeclarationStatus: latestSsRes.data?.status ?? null,
          latestRevenue: latestSsRes.data?.total_revenue ?? null,
        },
        modelo10: {
          fiscalYear: modelo10FiscalYear,
          withholdingsCount,
          pendingCandidates,
        },
      };
    },
    enabled: !!effectiveClientId,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    taxpayerKind,
    isLoading: query.isLoading || isLoadingTaxpayerKind,
    refetch: query.refetch,
  };
}
