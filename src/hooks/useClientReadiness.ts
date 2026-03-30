/**
 * Hook that computes readiness status for all accountant clients.
 *
 * Data sources:
 * - useAccountantClients → pending_invoices + validated_invoices (compras)
 * - at_credentials + accountant_at_config → AT access readiness
 * - at_sync_health_view → latest sync status/error when no client row exists
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
import { hasAnyUsableATConnectorAccess } from '@/lib/atConnectorAccess';

interface CredentialRow {
  client_id: string;
  subuser_id: string | null;
  encrypted_username: string | null;
  portal_nif: string | null;
  encrypted_password: string | null;
  portal_password_encrypted: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

interface SyncHealthRow {
  client_id: string;
  status: string | null;
  error_message: string | null;
}

/**
 * Counts rows per client_id via server-side RPC (GROUP BY).
 * Returns ~242 rows instead of downloading 53K rows client-side.
 * RLS enforced via SECURITY INVOKER.
 */
async function countByClientId(
  table: 'sales_invoices' | 'tax_withholdings',
  clientIds: string[]
): Promise<Record<string, number>> {
  if (!clientIds.length) return {};

  const { data, error } = await supabase.rpc('count_rows_by_client', {
    p_client_ids: clientIds,
    p_table_name: table,
  });

  if (error) {
    console.error(`[useClientReadiness] ${table} count failed:`, error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of (data || []) as { client_id: string; row_count: number }[]) {
    counts[row.client_id] = row.row_count;
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
        .select('client_id, subuser_id, encrypted_username, portal_nif, encrypted_password, portal_password_encrypted, last_sync_status, last_sync_error');

      if (error) {
        console.error('[useClientReadiness] at_credentials query failed:', error);
        return [] as CredentialRow[];
      }
      return (data || []) as CredentialRow[];
    },
    enabled: isAccountant && !!user?.id,
    staleTime: 30_000,
  });

  const { data: accountantConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['client-readiness-accountant-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('accountant_at_config')
        .select('is_active, subuser_id, subuser_password_encrypted')
        .eq('accountant_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[useClientReadiness] accountant_at_config query failed:', error);
        return null;
      }

      return data;
    },
    enabled: isAccountant && !!user?.id,
    staleTime: 30_000,
  });

  const { data: syncHealthRows, isLoading: isLoadingSyncHealth } = useQuery({
    queryKey: ['client-readiness-sync-health', user?.id, clientIds],
    queryFn: async () => {
      if (!clientIds.length) return [] as SyncHealthRow[];

      const { data, error } = await supabase
        .from('at_sync_health_view')
        .select('client_id, status, error_message')
        .in('client_id', clientIds);

      if (error) {
        console.error('[useClientReadiness] at_sync_health_view query failed:', error);
        return [] as SyncHealthRow[];
      }

      return (data || []) as SyncHealthRow[];
    },
    enabled: isAccountant && clientIds.length > 0,
    staleTime: 30_000,
  });

  // ── Sales counts (vendas) ──
  const { data: salesCounts, isLoading: isLoadingSales } = useQuery({
    queryKey: ['client-readiness-sales', user?.id, clientIds],
    queryFn: () => countByClientId('sales_invoices', clientIds),
    enabled: isAccountant && clientIds.length > 0,
    staleTime: 30_000,
  });

  // ── Withholding counts (retenções) ──
  const { data: withholdingCounts, isLoading: isLoadingWithholdings } = useQuery({
    queryKey: ['client-readiness-withholdings', user?.id, clientIds],
    queryFn: () => countByClientId('tax_withholdings', clientIds),
    enabled: isAccountant && clientIds.length > 0,
    staleTime: 30_000,
  });

  // ── Build readiness map ──
  const readinessMap = useMemo(() => {
    const map = new Map<string, ClientReadiness>();
    if (!clients.length) return map;

    const credMap = new Map(
      (credentials || []).map((c) => [c.client_id, c])
    );
    const syncHealthMap = new Map(
      (syncHealthRows || []).map((row) => [row.client_id, row])
    );

    for (const client of clients) {
      const cred = credMap.get(client.id);
      const syncHealth = syncHealthMap.get(client.id);
      const invoiceCount =
        (client.pending_invoices || 0) + (client.validated_invoices || 0);

      map.set(
        client.id,
        computeClientReadiness({
          hasCredentials: hasAnyUsableATConnectorAccess({
            credential: cred,
            sharedConfig: accountantConfig,
            clientNif: client.nif,
          }),
          invoiceCount,
          salesCount: salesCounts?.[client.id] || 0,
          withholdingsCount: withholdingCounts?.[client.id] || 0,
          lastSyncStatus: cred?.last_sync_status || syncHealth?.status || null,
          lastSyncError: cred?.last_sync_error || syncHealth?.error_message || null,
        })
      );
    }

    return map;
  }, [accountantConfig, clients, credentials, salesCounts, syncHealthRows, withholdingCounts]);

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
    clients,
    readinessMap,
    summary,
    isLoading:
      isLoadingClients ||
      isLoadingCreds ||
      isLoadingConfig ||
      isLoadingSyncHealth ||
      isLoadingSales ||
      isLoadingWithholdings,
    totalClients: clients.length,
  };
}

// Re-export for convenience
export { readinessConfig, readinessOrder, type ClientReadiness };
