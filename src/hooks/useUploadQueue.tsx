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
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  fiscal_year: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_data: unknown | null;
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
}

interface DbQueueItem {
  id: string;
  file_name: string;
  file_data: string;
  qr_content: string | null;
  upload_type: string;
  status: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
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
      const { data, error } = await supabase
        .from('upload_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mappedItems: QueueItem[] = (data as DbQueueItem[] || []).map(item => ({
        id: item.id,
        file_path: '',
        file_name: item.file_name,
        file_size: 0,
        mime_type: 'image/jpeg',
        fiscal_year: new Date().getFullYear(),
        status: item.status as QueueItem['status'],
        extracted_data: null,
        confidence: null,
        warnings: null,
        error_message: item.error_message,
        attempts: item.retry_count,
        created_at: item.created_at,
        started_at: null,
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
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching upload queue:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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

      const processed = data?.processed || 0;
      const completed = data?.completed || 0;
      const failed = data?.failed || 0;
      const rateLimited = data?.rateLimited || 0;

      if (showToast) {
        toast({
          title: 'Processamento concluído',
          description: `${completed} ficheiros processados, ${failed} falhados${rateLimited > 0 ? `, ${rateLimited} aguardam retry` : ''} de ${processed} total`,
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
    retryItem,
    triggerProcessing,
    refresh: fetchQueue,
  };
}
