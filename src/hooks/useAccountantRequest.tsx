import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AccountantRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  occ_number: string | null;
  cedula_number: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface AccountantRequestForm {
  occ_number?: string;
  cedula_number?: string;
  company_name?: string;
  tax_office?: string;
  specializations?: string[];
  years_experience?: number;
  motivation?: string;
}

export interface PendingRequest {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  occ_number: string | null;
  cedula_number: string | null;
  company_name: string | null;
  tax_office: string | null;
  specializations: string[] | null;
  years_experience: number | null;
  motivation: string | null;
  created_at: string;
}

export function useAccountantRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current user's request status
  const { data: myRequest, isLoading: isLoadingRequest } = useQuery({
    queryKey: ['my-accountant-request', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc('get_my_accountant_request' as any);
      
      if (error) {
        console.error('Error fetching request:', error);
        return null;
      }
      
      if (!data || (Array.isArray(data) && data.length === 0)) return null;
      
      return (Array.isArray(data) ? data[0] : data) as AccountantRequest;
    },
    enabled: !!user?.id,
  });

  // Submit accountant request
  const submitRequestMutation = useMutation({
    mutationFn: async (formData: AccountantRequestForm) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('accountant_requests' as any)
        .insert({
          user_id: user.id,
          occ_number: formData.occ_number || null,
          cedula_number: formData.cedula_number || null,
          company_name: formData.company_name || null,
          tax_office: formData.tax_office || null,
          specializations: formData.specializations || [],
          years_experience: formData.years_experience || null,
          motivation: formData.motivation || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido de registo submetido com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['my-accountant-request'] });
    },
    onError: (error: Error) => {
      console.error('Submit request error:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já tem um pedido de registo pendente');
      } else {
        toast.error('Erro ao submeter pedido');
      }
    },
  });

  return {
    myRequest,
    isLoadingRequest,
    hasPendingRequest: myRequest?.status === 'pending',
    isApproved: myRequest?.status === 'approved',
    isRejected: myRequest?.status === 'rejected',
    submitRequest: submitRequestMutation.mutate,
    isSubmitting: submitRequestMutation.isPending,
  };
}

export function useAdminAccountantRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Get pending requests
  const { data: pendingRequests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ['pending-accountant-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pending_accountant_requests' as any);
      
      if (error) throw error;
      return (data || []) as PendingRequest[];
    },
    enabled: isAdmin === true,
  });

  // Approve request
  const approveMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const { error } = await supabase.rpc('approve_accountant_request' as any, {
        request_id: requestId,
        p_admin_notes: notes || null,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido aprovado! O utilizador é agora contabilista.');
      queryClient.invalidateQueries({ queryKey: ['pending-accountant-requests'] });
    },
    onError: (error: Error) => {
      console.error('Approve error:', error);
      toast.error('Erro ao aprovar pedido');
    },
  });

  // Reject request
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const { error } = await supabase.rpc('reject_accountant_request' as any, {
        request_id: requestId,
        p_admin_notes: notes,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido rejeitado.');
      queryClient.invalidateQueries({ queryKey: ['pending-accountant-requests'] });
    },
    onError: (error: Error) => {
      console.error('Reject error:', error);
      toast.error('Erro ao rejeitar pedido');
    },
  });

  return {
    isAdmin,
    pendingRequests: pendingRequests || [],
    pendingCount: pendingRequests?.length || 0,
    isLoadingRequests,
    approveRequest: approveMutation.mutate,
    isApproving: approveMutation.isPending,
    rejectRequest: rejectMutation.mutate,
    isRejecting: rejectMutation.isPending,
  };
}
