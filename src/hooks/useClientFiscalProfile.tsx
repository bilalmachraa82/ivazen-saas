import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Profile } from '@/hooks/useProfile';
import { resolveScopedClientId } from '@/lib/clientScope';

export function useClientFiscalProfile(clientId?: string | null) {
  const { user } = useAuth();
  const effectiveClientId = resolveScopedClientId(clientId, user?.id);

  const query = useQuery({
    queryKey: ['client-fiscal-profile', effectiveClientId],
    queryFn: async () => {
      if (!effectiveClientId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', effectiveClientId)
        .maybeSingle();

      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!effectiveClientId,
    staleTime: 30_000,
  });

  return {
    profile: query.data ?? null,
    needsFiscalSetup: !!query.data && !query.data.worker_type,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
