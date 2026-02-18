/**
 * Reconciliation Audit Page
 * Complete validation workflow: Upload → Extract → Reconcile → Report
 */

import { useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ZenCard } from '@/components/zen';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target,
  FileSpreadsheet,
  FileText,
  Play,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Cloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useClientManagement } from '@/hooks/useClientManagement';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { ReconciliationUploader, FileList } from '@/components/validation/ReconciliationUploader';
import { ReconciliationSummary } from '@/components/validation/ReconciliationSummary';
import { ReconciliationTable } from '@/components/validation/ReconciliationTable';
import {
  parseExcelReference,
  matchRecords,
  ReconciliationResult,
  ReconciliationType,
  ExcelRecord,
  ExtractedRecord,
  generateAuditReport,
  exportReportToText,
} from '@/lib/reconciliationEngine';
import { cn } from '@/lib/utils';

type Step = 'upload' | 'extract' | 'reconcile' | 'complete';

interface UploadedFile {
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  extractedData?: ExtractedRecord;
}

export default function ReconciliationAudit() {
  const { clients } = useClientManagement();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  
  const [step, setStep] = useState<Step>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Data state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelRecords, setExcelRecords] = useState<ExcelRecord[]>([]);
  const [excelWarnings, setExcelWarnings] = useState<string[]>([]);
  const [reconciliationType, setReconciliationType] = useState<ReconciliationType>('iva');
  
  const [pdfFiles, setPdfFiles] = useState<UploadedFile[]>([]);
  const [extractedRecords, setExtractedRecords] = useState<ExtractedRecord[]>([]);
  
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [isSyncingAT, setIsSyncingAT] = useState(false);
  const [syncEnvironment, setSyncEnvironment] = useState<'test' | 'production'>('test');
  
  // Handle Excel upload - with AI fallback for summary files
  const handleExcelUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      // First try deterministic parsing
      const result = await parseExcelReference(file);
      
      // If deterministic parsing returns 0 records, try AI
      if (result.records.length === 0) {
        toast.info('A analisar Excel com IA...', {
          description: 'O ficheiro parece ser um apuramento/resumo',
        });
        
        // Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        // Call AI parsing
        const { data: aiResult, error: aiError } = await supabase.functions.invoke('parse-excel-with-ai', {
          body: { fileBase64: base64, fileName: file.name },
        });
        
        if (aiError) throw aiError;
        
        if (aiResult?.success) {
          setExcelFile(file);
          
          if (aiResult.fileType === 'summary' && aiResult.summaryTotals) {
            // For summary files, create a synthetic record with totals
            const summaryRecord: ExcelRecord = {
              rowNumber: 1, // Synthetic row for summary
              nif: '999999999', // Placeholder for summary
              name: `Apuramento ${file.name}`,
              totalAmount: aiResult.summaryTotals.base_tributavel || 0,
              vatStandard: aiResult.summaryTotals.iva_liquidado || 0,
              baseStandard: aiResult.summaryTotals.base_tributavel || 0,
            };
            setExcelRecords([summaryRecord]);
            setExcelWarnings([
              `Tipo detectado via IA: Apuramento/Resumo`,
              `IVA Dedutível: ${aiResult.summaryTotals.iva_dedutivel?.toFixed(2) || '0.00'}€`,
              `IVA Liquidado: ${aiResult.summaryTotals.iva_liquidado?.toFixed(2) || '0.00'}€`,
              `Saldo IVA: ${aiResult.summaryTotals.saldo_iva?.toFixed(2) || '0.00'}€`,
              ...(aiResult.warnings || []),
            ]);
            setReconciliationType('iva');
            
            toast.success('Apuramento IVA detectado via IA', {
              description: `Saldo: ${aiResult.summaryTotals.saldo_iva?.toFixed(2) || '0.00'}€`,
            });
          } else if (aiResult.records && aiResult.records.length > 0) {
            // AI found records
            const mappedRecords: ExcelRecord[] = aiResult.records.map((r: any, idx: number) => ({
              rowNumber: idx + 1,
              nif: r.nif || '',
              name: r.name || '',
              documentDate: r.date ? new Date(r.date) : undefined,
              documentReference: r.document_number || '',
              totalAmount: r.total_amount,
              baseStandard: r.base_standard,
              vatStandard: r.vat_standard,
              baseIntermediate: r.base_intermediate,
              vatIntermediate: r.vat_intermediate,
              baseReduced: r.base_reduced,
              vatReduced: r.vat_reduced,
              baseExempt: r.base_exempt,
              grossAmount: r.gross_amount,
              withholdingAmount: r.withholding_amount,
              withholdingRate: r.withholding_rate,
            }));
            
            setExcelRecords(mappedRecords);
            setExcelWarnings(aiResult.warnings || []);
            setReconciliationType(aiResult.fileType === 'modelo10' ? 'modelo10' : 'iva');
            
            toast.success(`Excel processado via IA: ${mappedRecords.length} registos`);
          } else {
            throw new Error('IA não conseguiu extrair dados do ficheiro');
          }
        } else {
          throw new Error(aiResult?.error || 'Erro no processamento via IA');
        }
      } else {
        // Deterministic parsing worked
        setExcelFile(file);
        setExcelRecords(result.records);
        setExcelWarnings(result.warnings);
        setReconciliationType(result.type);
        
        toast.success(`Excel carregado: ${result.records.length} registos`, {
          description: result.warnings.length > 0 
            ? `${result.warnings.length} avisos` 
            : `Tipo detectado: ${result.type === 'iva' ? 'IVA' : result.type === 'modelo10' ? 'Modelo 10' : 'Ambos'}`
        });
      }
    } catch (error: any) {
      console.error('Excel upload error:', error);
      toast.error('Erro ao processar Excel', { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  }, []);
  
  // Handle PDF upload
  const handlePdfsUpload = useCallback(async (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      file,
      status: 'pending' as const,
    }));
    setPdfFiles(prev => [...prev, ...newFiles]);
  }, []);
  
  // Extract data from PDFs
  const handleExtraction = useCallback(async () => {
    if (pdfFiles.length === 0) {
      toast.error('Carregue ficheiros PDF primeiro');
      return;
    }
    
    setIsProcessing(true);
    setStep('extract');
    setProgress(0);
    
    const extracted: ExtractedRecord[] = [];
    const updatedFiles = [...pdfFiles];
    
    for (let i = 0; i < pdfFiles.length; i++) {
      const item = pdfFiles[i];
      updatedFiles[i] = { ...item, status: 'processing' };
      setPdfFiles([...updatedFiles]);
      
      try {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(item.file);
        });
        
        // Call extraction edge function
        const { data, error } = await supabase.functions.invoke('extract-invoice-data', {
          body: {
            fileData: base64,
            fileName: item.file.name,
            mimeType: item.file.type || 'application/pdf',
          },
        });
        
        if (error) throw error;
        
        if (data?.success && data?.data) {
          const d = data.data;
          const record: ExtractedRecord = {
            fileName: item.file.name,
            nif: d.supplier_nif || d.beneficiary_nif || '',
            name: d.supplier_name || d.beneficiary_name || '',
            documentDate: d.document_date ? new Date(d.document_date) : undefined,
            documentReference: d.document_number || '',
            totalAmount: d.total_amount,
            baseStandard: d.base_standard,
            vatStandard: d.vat_standard,
            baseIntermediate: d.base_intermediate,
            vatIntermediate: d.vat_intermediate,
            baseReduced: d.base_reduced,
            vatReduced: d.vat_reduced,
            baseExempt: d.base_exempt,
            grossAmount: d.total_amount,
            withholdingAmount: d.withholding_amount,
            withholdingRate: d.withholding_rate,
            confidence: d.confidence,
          };
          
          extracted.push(record);
          updatedFiles[i] = { ...item, status: 'done', extractedData: record };
        } else {
          const errorMsg = data?.error || 'Sem dados extraídos';
          updatedFiles[i] = { ...item, status: 'error', error: errorMsg };
        }
      } catch (error: any) {
        updatedFiles[i] = { ...item, status: 'error', error: error.message };
      }
      
      setPdfFiles([...updatedFiles]);
      setProgress(((i + 1) / pdfFiles.length) * 100);
    }
    
    setExtractedRecords(extracted);
    setIsProcessing(false);
    
    toast.success(`Extracção concluída: ${extracted.length} de ${pdfFiles.length}`, {
      description: `${pdfFiles.filter(f => f.status === 'error').length} erros`
    });
    
    // Auto-advance to reconciliation if we have data
    if (extracted.length > 0 && excelRecords.length > 0) {
      setStep('reconcile');
    }
  }, [pdfFiles, excelRecords.length]);
  
  // Run reconciliation
  const handleReconciliation = useCallback(() => {
    if (excelRecords.length === 0) {
      toast.error('Carregue o Excel de referência primeiro');
      return;
    }
    
    if (extractedRecords.length === 0) {
      toast.error('Execute a extracção primeiro');
      return;
    }
    
    const result = matchRecords({
      excelRecords,
      extractedRecords,
      type: reconciliationType,
      toleranceEur: 0.01,
    });
    
    setReconciliationResult(result);
    setStep('complete');
    
    if (result.isZeroDelta) {
      toast.success('🎉 Zero Delta alcançado!', {
        description: 'Todos os valores conferem com o Excel'
      });
    } else {
      toast.warning('Discrepâncias detectadas', {
        description: `${result.summary.outsideTolerance} registos com diferenças`
      });
    }
  }, [excelRecords, extractedRecords, reconciliationType]);
  
  // Export report
  const handleExportReport = useCallback(() => {
    if (!reconciliationResult) return;
    
    const client = clients.find(c => c.id === selectedClientId);
    const report = generateAuditReport(reconciliationResult, {
      clientName: client?.full_name || 'Cliente',
    });
    
    const text = exportReportToText(report);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Relatório exportado');
  }, [reconciliationResult, clients, selectedClientId]);
  
  // Reset workflow
  const handleReset = useCallback(() => {
    setStep('upload');
    setExcelFile(null);
    setExcelRecords([]);
    setExcelWarnings([]);
    setPdfFiles([]);
    setExtractedRecords([]);
    setReconciliationResult(null);
    setProgress(0);
  }, []);
  
  // Sync AT
  const handleSyncAT = useCallback(async () => {
    if (!selectedClientId) {
      toast.error('Seleccione um cliente primeiro');
      return;
    }
    
    setIsSyncingAT(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-efatura', {
        body: {
          clientId: selectedClientId,
          environment: syncEnvironment,
          type: 'compras',
        },
      });
      
      if (error) throw error;
      
      toast.success('Sincronização AT concluída', {
        description: `${data?.invoicesProcessed || 0} facturas obtidas`
      });
    } catch (error: any) {
      toast.error('Erro na sincronização AT', {
        description: error.message || 'Verifique se o certificado e credenciais AT estão configurados'
      });
    } finally {
      setIsSyncingAT(false);
    }
  }, [selectedClientId]);
  
  // Remove PDF file
  const handleRemovePdf = useCallback((index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // Step indicator
  const steps = [
    { id: 'upload', label: 'Upload', icon: FileSpreadsheet },
    { id: 'extract', label: 'Extracção', icon: FileText },
    { id: 'reconcile', label: 'Reconciliação', icon: Target },
    { id: 'complete', label: 'Resultado', icon: CheckCircle2 },
  ];
  
  const currentStepIndex = steps.findIndex(s => s.id === step);
  
  return (
    <DashboardLayout>
      <div className="container max-w-6xl mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Auditoria de Reconciliação
            </h1>
            <p className="text-muted-foreground">
              Validação Zero-Delta: Excel vs Extracção IA
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {clients.length > 0 && (
              <ClientSearchSelector
                clients={clients}
                selectedClientId={selectedClientId}
                onSelect={setSelectedClientId}
                placeholder="Seleccionar cliente..."
                className="w-[280px]"
              />
            )}
            
            {selectedClientId && (
              <div className="flex items-center gap-2">
                <Tabs 
                  value={syncEnvironment} 
                  onValueChange={(v) => setSyncEnvironment(v as 'test' | 'production')}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="test" className="text-xs px-3">Teste</TabsTrigger>
                    <TabsTrigger value="production" className="text-xs px-3">Produção</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button 
                  variant="outline" 
                  onClick={handleSyncAT}
                  disabled={isSyncingAT}
                  size="sm"
                >
                  {isSyncingAT ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 mr-2" />
                  )}
                  Sincronizar AT
                </Button>
              </div>
            )}
            
            {step !== 'upload' && (
              <Button variant="outline" onClick={handleReset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reiniciar
              </Button>
            )}
          </div>
        </div>
        
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isComplete = i < currentStepIndex;
            
            return (
              <div key={s.id} className="flex items-center">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-full transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isComplete && 'bg-primary/20 text-primary',
                  !isActive && !isComplete && 'bg-muted text-muted-foreground'
                )}>
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className={cn(
                    'h-4 w-4 mx-1',
                    i < currentStepIndex ? 'text-primary' : 'text-muted-foreground/50'
                  )} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Excel Warnings */}
        {excelWarnings.length > 0 && (
          <Alert variant="default" className="border-amber-500/50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Avisos do Excel</AlertTitle>
            <AlertDescription>
              <ul className="text-sm list-disc list-inside max-h-24 overflow-y-auto">
                {excelWarnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {excelWarnings.length > 5 && (
                  <li>... e mais {excelWarnings.length - 5} avisos</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Debug Alert when Excel has 0 records */}
        {excelFile && excelRecords.length === 0 && !isProcessing && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Excel não reconhecido</AlertTitle>
            <AlertDescription>
              <p>Nenhum registo foi extraído do ficheiro "{excelFile.name}".</p>
              <p className="mt-1 text-sm">Verifique se o Excel contém uma coluna de NIF e dados válidos.</p>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer hover:underline">Debug técnico</summary>
                <div className="mt-1 p-2 bg-muted/50 rounded text-muted-foreground">
                  {excelWarnings.length > 0 
                    ? excelWarnings.join('; ') 
                    : 'Sem avisos - possível problema no formato do ficheiro'}
                </div>
              </details>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Step Content */}
        {(step === 'upload' || step === 'extract') && (
          <div className="space-y-6">
            {/* Uploader */}
            <ReconciliationUploader
              onExcelUpload={handleExcelUpload}
              onPdfsUpload={handlePdfsUpload}
              excelFile={excelFile}
              pdfFiles={pdfFiles}
              isProcessing={isProcessing}
              progress={progress}
            />
            
            {/* File List */}
            {pdfFiles.length > 0 && (
              <ZenCard>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Ficheiros Carregados</CardTitle>
                </CardHeader>
                <CardContent>
                  <FileList 
                    files={pdfFiles} 
                    onRemove={step === 'upload' ? handleRemovePdf : undefined} 
                  />
                </CardContent>
              </ZenCard>
            )}
            
            {/* Summary & Actions */}
            <ZenCard>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{excelRecords.length}</p>
                      <p className="text-xs text-muted-foreground">Registos Excel</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{pdfFiles.length}</p>
                      <p className="text-xs text-muted-foreground">PDFs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{extractedRecords.length}</p>
                      <p className="text-xs text-muted-foreground">Extraídos</p>
                    </div>
                    {reconciliationType && (
                      <Badge variant="outline" className="text-sm">
                        {reconciliationType === 'iva' ? 'IVA' : 
                         reconciliationType === 'modelo10' ? 'Modelo 10' : 'IVA + Modelo 10'}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {step === 'upload' && pdfFiles.length > 0 && (
                      <Button onClick={handleExtraction} disabled={isProcessing}>
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Extrair Dados
                      </Button>
                    )}
                    
                    {step === 'extract' && extractedRecords.length > 0 && !isProcessing && (
                      <Button onClick={handleReconciliation}>
                        <Target className="h-4 w-4 mr-2" />
                        Reconciliar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </ZenCard>
          </div>
        )}
        
        {/* Reconciliation Step */}
        {step === 'reconcile' && !reconciliationResult && (
          <ZenCard gradient="primary" withLine className="text-center py-12">
            <CardContent>
              <Target className="h-16 w-16 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-bold mb-2">Pronto para Reconciliar</h2>
              <p className="text-muted-foreground mb-6">
                {excelRecords.length} registos Excel vs {extractedRecords.length} extraídos
              </p>
              <Button size="lg" onClick={handleReconciliation}>
                <Target className="h-5 w-5 mr-2" />
                Iniciar Reconciliação
              </Button>
            </CardContent>
          </ZenCard>
        )}
        
        {/* Results */}
        {reconciliationResult && (
          <div className="space-y-6">
            <ReconciliationSummary 
              result={reconciliationResult} 
              type={reconciliationType} 
            />
            
            <ReconciliationTable 
              result={reconciliationResult} 
              type={reconciliationType}
              clientName={clients.find(c => c.id === selectedClientId)?.full_name}
            />
            
            {/* Export Actions */}
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleExportReport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Relatório
              </Button>
              <Button onClick={handleReset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Nova Auditoria
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
