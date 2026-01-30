/**
 * AT Recibos Importer Component
 * Imports Excel files from Portal das Finanças (ListaRecibos.xls format)
 * For Modelo 10 tax withholding declarations
 *
 * Features:
 * - Multiple file upload (drag & drop or select)
 * - Supports Recibos Verdes (Cat. B, 25%) and Rendas (Cat. F, 28%)
 * - Aggregates by NIF across all files
 * - Excel export with yellow highlighted columns
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
  Users,
  Download,
  FileDown,
  Files,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  parseATExcel,
  ATParseResult,
  ATNIFSummary,
  ATCategoria,
  ATReciboRecord,
  convertToModelo10Format,
  formatCurrency,
  getCategoriaDisplayName,
  TAXAS_RETENCAO,
} from '@/lib/atRecibosParser';
import { validateATParseResult, quickValidate, formatValidationReport } from '@/lib/atColumnValidator';
import { EmitterDataForm } from './EmitterDataForm';
import { hasEmitterData, loadEmitterData } from '@/lib/emitterStorage';
import { generateModelo10Excel } from '@/lib/modelo10ExcelGenerator';

interface ATRecibosImporterProps {
  selectedClientId?: string | null;
  selectedYear: number;
  clientName?: string | null;
  onImportComplete?: (count: number) => void;
  isAccountantOwnAccount?: boolean;
}

type ImportStep = 'instructions' | 'upload' | 'processing' | 'preview' | 'importing' | 'complete';

interface NIFSelection extends ATNIFSummary {
  selected: boolean;
}

interface FileProcessingStatus {
  name: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  recordCount?: number;
  error?: string;
}

interface AggregatedResult {
  allRecords: ATReciboRecord[];
  byNIF: Map<string, ATNIFSummary>;
  totalBruto: number;
  totalRetencao: number;
  totalRecords: number;
  warnings: string[];
  errors: string[];
  validationSummary?: {
    valid: boolean;
    validRecords: number;
    invalidRecords: number;
    criticalErrorCount: number;
    warningCount: number;
    yellowColumnsPresent: string[];
    yellowColumnsMissing: string[];
  };
}

export function ATRecibosImporter({
  selectedClientId,
  selectedYear,
  clientName,
  onImportComplete,
  isAccountantOwnAccount,
}: ATRecibosImporterProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<ImportStep>('instructions');
  const [aggregatedResult, setAggregatedResult] = useState<AggregatedResult | null>(null);
  const [nifSelections, setNifSelections] = useState<NIFSelection[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [categoria, setCategoria] = useState<ATCategoria>('B_INDEPENDENTES');
  const [taxaRetencao, setTaxaRetencao] = useState(25);
  const [fileStatuses, setFileStatuses] = useState<FileProcessingStatus[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const effectiveClientId = selectedClientId || user?.id;

  // Update retention rate when category changes
  const handleCategoriaChange = (value: ATCategoria) => {
    setCategoria(value);
    setTaxaRetencao(TAXAS_RETENCAO[value] * 100);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  /**
   * Process multiple files and aggregate results
   */
  const processMultipleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    // Filter valid files
    const validFiles = fileArray.filter(file => {
      const name = file.name.toLowerCase();
      return name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv');
    });

    if (validFiles.length === 0) {
      toast.error('Nenhum ficheiro Excel ou CSV válido selecionado');
      return;
    }

    // Initialize file statuses
    const initialStatuses: FileProcessingStatus[] = validFiles.map(f => ({
      name: f.name,
      status: 'pending',
    }));
    setFileStatuses(initialStatuses);
    setStep('processing');
    setCurrentFileIndex(0);

    // Aggregate all records
    const allRecords: ATReciboRecord[] = [];
    const allWarnings: string[] = [];
    const allErrors: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setCurrentFileIndex(i);

      // Update status to processing
      setFileStatuses(prev => prev.map((s, idx) =>
        idx === i ? { ...s, status: 'processing' } : s
      ));

      try {
        const result = await parseATExcel(file, {
          categoria,
          taxaRetencao: taxaRetencao / 100,
          ano: selectedYear,
        });

        if (result.success) {
          allRecords.push(...result.records);
          allWarnings.push(...result.warnings.map(w => `[${file.name}] ${w}`));

          setFileStatuses(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: 'success', recordCount: result.records.length } : s
          ));
        } else {
          allErrors.push(...result.errors.map(e => `[${file.name}] ${e}`));
          setFileStatuses(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: 'error', error: result.errors[0] } : s
          ));
        }
      } catch (error: any) {
        allErrors.push(`[${file.name}] ${error.message}`);
        setFileStatuses(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'error', error: error.message } : s
        ));
      }
    }

    // Aggregate by NIF
    const byNIF = new Map<string, ATNIFSummary>();
    let totalBruto = 0;
    let totalRetencao = 0;

    for (const record of allRecords) {
      const key = record.nif || 'SEM_NIF';

      if (!byNIF.has(key)) {
        byNIF.set(key, {
          nif: record.nif,
          nome: record.nomeEmitente,
          categoria: record.categoria,
          totalBruto: 0,
          totalRetencao: 0,
          totalLiquido: 0,
          numRecibos: 0,
          records: [],
        });
      }

      const summary = byNIF.get(key)!;
      summary.totalBruto += record.valorBruto;
      summary.totalRetencao += record.retencao;
      summary.totalLiquido += record.valorLiquido;
      summary.numRecibos += 1;
      summary.records.push(record);

      totalBruto += record.valorBruto;
      totalRetencao += record.retencao;
    }

    // Create parse result for validation
    const parseResultForValidation: ATParseResult = {
      success: allRecords.length > 0,
      records: allRecords,
      errors: allErrors,
      warnings: allWarnings,
      summary: {
        totalRecords: allRecords.length,
        totalBruto,
        totalRetencao,
        totalLiquido: totalBruto - totalRetencao,
        byNIF,
        byCategoria: new Map([[categoria, totalBruto]]),
      },
      fileType: categoria === 'F_PREDIAIS' ? 'rendas' : 'recibos_verdes',
    };

    // Run validation
    const validationResult = validateATParseResult(parseResultForValidation);

    const aggregated: AggregatedResult = {
      allRecords,
      byNIF,
      totalBruto,
      totalRetencao,
      totalRecords: allRecords.length,
      warnings: allWarnings,
      errors: allErrors,
      validationSummary: {
        valid: validationResult.valid,
        validRecords: validationResult.validRecords,
        invalidRecords: validationResult.invalidRecords,
        criticalErrorCount: validationResult.summary.criticalErrorCount,
        warningCount: validationResult.summary.warningCount,
        yellowColumnsPresent: validationResult.summary.yellowColumnsPresent,
        yellowColumnsMissing: validationResult.summary.yellowColumnsMissing,
      },
    };

    setAggregatedResult(aggregated);

    // Convert to selections (excluding SEM_NIF)
    const selections: NIFSelection[] = [];
    for (const [key, nifData] of byNIF) {
      if (key !== 'SEM_NIF' && nifData.nif) {
        selections.push({
          ...nifData,
          selected: true,
        });
      }
    }
    setNifSelections(selections);

    if (selections.length > 0) {
      setStep('preview');
      toast.success(`${validFiles.length} ficheiro(s) processado(s): ${selections.length} contribuintes encontrados`);
    } else if (allErrors.length > 0) {
      toast.error('Erros ao processar ficheiros');
      setStep('upload');
    } else {
      toast.error('Nenhum registo válido encontrado');
      setStep('upload');
    }
  }, [categoria, taxaRetencao, selectedYear]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processMultipleFiles(files);
    }
  }, [processMultipleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processMultipleFiles(files);
    }
  }, [processMultipleFiles]);

  const toggleNIFSelection = (nif: string) => {
    setNifSelections(prev =>
      prev.map(item =>
        item.nif === nif ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleSelectAll = () => {
    const allSelected = nifSelections.every(item => item.selected);
    setNifSelections(prev =>
      prev.map(item => ({ ...item, selected: !allSelected }))
    );
  };

  /**
   * Export to comprehensive Excel with all tabs including Declaração
   */
  const exportToExcel = () => {
    if (!aggregatedResult || nifSelections.length === 0) {
      toast.error('Sem dados para exportar');
      return;
    }

    const selectedNIFs = nifSelections.filter(item => item.selected);
    const selectedRecords = aggregatedResult.allRecords.filter(r =>
      selectedNIFs.some(s => s.nif === r.nif)
    );

    // Separate by category
    const isRenda = categoria === 'F_PREDIAIS';
    const emitterData = loadEmitterData();

    // Generate comprehensive Excel with all tabs
    const result = generateModelo10Excel({
      recibosVerdes: isRenda ? [] : selectedRecords,
      recibosRenda: isRenda ? selectedRecords : [],
      summaryVerdes: isRenda ? [] : selectedNIFs,
      summaryRenda: isRenda ? selectedNIFs : [],
      selectedYear,
      emitterData,
      clientName: clientName || undefined,
    });

    if (result.success) {
      toast.success(`Excel completo exportado: ${result.filename}`);
    } else {
      toast.error(`Erro ao exportar: ${result.error}`);
    }
  };

  const handleImport = async () => {
    if (!effectiveClientId || !aggregatedResult) {
      toast.error('Cliente não definido');
      return;
    }

    const selectedNIFs = nifSelections.filter(item => item.selected);
    if (selectedNIFs.length === 0) {
      toast.error('Selecione pelo menos um contribuinte para importar');
      return;
    }

    setIsImporting(true);
    setStep('importing');
    setImportProgress(0);

    let imported = 0;
    let duplicates = 0;

    try {
      // Convert to Modelo 10 format using the aggregated summary
      const summaryForConversion = {
        totalRecords: aggregatedResult.totalRecords,
        totalBruto: aggregatedResult.totalBruto,
        totalRetencao: aggregatedResult.totalRetencao,
        totalLiquido: aggregatedResult.totalBruto - aggregatedResult.totalRetencao,
        byNIF: aggregatedResult.byNIF,
        byCategoria: new Map([[categoria, aggregatedResult.totalBruto]]),
      };

      const modelo10Data = convertToModelo10Format(summaryForConversion, selectedYear);

      // Filter only selected NIFs
      const selectedData = modelo10Data.filter(item =>
        selectedNIFs.some(sel => sel.nif === item.beneficiary_nif)
      );

      for (let i = 0; i < selectedData.length; i++) {
        const item = selectedData[i];

        // Check for duplicates (same NIF + year + category)
        const { data: existing } = await supabase
          .from('tax_withholdings')
          .select('id')
          .eq('client_id', effectiveClientId)
          .eq('beneficiary_nif', item.beneficiary_nif)
          .eq('fiscal_year', selectedYear)
          .eq('income_category', item.income_category)
          .maybeSingle();

        if (existing) {
          duplicates++;
          setImportProgress(Math.round(((i + 1) / selectedData.length) * 100));
          continue;
        }

        // Insert into tax_withholdings
        const { error } = await supabase.from('tax_withholdings').insert({
          client_id: effectiveClientId,
          beneficiary_nif: item.beneficiary_nif,
          beneficiary_name: item.beneficiary_name,
          income_category: item.income_category,
          gross_amount: item.gross_amount,
          withholding_amount: item.withholding_amount,
          withholding_rate: item.withholding_rate,
          fiscal_region: item.fiscal_region,
          payment_date: item.payment_date,
          fiscal_year: selectedYear,
          is_non_resident: false,
          status: 'pending',
        });

        if (error) {
          console.error('Insert error:', error);
        } else {
          imported++;
        }

        setImportProgress(Math.round(((i + 1) / selectedData.length) * 100));
      }

      setImportedCount(imported);
      setDuplicatesCount(duplicates);
      setStep('complete');

      if (imported > 0) {
        toast.success(`${imported} registo(s) importado(s) com sucesso`);
        onImportComplete?.(imported);
      }
      if (duplicates > 0) {
        toast.info(`${duplicates} registo(s) duplicado(s) ignorado(s)`);
      }

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Erro na importação');
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setStep('instructions');
    setAggregatedResult(null);
    setNifSelections([]);
    setFileStatuses([]);
    setImportProgress(0);
    setImportedCount(0);
    setDuplicatesCount(0);
    setCurrentFileIndex(0);
  };

  const selectedCount = nifSelections.filter(item => item.selected).length;
  const totalBruto = nifSelections
    .filter(item => item.selected)
    .reduce((sum, item) => sum + item.totalBruto, 0);
  const totalRetencao = nifSelections
    .filter(item => item.selected)
    .reduce((sum, item) => sum + item.totalRetencao, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Importar Recibos AT</h2>
        <p className="text-muted-foreground mt-1">
          Importe ficheiros Excel do Portal das Finanças (suporta múltiplos ficheiros)
        </p>
      </div>

      {/* Client Info for Accountants */}
      {selectedClientId && clientName && !isAccountantOwnAccount && (
        <Alert className="border-primary/20 bg-primary/5">
          <Users className="h-4 w-4 text-primary" />
          <AlertDescription>
            A importar para: <strong className="text-primary">{clientName}</strong> | Ano: <strong>{selectedYear}</strong>
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

      {/* Warning if no client selected */}
      {selectedClientId === null && !isAccountantOwnAccount && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Selecione um cliente</strong> antes de importar.
          </AlertDescription>
        </Alert>
      )}

      {/* Instructions Step */}
      {step === 'instructions' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar do Portal das Finanças
            </CardTitle>
            <CardDescription>
              Importe recibos verdes (23% - OE2026) ou recibos de renda (25%/28%) exportados da AT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium">Aceda ao Portal das Finanças</p>
                  <p className="text-sm text-muted-foreground">
                    Faça login e vá a Consultar → Recibos Verdes ou Rendas
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-2"
                    onClick={() => window.open('https://faturas.portaldasfinancas.gov.pt', '_blank')}
                  >
                    Abrir Portal
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Exporte para Excel</p>
                  <p className="text-sm text-muted-foreground">
                    Selecione o período {selectedYear} e exporte a lista de recibos
                  </p>
                </div>
              </div>

              <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Carregue os ficheiros aqui</p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Múltiplos ficheiros</strong> - arraste todos de uma vez. O sistema agrupa por NIF automaticamente.
                  </p>
                </div>
              </div>
            </div>

            {/* Category and Rate Selection */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>Categoria de Rendimento</Label>
                <Select value={categoria} onValueChange={(v) => handleCategoriaChange(v as ATCategoria)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B_INDEPENDENTES">B. Trabalho Independente (Recibos Verdes)</SelectItem>
                    <SelectItem value="F_PREDIAIS">F. Rendimentos Prediais (Rendas - 28%)</SelectItem>
                    <SelectItem value="E_CAPITAIS">E. Rendimentos de Capitais</SelectItem>
                    <SelectItem value="H_PENSOES">H. Pensões</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taxa de Retenção (%)</Label>
                <Input
                  type="number"
                  value={taxaRetencao}
                  onChange={(e) => setTaxaRetencao(Number(e.target.value))}
                  min={0}
                  max={100}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">
                  Padrão: {TAXAS_RETENCAO[categoria] * 100}% {categoria === 'F_PREDIAIS' ? '(rendas)' : ''}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Badge variant="secondary" className="gap-1">
                <Files className="h-3 w-3" />
                Múltiplos ficheiros
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                Excel (.xls, .xlsx)
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                CSV
              </Badge>
            </div>

            <Button
              className="w-full gap-2"
              onClick={() => setStep('upload')}
              disabled={isAccountantOwnAccount || selectedClientId === null}
            >
              <Upload className="h-4 w-4" />
              {isAccountantOwnAccount ? 'Seleccione um cliente' : 'Continuar para Upload'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Carregar Ficheiros AT
              <Badge variant="outline">{getCategoriaDisplayName(categoria)}</Badge>
              <Badge variant="secondary">{taxaRetencao}%</Badge>
            </CardTitle>
            <CardDescription>
              Arraste múltiplos ficheiros ou selecione uma pasta inteira
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
                ${dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-primary/50'
                }
              `}
              onClick={() => document.getElementById('at-file-upload')?.click()}
            >
              <Files className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Arraste os ficheiros aqui</p>
              <p className="text-sm text-muted-foreground mb-4">
                Suporta <strong>múltiplos ficheiros</strong> em simultâneo
              </p>
              <input
                type="file"
                accept=".xls,.xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="at-file-upload"
                multiple
              />
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Selecionar Ficheiros
              </Button>
            </div>

            <Button variant="ghost" onClick={() => setStep('instructions')}>
              Voltar às instruções
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Processing Step */}
      {step === 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle>A processar ficheiros...</CardTitle>
            <CardDescription>
              Ficheiro {currentFileIndex + 1} de {fileStatuses.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={((currentFileIndex + 1) / fileStatuses.length) * 100} />

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fileStatuses.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                  {file.status === 'pending' && (
                    <div className="h-4 w-4 rounded-full bg-muted-foreground/30" />
                  )}
                  {file.status === 'processing' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {file.status === 'success' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="flex-1 text-sm truncate">{file.name}</span>
                  {file.recordCount !== undefined && (
                    <Badge variant="secondary">{file.recordCount} registos</Badge>
                  )}
                  {file.error && (
                    <span className="text-xs text-red-500">{file.error}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && aggregatedResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Pré-visualização
                  <Badge variant="outline">
                    {categoria === 'F_PREDIAIS' ? 'Rendas (25%/28%)' : 'Recibos Verdes (23%)'}
                  </Badge>
                </span>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {fileStatuses.filter(f => f.status === 'success').length} ficheiro(s)
                  </Badge>
                  <Badge variant="secondary">{nifSelections.length} contribuintes</Badge>
                </div>
              </CardTitle>
              <CardDescription>
                Revise os registos agregados de todos os ficheiros e exporte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Validation Status */}
              {aggregatedResult.validationSummary && (
                <Alert className={aggregatedResult.validationSummary.valid
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-red-500/30 bg-red-500/5'
                }>
                  {aggregatedResult.validationSummary.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <strong>{aggregatedResult.validationSummary.valid ? 'Validação OK' : 'Erros de validação'}</strong>
                      <div className="flex gap-2 text-sm">
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {aggregatedResult.validationSummary.validRecords} válidos
                        </Badge>
                        {aggregatedResult.validationSummary.invalidRecords > 0 && (
                          <Badge variant="destructive">
                            {aggregatedResult.validationSummary.invalidRecords} inválidos
                          </Badge>
                        )}
                      </div>
                    </div>
                    {aggregatedResult.validationSummary.yellowColumnsPresent.length > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Colunas obrigatórias (amarelo):</span>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {aggregatedResult.validationSummary.yellowColumnsPresent.map((col, i) => (
                            <Badge key={i} variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700 text-xs">
                              ✓ {col}
                            </Badge>
                          ))}
                          {aggregatedResult.validationSummary.yellowColumnsMissing.map((col, i) => (
                            <Badge key={i} variant="destructive" className="text-xs">
                              ✗ {col}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Warnings */}
              {aggregatedResult.warnings.length > 0 && (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription>
                    <strong>{aggregatedResult.warnings.length} aviso(s):</strong>
                    <ul className="mt-1 text-sm list-disc list-inside max-h-20 overflow-y-auto">
                      {aggregatedResult.warnings.slice(0, 5).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                      {aggregatedResult.warnings.length > 5 && (
                        <li>... e mais {aggregatedResult.warnings.length - 5}</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Summary */}
              <div className="grid grid-cols-5 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Ficheiros</p>
                  <p className="text-2xl font-bold">{fileStatuses.filter(f => f.status === 'success').length}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Selecionados</p>
                  <p className="text-2xl font-bold">{selectedCount}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Bruto</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalBruto)}</p>
                </div>
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-muted-foreground">Total Retenção</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalRetencao)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Taxa</p>
                  <p className="text-2xl font-bold">{taxaRetencao}%</p>
                </div>
              </div>

              {/* NIF Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-yellow-50 dark:bg-yellow-900/20">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={nifSelections.every(item => item.selected)}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="bg-yellow-100 dark:bg-yellow-900/30 font-bold">NIF</TableHead>
                      <TableHead className="bg-yellow-100 dark:bg-yellow-900/30 font-bold">Nome</TableHead>
                      <TableHead className="text-center">Recibos</TableHead>
                      <TableHead className="text-right bg-yellow-100 dark:bg-yellow-900/30 font-bold">Bruto</TableHead>
                      <TableHead className="text-right bg-yellow-100 dark:bg-yellow-900/30 font-bold">Retenção</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nifSelections.map((item) => (
                      <TableRow
                        key={item.nif}
                        className={!item.selected ? 'opacity-50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => toggleNIFSelection(item.nif)}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-bold bg-yellow-50/50 dark:bg-yellow-900/10">
                          {item.nif}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate bg-yellow-50/50 dark:bg-yellow-900/10">
                          {item.nome}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{item.numRecibos}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium bg-yellow-50/50 dark:bg-yellow-900/10">
                          {formatCurrency(item.totalBruto)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-amber-600 bg-yellow-50/50 dark:bg-yellow-900/10">
                          {formatCurrency(item.totalRetencao)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.totalLiquido)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Emitter Data Form (compact) */}
              <EmitterDataForm compact />

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={resetImport} className="gap-2">
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  onClick={exportToExcel}
                  disabled={selectedCount === 0}
                  className="gap-2 border-green-500 text-green-600 hover:bg-green-50"
                >
                  <FileDown className="h-4 w-4" />
                  Exportar Excel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedCount === 0 || !effectiveClientId}
                  className="flex-1 gap-2"
                >
                  <Download className="h-4 w-4" />
                  Importar {selectedCount} para Modelo 10
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Importing Step */}
      {step === 'importing' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">A importar para Modelo 10...</p>
              <Progress value={importProgress} className="w-64" />
              <p className="text-sm text-muted-foreground">{importProgress}% concluído</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-green-500/20">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-lg font-medium">Importação Concluída</p>
              <div className="text-center space-y-1">
                <p className="text-muted-foreground">
                  <strong className="text-green-600">{importedCount}</strong> registo(s) importado(s) para Modelo 10
                </p>
                {duplicatesCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {duplicatesCount} registo(s) duplicado(s) ignorado(s)
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={resetImport} variant="outline">
                  Importar Mais
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
