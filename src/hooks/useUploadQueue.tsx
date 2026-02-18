/**
 * useUploadQueue Hook
 * 
 * Manages background upload queue for invoices.
 * Stores pending uploads in the database and processes them when online.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface QueueItem {
  id: string;
  file_name: string;
  fiscal_year: number;
  // needs_review: document processed but NOT saved (failed validation, missing NIF, etc.)
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review';
  extracted_data: unknown | null;
  // Stored by backend as 0-100
  confidence: number | null;
  warnings: string[] | null;
  error_message: string | null;
  attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface QueueStats {
  total_count: number;
  pending_count: number;
  processing_count: number;
  completed_count: number;
  failed_count: number;
  needs_review_count: number; // Documents processed but NOT saved (needs manual review)
}

interface DbQueueItem {
  id: string;
  client_id: string;
  user_id: string;
  file_name: string;
  status: string;
  extracted_data: unknown | null;
  confidence: number | null;
  warnings: string[] | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  fiscal_year: number | null;
  processed_at: string | null;
}

export function useUploadQueue(forClientId?: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // For accountants, use the selected client's ID; otherwise use logged-in user's ID
  const effectiveClientId = forClientId || user?.id;

  // Fetch queue items from database
  const fetchQueue = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      if (!effectiveClientId) {
        setItems([]);
        setStats({
          total_count: 0,
          pending_count: 0,
          processing_count: 0,
          completed_count: 0,
          failed_count: 0,
          needs_review_count: 0,
        });
        return;
      }

      const { data, error } = await supabase
        .from('upload_queue')
        .select('id, client_id, user_id, file_name, status, extracted_data, confidence, warnings, error_message, retry_count, created_at, started_at, fiscal_year, processed_at')
        .eq('client_id', effectiveClientId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mappedItems: QueueItem[] = (data as DbQueueItem[] || []).map(item => ({
        id: item.id,
        file_name: item.file_name,
        fiscal_year: item.fiscal_year ?? new Date().getFullYear(),
        status: item.status as QueueItem['status'],
        extracted_data: item.extracted_data ?? null,
        confidence: item.confidence ?? null,
        warnings: item.warnings ?? null,
        error_message: item.error_message,
        attempts: item.retry_count,
        created_at: item.created_at,
        started_at: item.started_at,
        completed_at: item.processed_at,
      }));

      setItems(mappedItems);

      // Calculate stats
      const newStats: QueueStats = {
        total_count: mappedItems.length,
        pending_count: mappedItems.filter(i => i.status === 'pending').length,
        processing_count: mappedItems.filter(i => i.status === 'processing').length,
        completed_count: mappedItems.filter(i => i.status === 'completed').length,
        failed_count: mappedItems.filter(i => i.status === 'failed').length,
        needs_review_count: mappedItems.filter(i => i.status === 'needs_review').length,
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching upload queue:', error);
    } finally {
      setIsLoading(false);
    }
   }, [user, effectiveClientId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // State for processing status
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  // Internal processing function (can be called silently for auto-processing)
  const triggerProcessingInternal = useCallback(async (showToast = true) => {
    if (!user || processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);
    console.log('Triggering background processing...');

    try {
      const { data, error } = await supabase.functions.invoke('process-queue');

      if (error) {
        console.error('Error from process-queue:', error);
        throw error;
      }

      console.log('Processing result:', data);

      if (showToast) {
        const pendingCount = typeof data?.pending_count === 'number' ? data.pending_count : null;
        toast({
          title: 'Processamento iniciado',
          description: pendingCount !== null
            ? `Fila iniciada em background (${pendingCount} pendentes). Atualize em alguns segundos.`
            : 'Fila iniciada em background. Atualize em alguns segundos.',
        });
      }

      // Refresh the queue to show updated status
      await fetchQueue();

    } catch (error: unknown) {
      console.error('Error triggering processing:', error);
      if (showToast) {
        toast({
          title: 'Erro ao processar',
          description: error instanceof Error ? error.message : 'Não foi possível iniciar o processamento',
          variant: 'destructive',
        });
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [user, fetchQueue, toast]);

  // Public trigger function (always shows toast)
  const triggerProcessing = useCallback(async () => {
    await triggerProcessingInternal(true);
  }, [triggerProcessingInternal]);

  // Upload files to queue
  const uploadToQueue = useCallback(async (files: File[], _fiscalYear: number) => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Utilizador não autenticado',
        variant: 'destructive',
      });
      return { success: false, uploaded: 0 };
    }

    setIsUploading(true);
    setUploadProgress(0);

    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Convert file to base64
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { error } = await supabase
          .from('upload_queue')
          .insert({
            user_id: user.id,
            client_id: effectiveClientId, // For accountants, this is the selected client's ID
            file_name: file.name,
            file_data: fileData,
            qr_content: null,
            upload_type: 'expense',
            status: 'pending',
            fiscal_year: _fiscalYear,
          });

        if (error) throw error;

        uploadedCount++;
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }

    await fetchQueue();

    if (uploadedCount > 0) {
      toast({
        title: 'Ficheiros adicionados à fila',
        description: `${uploadedCount} de ${files.length} ficheiros adicionados. A iniciar processamento automático...`,
      });

      // Auto-trigger processing after upload completes
      // Small delay to allow UI to update
      setTimeout(() => {
        triggerProcessingInternal();
      }, 500);
    }

    setIsUploading(false);
    setUploadProgress(0);

    return { success: uploadedCount > 0, uploaded: uploadedCount };
  }, [user, effectiveClientId, toast, fetchQueue, triggerProcessingInternal]);

  // Remove item from queue
  const removeItem = useCallback(async (itemId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('upload_queue')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchQueue();
      toast({
        title: 'Item removido',
        description: 'O ficheiro foi removido da fila',
      });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o item',
        variant: 'destructive',
      });
    }
  }, [user, fetchQueue, toast]);

  // Clear all completed/failed items
  const clearCompleted = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('upload_queue')
        .delete()
        .eq('user_id', user.id)
        .in('status', ['completed', 'failed']);

      if (error) throw error;

      await fetchQueue();
      toast({
        title: 'Fila limpa',
        description: 'Itens concluídos e falhados foram removidos',
      });
    } catch (error) {
      console.error('Error clearing completed:', error);
    }
  }, [user, fetchQueue, toast]);

  // Clear ALL queue items for a specific client (for reset functionality)
  const clearAllQueue = useCallback(async (clientId?: string) => {
    if (!user) return;

    try {
      const targetClientId = clientId || effectiveClientId;
      if (!targetClientId) {
        throw new Error('Client ID not specified');
      }

      const { error } = await supabase
        .from('upload_queue')
        .delete()
        .eq('client_id', targetClientId);

      if (error) throw error;

      await fetchQueue();
      toast({
        title: 'Fila limpa',
        description: 'Todos os itens da fila foram removidos',
      });
    } catch (error) {
      console.error('Error clearing all queue:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível limpar a fila',
        variant: 'destructive',
      });
    }
  }, [user, effectiveClientId, fetchQueue, toast]);

  // Retry failed item
  const retryItem = useCallback(async (itemId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('upload_queue')
        .update({ status: 'pending', error_message: null })
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchQueue();
      toast({
        title: 'Item reprocessado',
        description: 'O ficheiro foi adicionado à fila novamente',
      });
    } catch (error) {
      console.error('Error retrying item:', error);
    }
  }, [user, fetchQueue, toast]);

  return {
    items,
    stats,
    isLoading,
    isUploading,
    isProcessing,
    uploadProgress,
    uploadToQueue,
    removeItem,
    clearCompleted,
    clearAllQueue,
    retryItem,
    triggerProcessing,
    refresh: fetchQueue,
  };
}
