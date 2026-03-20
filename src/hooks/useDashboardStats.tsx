import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { enrichSupplierNames, getSupplierDisplayName } from '@/lib/supplierNameResolver';

interface DashboardStats {
  total: number;
  pending: number;
  validated: number;
  lowConfidence: number;
}

interface DashboardStatsFilters {
  year?: number | null;
}

interface RecentInvoice {
  id: string;
  supplier: string;
  amount: number;
  status: 'pending' | 'validated' | 'classified';
  confidence: number;
  date: string;
}

const EMPTY_STATS: DashboardStats = {
  total: 0,
  pending: 0,
  validated: 0,
  lowConfidence: 0,
};

export function useDashboardStats(forClientId?: string | null, filters?: DashboardStatsFilters) {
  const { user, hasRole } = useAuth();
  const isAccountant = hasRole('accountant');
  const year = filters?.year ?? null;
  const startOfYear = year ? `${year}-01-01` : null;
  const endOfYear = year ? `${year}-12-31` : null;

  // For accountants: use selected client, or aggregate all clients
  // For regular users: always use own ID
  const effectiveClientId = isAccountant ? forClientId : user?.id;

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats', user?.id, effectiveClientId, isAccountant, year],
    queryFn: async (): Promise<DashboardStats> => {
      if (!effectiveClientId) return EMPTY_STATS;

      let totalQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', effectiveClientId);
      let pendingQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', effectiveClientId)
        .in('status', ['pending', 'classified']);
      let validatedQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', effectiveClientId)
        .eq('status', 'validated');
      let lowConfidenceQuery = supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', effectiveClientId)
        .lt('ai_confidence', 80)
        .neq('status', 'validated');

      if (year) {
        totalQuery = totalQuery.gte('document_date', startOfYear).lte('document_date', endOfYear);
        pendingQuery = pendingQuery.gte('document_date', startOfYear).lte('document_date', endOfYear);
        validatedQuery = validatedQuery.gte('document_date', startOfYear).lte('document_date', endOfYear);
        lowConfidenceQuery = lowConfidenceQuery.gte('document_date', startOfYear).lte('document_date', endOfYear);
      }

      const [totalRes, pendingRes, validatedRes, lowConfRes] = await Promise.all([
        totalQuery,
        pendingQuery,
        validatedQuery,
        lowConfidenceQuery,
      ]);

      if (totalRes.error) {
        console.error('Error fetching stats:', totalRes.error);
        return EMPTY_STATS;
      }

      return {
        total: totalRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        validated: validatedRes.count ?? 0,
        lowConfidence: lowConfRes.count ?? 0,
      };
    },
    enabled: !!effectiveClientId,
  });

  const { data: recentInvoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['recent-invoices', user?.id, effectiveClientId, isAccountant, year],
    queryFn: async (): Promise<RecentInvoice[]> => {
      if (!effectiveClientId) return [];

      let query = supabase
        .from('invoices')
        .select('id, supplier_name, supplier_nif, total_amount, status, ai_confidence, document_date');

      if (effectiveClientId) {
        query = query.eq('client_id', effectiveClientId);
      }

      if (year) {
        query = query.gte('document_date', startOfYear).lte('document_date', endOfYear);
      }

      const { data, error } = await query
        .order('document_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching recent invoices:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      const enrichedData = await enrichSupplierNames(data);

      return enrichedData.map(inv => ({
        id: inv.id,
        supplier: getSupplierDisplayName(inv.supplier_name, inv.supplier_nif),
        amount: Number(inv.total_amount),
        status: inv.status as 'pending' | 'validated' | 'classified',
        confidence: inv.ai_confidence || 0,
        date: inv.document_date
          ? new Date(inv.document_date).toLocaleDateString('pt-PT')
          : '—',
      }));
    },
    enabled: !!effectiveClientId,
  });

  const refetch = async () => {
    await refetchStats();
    await refetchInvoices();
  };

  return {
    stats: stats || EMPTY_STATS,
    recentInvoices: recentInvoices || [],
    isLoading: statsLoading || invoicesLoading,
    refetch,
  };
}
