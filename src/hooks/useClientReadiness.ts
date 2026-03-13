/**
 * Hook that computes readiness status for all accountant clients.
 *
 * Data sources:
 * - useAccountantClients → pending_invoices + validated_invoices (compras)
 * - at_credentials → credential existence + last sync status/error
 * - sales_invoices → count per client_id (vendas)
 * - tax_withholdings → count per client_id (retenções)
 *
 * Returns a Map<clientId, ClientReadiness> for O(1) lookup.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountantClients } from '@/hooks/useAccountantClients';
import {
  computeClientReadiness,
  readinessConfig,
  readinessOrder,
  type ClientReadiness,
} from '@/lib/clientReadiness';

interface CredentialRow {
  client_id: string;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

/**
 * Counts rows per client_id in a given table.
 * Uses a lightweight select of just client_id, then counts client-side.
 * RLS ensures only the accountant's clients' rows are returned.
 */
async function countByClientId(
  table: 'sales_invoices' | 'tax_withholdings',
  clientIds: string[]
): Promise<Record<string, number>> {
  if (!clientIds.length) return {};

  const counts: Record<string, number> = {};

  // Fetch in batches of 1000 client_ids to stay within Supabase limits
  for (let offset = 0; offset < clientIds.length; offset += 1000) {
    const batch = clientIds.slice(offset, offset + 1000);
    const { data, error } = await supabase
      .from(table)
      .select('client_id')
      .in('client_id', batch);

    if (error) {
      console.error(`[useClientReadiness] ${table} count failed:`, error);
      continue;
    }

    for (const row of data || []) {
      counts[row.client_id] = (counts[row.client_id] || 0) + 1;
    }
  }

  return counts;
}

export function useClientReadiness() {
  const { user, hasRole } = useAuth();
  const isAccountant = hasRole('accountant');
  const { clients, isLoading: isLoadingClients } = useAccountantClients({ enabled: isAccountant });

  const clientIds = useMemo(() => clients.map((c) => c.id), [clients]);

  // ── AT credentials (one row per client max) ──
  const { data: credentials, isLoading: isLoadingCreds } = useQuery({
    queryKey: ['client-readiness-creds', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('at_credentials')
        .select('client_id, last_sync_status, last_sync_error');

      if (error) {
        console.error('[useClientReadiness] at_credentials query failed:', error);
        return [] as CredentialRow[];
      }
      return (data || []) as CredentialRow[];
    },
    enabled: isAccountant && !!user?.id,
    staleTime: 60000,
  });

  // ── Sales counts (vendas) ──
  const { data: salesCounts } = useQuery({
    queryKey: ['client-readiness-sales', user?.id, clientIds.length],
    queryFn: () => countByClientId('sales_invoices', clientIds),
    enabled: isAccountant && clientIds.length > 0,
    staleTime: 60000,
  });

  // ── Withholding counts (retenções) ──
  const { data: withholdingCounts } = useQuery({
    queryKey: ['client-readiness-withholdings', user?.id, clientIds.length],
    queryFn: () => countByClientId('tax_withholdings', clientIds),
    enabled: isAccountant && clientIds.length > 0,
    staleTime: 60000,
  });

  // ── Build readiness map ──
  const readinessMap = useMemo(() => {
    const map = new Map<string, ClientReadiness>();
    if (!clients.length) return map;

    const credMap = new Map(
      (credentials || []).map((c) => [c.client_id, c])
    );

    for (const client of clients) {
      const cred = credMap.get(client.id);
      const invoiceCount =
        (client.pending_invoices || 0) + (client.validated_invoices || 0);

      map.set(
        client.id,
        computeClientReadiness({
          hasCredentials: !!cred,
          invoiceCount,
          salesCount: salesCounts?.[client.id] || 0,
          withholdingsCount: withholdingCounts?.[client.id] || 0,
          lastSyncStatus: cred?.last_sync_status ?? null,
          lastSyncError: cred?.last_sync_error ?? null,
        })
      );
    }

    return map;
  }, [clients, credentials, salesCounts, withholdingCounts]);

  // ── Aggregate counts for portfolio summary ──
  const summary = useMemo(() => {
    const counts: Record<ClientReadiness, number> = {
      ready: 0,
      partial: 0,
      no_data: 0,
      no_credentials: 0,
      blocked: 0,
      needs_import: 0,
    };

    readinessMap.forEach((status) => {
      counts[status]++;
    });

    return counts;
  }, [readinessMap]);

  return {
    readinessMap,
    summary,
    isLoading: isLoadingClients || isLoadingCreds,
    totalClients: clients.length,
  };
}

// Re-export for convenience
export { readinessConfig, readinessOrder, type ClientReadiness };
