/**
 * Hook unificado para obter clientes de um contabilista
 * Usa sempre a RPC get_accountant_clients para consistência
 * 
 * Este hook deve ser usado em TODAS as páginas que precisam de lista de clientes:
 * - Modelo 10
 * - IVA Calculator  
 * - Validation (Compras)
 * - Sales Validation (Vendas)
 * - Upload
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AccountantClient {
  id: string;
  full_name: string | null;
  company_name: string | null;
  nif: string | null;
  email: string | null;
  pending_invoices: number;
  validated_invoices: number;
  access_level: string;
  is_primary: boolean;
}

interface UseAccountantClientsOptions {
  enabled?: boolean;
}

export function useAccountantClients(options: UseAccountantClientsOptions = {}) {
  const { user } = useAuth();
  const { enabled = true } = options;
  
  const query = useQuery({
    queryKey: ['accountant-clients-unified', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // First check if user is an accountant
      const { data: roleData } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'accountant'
      });
      
      if (!roleData) {
        return [];
      }
      
      // Get clients using the RPC function
      const { data, error } = await supabase.rpc('get_accountant_clients', {
        accountant_uuid: user.id
      });
      
      if (error) {
        console.error('Error fetching accountant clients:', error);
        throw error;
      }
      
      return (data || []) as AccountantClient[];
    },
    enabled: enabled && !!user?.id,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
  
  // Computed values
  const clients = query.data || [];
  const isAccountant = clients.length > 0 || query.isSuccess;
  
  // Helper to get display name
  const getClientDisplayName = (client: AccountantClient | null): string => {
    if (!client) return '';
    return client.company_name || client.full_name || client.nif || 'Cliente';
  };
  
  // Helper to find client by ID
  const getClientById = (clientId: string | null | undefined): AccountantClient | null => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId) || null;
  };
  
  // Helper to check if current user's ID is their own (not a client)
  const isOwnAccount = (clientId: string | null | undefined): boolean => {
    return clientId === user?.id;
  };
  
  return {
    // Data
    clients,
    isAccountant,
    
    // Query state
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    
    // Helpers
    getClientDisplayName,
    getClientById,
    isOwnAccount,
  };
}

/**
 * Hook simplificado para componentes que só precisam de saber se é contabilista
 */
export function useIsAccountant() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['is-accountant', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'accountant'
      });
      
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute
  });
}
