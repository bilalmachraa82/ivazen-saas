/**
 * Database Importer Component
 * Sistema de importação universal com validação multi-camada
 */

import { useCallback } from 'react';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ZenCard } from '@/components/zen';
import { 
  Database, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertTriangle, 
  Download, 
  ArrowLeft, 
  ArrowRight,
  Loader2,
  Users,
  FileText,
  Receipt,
  Calculator,
  Coins
} from 'lucide-react';
import { useDatabaseImport } from '@/hooks/useDatabaseImport';
import { DataType, DuplicateStrategy } from '@/lib/universalImportParser';
import { cn } from '@/lib/utils';

const DATA_TYPE_OPTIONS: { value: DataType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'unknown', label: 'Detectar Automaticamente', icon: Database, description: 'O sistema detecta o tipo' },
  { value: 'clients', label: 'Clientes', icon: Users, description: 'Base de dados de clientes/CRM' },
  { value: 'tax_withholdings', label: 'Retenções', icon: Calculator, description: 'Retenções na fonte (Modelo 10)' },
  { value: 'invoices', label: 'Facturas IVA', icon: Receipt, description: 'Facturas de compras (despesas)' },
  { value: 'sales_invoices', label: 'Vendas', icon: FileText, description: 'Facturas emitidas (receitas)' },
  { value: 'revenue_entries', label: 'Rendimentos SS', icon: Coins, description: 'Rendimentos Segurança Social' },
];

const DUPLICATE_STRATEGIES: { value: DuplicateStrategy; label: string; description: string }[] = [
  { value: 'skip', label: 'Ignorar', description: 'Não importar registos duplicados' },
  { value: 'merge', label: 'Merge (Recomendado)', description: 'Actualizar apenas campos vazios' },
  { value: 'update', label: 'Substituir', description: 'Substituir todos os dados existentes' },
];

