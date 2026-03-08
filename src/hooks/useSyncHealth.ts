import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SyncHealthData {
  total_syncs_24h: number;
  completed_24h: number;
  errors_24h: number;
  success_rate: number;
  pending_retries: number;
  dead_letter_count: number;
  currently_processing: number;
  avg_duration_ms: number;
  error_breakdown: Record<string, number>;
  credentials_with_failures: number;
  last_automation_run: {
    run_date: string;
    slot: string;
    total_jobs: number;
    local_time: string;
  } | null;
  history_summary_7d: {
    total: number;
    by_method: Record<string, number>;
    api_success_rate: number;
    api_errors: number;
    portal_errors: number;
    stuck_running: number;
  } | null;
}

export function useSyncHealth() {
  return useQuery<SyncHealthData>({
    queryKey: ['sync-health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_at_sync_health');
      if (error) throw error;
      return data as SyncHealthData;
    },
    refetchInterval: 60_000, // Refresh every minute
    staleTime: 30_000,
  });
}
