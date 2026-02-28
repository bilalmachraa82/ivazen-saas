import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ATControlCenterRow {
  accountant_id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_nif: string | null;
  has_credentials: boolean;
  credential_environment: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_reason_code: string | null;
  last_error_message: string | null;
  last_sync_method: string | null;
  compras_total: number;
  vendas_total: number;
  withholdings_total: number;
  withholding_candidates_pending: number;
  withholding_candidates_high_confidence: number;
  withholding_candidates_rejected: number;
  jobs_pending: number;
  jobs_processing: number;
  jobs_error: number;
  jobs_completed: number;
  last_job_at: string | null;
  operational_status: string;
}

export interface ATControlCenterStats {
  total_clients: number;
  with_credentials: number;
  requires_attention: number;
  status_counts: Record<string, number>;
  reason_counts: Record<string, number>;
}

export interface UseATControlCenterFilters {
  search?: string;
  status?: string;
  reason?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_STATS: ATControlCenterStats = {
  total_clients: 0,
  with_credentials: 0,
  requires_attention: 0,
  status_counts: {},
  reason_counts: {},
};

export function useATControlCenter(filters: UseATControlCenterFilters = {}) {
  const queryClient = useQueryClient();
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize || 50));
  const offset = (page - 1) * pageSize;

  const rowsQuery = useQuery({
    queryKey: ['at-control-center', filters.search, filters.status, filters.reason, page, pageSize],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_at_control_center', {
        p_search: filters.search || null,
        p_status: filters.status || null,
        p_reason: filters.reason || null,
        p_limit: pageSize,
        p_offset: offset,
      });

      if (error) throw error;
      return (data || []) as ATControlCenterRow[];
    },
    staleTime: 15_000,
  });

  const statsQuery = useQuery({
    queryKey: ['at-control-center-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_at_control_center_stats');
      if (error) throw error;
      const raw = (data && typeof data === 'object') ? data as Partial<ATControlCenterStats> : {};
      return {
        ...DEFAULT_STATS,
        ...raw,
        status_counts: raw.status_counts || {},
        reason_counts: raw.reason_counts || {},
      } as ATControlCenterStats;
    },
    staleTime: 15_000,
  });

  const promoteCandidatesMutation = useMutation({
    mutationFn: async (params: { clientId: string; candidateIds?: string[]; mode?: 'auto' | 'manual_approve' | 'manual_reject' }) => {
      const { data, error } = await supabase.rpc('promote_withholding_candidates', {
        p_client_id: params.clientId,
        p_ids: params.candidateIds?.length ? params.candidateIds : null,
        p_mode: params.mode || 'manual_approve',
      });
      if (error) throw error;
      const payload = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
      return {
        promoted: Number(payload.promoted ?? 0),
        rejected: Number(payload.rejected ?? 0),
        skipped: Number(payload.skipped ?? 0),
        selected: Number(payload.selected ?? 0),
      } as { promoted?: number; rejected?: number; skipped?: number; selected?: number };
    },
    onSuccess: (data) => {
      const promoted = Number(data?.promoted || 0);
      const rejected = Number(data?.rejected || 0);
      if (promoted > 0) {
        toast.success(`${promoted} retenção(ões) promovidas para Modelo 10`);
      } else if (rejected > 0) {
        toast.success(`${rejected} retenção(ões) marcadas como rejeitadas`);
      } else {
        toast.info('Nenhum candidato elegível para esta ação');
      }

      queryClient.invalidateQueries({ queryKey: ['at-control-center'] });
      queryClient.invalidateQueries({ queryKey: ['at-control-center-stats'] });
      queryClient.invalidateQueries({ queryKey: ['withholdings'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro ao processar candidatos';
      toast.error('Falha ao processar candidatos', { description: message });
    },
  });

  const reasonOptions = useMemo(() => {
    const set = new Set<string>();
    Object.keys(statsQuery.data?.reason_counts || {}).forEach((k) => {
      if (k) set.add(k);
    });
    return Array.from(set).sort();
  }, [statsQuery.data]);

  return {
    rows: rowsQuery.data || [],
    stats: statsQuery.data || DEFAULT_STATS,
    reasonOptions,
    isLoading: rowsQuery.isLoading || statsQuery.isLoading,
    isRefetching: rowsQuery.isRefetching || statsQuery.isRefetching,
    error: rowsQuery.error || statsQuery.error,
    refetch: async () => {
      await Promise.all([rowsQuery.refetch(), statsQuery.refetch()]);
    },
    promoteCandidates: promoteCandidatesMutation.mutateAsync,
    isPromoting: promoteCandidatesMutation.isPending,
    page,
    pageSize,
  };
}
