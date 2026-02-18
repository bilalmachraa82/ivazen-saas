/**
 * Bulk Invoice Upload Component
 * Allows uploading multiple purchase/sales invoices at once with visual queue processing
 */

import { useState, useCallback, useEffect, DragEvent } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, XCircle, Trash2, Users, ShoppingCart, TrendingUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  processBulkInvoices,
  InvoiceQueueItem,
  getInvoiceConfidenceStatus,
  validateBulkFiles,
  saveInvoiceToDatabase,
  BULK_INVOICE_CONFIG
} from '@/lib/bulkInvoiceProcessor';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface BulkInvoiceUploadProps {
  selectedClientId?: string | null;
  clientName?: string | null;
}

export function BulkInvoiceUpload({ selectedClientId, clientName }: BulkInvoiceUploadProps) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<InvoiceQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'purchase' | 'sales'>('purchase');
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const effectiveClientId = selectedClientId || user?.id;

  // Calculate stats
  const totalCount = queue.length;
  const completedCount = queue.filter(item => item.status === 'completed').length;
  const errorCount = queue.filter(item => item.status === 'error').length;
  const pendingCount = queue.filter(item => item.status === 'pending').length;
  const processingCount = queue.filter(item => item.status === 'processing').length;
  const savedCount = queue.filter(item => item.status === 'completed' && item.invoiceId).length;
  const unsavedCount = queue.filter(item => item.status === 'completed' && !item.invoiceId).length;

  // Prevent navigation when there are unsaved processed items
  useEffect(() => {
    const hasUnsaved = queue.some(item => item.status === 'completed' && !item.invoiceId);
    if (!hasUnsaved) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Tem faturas processadas mas não gravadas. Tem a certeza que quer sair?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [queue]);

  // Retry saving a single item
  const handleRetrySave = async (item: InvoiceQueueItem) => {
    if (!effectiveClientId || !item.extractedData) return;

    setRetryingIds(prev => new Set(prev).add(item.id));

    try {
      // Upload file first (it may already exist but storage handles upsert)
      const { supabase } = await import('@/integrations/supabase/client');
      const { detectMimeType } = await import('@/lib/mime');
      const subPath = item.invoiceType === 'sales' ? 'sales/' : '';
      const filePath = `${effectiveClientId}/${subPath}${Date.now()}_${item.fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, item.file, {
          contentType: detectMimeType(item.file),
          upsert: false,
        });

      if (uploadError) {
        toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' });
        return;
      }

      // saveInvoiceToDatabase already retries without supplier_vat_id if the DB column is missing.
      const result = await saveInvoiceToDatabase(item.extractedData, filePath, effectiveClientId, item.invoiceType);

      if (result.success) {
        setQueue(prev => prev.map(q =>
          q.id === item.id
            ? { ...q, invoiceId: result.invoiceId, warnings: (q.warnings || []).filter(w => !w.startsWith('Aviso:')) }
            : q
        ));
        toast({ title: 'Gravada!', description: `${item.fileName} guardada com sucesso.` });
      } else {
        toast({ title: 'Erro ao gravar', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // Handle file drop
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [invoiceType, queue.length]);

  // Handle file input
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  }, [invoiceType, queue.length]);

  // Debug state for diagnostic panel
  const [debugInfo, setDebugInfo] = useState<{
    received: number;
    fileDetails: { name: string; type: string; size: number; accepted: boolean; reason?: string }[];
    validCount: number;
    invalidCount: number;
  } | null>(null);

  // Add files to queue
  const addFiles = (files: File[]) => {
    console.log('[addFiles] Received:', files.length, 'files, names:', files.map(f => f.name));

    if (queue.length + files.length > BULK_INVOICE_CONFIG.MAX_FILES_PER_BATCH) {
      toast({
        title: 'Demasiados ficheiros',
        description: `Maximo de ${BULK_INVOICE_CONFIG.MAX_FILES_PER_BATCH} ficheiros por batch. Ja tem ${queue.length} na fila.`,
        variant: 'destructive',
      });
      return;
    }

    const { valid, invalid } = validateBulkFiles(files);

    console.log('[addFiles] validateBulkFiles result: valid=', valid.length, 'invalid=', invalid.length);
    if (invalid.length > 0) {
      console.log('[addFiles] REJECTED:', invalid.map(f => f.file.name + ' -> ' + f.reason));
    }

    const fileDetails = [
      ...valid.map(v => ({ name: v.fileName, type: v.file.type || '(empty)', size: v.file.size, accepted: true })),
      ...invalid.map(i => ({ name: i.file.name, type: i.file.type || '(empty)', size: i.file.size, accepted: false, reason: i.reason })),
    ];
    setDebugInfo({ received: files.length, fileDetails, validCount: valid.length, invalidCount: invalid.length });

    if (invalid.length > 0) {
      toast({
        title: `${invalid.length} ficheiro(s) rejeitado(s)`,
        description: invalid.slice(0, 3).map(f => `${f.file.name}: ${f.reason}`).join(', ') + (invalid.length > 3 ? '...' : ''),
        variant: 'destructive',
      });
    }

    if (valid.length === 0) return;

    const itemsWithType = valid.map(item => ({ ...item, invoiceType }));
    setQueue(prev => [...prev, ...itemsWithType]);
    toast({ title: 'Ficheiros adicionados', description: `${valid.length} fatura(s) adicionada(s) a fila` });
  };

  // Process all pending documents
  const handleProcess = async () => {
    if (!effectiveClientId) {
      toast({ title: 'Cliente nao definido', description: 'Selecione um cliente antes de processar', variant: 'destructive' });
      return;
    }

    const filesToProcess = queue.filter(item => item.status === 'pending' || item.status === 'error');
    console.log('[handleProcess] Queue total:', queue.length, 'filesToProcess:', filesToProcess.length);

    if (filesToProcess.length === 0) {
      toast({ title: 'Nenhuma fatura pendente', description: 'Todas as faturas ja foram processadas' });
      return;
    }

    setIsProcessing(true);
    try {
      await processBulkInvoices(filesToProcess, effectiveClientId, (id, updatedItem) => {
        setQueue(prev => prev.map(item => item.id === id ? updatedItem : item));
      }, { saveToDatabase: true });
      toast({ title: 'Processamento concluido', description: `${filesToProcess.length} fatura(s) processada(s)` });
    } catch (error: any) {
      toast({ title: 'Erro no processamento', description: error.message || 'Ocorreu um erro ao processar as faturas', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAll = () => {
    setQueue([]);
    toast({ title: 'Fila limpa', description: 'Todas as faturas foram removidas' });
  };

  const handleRemove = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  // Retry all unsaved items
  const handleRetryAllUnsaved = async () => {
    const unsaved = queue.filter(item => item.status === 'completed' && !item.invoiceId && item.extractedData);
    for (const item of unsaved) {
      await handleRetrySave(item);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Upload em Bulk</h2>
        <p className="text-muted-foreground mt-1">
          Carregue multiplas faturas de uma vez. Suporta PDF e imagens.
        </p>
      </div>

      {/* Invoice Type Selector */}
      <Tabs value={invoiceType} onValueChange={(v) => setInvoiceType(v as 'purchase' | 'sales')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="purchase" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Compras (Despesas)
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Vendas (Receitas)
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Client Info for Accountants */}
      {selectedClientId && clientName && (
        <Alert className="border-primary/20 bg-primary/5">
          <Users className="h-4 w-4 text-primary" />
          <AlertDescription>
            As faturas serao adicionadas ao cliente: <strong className="text-primary">{clientName}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning if no client selected */}
      {selectedClientId === null && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Selecione um cliente</strong> antes de processar faturas.
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Limites:</strong> Max. 10MB por ficheiro | Max. 100 ficheiros por batch |
          Processa 2 docs em simultaneo | Faturas guardadas automaticamente
        </AlertDescription>
      </Alert>

      {/* Drop Zone */}
      <Card>
        <CardContent className="p-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onClick={() => document.getElementById('bulk-invoice-file-input')?.click()}
          >
            <input
              id="bulk-invoice-file-input"
              type="file"
              multiple
              accept=".pdf,image/*"
              onChange={handleFileInput}
              className="hidden"
            />
            <Upload className={`h-16 w-16 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-lg font-medium mb-2">
              {isDragging ? 'Solte os ficheiros aqui' : 'Arraste ficheiros ou clique para selecionar'}
            </p>
            <p className="text-sm text-muted-foreground">
              Suporta PDF, JPG, PNG | Max. 10MB por ficheiro | Max. 100 ficheiros
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Tipo selecionado: <strong>{invoiceType === 'purchase' ? 'Faturas de Compra' : 'Faturas de Venda'}</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Temporary Debug Panel */}
      {debugInfo && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 dark:text-amber-200">
            <p className="font-bold mb-1">🔍 Debug: Último upload</p>
            <p className="text-xs">Browser entregou: <strong>{debugInfo.received}</strong> ficheiros | Aceites: <strong>{debugInfo.validCount}</strong> | Rejeitados: <strong>{debugInfo.invalidCount}</strong></p>
            <div className="mt-1 max-h-40 overflow-y-auto text-xs font-mono">
              {debugInfo.fileDetails.map((f, i) => (
                <div key={i} className={f.accepted ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                  {f.accepted ? '✅' : '❌'} {f.name} | type=&quot;{f.type}&quot; | size={f.size} {f.reason ? `| razão: ${f.reason}` : ''}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Unsaved Warning Banner */}
      {unsavedCount > 0 && !isProcessing && (
        <Alert variant="destructive" className="border-red-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>{unsavedCount} fatura{unsavedCount !== 1 ? 's' : ''} processada{unsavedCount !== 1 ? 's' : ''} mas NÃO gravada{unsavedCount !== 1 ? 's' : ''}</strong> na base de dados.
              Use o botão "Tentar Gravar" em cada uma, ou:
            </span>
            <Button size="sm" variant="outline" className="ml-3 shrink-0" onClick={handleRetryAllUnsaved}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Gravar Todas ({unsavedCount})
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats and Actions */}
      {totalCount > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm font-medium">
            {totalCount} fatura{totalCount !== 1 ? 's' : ''}
          </div>

          {completedCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>{completedCount} processada{completedCount !== 1 ? 's' : ''}</span>
              {savedCount > 0 && (
                <span className="text-xs">({savedCount} guardada{savedCount !== 1 ? 's' : ''})</span>
              )}
            </div>
          )}

          {unsavedCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{unsavedCount} não gravada{unsavedCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {processingCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{processingCount} a processar</span>
            </div>
          )}

          {errorCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-red-600">
              <XCircle className="h-4 w-4" />
              <span>{errorCount} falhada{errorCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="text-sm text-yellow-600">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
            </div>
          )}

          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClearAll} disabled={isProcessing}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Tudo
            </Button>
            <Button onClick={handleProcess} disabled={isProcessing || pendingCount === 0 || !effectiveClientId}>
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A processar...</>
              ) : (
                <>Processar {pendingCount} fatura{pendingCount !== 1 ? 's' : ''}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Processing Queue */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Fila de Processamento</h3>
          {queue.map(item => {
            const status = item.confidence ? getInvoiceConfidenceStatus(item.confidence) : null;
            const isUnsaved = item.status === 'completed' && !item.invoiceId;
            const isRetrying = retryingIds.has(item.id);

            return (
              <Card
                key={item.id}
                className={`transition-colors ${
                  item.status === 'completed'
                    ? isUnsaved
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-300'
                      : status?.color === 'green'
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200'
                      : status?.color === 'yellow'
                      ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200'
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200'
                    : item.status === 'error'
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200'
                    : item.status === 'processing'
                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200'
                    : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className="pt-0.5">
                      {item.status === 'completed' && !isUnsaved && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {item.status === 'completed' && isUnsaved && <AlertCircle className="h-5 w-5 text-red-600" />}
                      {item.status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                      {item.status === 'processing' && <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />}
                      {item.status === 'pending' && <FileText className="h-5 w-5 text-muted-foreground" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{item.fileName}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          item.invoiceType === 'sales'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.invoiceType === 'sales' ? 'Venda' : 'Compra'}
                        </span>
                      </div>

                      {item.extractedData && (
                        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                          <p>NIF/VAT: {item.extractedData.supplier_nif} | Total: {item.extractedData.total_amount?.toFixed(2)}€</p>
                          {item.extractedData.supplier_vat_id && (
                            <p>VAT: {item.extractedData.supplier_vat_id}</p>
                          )}
                          {item.extractedData.document_number && (
                            <p>Doc: {item.extractedData.document_number}</p>
                          )}
                        </div>
                      )}

                      {item.confidence !== undefined && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Confiança: {(item.confidence * 100).toFixed(0)}%
                          {item.invoiceId && <span className="text-green-600 ml-2">✓ Guardada</span>}
                        </p>
                      )}

                      {item.warnings && item.warnings.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {item.warnings.map((warning, i) => (
                            <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{warning}</p>
                          ))}
                        </div>
                      )}

                      {item.error && (
                        <p className="text-xs text-red-600 mt-1">{item.error}</p>
                      )}

                      {item.status === 'processing' && (
                        <div className="mt-2">
                          <Progress value={item.progress} className="h-1" />
                        </div>
                      )}
                    </div>

                    {/* Status Badge + Retry */}
                    <div className="flex items-center gap-2">
                      {isUnsaved && (
                        <>
                          <div className="px-2 py-1 rounded text-xs font-medium whitespace-nowrap bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            ✗ Não Gravada
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleRetrySave(item)}
                            disabled={isRetrying}
                          >
                            {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                            {isRetrying ? '...' : 'Gravar'}
                          </Button>
                        </>
                      )}

                      {status && item.status === 'completed' && !isUnsaved && (
                        <div
                          className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                            status.color === 'green'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : status.color === 'yellow'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          }`}
                        >
                          {status.icon} {status.label}
                        </div>
                      )}

                      {/* Remove Button */}
                      {item.status !== 'processing' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(item.id)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {savedCount > 0 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>{savedCount} fatura{savedCount !== 1 ? 's' : ''}</strong> guardada{savedCount !== 1 ? 's' : ''} com sucesso!
            {invoiceType === 'purchase' && ' As faturas de compra estao a ser classificadas pela IA em segundo plano.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