export function DatabaseImporter() {
  const {
    step,
    isProcessing,
    file,
    headers,
    rows,
    dataType,
    mapping,
    validationResults,
    duplicates,
    duplicateStrategy,
    fiscalYear,
    summary,
    importResult,
    reset,
    handleFileUpload,
    setDataType,
    updateMapping,
    setDuplicateStrategy,
    setFiscalYear,
    runValidation,
    executeImport,
    downloadTemplate,
    setStep,
    getDataTypeLabel,
  } = useDatabaseImport();

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileUpload(droppedFile);
    }
  }, [handleFileUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileUpload(selectedFile);
    }
  }, [handleFileUpload]);

  // Render step indicator
  const renderStepIndicator = () => {
    const steps = [
      { id: 'upload', label: 'Upload' },
      { id: 'mapping', label: 'Mapeamento' },
      { id: 'validation', label: 'Validação' },
      { id: 'complete', label: 'Concluído' },
    ];
    
    const currentIndex = steps.findIndex(s => s.id === step || (step === 'importing' && s.id === 'validation'));
    
    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              i < currentIndex ? "bg-primary text-primary-foreground" :
              i === currentIndex ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
              "bg-muted text-muted-foreground"
            )}>
              {i < currentIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "w-12 h-0.5 mx-2",
                i < currentIndex ? "bg-primary" : "bg-muted"
              )} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Step 1: Upload
  const renderUploadStep = () => (
    <div className="space-y-6">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5",
          isProcessing ? "opacity-50 pointer-events-none" : ""
        )}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
          disabled={isProcessing}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-primary/10">
              {isProcessing ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <Upload className="h-8 w-8 text-primary" />
              )}
            </div>
            <div>
              <p className="font-semibold text-lg">
                {isProcessing ? 'A processar...' : 'Arraste ficheiros Excel/CSV aqui'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ou clique para seleccionar
              </p>
            </div>
          </div>
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Tipos suportados:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DATA_TYPE_OPTIONS.map(opt => (
            <div key={opt.value} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <opt.icon className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-2">
        <p className="text-sm text-muted-foreground w-full mb-2">Descarregar templates:</p>
        {DATA_TYPE_OPTIONS.filter(o => o.value !== 'unknown').map(opt => (
          <Button
            key={opt.value}
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate(opt.value)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );

  // Step 2: Mapping
  const renderMappingStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">{file?.name}</p>
            <p className="text-sm text-muted-foreground">{rows.length} registos encontrados</p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1">
          {DATA_TYPE_OPTIONS.find(o => o.value === dataType)?.icon && (
            <span>
              {(() => {
                const Icon = DATA_TYPE_OPTIONS.find(o => o.value === dataType)?.icon;
                return Icon ? <Icon className="h-3 w-3" /> : null;
              })()}
            </span>
          )}
          {getDataTypeLabel(dataType)}
        </Badge>
      </div>

      <div className="space-y-3">
        <Label>Tipo de Dados</Label>
        <Select value={dataType} onValueChange={(v) => setDataType(v as DataType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dataType === 'tax_withholdings' && (
        <div className="space-y-3">
          <Label>Ano Fiscal</Label>
          <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2024, 2023, 2022].map(year => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3">
        <Label>Mapeamento de Colunas</Label>
        <ScrollArea className="h-[300px] border rounded-lg p-4">
          <div className="space-y-3">
            {headers.map((header, idx) => {
              const currentMapping = mapping.find(m => m.sourceColumn === header);
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-1/3 text-sm font-medium truncate" title={header}>
                    {header}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select
                    value={currentMapping?.targetField || '_ignore'}
                    onValueChange={(v) => updateMapping(header, v === '_ignore' ? '' : v)}
                  >
                    <SelectTrigger className="w-2/3">
                      <SelectValue placeholder="Seleccionar campo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_ignore">(Ignorar)</SelectItem>
                      <SelectItem value="full_name">Nome Completo</SelectItem>
                      <SelectItem value="company_name">Nome Empresa</SelectItem>
                      <SelectItem value="nif">NIF</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="address">Morada</SelectItem>
                      <SelectItem value="status">Estado</SelectItem>
                      <SelectItem value="beneficiary_nif">NIF Beneficiário</SelectItem>
                      <SelectItem value="beneficiary_name">Nome Beneficiário</SelectItem>
                      <SelectItem value="gross_amount">Valor Bruto</SelectItem>
                      <SelectItem value="withholding_amount">Retenção</SelectItem>
                      <SelectItem value="withholding_rate">Taxa</SelectItem>
                      <SelectItem value="payment_date">Data Pagamento</SelectItem>
                      <SelectItem value="income_category">Categoria</SelectItem>
                      <SelectItem value="document_reference">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                  {currentMapping?.autoDetected && (
                    <Badge variant="outline" className="shrink-0">Auto</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-3">
        <Label>Estratégia de Duplicados</Label>
        <RadioGroup
          value={duplicateStrategy}
          onValueChange={(v) => setDuplicateStrategy(v as DuplicateStrategy)}
          className="space-y-2"
        >
          {DUPLICATE_STRATEGIES.map(strat => (
            <div key={strat.value} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
              <RadioGroupItem value={strat.value} id={strat.value} className="mt-0.5" />
              <label htmlFor={strat.value} className="cursor-pointer flex-1">
                <p className="font-medium">{strat.label}</p>
                <p className="text-sm text-muted-foreground">{strat.description}</p>
              </label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={reset} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={runValidation} disabled={isProcessing} className="flex-1 gap-2">
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Validar Dados
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Step 3: Validation
  const renderValidationStep = () => {
    const errors = validationResults.filter(r => !r.valid);
    const warnings = validationResults.filter(r => r.valid && r.warnings.length > 0);
    
    return (
      <div className="space-y-6">
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 text-center">
              <p className="text-2xl font-bold text-green-600">{summary.valid}</p>
              <p className="text-xs text-muted-foreground">Válidos</p>
            </div>
            <div className="p-4 rounded-lg bg-yellow-500/10 text-center">
              <p className="text-2xl font-bold text-yellow-600">{summary.withWarnings}</p>
              <p className="text-xs text-muted-foreground">Avisos</p>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10 text-center">
              <p className="text-2xl font-bold text-red-600">{summary.withErrors}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.duplicates}</p>
              <p className="text-xs text-muted-foreground">Duplicados</p>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-600">
              <X className="h-4 w-4" />
              <span className="font-medium">Erros Críticos ({errors.length})</span>
            </div>
            <ScrollArea className="h-[150px] border border-red-200 rounded-lg p-3 bg-red-50 dark:bg-red-950/20">
              {errors.slice(0, 20).map((err, i) => (
                <div key={i} className="text-sm py-1">
                  <span className="font-mono text-muted-foreground">Linha {err.row}:</span>{' '}
                  {err.errors.join(', ')}
                </div>
              ))}
              {errors.length > 20 && (
                <p className="text-sm text-muted-foreground mt-2">
                  ... e mais {errors.length - 20} erros
                </p>
              )}
            </ScrollArea>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Avisos ({warnings.length})</span>
            </div>
            <ScrollArea className="h-[100px] border border-yellow-200 rounded-lg p-3 bg-yellow-50 dark:bg-yellow-950/20">
              {warnings.slice(0, 10).map((warn, i) => (
                <div key={i} className="text-sm py-1">
                  <span className="font-mono text-muted-foreground">Linha {warn.row}:</span>{' '}
                  {warn.warnings.join(', ')}
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-600">
              <Database className="h-4 w-4" />
              <span className="font-medium">
                Duplicados ({duplicates.length}) - Serão {duplicateStrategy === 'skip' ? 'ignorados' : duplicateStrategy === 'merge' ? 'merged' : 'substituídos'}
              </span>
            </div>
            <ScrollArea className="h-[100px] border border-blue-200 rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20">
              {duplicates.slice(0, 10).map((dup, i) => (
                <div key={i} className="text-sm py-1">
                  <span className="font-mono text-muted-foreground">Linha {dup.row}:</span>{' '}
                  NIF {dup.importData.nif || dup.importData.beneficiary_nif}
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('mapping')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button 
            onClick={executeImport} 
            disabled={isProcessing || (summary?.valid || 0) === 0}
            className="flex-1 gap-2"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Importar {summary?.valid || 0} Registos
          </Button>
        </div>
      </div>
    );
  };

  // Step 4: Importing
  const renderImportingStep = () => (
    <div className="space-y-6 text-center py-8">
      <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
      <div>
        <p className="font-semibold text-lg">A importar dados...</p>
        <p className="text-sm text-muted-foreground">Por favor aguarde</p>
      </div>
      <Progress value={50} className="w-full max-w-xs mx-auto" />
    </div>
  );

  // Step 5: Complete
  const renderCompleteStep = () => (
    <div className="space-y-6 text-center py-8">
      <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30 w-fit mx-auto">
        <Check className="h-12 w-12 text-green-600" />
      </div>
      <div>
        <p className="font-semibold text-xl">Importação Concluída!</p>
      </div>
      
      {importResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto">
          <div className="p-4 rounded-lg bg-green-500/10">
            <p className="text-2xl font-bold text-green-600">{importResult.inserted}</p>
            <p className="text-xs text-muted-foreground">Inseridos</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/10">
            <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
            <p className="text-xs text-muted-foreground">Actualizados</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30">
            <p className="text-2xl font-bold">{importResult.skipped}</p>
            <p className="text-xs text-muted-foreground">Ignorados</p>
          </div>
          <div className="p-4 rounded-lg bg-red-500/10">
            <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </div>
        </div>
      )}

      <Button onClick={reset} className="gap-2">
        <Upload className="h-4 w-4" />
        Nova Importação
      </Button>
    </div>
  );

  return (
    <ZenCard gradient="default" withLine className="shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          Importar Base de Dados
        </CardTitle>
        <CardDescription>
          Importe dados de Excel ou CSV com validação automática e protecção contra duplicados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderStepIndicator()}
        
        {step === 'upload' && renderUploadStep()}
        {step === 'mapping' && renderMappingStep()}
        {step === 'validation' && renderValidationStep()}
        {step === 'importing' && renderImportingStep()}
        {step === 'complete' && renderCompleteStep()}
      </CardContent>
    </ZenCard>
  );
}
