/**
 * Hook for managing AT credentials and configuration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ATConfig {
  id: string;
  accountant_id: string;
  certificate_cn?: string;
  certificate_pfx_base64?: string;
  certificate_password_encrypted?: string;
  certificate_valid_from?: string;
  certificate_valid_to?: string;
  at_public_key_base64?: string;
  subuser_id?: string;
  subuser_password_encrypted?: string;
  environment: 'test' | 'production';
  is_active: boolean;
  ca_chain_pem?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ATCredential {
  id: string;
  client_id: string;
  accountant_id: string;
  portal_nif?: string;
  environment: string;
  last_sync_at?: string;
  last_sync_status?: string;
  last_sync_error?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncHistoryEntry {
  id: string;
  client_id: string;
  sync_type: 'compras' | 'vendas' | 'ambos';
  sync_method: 'api' | 'csv' | 'manual' | 'portal';
  start_date: string;
  end_date: string;
  records_imported: number;
  records_updated: number;
  records_skipped: number;
  records_errors: number;
  status: 'pending' | 'running' | 'success' | 'partial' | 'error';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export function useATConfig() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['at-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('accountant_at_config')
        .select('*')
        .eq('accountant_id', user.id)
        .limit(1);

      if (error) throw error;
      return (data && data.length > 0) ? data[0] as ATConfig : null;
    },
    enabled: !!user?.id,
  });
}

export function useATCredentials(clientId?: string) {
  const { user } = useAuth();
  const effectiveClientId = clientId || user?.id;

  return useQuery({
    queryKey: ['at-credentials', effectiveClientId],
    queryFn: async () => {
      if (!effectiveClientId) return null;

      const { data, error } = await supabase
        .from('at_credentials')
        .select('*')
        .eq('client_id', effectiveClientId)
        .limit(1);

      if (error) throw error;
      return (data && data.length > 0) ? data[0] as ATCredential : null;
    },
    enabled: !!effectiveClientId,
  });
}

export function useSyncHistory(clientId?: string, limit = 10) {
  const { user } = useAuth();
  const effectiveClientId = clientId || user?.id;

  return useQuery({
    queryKey: ['sync-history', effectiveClientId, limit],
    queryFn: async () => {
      if (!effectiveClientId) return [];

      const { data, error } = await supabase
        .from('at_sync_history')
        .select('*')
        .eq('client_id', effectiveClientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as SyncHistoryEntry[];
    },
    enabled: !!effectiveClientId,
  });
}

export function useUploadCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      pfxBase64: string;
      pfxPassword: string;
      atPublicKeyBase64: string;
      subuserId: string;
      subuserPassword: string;
      environment: 'test' | 'production';
      certificateCN?: string;
      validFrom?: string;
      validTo?: string;
      caCertBase64?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('upload-at-certificate', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Upload failed');

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['at-config'] });
      toast.success('Certificado configurado com sucesso', {
        description: `Subutilizador: ${data.config?.subuser_id}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Erro ao configurar certificado', {
        description: error.message,
      });
    },
  });
}

export function useImportCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: Array<{ nif: string; portal_password: string; full_name?: string }>) => {
      const { data, error } = await supabase.functions.invoke('import-client-credentials', {
        body: { credentials },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Import failed');

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['at-credentials'] });
      toast.success('Credenciais importadas', {
        description: `${data.summary.imported} novos, ${data.summary.updated} actualizados, ${data.summary.notFound} não encontrados`,
      });
    },
    onError: (error: Error) => {
      toast.error('Erro ao importar credenciais', {
        description: error.message,
      });
    },
  });
}

export function useSyncEFatura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      clientId: string;
      environment: 'test' | 'production';
      type: 'compras' | 'vendas' | 'ambos';
      startDate?: string;
      endDate?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('sync-efatura', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Sync failed');

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['at-credentials'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      toast.success('Sincronização concluída', {
        description: `${data.count} registos importados`,
      });
    },
    onError: (error: Error) => {
      toast.error('Erro na sincronização', {
        description: error.message,
      });
    },
  });
}
