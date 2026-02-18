/**
 * Reconciliation Uploader Component
 * Upload Excel reference + PDFs for extraction
 */

import { useState, useCallback, useRef } from 'react';
import { ZenCard } from '@/components/zen';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileSpreadsheet,
  FileText,
  Upload,
  X,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UploadedFile {
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

interface ReconciliationUploaderProps {
  onExcelUpload: (file: File) => Promise<void>;
  onPdfsUpload: (files: File[]) => Promise<void>;
  excelFile?: File | null;
  pdfFiles: UploadedFile[];
  isProcessing: boolean;
  progress?: number;
  className?: string;
}

export function ReconciliationUploader({
  onExcelUpload,
  onPdfsUpload,
  excelFile,
  pdfFiles,
  isProcessing,
  progress = 0,
  className,
}: ReconciliationUploaderProps) {
  const [excelDragActive, setExcelDragActive] = useState(false);
  const [pdfDragActive, setPdfDragActive] = useState(false);
  
  const excelInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  const handleExcelDrag = useCallback((e: React.DragEvent, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setExcelDragActive(active);
  }, []);
  
  const handlePdfDrag = useCallback((e: React.DragEvent, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfDragActive(active);
  }, []);
  
  const handleExcelDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExcelDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      await onExcelUpload(file);
    } else {
      toast.error('Ficheiro inválido', { description: 'Por favor carregue um ficheiro Excel (.xlsx ou .xls)' });
    }
  }, [onExcelUpload]);
  
  const handlePdfDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfDragActive(false);
    
    const files = Array.from(e.dataTransfer.files).filter(f => 
      f.name.toLowerCase().endsWith('.pdf') ||
      f.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      await onPdfsUpload(files);
    } else {
      toast.error('Ficheiros inválidos', { description: 'Por favor carregue ficheiros PDF ou imagens' });
    }
  }, [onPdfsUpload]);
  
  const handleExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onExcelUpload(file);
    }
  };
  
  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await onPdfsUpload(files);
    }
  };
  
  const completedCount = pdfFiles.filter(f => f.status === 'done').length;
  const errorCount = pdfFiles.filter(f => f.status === 'error').length;
  
  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      {/* Excel Upload */}
      <ZenCard gradient="primary" withLine>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5" />
            Excel de Referência
          </CardTitle>
          <CardDescription>
            Carregue o Excel do contabilista (a "verdade")
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={(e) => handleExcelDrag(e, true)}
            onDragLeave={(e) => handleExcelDrag(e, false)}
            onDragOver={(e) => handleExcelDrag(e, true)}
            onDrop={handleExcelDrop}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer',
              excelDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              isProcessing && 'opacity-50 pointer-events-none'
            )}
            onClick={() => excelInputRef.current?.click()}
          >
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelSelect}
              disabled={isProcessing}
            />
            
            {excelFile ? (
              <div className="flex items-center justify-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">{excelFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(excelFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Arraste o Excel aqui ou clique para seleccionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  .xlsx ou .xls
                </p>
              </>
            )}
          </div>
        </CardContent>
      </ZenCard>
      
      {/* PDF Upload */}
      <ZenCard gradient="default" withLine>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Documentos PDF
          </CardTitle>
          <CardDescription>
            Carregue as faturas e recibos para extracção
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={(e) => handlePdfDrag(e, true)}
            onDragLeave={(e) => handlePdfDrag(e, false)}
            onDragOver={(e) => handlePdfDrag(e, true)}
            onDrop={handlePdfDrop}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer',
              pdfDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              isProcessing && 'opacity-50 pointer-events-none'
            )}
            onClick={() => pdfInputRef.current?.click()}
          >
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,image/*"
              multiple
              className="hidden"
              onChange={handlePdfSelect}
              disabled={isProcessing}
            />
            
            {pdfFiles.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-4">
                  <Badge variant="secondary" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {pdfFiles.length} ficheiros
                  </Badge>
                  {completedCount > 0 && (
                    <Badge variant="default" className="gap-1 bg-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {completedCount} extraídos
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {errorCount} erros
                    </Badge>
                  )}
                </div>
                
                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      A processar... {Math.round(progress)}%
                    </p>
                  </div>
                )}
                
                <Button variant="outline" size="sm" className="mt-2">
                  <Upload className="h-4 w-4 mr-2" />
                  Adicionar mais
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Arraste PDFs ou imagens aqui
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Suporta múltiplos ficheiros
                </p>
              </>
            )}
          </div>
        </CardContent>
      </ZenCard>
    </div>
  );
}

// File list component for showing uploaded files
interface FileListProps {
  files: UploadedFile[];
  onRemove?: (index: number) => void;
  className?: string;
}

export function FileList({ files, onRemove, className }: FileListProps) {
  if (files.length === 0) return null;
  
  return (
    <div className={cn('space-y-2 max-h-64 overflow-y-auto', className)}>
      {files.map((item, index) => (
        <div 
          key={index}
          className={cn(
            'flex items-center justify-between p-2 rounded-lg text-sm',
            item.status === 'done' && 'bg-green-50 dark:bg-green-900/20',
            item.status === 'error' && 'bg-red-50 dark:bg-red-900/20',
            item.status === 'processing' && 'bg-primary/5',
            item.status === 'pending' && 'bg-muted/50'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {item.status === 'processing' ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            ) : item.status === 'done' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : item.status === 'error' ? (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="truncate">{item.file.name}</span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {item.error && (
              <span className="text-xs text-red-600 max-w-32 truncate" title={item.error}>
                {item.error}
              </span>
            )}
            {onRemove && item.status !== 'processing' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
