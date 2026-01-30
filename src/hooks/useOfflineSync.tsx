import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  addPendingUpload, 
  getPendingUploads, 
  removePendingUpload, 
  updateRetryCount,
  getPendingCount,
  PendingUpload 
} from '@/lib/offlineDb';
import { useInvoiceUpload } from './useInvoiceUpload';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { processInvoice } = useInvoiceUpload();

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Error getting pending count:', error);
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexão restabelecida');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Sem conexão - uploads serão guardados localmente');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshPendingCount]);

  // Queue upload for later
  const queueUpload = useCallback(async (
    imageData: string,
    qrContent: string,
    fileName: string
  ): Promise<string> => {
    const id = await addPendingUpload({ imageData, qrContent, fileName });
    await refreshPendingCount();
    toast.info('Fatura guardada para upload quando houver conexão');
    return id;
  }, [refreshPendingCount]);

  // Process a single pending upload
  const processPendingUpload = useCallback(async (upload: PendingUpload): Promise<boolean> => {
    try {
      // Convert base64 back to blob
      const response = await fetch(upload.imageData);
      const blob = await response.blob();
      
      const result = await processInvoice(blob, upload.qrContent, upload.fileName);
      
      if (result.success) {
        await removePendingUpload(upload.id);
        return true;
      } else {
        await updateRetryCount(upload.id);
        return false;
      }
    } catch (error) {
      console.error('Error processing pending upload:', error);
      await updateRetryCount(upload.id);
      return false;
    }
  }, [processInvoice]);

  // Sync all pending uploads
  const syncPendingUploads = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    
    const pending = await getPendingUploads();
    if (pending.length === 0) return;

    setIsSyncing(true);
    toast.loading(`A sincronizar ${pending.length} fatura(s)...`, { id: 'sync' });

    let successCount = 0;
    let failCount = 0;

    for (const upload of pending) {
      // Skip uploads with too many retries
      if (upload.retryCount >= 3) {
        failCount++;
        continue;
      }

      const success = await processPendingUpload(upload);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    await refreshPendingCount();
    setIsSyncing(false);

    if (successCount > 0 && failCount === 0) {
      toast.success(`${successCount} fatura(s) sincronizada(s) com sucesso`, { id: 'sync' });
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`${successCount} sincronizada(s), ${failCount} falharam`, { id: 'sync' });
    } else if (failCount > 0) {
      toast.error(`Falha ao sincronizar ${failCount} fatura(s)`, { id: 'sync' });
    } else {
      toast.dismiss('sync');
    }
  }, [isOnline, isSyncing, processPendingUpload, refreshPendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      const timer = setTimeout(() => {
        syncPendingUploads();
      }, 2000); // Wait 2s to ensure stable connection
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, syncPendingUploads]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    queueUpload,
    syncPendingUploads,
    refreshPendingCount,
  };
}
