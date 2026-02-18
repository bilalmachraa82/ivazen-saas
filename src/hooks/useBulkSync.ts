/**
 * useBulkSync Hook
 * Manages background sync jobs with polling for progress
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SyncBatchProgress {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  errors: number;
  total_invoices: number;
}

export interface SyncJob {
  id: string;
  client_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message?: string;
  invoices_synced?: number;
  started_at?: string;
  completed_at?: string;
}

export function useBulkSync() {
  const queryClient = useQueryClient();
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Start mass sync
  const startSyncMutation = useMutation({
    mutationFn: async ({ 
      clientIds, 
      fiscalYear 
    }: { 
      clientIds: string[]; 
      fiscalYear?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('sync-queue-manager', {
        body: { clientIds, fiscalYear },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to start sync');

      return data as { batchId: string; totalJobs: number; fiscalYear: number };
    },
    onSuccess: (data) => {
      setActiveBatchId(data.batchId);
      setIsPolling(true);
      toast.success(`Sincronização iniciada`, {
        description: `${data.totalJobs} clientes na fila para ${data.fiscalYear}`,
      });
    },
    onError: (error: any) => {
      toast.error('Erro ao iniciar sincronização', {
        description: error.message,
      });
    },
  });

  // Get batch progress
  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ['sync-batch-progress', activeBatchId],
    queryFn: async () => {
      if (!activeBatchId) return null;

      const { data, error } = await supabase.rpc('get_sync_batch_progress', {
        p_batch_id: activeBatchId,
      });

      if (error) throw error;
      return (data?.[0] || null) as SyncBatchProgress | null;
    },
    enabled: !!activeBatchId && isPolling,
    refetchInterval: isPolling ? 3000 : false, // Poll every 3 seconds
    staleTime: 1000,
  });

  // Get jobs for current batch
  const { data: jobs, refetch: refetchJobs } = useQuery({
    queryKey: ['sync-batch-jobs', activeBatchId],
    queryFn: async () => {
      if (!activeBatchId) return [];

      const { data, error } = await supabase
        .from('at_sync_jobs')
        .select('*')
        .eq('job_batch_id', activeBatchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as SyncJob[];
    },
    enabled: !!activeBatchId,
    refetchInterval: isPolling ? 5000 : false,
  });

  // Stop polling when complete
  useEffect(() => {
    if (progress && progress.pending === 0 && progress.processing === 0) {
      setIsPolling(false);
      
      if (progress.completed > 0) {
        toast.success('Sincronização concluída!', {
          description: `${progress.completed} clientes sincronizados, ${progress.total_invoices} facturas`,
        });
      }
      
      if (progress.errors > 0) {
        toast.warning(`${progress.errors} clientes com erros`, {
          description: 'Verifique os detalhes na lista',
        });
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['bulk-sync-clients'] });
      queryClient.invalidateQueries({ queryKey: ['sync-history'] });
    }
  }, [progress, queryClient]);

  // Cancel/reset
  const reset = useCallback(() => {
    setActiveBatchId(null);
    setIsPolling(false);
  }, []);

  // Calculate progress percentage
  const progressPercent = progress 
    ? ((progress.completed + progress.errors) / progress.total) * 100 
    : 0;

  const isActive = isPolling || (progress && progress.pending > 0);

  return {
    // Actions
    startSync: startSyncMutation.mutate,
    startSyncAsync: startSyncMutation.mutateAsync,
    reset,
    refetchProgress,
    refetchJobs,

    // State
    isStarting: startSyncMutation.isPending,
    isActive,
    activeBatchId,
    progress,
    progressPercent,
    jobs,

    // Computed
    hasErrors: (progress?.errors || 0) > 0,
    isComplete: progress ? progress.pending === 0 && progress.processing === 0 : false,
  };
}
