import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveScopedClientId } from '@/lib/clientScope';
import { hasAnyUsableATConnectorAccess, resolveATEnvironment } from '@/lib/atConnectorAccess';

export type ChannelId = 'at_soap' | 'csv_excel' | 'pdf_ocr' | 'saft' | 'modelo10';

export type ChannelStatus = 'active' | 'configured' | 'available' | 'unavailable';

export interface ChannelHealth {
  id: ChannelId;
  status: ChannelStatus;
  lastActivity: string | null;
  recordsImported: number;
  lastError: string | null;
  trackingMode: 'dedicated' | 'derived' | 'none';
}

export interface ImportChannelHealthData {
  channels: Record<ChannelId, ChannelHealth>;
  /** Total records across all tables (invoices + sales + withholdings). */
  totalImported: number;
  purchaseImported: number;
  salesImported: number;
  withholdingsImported: number;
  hasATCredentials: boolean;
  atEnvironment: string | null;
}

interface UseImportChannelHealthOptions {
  clientId?: string | null;
}

export function useImportChannelHealth(options: UseImportChannelHealthOptions = {}) {
  const { user, roles } = useAuth();
  const effectiveClientId = resolveScopedClientId(options.clientId, user?.id);
  const isAccountant = roles.includes('accountant');

  const query = useQuery({
    queryKey: ['import-channel-health', effectiveClientId, user?.id, isAccountant],
    queryFn: async (): Promise<ImportChannelHealthData | null> => {
      if (!effectiveClientId) return null;

      const [
        atCredentialsRes,
        accountantConfigRes,
        syncHistoryRes,
        purchaseCountRes,
        salesCountRes,
        withholdingsCountRes,
      ] = await Promise.all([
        supabase
          .from('at_credentials')
          .select('subuser_id, encrypted_username, portal_nif, encrypted_password, portal_password_encrypted, last_sync_status, last_sync_at, last_sync_error, environment')
          .eq('client_id', effectiveClientId)
          .limit(1)
          .maybeSingle(),
        isAccountant && user?.id
          ? supabase
            .from('accountant_at_config')
            .select('is_active, subuser_id, subuser_password_encrypted, environment')
            .eq('accountant_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('at_sync_history')
          .select('created_at, sync_type, sync_method, status, records_imported, records_errors')
          .eq('client_id', effectiveClientId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId),
        supabase
          .from('sales_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId),
        supabase
          .from('tax_withholdings')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', effectiveClientId),
      ]);

      const syncHistory = syncHistoryRes.data || [];
      const hasATCredentials = hasAnyUsableATConnectorAccess({
        credential: atCredentialsRes.data,
        sharedConfig: accountantConfigRes.data,
      });
      const atEnvironment = resolveATEnvironment({
        credential: atCredentialsRes.data,
        sharedConfig: accountantConfigRes.data,
      });

      // ── AT SOAP channel ──
      // Only sync-efatura writes to at_sync_history, always with sync_method='api'.
      // No other channel (CSV import, PDF upload, SAF-T) writes sync history.
      const apiSyncs = syncHistory.filter((s) => s.sync_method === 'api');
      const lastApiSync = apiSyncs[0] ?? null;
      const apiImported = apiSyncs.reduce((sum, s) => sum + (s.records_imported || 0), 0);

      const atSoapStatus: ChannelStatus = lastApiSync
        ? lastApiSync.status === 'success' ? 'active' : 'configured'
        : hasATCredentials ? 'configured' : 'available';

      const purchaseCount = purchaseCountRes.count ?? 0;
      const salesCount = salesCountRes.count ?? 0;
      const withholdingsCount = withholdingsCountRes.count ?? 0;

      // ── Channels without dedicated tracking ──
      // CSV import, PDF/OCR upload, and SAF-T do NOT write to at_sync_history.
      // We cannot attribute activity to these channels from aggregate table counts
      // (invoices may have come from AT SOAP, CSV, or upload — we don't know).
      // Status is always 'available' — honest about the lack of per-channel tracking.

      return {
        channels: {
          at_soap: {
            id: 'at_soap',
            status: atSoapStatus,
            lastActivity: lastApiSync?.created_at ?? atCredentialsRes.data?.last_sync_at ?? null,
            recordsImported: apiImported,
            lastError: lastApiSync?.status === 'error' ? 'Erro no último sync' : null,
            trackingMode: 'dedicated',
          },
          csv_excel: {
            id: 'csv_excel',
            status: 'available',
            lastActivity: null,
            recordsImported: 0,
            lastError: null,
            trackingMode: 'none',
          },
          pdf_ocr: {
            id: 'pdf_ocr',
            status: 'available',
            lastActivity: null,
            recordsImported: 0,
            lastError: null,
            trackingMode: 'none',
          },
          saft: {
            id: 'saft',
            status: 'available',
            lastActivity: null,
            recordsImported: 0,
            lastError: null,
            trackingMode: 'none',
          },
          modelo10: {
            id: 'modelo10',
            status: withholdingsCount > 0 ? 'active' : 'available',
            lastActivity: null,
            recordsImported: withholdingsCount,
            lastError: null,
            trackingMode: 'derived',
          },
        },
        totalImported: purchaseCount + salesCount + withholdingsCount,
        purchaseImported: purchaseCount,
        salesImported: salesCount,
        withholdingsImported: withholdingsCount,
        hasATCredentials,
        atEnvironment,
      };
    },
    enabled: !!effectiveClientId,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
