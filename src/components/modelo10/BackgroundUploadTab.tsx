/**
 * Background Upload Tab for Modelo 10
 * For large batches (100+ files) - uploads to queue for background processing
 */

import { useState, useCallback, DragEvent } from 'react';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Trash2,
  RefreshCw,
  Clock,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useWithholdings } from '@/hooks/useWithholdings';
import { useUploadQueue, QueueItem as UploadQueueItem } from '@/hooks/useUploadQueue';
import { BulkReviewTable } from './BulkReviewTable';
import { getConfidenceStatus, QueueItem as BulkQueueItem } from '@/lib/bulkProcessor';

// Limits for background upload (more generous than real-time)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES_PER_BATCH = 500; // Allow up to 500 files

interface BackgroundUploadTabProps {
  selectedClientId?: string | null;
  selectedYear: number;
  isAccountantOwnAccount?: boolean;
}

export function BackgroundUploadTab({ selectedClientId, selectedYear, isAccountantOwnAccount }: BackgroundUploadTabProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();
  // Pass selectedClientId to the hook so withholdings are created for the correct client
  const {
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
    refresh,
  } = useUploadQueue(selectedClientId);

  // Handle file drop
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    validateAndAddFiles(files);
  }, []);

  // Handle file input
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      validateAndAddFiles(files);
    }
  }, []);

  // Validate and add files to selection
  const validateAndAddFiles = (files: File[]) => {
    const totalFiles = selectedFiles.length + files.length;
    if (totalFiles > MAX_FILES_PER_BATCH) {
      toast({
        title: 'Demasiados ficheiros',
        description: `Máximo de ${MAX_FILES_PER_BATCH} ficheiros por batch`,
        variant: 'destructive',
      });
      return;
    }

    const validFiles: File[] = [];
    const rejected: string[] = [];

    files.forEach(file => {
      const isPDF = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');

      if (!isPDF && !isImage) {
        rejected.push(`${file.name} (tipo inválido)`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name} (>5MB)`);
        return;
      }

      validFiles.push(file);
    });

    if (rejected.length > 0) {
      toast({
        title: `${rejected.length} ficheiro(s) rejeitado(s)`,
        description: rejected.slice(0, 3).join(', '),
        variant: 'destructive',
      });
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  // Start upload
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    await uploadToQueue(selectedFiles, selectedYear);
    setSelectedFiles([]);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedFiles([]);
  };

  // Convert queue items to format for BulkReviewTable
  const completedItems: BulkQueueItem[] = items
    .filter(item => item.status === 'completed' && item.extracted_data)
    .map(item => ({
      id: item.id,
      file: new File([], item.file_name),
      fileName: item.file_name,
      status: 'completed' as const,
      progress: 100,
      extractedData: item.extracted_data as BulkQueueItem['extractedData'],
      confidence: item.confidence || 0,
      warnings: item.warnings || [],
    }));

  // Status badge helper
  const getStatusBadge = (status: UploadQueueItem['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'processing':
        return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />A processar</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Upload em Massa (Background)</h2>
        <p className="text-muted-foreground mt-1">
          Para grandes volumes (até 500 ficheiros). Processamento automático em segundo plano.
        </p>
      </div>

      {/* Warning: Accountant's own account */}
      {isAccountantOwnAccount && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importação bloqueada:</strong> Não é possível importar documentos para a sua própria conta de contabilista.
            Seleccione um cliente para continuar.
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      {!isAccountantOwnAccount && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Modo Background:</strong> Os ficheiros são carregados para uma fila e processados automaticamente.
            Pode fechar o browser - será notificado quando terminar.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && stats.total_count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total_count}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending_count}</div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.processing_count}</div>
              <p className="text-xs text-muted-foreground">A processar</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.completed_count}</div>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.failed_count}</div>
              <p className="text-xs text-muted-foreground">Falhados</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Zone */}
      <Card className={isAccountantOwnAccount ? 'opacity-50' : ''}>
        <CardContent className="p-6">
          <div
            onDrop={isAccountantOwnAccount ? undefined : handleDrop}
            onDragOver={isAccountantOwnAccount ? undefined : (e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={isAccountantOwnAccount ? undefined : () => setIsDragging(false)}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isAccountantOwnAccount
                ? 'border-muted-foreground/25 cursor-not-allowed'
                : isDragging
                  ? 'border-primary bg-primary/5 cursor-pointer'
                  : 'border-muted-foreground/25 hover:border-primary/50 cursor-pointer'
            }`}
            onClick={isAccountantOwnAccount ? undefined : () => document.getElementById('bg-file-input')?.click()}
          >
            <input
              id="bg-file-input"
              type="file"
              multiple
              accept=".pdf,image/*"
              onChange={handleFileInput}
              className="hidden"
              disabled={isAccountantOwnAccount}
            />
            <Upload className={`h-16 w-16 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-lg font-medium mb-2">
              {isAccountantOwnAccount
                ? 'Seleccione um cliente para importar'
                : isDragging
                  ? 'Solte os ficheiros aqui'
                  : 'Arraste ficheiros ou clique para selecionar'}
            </p>
            <p className="text-sm text-muted-foreground">
              Suporta PDF, JPG, PNG • Máx. 5MB por ficheiro • Até 500 ficheiros
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{selectedFiles.length} ficheiros selecionados</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
                <Button size="sm" onClick={handleUpload} disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      A enviar... {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      Enviar para Fila
                    </>
                  )}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isUploading && (
              <Progress value={uploadProgress} className="mb-4" />
            )}
            <div className="max-h-40 overflow-y-auto space-y-1">
              {selectedFiles.slice(0, 20).map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ))}
              {selectedFiles.length > 20 && (
                <p className="text-sm text-muted-foreground">
                  ... e mais {selectedFiles.length - 20} ficheiros
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Items */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Fila de Processamento</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                {stats && (stats.pending_count > 0 || stats.processing_count === 0) && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={triggerProcessing}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4 mr-1" />
                    )}
                    {isProcessing ? 'A processar...' : 'Processar Agora'}
                  </Button>
                )}
                {stats && (stats.completed_count > 0 || stats.failed_count > 0) && (
                  <Button variant="outline" size="sm" onClick={clearCompleted}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Limpar Concluídos
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Ficheiro</th>
                    <th className="text-left py-2">Estado</th>
                    <th className="text-left py-2">Confiança</th>
                    <th className="text-right py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 50).map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{item.file_name}</span>
                        </div>
                      </td>
                      <td className="py-2">{getStatusBadge(item.status)}</td>
                      <td className="py-2">
                        {item.confidence !== null && (
                          <Badge
                            variant="outline"
                            className={
                              item.confidence >= 0.95
                                ? 'border-green-500 text-green-600'
                                : item.confidence >= 0.8
                                ? 'border-yellow-500 text-yellow-600'
                                : 'border-red-500 text-red-600'
                            }
                          >
                            {(item.confidence * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {item.status === 'failed' && (
                          <Button variant="ghost" size="sm" onClick={() => retryItem(item.id)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length > 50 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  A mostrar 50 de {items.length} items
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Table for Completed Items */}
      {completedItems.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">
            Documentos Prontos para Revisão ({completedItems.length})
          </h3>
          <BulkReviewTable
            items={completedItems}
            onRemove={removeItem}
            selectedClientId={selectedClientId}
            selectedYear={selectedYear}
          />
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && selectedFiles.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Nenhum ficheiro na fila</p>
          <p className="text-sm">Arraste ficheiros para começar</p>
        </div>
      )}
    </div>
  );
}
