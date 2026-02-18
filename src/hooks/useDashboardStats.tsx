import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DashboardStats {
  total: number;
  pending: number;
  validated: number;
  lowConfidence: number;
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

export function useDashboardStats(forClientId?: string | null) {
  const { user, hasRole } = useAuth();
  const isAccountant = hasRole('accountant');

  // For accountants: use selected client, or aggregate all clients
  // For regular users: always use own ID
  const effectiveClientId = isAccountant ? forClientId : user?.id;

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats', user?.id, effectiveClientId, isAccountant],
    queryFn: async (): Promise<DashboardStats> => {
      if (!effectiveClientId) return EMPTY_STATS;

      let query = supabase
        .from('invoices')
        .select('status, ai_confidence');

      if (effectiveClientId) {
        query = query.eq('client_id', effectiveClientId);
      }

      const { data: invoices, error } = await query;

      if (error) {
        console.error('Error fetching stats:', error);
        return EMPTY_STATS;
      }

      if (!invoices || invoices.length === 0) {
        return EMPTY_STATS;
      }

      const total = invoices.length;
      const pending = invoices.filter(i => i.status === 'pending' || i.status === 'classified').length;
      const validated = invoices.filter(i => i.status === 'validated').length;
      const lowConfidence = invoices.filter(i => (i.ai_confidence || 0) < 80 && i.status !== 'validated').length;

      return { total, pending, validated, lowConfidence };
    },
    enabled: !!effectiveClientId,
  });

  const { data: recentInvoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['recent-invoices', user?.id, effectiveClientId, isAccountant],
    queryFn: async (): Promise<RecentInvoice[]> => {
      if (!effectiveClientId) return [];

      let query = supabase
        .from('invoices')
        .select('id, supplier_name, total_amount, status, ai_confidence, document_date');

      if (effectiveClientId) {
        query = query.eq('client_id', effectiveClientId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching recent invoices:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(inv => ({
        id: inv.id,
        supplier: inv.supplier_name || 'Fornecedor desconhecido',
        amount: Number(inv.total_amount),
        status: inv.status as 'pending' | 'validated' | 'classified',
        confidence: inv.ai_confidence || 0,
        date: new Date(inv.document_date).toLocaleDateString('pt-PT'),
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
