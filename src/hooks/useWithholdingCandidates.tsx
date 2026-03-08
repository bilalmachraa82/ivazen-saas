import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { fetchAllByCursor } from '@/lib/supabasePagination';
import { toast } from 'sonner';
import { resolveScopedClientId } from '@/lib/clientScope';
import { useAuth } from '@/hooks/useAuth';

export type WithholdingCandidate = Tables<'at_withholding_candidates'>;

interface UseWithholdingCandidatesOptions {
  clientId?: string | null;
  fiscalYear?: number;
}

export function useWithholdingCandidates(options: UseWithholdingCandidatesOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const effectiveClientId = resolveScopedClientId(options.clientId, user?.id);
  const effectiveYear = options.fiscalYear ?? new Date().getFullYear();

  const query = useQuery({
    queryKey: ['withholding-candidates', effectiveClientId, effectiveYear],
    queryFn: async () => {
      if (!effectiveClientId) return [];

      return fetchAllByCursor<WithholdingCandidate>(
        (cursor, pageSize) => {
          let request = supabase
            .from('at_withholding_candidates')
            .select('*')
            .eq('client_id', effectiveClientId)
            .eq('fiscal_year', effectiveYear)
            .order('payment_date', { ascending: false })
            .order('id', { ascending: false })
            .limit(pageSize);

          if (cursor) {
            request = request.or(
              `payment_date.lt.${cursor.payment_date},and(payment_date.eq.${cursor.payment_date},id.lt.${cursor.id})`,
            );
          }

          return request.then((result) => result);
        },
        {
          pageSize: 500,
          maxPages: 20,
          getCursorKey: (row) => `${row.payment_date}|${row.id}`,
        },
      );
    },
    enabled: !!effectiveClientId,
    staleTime: 10_000,
  });

  const promoteMutation = useMutation({
    mutationFn: async (candidateIds: string[]) => {
      if (!effectiveClientId) throw new Error('Cliente não selecionado');
      if (candidateIds.length === 0) return { promoted: 0, rejected: 0, skipped: 0, selected: 0 };

      const { data, error } = await supabase.rpc('promote_withholding_candidates', {
        p_client_id: effectiveClientId,
        p_ids: candidateIds,
        p_mode: 'manual_approve',
      });

      if (error) throw error;
      return (data || {}) as Record<string, number>;
    },
    onSuccess: async (data) => {
      const promoted = Number(data.promoted || 0);
      const skipped = Number(data.skipped || 0);

      if (promoted > 0) {
        toast.success(`${promoted} candidato(s) promovido(s) para Modelo 10`);
      } else if (skipped > 0) {
        toast.info(`${skipped} candidato(s) já existiam ou não eram elegíveis`);
      } else {
        toast.info('Nenhum candidato elegível para promoção');
      }

      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ['withholdings'] }),
        queryClient.invalidateQueries({ queryKey: ['withholding-candidates-pending'] }),
        queryClient.invalidateQueries({ queryKey: ['at-control-center'] }),
        queryClient.invalidateQueries({ queryKey: ['at-control-center-stats'] }),
      ]);
    },
    onError: (error: Error) => {
      toast.error('Erro ao promover candidatos', { description: error.message });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (candidateIds: string[]) => {
      if (!effectiveClientId) throw new Error('Cliente não selecionado');
      if (candidateIds.length === 0) return { promoted: 0, rejected: 0, skipped: 0, selected: 0 };

      const { data, error } = await supabase.rpc('promote_withholding_candidates', {
        p_client_id: effectiveClientId,
        p_ids: candidateIds,
        p_mode: 'manual_reject',
      });

      if (error) throw error;
      return (data || {}) as Record<string, number>;
    },
    onSuccess: async (data) => {
      const rejected = Number(data.rejected || 0);
      if (rejected > 0) {
        toast.success(`${rejected} candidato(s) rejeitado(s)`);
      } else {
        toast.info('Nenhum candidato rejeitado');
      }

      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ['withholding-candidates-pending'] }),
        queryClient.invalidateQueries({ queryKey: ['at-control-center'] }),
        queryClient.invalidateQueries({ queryKey: ['at-control-center-stats'] }),
      ]);
    },
    onError: (error: Error) => {
      toast.error('Erro ao rejeitar candidatos', { description: error.message });
    },
  });

  const stats = useMemo(() => {
    const rows = query.data || [];
    return {
      total: rows.length,
      pending: rows.filter((row) => row.status === 'pending').length,
      promoted: rows.filter((row) => row.status === 'promoted').length,
      rejected: rows.filter((row) => row.status === 'rejected').length,
      totalGross: rows.reduce((sum, row) => sum + Number(row.gross_amount || 0), 0),
      totalWithholding: rows.reduce((sum, row) => sum + Number(row.withholding_amount || 0), 0),
    };
  }, [query.data]);

  return {
    candidates: query.data || [],
    stats,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    promoteCandidates: promoteMutation.mutateAsync,
    rejectCandidates: rejectMutation.mutateAsync,
    isPromoting: promoteMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
