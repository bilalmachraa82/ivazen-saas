import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AccountantProfile {
  id: string;
  full_name: string;
  email: string | null;
  nif: string | null;
  company_name: string | null;
  created_at: string | null;
}

interface ClientProfile {
  id: string;
  full_name: string;
  email: string | null;
  nif: string | null;
  company_name: string | null;
  cae: string | null;
  created_at: string | null;
}

interface AccountantWithClients extends AccountantProfile {
  clientCount: number;
}

interface GlobalStats {
  totalAccountants: number;
  totalClients: number;
  totalWithholdings: number;
  totalWithholdingValue: number;
  pendingInvoices: number;
}

export function useSuperAdmin() {
  const { user } = useAuth();

  // Check if user is admin
  const { data: isAdmin, isLoading: isLoadingAdmin } = useQuery({
    queryKey: ['is-super-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
      
      return !!data;
    },
    enabled: !!user?.id,
  });

  // List all accountants with client counts
  const { data: accountants, isLoading: isLoadingAccountants, refetch: refetchAccountants } = useQuery({
    queryKey: ['all-accountants'],
    queryFn: async (): Promise<AccountantWithClients[]> => {
      // Get all users with accountant role
      const { data: accountantRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'accountant');

      if (rolesError) {
        console.error('Error fetching accountant roles:', rolesError);
        return [];
      }

      if (!accountantRoles || accountantRoles.length === 0) {
        return [];
      }

      const accountantIds = accountantRoles.map(r => r.user_id);

      // Get profiles for accountants
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, nif, company_name, created_at')
        .in('id', accountantIds);

      if (profilesError) {
        console.error('Error fetching accountant profiles:', profilesError);
        return [];
      }

      // Get client counts for each accountant
      const { data: associations, error: assocError } = await supabase
        .from('client_accountants')
        .select('accountant_id, client_id')
        .in('accountant_id', accountantIds);

      if (assocError) {
        console.error('Error fetching associations:', assocError);
      }

      // Map profiles with client counts
      return (profiles || []).map(profile => {
        const clientCount = associations?.filter(a => a.accountant_id === profile.id).length || 0;
        return {
          ...profile,
          clientCount,
        };
      });
    },
    enabled: isAdmin === true,
  });

  // Get clients for a specific accountant
  const getClientsForAccountant = async (accountantId: string): Promise<ClientProfile[]> => {
    const { data: associations, error: assocError } = await supabase
      .from('client_accountants')
      .select('client_id')
      .eq('accountant_id', accountantId);

    if (assocError || !associations || associations.length === 0) {
      console.error('Error fetching client associations:', assocError);
      return [];
    }

    const clientIds = associations.map(a => a.client_id);

    const { data: clients, error: clientsError } = await supabase
      .from('profiles')
      .select('id, full_name, email, nif, company_name, cae, created_at')
      .in('id', clientIds);

    if (clientsError) {
      console.error('Error fetching client profiles:', clientsError);
      return [];
    }

    return clients || [];
  };

  // Get global stats for super admin dashboard
  const { data: globalStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['super-admin-global-stats'],
    queryFn: async (): Promise<GlobalStats> => {
      // Count accountants
      const { count: accountantCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'accountant');

      // Count unique clients (from associations)
      const { data: allAssociations } = await supabase
        .from('client_accountants')
        .select('client_id');
      
      const uniqueClients = new Set(allAssociations?.map(a => a.client_id) || []);

      // Get withholdings stats
      const { data: withholdings } = await supabase
        .from('tax_withholdings')
        .select('gross_amount');
      
      const totalWithholdings = withholdings?.length || 0;
      const totalWithholdingValue = withholdings?.reduce((sum, w) => sum + Number(w.gross_amount), 0) || 0;

      // Count pending invoices
      const { count: pendingCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      return {
        totalAccountants: accountantCount || 0,
        totalClients: uniqueClients.size,
        totalWithholdings,
        totalWithholdingValue,
        pendingInvoices: pendingCount || 0,
      };
    },
    enabled: isAdmin === true,
  });

  // Get withholdings for a specific client
  const getWithholdingsForClient = async (clientId: string) => {
    const { data, error } = await supabase
      .from('tax_withholdings')
      .select('*')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching withholdings:', error);
      return [];
    }

    return data || [];
  };

  return {
    isAdmin,
    isLoadingAdmin,
    accountants,
    isLoadingAccountants,
    refetchAccountants,
    getClientsForAccountant,
    globalStats,
    isLoadingStats,
    getWithholdingsForClient,
  };
}
