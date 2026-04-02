import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useAuth } from '@/hooks/useAuth';
import { resolveScopedClientId } from '@/lib/clientScope';
import { applyFiscallyEffectivePurchaseFilter } from '@/lib/fiscalStatus';
import { useTaxpayerKind } from '@/hooks/useTaxpayerKind';
import { getQuarterDateRange, getQuarterLabel } from '@/lib/fiscalQuarter';
import { hasAnyUsableATConnectorAccess } from '@/lib/atConnectorAccess';

const PENDING_PURCHASE_FILTER =
  'status.eq.pending,and(status.eq.classified,requires_accountant_validation.is.true),and(status.eq.classified,requires_accountant_validation.is.null)';

interface ClientSummary {
  id: string;
  full_name: string | null;
  company_name: string | null;
  nif: string | null;
  vat_regime: string | null;
  iva_cadence: 'monthly' | 'quarterly' | null;
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
  error_message?: string | null;
  reason_code?: string | null;
}

interface UseClientFiscalCenterOptions {
  clientId?: string | null;
  fiscalYear?: number;
  quarter?: number;
}

export interface ClientFiscalCenterData {
  period: {
    fiscalYear: number;
    quarter: number;
    quarterLabel: string;
    rangeStart: string;
    rangeEnd: string;
  };
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
    readyRevenue: number;
  };
  ss: {
    declarationCount: number;
    currentDeclarationStatus: string | null;
    currentRevenue: number;
  };
  modelo10: {
    fiscalYear: number;
    withholdingsCount: number;
    pendingCandidates: number;
  };
}

export function useClientFiscalCenter(options: UseClientFiscalCenterOptions = {}) {
  const { user, roles } = useAuth();
  const effectiveClientId = resolveScopedClientId(options.clientId, user?.id);
  const isAccountant = roles.includes('accountant');
  const { taxpayerKind, isLoading: isLoadingTaxpayerKind } = useTaxpayerKind(options.clientId);
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const fiscalYear = options.fiscalYear ?? currentYear;
  const quarter = options.quarter ?? currentQuarter;
  const quarterRange = getQuarterDateRange(fiscalYear, quarter);
  const quarterLabel = getQuarterLabel(fiscalYear, quarter);

  const query = useQuery({
    queryKey: ['client-fiscal-center', effectiveClientId, fiscalYear, quarter, user?.id, isAccountant],
    queryFn: async (): Promise<ClientFiscalCenterData | null> => {
      if (!effectiveClientId) return null;
      const previousYear = fiscalYear - 1;

      const [
        clientRes,
        atCredentialsRes,
        accountantConfigRes,
        syncHistoryRes,
        purchasesTotalRes,
        purchasesPendingRes,
        purchasesEffectiveRes,
        purchasesLowConfidenceRes,
        salesTotalRes,
        salesReadyCountRes,
        salesReadyAmountsRes,
        ssCountRes,
        currentQuarterSsRes,
        withholdingsCurrentRes,
        withholdingsPreviousRes,
        candidatesCurrentRes,
        candidatesPreviousRes,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, company_name, nif, vat_regime, iva_cadence, worker_type, taxpayer_kind')
          .eq('id', effectiveClientId)
          .maybeSingle(),
        supabase
          .from('at_credentials')
          .select('subuser_id, encrypted_username, portal_nif, encrypted_password, portal_password_encrypted, last_sync_status, last_sync_at, last_sync_error')
          .eq('client_id', effectiveClientId)
          .limit(1)
          .maybeSingle(),
        isAccountant && user?.id
          ? supabase
            .from('accountant_at_config')
            .select('is_active, subuser_id, subuser_password_encrypted')
            .eq('accountant_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('at_sync_history')
          .select('created_at, sync_type, sync_method, status, records_imported, records_errors, error_message, reason_code')
          .eq('client_id', effectiveClientId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .gte('document_date', quarterRange.start)
          .lte('document_date', quarterRange.end),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .gte('document_date', quarterRange.start)
          .lte('document_date', quarterRange.end)
          .or(PENDING_PURCHASE_FILTER),
        applyFiscallyEffectivePurchaseFilter(
          supabase
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', effectiveClientId)
            .gte('document_date', quarterRange.start)
            .lte('document_date', quarterRange.end),
        ),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .gte('document_date', quarterRange.start)
          .lte('document_date', quarterRange.end)
          .lt('ai_confidence', 80)
          .neq('status', 'validated'),
        // Sales: total count (head-only, no rows transferred)
        supabase
          .from('sales_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .gte('document_date', quarterRange.start)
          .lte('document_date', quarterRange.end),
        // Sales: ready (validated/classified) count (head-only)
        supabase
          .from('sales_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .gte('document_date', quarterRange.start)
          .lte('document_date', quarterRange.end)
          .in('status', ['validated', 'classified']),
        // Sales: ready revenue (only total_amount column for ready rows)
        supabase
          .from('sales_invoices')
          .select('total_amount')
          .eq('client_id', effectiveClientId)
          .gte('document_date', quarterRange.start)
          .lte('document_date', quarterRange.end)
          .in('status', ['validated', 'classified']),
        supabase
          .from('ss_declarations')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId),
        supabase
          .from('ss_declarations')
          .select('period_quarter, status, total_revenue')
          .eq('client_id', effectiveClientId)
          .eq('period_quarter', `${fiscalYear}-Q${quarter}`)
          .maybeSingle(),
        supabase
          .from('tax_withholdings')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .eq('fiscal_year', fiscalYear),
        supabase
          .from('tax_withholdings')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .eq('fiscal_year', previousYear),
        supabase
          .from('at_withholding_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .eq('fiscal_year', fiscalYear)
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
          ? fiscalYear
          : previousYear;

      const withholdingsCount =
        modelo10FiscalYear === fiscalYear
          ? (withholdingsCurrentRes.count ?? 0)
          : (withholdingsPreviousRes.count ?? 0);

      const pendingCandidates =
        modelo10FiscalYear === fiscalYear
          ? (candidatesCurrentRes.count ?? 0)
          : (candidatesPreviousRes.count ?? 0);

      const salesTotal = salesTotalRes.count ?? 0;
      const salesReady = salesReadyCountRes.count ?? 0;
      const readyRevenue = (salesReadyAmountsRes.data ?? []).reduce(
        (sum, row) => sum + Number(row.total_amount || 0),
        0,
      );
      const recentSyncs = (syncHistoryRes.data || []) as SyncEntry[];
      const latestSync = recentSyncs[0] ?? null;
      const clientNif = clientRes.data?.nif ?? null;

      return {
        period: {
          fiscalYear,
          quarter,
          quarterLabel,
          rangeStart: quarterRange.start,
          rangeEnd: quarterRange.end,
        },
        client: (clientRes.data || null) as ClientSummary | null,
        at: {
          hasCredentials: hasAnyUsableATConnectorAccess({
            credential: atCredentialsRes.data,
            sharedConfig: accountantConfigRes.data,
            clientNif,
          }),
          lastSyncStatus: atCredentialsRes.data?.last_sync_status || latestSync?.status || null,
          lastSyncAt: atCredentialsRes.data?.last_sync_at || latestSync?.created_at || null,
          lastSyncError: atCredentialsRes.data?.last_sync_error || latestSync?.error_message || null,
          recentSyncs,
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
          readyRevenue,
        },
        ss: {
          declarationCount: ssCountRes.count ?? 0,
          currentDeclarationStatus: currentQuarterSsRes.data?.status ?? null,
          currentRevenue: currentQuarterSsRes.data?.total_revenue ?? readyRevenue,
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
