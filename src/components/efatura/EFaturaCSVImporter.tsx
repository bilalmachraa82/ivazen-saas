/**
 * e-Fatura CSV Importer Component
 * Handles file upload, parsing, and preview of e-Fatura CSV exports
 */

import { useState, useCallback } from 'react';
import { ZenCard } from '@/components/zen';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Download,
  Loader2,
  FileDown,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { parseEFaturaFile, EFaturaRecord, EFaturaParseResult } from '@/lib/efaturaParser';
import { classifyExpense, ClassificationResult, saveClassificationRule } from '@/lib/classificationRules';
import { buildDPExportData, downloadDPExcel, getQuarterPeriod, getQuarterMonths, type InvoiceRecord } from '@/lib/dpExcelGenerator';
import { cn } from '@/lib/utils';

interface EFaturaCSVImporterProps {
  clientId?: string | null;
  year: number;
  quarter: number;
}

interface ImportedRecord extends EFaturaRecord {
  classification?: ClassificationResult;
  selected?: boolean;
}

export function EFaturaCSVImporter({ clientId, year, quarter }: EFaturaCSVImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseResult, setParseResult] = useState<EFaturaParseResult | null>(null);
  const [classifiedRecords, setClassifiedRecords] = useState<ImportedRecord[]>([]);
  const [progress, setProgress] = useState(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProgress(10);

    try {
      // Parse CSV
      const result = await parseEFaturaFile(file);
      setParseResult(result);
      setProgress(30);

      if (!result.success || result.records.length === 0) {
        toast.error('Erro ao processar ficheiro', {
          description: result.errors.join(', ') || 'Ficheiro vazio ou formato inválido'
        });
        setIsProcessing(false);
        return;
      }

      // Classify each record
      const classified: ImportedRecord[] = [];
      for (let i = 0; i < result.records.length; i++) {
        const record = result.records[i];
        const classification = await classifyExpense({
          supplierNif: record.nif,
          supplierName: record.nome,
          valorTotal: record.valorTotal,
          valorIva: record.valorIva,
          clientId: clientId || undefined,
          sector: record.sector,
        });

        classified.push({
          ...record,
          classification,
          selected: !classification.requiresReview,
        });

        setProgress(30 + Math.round((i / result.records.length) * 60));
      }

      setClassifiedRecords(classified);
      setProgress(100);

      const autoClassified = classified.filter(r => !r.classification?.requiresReview).length;
      toast.success(`${result.records.length} registos processados`, {
        description: `${autoClassified} classificados automaticamente`
      });

    } catch (error: any) {
      toast.error('Erro ao processar ficheiro', {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  }, [clientId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(f => 
      f.name.toLowerCase().endsWith('.csv') || 
      f.name.toLowerCase().endsWith('.xls') ||
      f.name.toLowerCase().endsWith('.xlsx')
    );

    if (csvFile) {
      processFile(csvFile);
    } else {
      toast.error('Ficheiro inválido', {
        description: 'Por favor carregue um ficheiro CSV ou Excel'
      });
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const toggleRecordSelection = (index: number) => {
    setClassifiedRecords(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  };

  const selectAll = () => {
    setClassifiedRecords(prev => prev.map(r => ({ ...r, selected: true })));
  };

  const selectNone = () => {
    setClassifiedRecords(prev => prev.map(r => ({ ...r, selected: false })));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-primary bg-primary/10';
    if (confidence >= 50) return 'text-warning bg-warning/10';
    return 'text-destructive bg-destructive/10';
  };

  const selectedCount = classifiedRecords.filter(r => r.selected).length;
  const totalVatDeductible = classifiedRecords
    .filter(r => r.selected && r.classification?.deductibility)
    .reduce((sum, r) => {
      const deductibility = (r.classification?.deductibility || 0) / 100;
      return sum + r.valorIva * deductibility;
    }, 0);

  // Import selected records into the invoices table
  const handleImport = async () => {
    const selectedRecords = classifiedRecords.filter(r => r.selected);
    if (selectedRecords.length === 0) {
      toast.error('Seleccione pelo menos um registo para importar');
      return;
    }

    const effectiveClientId = clientId;
    if (!effectiveClientId) {
      toast.error('Utilizador não identificado');
      return;
    }

    setIsImporting(true);
    let imported = 0;
    let skipped = 0;

    try {
      for (const record of selectedRecords) {
        // Calculate fiscal period
        const fiscalPeriod = `${record.data.getFullYear()}${String(record.data.getMonth() + 1).padStart(2, '0')}`;

        // Check for duplicates (same supplier_nif + document_number + date)
        if (record.numeroDocumento) {
          const { data: existing } = await supabase
            .from('invoices')
            .select('id')
            .eq('client_id', effectiveClientId)
            .eq('supplier_nif', record.nif)
            .eq('document_number', record.numeroDocumento)
            .limit(1);

          if (existing && existing.length > 0) {
            skipped++;
            continue;
          }
        }

        // Determine VAT base fields from rate
        const vatRate = record.baseTributavel > 0
          ? Math.round((record.valorIva / record.baseTributavel) * 100)
          : 0;

        const vatFields: Record<string, number | null> = {
          base_standard: null,
          vat_standard: null,
          base_intermediate: null,
          vat_intermediate: null,
          base_reduced: null,
          vat_reduced: null,
          base_exempt: null,
        };

        if (vatRate >= 20) {
          vatFields.base_standard = record.baseTributavel;
          vatFields.vat_standard = record.valorIva;
        } else if (vatRate >= 10) {
          vatFields.base_intermediate = record.baseTributavel;
          vatFields.vat_intermediate = record.valorIva;
        } else if (vatRate >= 4) {
          vatFields.base_reduced = record.baseTributavel;
          vatFields.vat_reduced = record.valorIva;
        } else {
          vatFields.base_exempt = record.baseTributavel;
        }

        const { error } = await supabase
          .from('invoices')
          .insert({
            client_id: effectiveClientId,
            supplier_nif: record.nif || 'CSV-IMPORT',
            supplier_name: record.nome || null,
            document_date: record.data.toISOString().split('T')[0],
            document_number: record.numeroDocumento || null,
            document_type: record.tipoDocumento || 'FT',
            atcud: record.atcud || null,
            total_amount: record.valorTotal,
            total_vat: record.valorIva,
            ...vatFields,
            fiscal_period: fiscalPeriod,
            fiscal_region: 'PT',
            image_path: `efatura-csv/${effectiveClientId}/${record.numeroDocumento || Date.now()}`,
            status: 'pending',
            efatura_source: 'csv_portal',
            // Pre-fill AI classification from rule-based classification
            ai_classification: record.classification?.classification || null,
            ai_dp_field: record.classification?.dpField || null,
            ai_deductibility: record.classification?.deductibility || null,
            ai_confidence: record.classification?.confidence || null,
            ai_reason: record.classification?.reason || null,
          });

        if (error) {
          console.error('Insert error:', error);
        } else {
          imported++;
        }
      }

      if (imported > 0) {
        toast.success(`${imported} facturas importadas com sucesso`, {
          description: skipped > 0 ? `${skipped} duplicados ignorados` : undefined,
        });
        handleReset();
      } else if (skipped > 0) {
        toast.warning(`Todas as ${skipped} facturas já existem na base de dados`);
      }
    } catch (error: any) {
      toast.error('Erro ao importar', { description: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  // Reset state
  const handleReset = () => {
    setParseResult(null);
    setClassifiedRecords([]);
    setProgress(0);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const selectedRecords = classifiedRecords.filter(r => r.selected);
    if (selectedRecords.length === 0) {
      toast.error('Seleccione pelo menos um registo para exportar');
      return;
    }

    // Convert to InvoiceRecord format
    const compras: InvoiceRecord[] = selectedRecords.map(r => ({
      supplier_nif: r.nif,
      supplier_name: r.nome,
      document_date: new Date().toISOString(),
      fiscal_period: `${year}${String((quarter - 1) * 3 + 1).padStart(2, '0')}`,
      base_standard: r.baseTributavel,
      base_intermediate: null,
      base_reduced: null,
      base_exempt: null,
      vat_standard: r.valorIva,
      vat_intermediate: null,
      vat_reduced: null,
      total_vat: r.valorIva,
      total_amount: r.valorTotal,
      final_dp_field: r.classification?.dpField || 24,
      final_deductibility: r.classification?.deductibility || 100,
    }));

    const periodo = getQuarterPeriod(year, quarter);
    const meses = getQuarterMonths(year, quarter);
    const data = buildDPExportData(
      'Cliente',
      periodo,
      meses,
      compras,
      []
    );

    downloadDPExcel(data);
    toast.success('Excel exportado com sucesso');
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {classifiedRecords.length === 0 && (
        <ZenCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Carregar Ficheiro CSV
            </CardTitle>
            <CardDescription>
              Exporte os dados do Portal das Finanças e carregue aqui
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
                isProcessing && 'pointer-events-none opacity-50'
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isProcessing ? (
                <div className="space-y-4">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                  <p className="text-muted-foreground">A processar ficheiro...</p>
                  <Progress value={progress} className="max-w-xs mx-auto" />
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Arraste um ficheiro CSV ou Excel aqui, ou
                  </p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button variant="outline" asChild>
                      <span>Seleccionar Ficheiro</span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </CardContent>
        </ZenCard>
      )}

      {/* Warnings */}
      {parseResult && parseResult.warnings.length > 0 && (
        <Alert variant="default" className="border-warning/50">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            {parseResult.warnings.length} avisos durante o processamento
          </AlertDescription>
        </Alert>
      )}

      {/* Results Table */}
      {classifiedRecords.length > 0 && (
        <ZenCard>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Resultados da Importação</CardTitle>
                <CardDescription>
                  {parseResult?.type === 'compras' ? 'Despesas' : 'Vendas'} do {quarter}º Trimestre {year}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={handleReset}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <span className="text-sm text-muted-foreground">Total:</span>
                <span className="ml-2 font-medium">{classifiedRecords.length} registos</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Seleccionados:</span>
                <span className="ml-2 font-medium">{selectedCount}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">IVA Dedutível:</span>
                <span className="ml-2 font-medium text-primary">{formatCurrency(totalVatDeductible)}</span>
              </div>
              <div className="flex-1" />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Seleccionar Todos
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Limpar Selecção
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Campo DP</TableHead>
                    <TableHead className="text-center">Confiança</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classifiedRecords.slice(0, 50).map((record, index) => (
                    <TableRow key={index} className={record.classification?.requiresReview ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={record.selected}
                          onCheckedChange={() => toggleRecordSelection(index)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium truncate max-w-[200px]">{record.nome || '—'}</div>
                          <div className="text-xs text-muted-foreground">{record.nif}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.data.toLocaleDateString('pt-PT')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(record.valorTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(record.valorIva)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          record.classification?.classification === 'ACTIVIDADE' ? 'default' :
                          record.classification?.classification === 'PESSOAL' ? 'secondary' : 'outline'
                        }>
                          {record.classification?.classification || '—'}
                        </Badge>
                        {record.classification?.deductibility !== undefined && record.classification.deductibility < 100 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({record.classification.deductibility}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.classification?.dpField ? (
                          <Badge variant="outline">Campo {record.classification.dpField}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn('text-xs', getConfidenceColor(record.classification?.confidence || 0))}>
                          {record.classification?.confidence || 0}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {classifiedRecords.length > 50 && (
              <p className="text-sm text-muted-foreground text-center">
                Mostrando 50 de {classifiedRecords.length} registos
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleReset}>
                Cancelar
              </Button>
              <Button variant="outline" onClick={handleExportExcel} disabled={selectedCount === 0}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar Excel AT
              </Button>
              <Button disabled={selectedCount === 0 || isImporting} onClick={handleImport}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {isImporting ? 'A importar...' : `Importar ${selectedCount} Registos`}
              </Button>
            </div>
          </CardContent>
        </ZenCard>
      )}
    </div>
  );
}
