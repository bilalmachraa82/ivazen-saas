import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountantClients, type AccountantClient } from '@/hooks/useAccountantClients';
import { toast } from 'sonner';

export interface AvailableClient {
  id: string;
  full_name: string;
  company_name: string | null;
  nif: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface ClientAccountant {
  id: string;
  accountant_id: string;
  full_name: string;
  company_name: string | null;
  nif: string | null;
  email: string | null;
  access_level: string;
  is_primary: boolean;
  created_at: string;
}

export function useClientManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AvailableClient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const {
    clients,
    isLoading: isLoadingClients,
    isAccountant,
  } = useAccountantClients({ enabled: !!user?.id });

  // Search available clients
  const searchClients = async (term: string) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_available_clients', {
        search_term: term
      });
      if (error) throw error;
      setSearchResults((data || []) as AvailableClient[]);
    } catch (error) {
      console.error('Search clients error:', error);
      toast.error('Erro ao pesquisar clientes');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Associate client mutation
  const associateClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.rpc('associate_client', {
        client_uuid: clientId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Cliente associado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['accountant-clients'] });
      queryClient.invalidateQueries({ queryKey: ['accountant-clients-unified'] });
      setSearchResults([]);
      setSearchTerm('');
    },
    onError: (error: Error) => {
      console.error('Associate client error:', error);
      toast.error(error.message || 'Erro ao associar cliente');
    },
  });

  // Remove client mutation
  const removeClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.rpc('remove_client', {
        client_uuid: clientId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Cliente removido da carteira');
      queryClient.invalidateQueries({ queryKey: ['accountant-clients'] });
      queryClient.invalidateQueries({ queryKey: ['accountant-clients-unified'] });
    },
    onError: (error: Error) => {
      console.error('Remove client error:', error);
      toast.error(error.message || 'Erro ao remover cliente');
    },
  });

  return {
    isAccountant,
    clients: clients || [],
    isLoadingClients,
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    searchClients,
    associateClient: associateClientMutation.mutate,
    isAssociating: associateClientMutation.isPending,
    removeClient: removeClientMutation.mutate,
    isRemoving: removeClientMutation.isPending,
  };
}
