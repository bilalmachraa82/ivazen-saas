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

export function useDashboardStats() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user) return EMPTY_STATS;

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('status, ai_confidence')
        .eq('client_id', user.id);

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
    enabled: !!user,
  });

  const { data: recentInvoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['recent-invoices', user?.id],
    queryFn: async (): Promise<RecentInvoice[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select('id, supplier_name, total_amount, status, ai_confidence, document_date')
        .eq('client_id', user.id)
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
    enabled: !!user,
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
