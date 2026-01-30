import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
  FileCode,
} from 'lucide-react';
import { parseInvoiceFile, ParsedInvoice, aggregateByQuarter, formatCurrency, ParseResult, detectCategoryFromCAE, CategoryDetectionResult } from '@/lib/csvParser';
import { toast } from 'sonner';
import { REVENUE_CATEGORIES } from '@/hooks/useSocialSecurity';
import { useCategoryPreferences } from '@/hooks/useCategoryPreferences';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Sparkles } from 'lucide-react';

interface RevenueImporterProps {
  onImport: (data: { quarter: string; amount: number; category: string }[]) => Promise<void>;
  onCreateSalesInvoices?: (invoices: ParsedInvoice[]) => Promise<{ inserted: number; duplicates: number } | number | void>;
  currentQuarter: string;
  userCAE?: string | null;
  activityDescription?: string | null;
}

type ImportStep = 'instructions' | 'upload' | 'preview' | 'importing' | 'complete';
type ImportMode = 'aggregate' | 'individual';

// Extended invoice with editable category
interface InvoiceWithCategory extends ParsedInvoice {
  selectedCategory: string;
  selected: boolean; // For individual invoice selection
}

export function RevenueImporter({ onImport, onCreateSalesInvoices, currentQuarter, userCAE, activityDescription }: RevenueImporterProps) {
  const [step, setStep] = useState<ImportStep>('instructions');
  const [invoicesWithCategories, setInvoicesWithCategories] = useState<InvoiceWithCategory[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [detectedCategory, setDetectedCategory] = useState<CategoryDetectionResult | null>(null);
  const [defaultCategory, setDefaultCategory] = useState('prestacao_servicos');
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileType, setFileType] = useState<'csv' | 'saft' | null>(null);
  const [showPerLineCategories, setShowPerLineCategories] = useState(false);
  const [usedSavedPreference, setUsedSavedPreference] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('aggregate');
  const [createdInvoicesCount, setCreatedInvoicesCount] = useState(0);

  // Category preferences hook
  const { getSuggestedCategory, savePreferencesBulk, preferences } = useCategoryPreferences();

  // Detect category based on user's CAE and saved preferences
  useState(() => {
    // First check saved preferences
    const savedCategory = getSuggestedCategory(userCAE);
    if (savedCategory) {
      setDefaultCategory(savedCategory);
      setUsedSavedPreference(true);
      setDetectedCategory({
        category: savedCategory,
        confidence: 'high',
        reason: 'Baseado nas suas importações anteriores',
      });
    } else {
      // Fallback to CAE detection
      const detection = detectCategoryFromCAE(userCAE, activityDescription);
      setDetectedCategory(detection);
      setDefaultCategory(detection.category);
    }
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback((file: File) => {
    const fileName = file.name.toLowerCase();
    const isXml = fileName.endsWith('.xml');
    const isCsv = fileName.endsWith('.csv');
    
    if (!isCsv && !isXml) {
      toast.error('Por favor, carregue um ficheiro CSV ou XML (SAFT-PT)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = parseInvoiceFile(content, file.name);
      
      // Check for saved preference first, then CAE detection
      const savedCategory = getSuggestedCategory(userCAE);
      let categoryToUse: string;
      
      if (savedCategory) {
        categoryToUse = savedCategory;
        setUsedSavedPreference(true);
        setDetectedCategory({
          category: savedCategory,
          confidence: 'high',
          reason: 'Baseado nas suas importações anteriores',
        });
      } else {
        const detection = detectCategoryFromCAE(userCAE, activityDescription);
        categoryToUse = detection.category;
        setDetectedCategory(detection);
      }
      
      // Add category and selection to each invoice
      const invoicesWithCats: InvoiceWithCategory[] = result.invoices.map(invoice => ({
        ...invoice,
        selectedCategory: categoryToUse,
        selected: true, // Default all selected
      }));
      
      setInvoicesWithCategories(invoicesWithCats);
      setDefaultCategory(categoryToUse);
      setErrors(result.errors);
      setWarnings(result.warnings);
      setFileType(result.fileType || (isXml ? 'saft' : 'csv'));
      
      if (result.invoices.length > 0) {
        setStep('preview');
        const typeLabel = result.fileType === 'saft' ? 'SAFT-PT' : 'CSV';
        toast.success(`${result.invoices.length} facturas encontradas (${typeLabel})`);
      } else if (result.errors.length > 0) {
        toast.error(result.errors[0]);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, [userCAE, activityDescription, getSuggestedCategory]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleImport = async () => {
    setIsImporting(true);
    setStep('importing');

    try {
      const selectedInvoices = invoicesWithCategories.filter(inv => inv.selected);
      
      if (importMode === 'individual' && onCreateSalesInvoices) {
        // Create individual sales invoices in the system
        await onCreateSalesInvoices(selectedInvoices);
        setCreatedInvoicesCount(selectedInvoices.length);
      } else {
        // Aggregate by quarter AND category (original behavior)
        const aggregated = new Map<string, number>();
        
        selectedInvoices.forEach(invoice => {
          const key = `${invoice.quarter}|${invoice.selectedCategory}`;
          const current = aggregated.get(key) || 0;
          aggregated.set(key, current + invoice.baseValue);
        });

        const importData: { quarter: string; amount: number; category: string }[] = [];
        aggregated.forEach((amount, key) => {
          const [quarter, category] = key.split('|');
          importData.push({ quarter, amount, category });
        });

        await onImport(importData);
      }
      
      // Save category preferences for future imports
      const categoriesUsed = selectedInvoices.map(inv => inv.selectedCategory);
      await savePreferencesBulk(categoriesUsed, userCAE);
      
      setStep('complete');
      toast.success('Importação concluída com sucesso');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro na importação');
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setStep('instructions');
    setInvoicesWithCategories([]);
    setErrors([]);
    setWarnings([]);
    setFileType(null);
    setShowPerLineCategories(false);
    setImportMode('aggregate');
    setCreatedInvoicesCount(0);
  };

  // Update all invoices to a specific category
  const applyDefaultCategory = (category: string) => {
    setDefaultCategory(category);
    setInvoicesWithCategories(prev => 
      prev.map(inv => ({ ...inv, selectedCategory: category }))
    );
  };

  // Update single invoice category
  const updateInvoiceCategory = (index: number, category: string) => {
    setInvoicesWithCategories(prev => 
      prev.map((inv, i) => i === index ? { ...inv, selectedCategory: category } : inv)
    );
  };

  // Toggle invoice selection
  const toggleInvoiceSelection = (index: number) => {
    setInvoicesWithCategories(prev => 
      prev.map((inv, i) => i === index ? { ...inv, selected: !inv.selected } : inv)
    );
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    const allSelected = invoicesWithCategories.every(inv => inv.selected);
    setInvoicesWithCategories(prev => 
      prev.map(inv => ({ ...inv, selected: !allSelected }))
    );
  };

  // Aggregate by quarter (for summary)
  const quarterTotals = new Map<string, number>();
  invoicesWithCategories.forEach(inv => {
    const current = quarterTotals.get(inv.quarter) || 0;
    quarterTotals.set(inv.quarter, current + inv.baseValue);
  });

  // Aggregate by category (for summary)
  const categoryTotals = new Map<string, number>();
  invoicesWithCategories.forEach(inv => {
    const current = categoryTotals.get(inv.selectedCategory) || 0;
    categoryTotals.set(inv.selectedCategory, current + inv.baseValue);
  });
  const grandTotal = Array.from(quarterTotals.values()).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-6">
      {/* Instructions Step */}
      {step === 'instructions' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Importar Faturas do Portal das Finanças
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para exportar e importar as suas faturas emitidas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step by step guide */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Aceder ao Portal das Finanças</p>
                    <p className="text-sm text-muted-foreground">
                      Faça login com as suas credenciais ou Chave Móvel Digital
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
                    <p className="font-medium">Consultar Faturas Emitidas</p>
                    <p className="text-sm text-muted-foreground">
                      Menu: Consultar → Faturas/Recibos Emitidos
                    </p>
                  </div>
                </div>

                <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Seleccionar o Período</p>
                    <p className="text-sm text-muted-foreground">
                      Filtre pelas datas do trimestre que pretende declarar
                    </p>
                  </div>
                </div>

                <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Exportar para CSV ou SAFT-PT</p>
                    <p className="text-sm text-muted-foreground">
                      Clique no botão de exportar e guarde o ficheiro CSV ou XML (SAFT-PT)
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="gap-1">
                        <FileSpreadsheet className="h-3 w-3" />
                        CSV
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <FileCode className="h-3 w-3" />
                        SAFT-PT (XML)
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    5
                  </div>
                  <div>
                    <p className="font-medium">Carregar Ficheiro Aqui</p>
                    <p className="text-sm text-muted-foreground">
                      Arraste ou seleccione o ficheiro CSV ou XML exportado
                    </p>
                  </div>
                </div>
              </div>

              <Button className="w-full gap-2" onClick={() => setStep('upload')}>
                <Upload className="h-4 w-4" />
                Continuar para Importação
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Carregar Ficheiro
              <Badge variant="outline" className="gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                CSV
              </Badge>
              <Badge variant="outline" className="gap-1">
                <FileCode className="h-3 w-3" />
                SAFT-PT
              </Badge>
            </CardTitle>
            <CardDescription>
              Arraste o ficheiro CSV ou SAFT-PT (XML) exportado do Portal das Finanças
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-colors
                ${dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/30 hover:border-primary/50'
                }
              `}
            >
              <div className="flex justify-center gap-4 mb-4">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                <FileCode className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-2">Arraste o ficheiro aqui</p>
              <p className="text-sm text-muted-foreground mb-4">CSV ou SAFT-PT (XML)</p>
              <input
                type="file"
                accept=".csv,.xml"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" className="gap-2" asChild>
                  <span>
                    <Upload className="h-4 w-4" />
                    Seleccionar Ficheiro
                  </span>
                </Button>
              </label>
            </div>

            {/* Alternative: Manual PDF upload hint */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <Info className="h-4 w-4 flex-shrink-0" />
              <p>
                <strong>Não tem o ficheiro SAFT?</strong> Pode carregar facturas de venda manualmente na página{' '}
                <a href="/upload?type=sales" className="text-primary underline hover:no-underline">
                  Carregar Facturas → Vendas
                </a>
                . As facturas validadas aparecerão automaticamente nos seus rendimentos.
              </p>
            </div>

            {errors.length > 0 && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Erros encontrados</span>
                </div>
                {errors.map((error, i) => (
                  <p key={i} className="text-sm text-muted-foreground">{error}</p>
                ))}
              </div>
            )}

            <Button variant="ghost" onClick={() => setStep('instructions')}>
              Voltar às instruções
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Pré-visualização
                  {fileType === 'saft' && (
                    <Badge variant="outline" className="gap-1">
                      <FileCode className="h-3 w-3" />
                      SAFT-PT
                    </Badge>
                  )}
                  {fileType === 'csv' && (
                    <Badge variant="outline" className="gap-1">
                      <FileSpreadsheet className="h-3 w-3" />
                      CSV
                    </Badge>
                  )}
                </span>
                <Badge variant="secondary">{invoicesWithCategories.length} facturas</Badge>
              </CardTitle>
              <CardDescription>
                Verifique os dados antes de importar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Avisos ({warnings.length})</span>
                  </div>
                  <div className="text-sm text-muted-foreground max-h-24 overflow-y-auto space-y-1">
                    {warnings.slice(0, 5).map((warning, i) => (
                      <p key={i}>{warning}</p>
                    ))}
                    {warnings.length > 5 && (
                      <p className="text-muted-foreground">
                        ... e mais {warnings.length - 5} avisos
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Summary by Quarter */}
              <div>
                <h4 className="font-medium mb-3">Resumo por Trimestre</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trimestre</TableHead>
                      <TableHead className="text-right">Nº Facturas</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from(quarterTotals.entries())
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([quarter, total]) => {
                        const count = invoicesWithCategories.filter(i => i.quarter === quarter).length;
                        const isCurrent = quarter === currentQuarter;
                        return (
                          <TableRow key={quarter} className={isCurrent ? 'bg-primary/5' : ''}>
                            <TableCell>
                              {quarter}
                              {isCurrent && (
                                <Badge variant="outline" className="ml-2">
                                  Actual
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{count}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(total)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    <TableRow className="font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{invoicesWithCategories.length}</TableCell>
                      <TableCell className="text-right">{formatCurrency(grandTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Summary by Category */}
              {categoryTotals.size > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Resumo por Categoria</h4>
                  <div className="space-y-2">
                    {Array.from(categoryTotals.entries()).map(([cat, total]) => (
                      <div key={cat} className="flex justify-between items-center p-2 rounded bg-muted/50">
                        <span className="text-sm">
                          {REVENUE_CATEGORIES.find(c => c.value === cat)?.label || cat}
                        </span>
                        <span className="font-medium">{formatCurrency(total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Mode Selection */}
              <div className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Modo de Importação
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    onClick={() => setImportMode('aggregate')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      importMode === 'aggregate' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        importMode === 'aggregate' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {importMode === 'aggregate' && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="font-medium">Agregar por Trimestre</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Soma os valores e cria uma entrada por trimestre/categoria. Ideal para declaração SS.
                    </p>
                  </div>

                  <div
                    onClick={() => onCreateSalesInvoices ? setImportMode('individual') : undefined}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      !onCreateSalesInvoices 
                        ? 'opacity-50 cursor-not-allowed border-border/30' 
                        : importMode === 'individual' 
                          ? 'border-green-500 bg-green-500/5 cursor-pointer' 
                          : 'border-border/50 hover:border-green-500/30 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        importMode === 'individual' ? 'border-green-500' : 'border-muted-foreground'
                      }`}>
                        {importMode === 'individual' && <div className="w-2 h-2 rounded-full bg-green-500" />}
                      </div>
                      <span className="font-medium">Criar Facturas Individuais</span>
                      <Badge variant="secondary" className="text-[10px]">Novo</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cria cada factura como documento individual no sistema. Permite validação e consulta.
                    </p>
                  </div>
                </div>

                {importMode === 'individual' && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>As facturas serão criadas individualmente e ficarão disponíveis na secção de Vendas.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Category Selection with Auto-Detection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Categoria Padrão</label>
                    {detectedCategory && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              {detectedCategory.confidence === 'high' && (
                                <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Alta confiança
                                </Badge>
                              )}
                              {detectedCategory.confidence === 'medium' && (
                                <Badge variant="secondary" className="gap-1 bg-amber-500 hover:bg-amber-600 text-white">
                                  <Info className="h-3 w-3" />
                                  Média confiança
                                </Badge>
                              )}
                              {detectedCategory.confidence === 'low' && (
                                <Badge variant="outline" className="gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Por confirmar
                                </Badge>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{detectedCategory.reason}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPerLineCategories(!showPerLineCategories)}
                  >
                    {showPerLineCategories ? 'Ocultar categorias por linha' : 'Editar por linha'}
                  </Button>
                </div>
                
                {detectedCategory && detectedCategory.confidence !== 'low' && !showPerLineCategories && (
                  <div className={`p-3 rounded-lg border ${usedSavedPreference ? 'bg-violet-500/10 border-violet-500/30' : 'bg-primary/5 border-primary/20'}`}>
                    <div className="flex items-center gap-2 text-sm">
                      {usedSavedPreference ? (
                        <Sparkles className="h-4 w-4 text-violet-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                      <span className="font-medium">
                        {usedSavedPreference ? 'Categoria sugerida' : 'Categoria detectada'}: {REVENUE_CATEGORIES.find(c => c.value === detectedCategory.category)?.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {detectedCategory.reason}
                    </p>
                  </div>
                )}

                <Select value={defaultCategory} onValueChange={applyDefaultCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVENUE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {showPerLineCategories 
                    ? 'Alterar aqui aplica a todas as facturas. Edite individualmente abaixo.'
                    : 'Clique em "Editar por linha" para classificar cada factura individualmente.'
                  }
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={resetImport} className="gap-2">
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImport} 
                  className={`flex-1 gap-2 ${importMode === 'individual' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {importMode === 'individual' 
                    ? `Criar ${invoicesWithCategories.filter(i => i.selected).length} Facturas`
                    : `Importar ${invoicesWithCategories.filter(i => i.selected).length} Facturas`
                  }
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Details with Per-Line Categories */}
          <Card>
            <CardHeader>
              <CardTitle>
                {showPerLineCategories ? 'Classificar Facturas por Linha' : 'Detalhes das Facturas'}
              </CardTitle>
              {showPerLineCategories && (
                <CardDescription>
                  Seleccione a categoria para cada factura individualmente
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead className="text-right">Valor Base</TableHead>
                      {showPerLineCategories && (
                        <TableHead className="w-[180px]">Categoria</TableHead>
                      )}
                      {!showPerLineCategories && (
                        <>
                          <TableHead className="text-right">IVA</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicesWithCategories.slice(0, showPerLineCategories ? 50 : 20).map((invoice, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">
                          {invoice.date.toLocaleDateString('pt-PT')}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {invoice.documentNumber}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(invoice.baseValue)}
                        </TableCell>
                        {showPerLineCategories && (
                          <TableCell>
                            <Select 
                              value={invoice.selectedCategory} 
                              onValueChange={(value) => updateInvoiceCategory(i, value)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {REVENUE_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        {!showPerLineCategories && (
                          <>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {formatCurrency(invoice.vatValue)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {formatCurrency(invoice.totalValue)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {invoicesWithCategories.length > (showPerLineCategories ? 50 : 20) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Mostrando {showPerLineCategories ? 50 : 20} de {invoicesWithCategories.length} facturas
                  </p>
                )}
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
              <p className="text-lg font-medium">A importar dados...</p>
              <Progress value={50} className="w-64" />
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
              <p className="text-muted-foreground text-center">
                {importMode === 'individual' 
                  ? `${createdInvoicesCount} facturas criadas no sistema`
                  : `${invoicesWithCategories.length} facturas agregadas por trimestre`
                }
              </p>
              {importMode === 'individual' && (
                <p className="text-sm text-muted-foreground">
                  As facturas estão disponíveis na secção de Vendas
                </p>
              )}
              <Button onClick={resetImport} variant="outline">
                Importar Mais
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
