/**
 * Bulk Upload Tab for Modelo 10
 * Allows uploading multiple documents at once with visual queue processing
 */

import { useState, useCallback, DragEvent } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, XCircle, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { processBulkDocuments, QueueItem, getConfidenceStatus } from '@/lib/bulkProcessor';
import { BulkReviewTable } from './BulkReviewTable';
import { useToast } from '@/hooks/use-toast';

// File size limit: 5MB per file (reduced to avoid payload limits with base64 encoding)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const MAX_FILES_PER_BATCH = 100; // Increased from 50 for better throughput

interface BulkUploadTabProps {
  selectedClientId?: string | null;
  selectedYear: number;
  clientName?: string | null;
  isAccountantOwnAccount?: boolean;
}

export function BulkUploadTab({ selectedClientId, selectedYear, clientName, isAccountantOwnAccount }: BulkUploadTabProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  // Handle file drop
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, []);

  // Handle file input
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  }, []);

  // Add files to queue
  const addFiles = (files: File[]) => {
    // Check total number of files
    if (queue.length + files.length > MAX_FILES_PER_BATCH) {
      toast({
        title: 'Demasiados ficheiros',
        description: `Máximo de ${MAX_FILES_PER_BATCH} ficheiros por batch. Já tem ${queue.length} na fila.`,
        variant: 'destructive',
      });
      return;
    }

    // Filter and validate files
    const validFiles: File[] = [];
    const rejectedFiles: string[] = [];

    files.forEach(file => {
      const isPDF = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');

      if (!isPDF && !isImage) {
        rejectedFiles.push(`${file.name} (tipo inválido)`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        rejectedFiles.push(`${file.name} (>5MB)`);
        return;
      }

      validFiles.push(file);
    });

    // Show rejected files warning
    if (rejectedFiles.length > 0) {
      toast({
        title: `${rejectedFiles.length} ficheiro(s) rejeitado(s)`,
        description: rejectedFiles.slice(0, 3).join(', ') + (rejectedFiles.length > 3 ? '...' : ''),
        variant: 'destructive',
      });
    }

    if (validFiles.length === 0) {
      return;
    }

    const newItems: QueueItem[] = validFiles.map((file, i) => ({
      id: `doc-${Date.now()}-${i}`,
      file,
      fileName: file.name,
      status: 'pending',
      progress: 0,
    }));

    setQueue(prev => [...prev, ...newItems]);

    toast({
      title: 'Ficheiros adicionados',
      description: `${validFiles.length} documento(s) adicionado(s) à fila`,
    });
  };

  // Process all pending documents
  const handleProcess = async () => {
    const filesToProcess = queue.filter(item => item.status === 'pending' || item.status === 'error');

    if (filesToProcess.length === 0) {
      toast({
        title: 'Nenhum documento pendente',
        description: 'Todos os documentos já foram processados',
      });
      return;
    }

    setIsProcessing(true);

    try {
      await processBulkDocuments(
        filesToProcess, // Pass full QueueItems to preserve IDs
        selectedYear, // Pass fiscal year from props
        (id, updatedItem) => {
          setQueue(prev => prev.map(item => item.id === id ? updatedItem : item));
        }
      );

      toast({
        title: 'Processamento concluído',
        description: `${filesToProcess.length} documento(s) processado(s)`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro no processamento',
        description: error.message || 'Ocorreu um erro ao processar os documentos',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear all documents
  const handleClearAll = () => {
    setQueue([]);
    toast({
      title: 'Fila limpa',
      description: 'Todos os documentos foram removidos',
    });
  };

  // Remove single document
  const handleRemove = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  // Calculate stats
  const totalCount = queue.length;
  const completedCount = queue.filter(item => item.status === 'completed').length;
  const errorCount = queue.filter(item => item.status === 'error').length;
  const pendingCount = queue.filter(item => item.status === 'pending').length;
  const processingCount = queue.filter(item => item.status === 'processing').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Import Bulk</h2>
        <p className="text-muted-foreground mt-1">
          Processe múltiplos documentos de uma vez (recibos verdes, rendas, faturas)
        </p>
      </div>

      {/* Client Info for Accountants */}
      {selectedClientId && clientName && !isAccountantOwnAccount && (
        <Alert className="border-primary/20 bg-primary/5">
          <Users className="h-4 w-4 text-primary" />
          <AlertDescription>
            Os documentos processados serão adicionados ao cliente: <strong className="text-primary">{clientName}</strong>
          </AlertDescription>
        </Alert>
      )}

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

      {/* Warning if no client selected (for accountants) */}
      {selectedClientId === null && !isAccountantOwnAccount && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Seleccione um cliente</strong> antes de processar documentos. Os dados serão associados ao cliente seleccionado.
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Limites:</strong> Máx. 5MB por ficheiro • Máx. 100 ficheiros por batch •
          Processa 5 docs em simultâneo • Documentos com alta confiança (≥95%) marcados para aprovação automática
        </AlertDescription>
      </Alert>

      {/* Drop Zone */}
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
            onClick={isAccountantOwnAccount ? undefined : () => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
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
              Suporta PDF, JPG, PNG • Máx. 5MB por ficheiro • Máx. 100 ficheiros
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats and Actions */}
      {totalCount > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm font-medium">
            {totalCount} documento{totalCount !== 1 ? 's' : ''}
          </div>

          {completedCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>{completedCount} concluído{completedCount !== 1 ? 's' : ''}</span>
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
              <span>{errorCount} falhado{errorCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="text-sm text-yellow-600">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
            </div>
          )}

          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Tudo
            </Button>
            <Button
              onClick={handleProcess}
              disabled={isProcessing || pendingCount === 0 || selectedClientId === null || isAccountantOwnAccount}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A processar...
                </>
              ) : (
                <>Processar {pendingCount} documento{pendingCount !== 1 ? 's' : ''}</>
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
            const status = item.confidence ? getConfidenceStatus(item.confidence) : null;

            return (
              <Card
                key={item.id}
                className={`transition-colors ${
                  item.status === 'completed'
                    ? status?.color === 'green'
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
                      {item.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {item.status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                      {item.status === 'processing' && <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />}
                      {item.status === 'pending' && <FileText className="h-5 w-5 text-muted-foreground" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.fileName}</p>

                      {item.confidence && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Confiança: {(item.confidence * 100).toFixed(0)}%
                        </p>
                      )}

                      {item.warnings && item.warnings.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {item.warnings.map((warning, i) => (
                            <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
                              {warning}
                            </p>
                          ))}
                        </div>
                      )}

                      {item.error && (
                        <p className="text-xs text-red-600 mt-1">❌ {item.error}</p>
                      )}

                      {/* Progress Bar */}
                      {item.status === 'processing' && (
                        <div className="mt-2">
                          <Progress value={item.progress} className="h-1" />
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    {status && item.status === 'completed' && (
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemove(item.id)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Table - Only show completed items */}
      {completedCount > 0 && (
        <div className="pt-6 border-t">
          <BulkReviewTable
            items={queue.filter(item => item.status === 'completed')}
            onRemove={handleRemove}
            selectedClientId={selectedClientId}
            selectedYear={selectedYear}
          />
        </div>
      )}
    </div>
  );
}
