import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface MyAccountant {
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

export function useMyAccountants() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch accountants associated with the current user (client)
  const { data: accountants, isLoading } = useQuery({
    queryKey: ['my-accountants', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase.rpc('get_client_accountants', {
        client_uuid: user.id
      });
      
      if (error) throw error;
      return (data || []) as MyAccountant[];
    },
    enabled: !!user?.id,
  });

  // Remove an accountant from my profile
  const removeAccountantMutation = useMutation({
    mutationFn: async (accountantId: string) => {
      const { error } = await supabase.rpc('remove_client_accountant', {
        p_accountant_id: accountantId
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contabilista removido');
      queryClient.invalidateQueries({ queryKey: ['my-accountants'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error: Error) => {
      console.error('Remove accountant error:', error);
      toast.error(error.message || 'Erro ao remover contabilista');
    },
  });

  // Get primary accountant
  const primaryAccountant = accountants?.find(a => a.is_primary) || null;
  const otherAccountants = accountants?.filter(a => !a.is_primary) || [];

  return {
    accountants: accountants || [],
    primaryAccountant,
    otherAccountants,
    isLoading,
    removeAccountant: removeAccountantMutation.mutate,
    isRemoving: removeAccountantMutation.isPending,
    hasMultipleAccountants: (accountants?.length || 0) > 1,
  };
}
