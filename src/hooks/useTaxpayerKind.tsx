import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { resolveScopedClientId } from '@/lib/clientScope';
import { resolveTaxpayerKind, type TaxpayerKind } from '@/lib/taxpayerKind';

/**
 * Hook that returns the effective taxpayer kind for the current client context.
 *
 * For accountants: uses selectedClientId.
 * For clients: uses their own profile.
 *
 * Combines explicit taxpayer_kind with inference from worker_type and data signals.
 */
export function useTaxpayerKind(forClientId?: string | null) {
  const { user, hasRole } = useAuth();
  const { selectedClientId } = useSelectedClient();
  const isAccountant = hasRole('accountant');
  const requestedClientId =
    forClientId !== undefined ? forClientId : (isAccountant ? selectedClientId : undefined);
  const effectiveClientId = resolveScopedClientId(
    requestedClientId,
    user?.id
  );

  const { data, isLoading } = useQuery({
    queryKey: ['taxpayer-kind', effectiveClientId],
    queryFn: async () => {
      if (!effectiveClientId) return null;

      // Fetch profile + data signals in parallel
      const [profileRes, whRes, salesRes, ssDeclRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('taxpayer_kind, worker_type')
          .eq('id', effectiveClientId)
          .maybeSingle(),
        supabase
          .from('tax_withholdings')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .limit(1),
        supabase
          .from('sales_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .limit(1),
        supabase
          .from('ss_declarations')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId)
          .limit(1),
      ]);

      const profile = profileRes.data;
      const hasWithholdings = (whRes.count ?? 0) > 0;
      const hasSsActivity = (salesRes.count ?? 0) > 0 || (ssDeclRes.count ?? 0) > 0;

      return resolveTaxpayerKind({
        taxpayer_kind: profile?.taxpayer_kind,
        worker_type: profile?.worker_type,
        has_withholdings: hasWithholdings,
        has_ss_activity: hasSsActivity,
      });
    },
    enabled: !!effectiveClientId,
    staleTime: 60_000,
  });

  return {
    taxpayerKind: data ?? null as TaxpayerKind | null,
    isLoading,
  };
}
