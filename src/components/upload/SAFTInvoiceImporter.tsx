/**
 * SAFT-PT Invoice Importer Component
 * Allows importing purchase/sales invoices from SAFT-PT XML files
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
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
  FileCode,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
  Users,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { parseInvoiceFile, ParsedInvoice, formatCurrency, ParseResult } from '@/lib/csvParser';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SAFTInvoiceImporterProps {
  selectedClientId?: string | null;
  clientName?: string | null;
  onComplete?: () => void;
}

type ImportStep = 'instructions' | 'upload' | 'preview' | 'importing' | 'complete';

interface InvoiceForImport extends ParsedInvoice {
  selected: boolean;
}

export function SAFTInvoiceImporter({ selectedClientId, clientName, onComplete }: SAFTInvoiceImporterProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<ImportStep>('instructions');
  const [invoices, setInvoices] = useState<InvoiceForImport[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [fileType, setFileType] = useState<'csv' | 'saft' | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [invoiceType, setInvoiceType] = useState<'purchase' | 'sales'>('purchase');

  const effectiveClientId = selectedClientId || user?.id;

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

      // Add selection to each invoice
      const invoicesWithSelection: InvoiceForImport[] = result.invoices.map(invoice => ({
        ...invoice,
        selected: true,
      }));

      setInvoices(invoicesWithSelection);
      setErrors(result.errors);
      setWarnings(result.warnings);
      setFileType(result.fileType || (isXml ? 'saft' : 'csv'));

      if (result.invoices.length > 0) {
        setStep('preview');
        const typeLabel = result.fileType === 'saft' ? 'SAFT-PT' : 'CSV';
        toast.success(`${result.invoices.length} faturas encontradas (${typeLabel})`);
      } else if (result.errors.length > 0) {
        toast.error(result.errors[0]);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

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

  const toggleInvoiceSelection = (index: number) => {
    setInvoices(prev =>
      prev.map((inv, i) => i === index ? { ...inv, selected: !inv.selected } : inv)
    );
  };

  const toggleSelectAll = () => {
    const allSelected = invoices.every(inv => inv.selected);
    setInvoices(prev => prev.map(inv => ({ ...inv, selected: !allSelected })));
  };

  const handleImport = async () => {
    if (!effectiveClientId) {
      toast.error('Cliente nao definido');
      return;
    }

    const selectedInvoices = invoices.filter(inv => inv.selected);
    if (selectedInvoices.length === 0) {
      toast.error('Selecione pelo menos uma fatura para importar');
      return;
    }

    setIsImporting(true);
    setStep('importing');
    setImportProgress(0);

    let imported = 0;
    let duplicates = 0;

    try {
      const table = invoiceType === 'sales' ? 'sales_invoices' : 'invoices';

      for (let i = 0; i < selectedInvoices.length; i++) {
        const invoice = selectedInvoices[i];

        // Check for duplicates
        const { data: existing } = await supabase
          .from(table)
          .select('id')
          .eq('client_id', effectiveClientId)
          .eq('document_number', invoice.documentNumber)
          .eq('document_date', invoice.date.toISOString().split('T')[0])
          .maybeSingle();

        if (existing) {
          duplicates++;
          setImportProgress(Math.round(((i + 1) / selectedInvoices.length) * 100));
          continue;
        }

        // Determine NIF fields based on invoice type
        // For purchase invoices: supplierName from SAFT is the supplier
        // For sales invoices: customerNif from SAFT is the customer
        const insertData = {
          client_id: effectiveClientId,
          document_date: invoice.date.toISOString().split('T')[0],
          document_number: invoice.documentNumber,
          document_type: invoice.documentType || 'FT',
          supplier_nif: invoiceType === 'purchase' ? (invoice.customerNif || 'SAFT') : effectiveClientId,
          supplier_name: invoiceType === 'purchase' ? invoice.supplierName : null,
          customer_nif: invoiceType === 'sales' ? invoice.customerNif : null,
          total_amount: invoice.totalValue,
          total_vat: invoice.vatValue,
          base_standard: invoice.baseValue,
          fiscal_period: `${invoice.date.getFullYear()}${String(invoice.date.getMonth() + 1).padStart(2, '0')}`,
          fiscal_region: 'PT',
          image_path: `saft-import/${effectiveClientId}/${invoice.documentNumber}`,
          status: 'pending',
        };

        const { error } = await supabase
          .from(table)
          .insert(insertData);

        if (error) {
          console.error('Insert error:', error);
          // Continue with other invoices
        } else {
          imported++;

          // Trigger classification for purchase invoices
          if (invoiceType === 'purchase') {
            // Get the inserted invoice ID and trigger classification
            const { data: insertedInvoice } = await supabase
              .from(table)
              .select('id')
              .eq('client_id', effectiveClientId)
              .eq('document_number', invoice.documentNumber)
              .single();

            if (insertedInvoice) {
              supabase.functions.invoke('classify-invoice', {
                body: { invoice_id: insertedInvoice.id }
              }).catch(err => console.warn('Classification failed:', err));
            }
          }
        }

        setImportProgress(Math.round(((i + 1) / selectedInvoices.length) * 100));
      }

      setImportedCount(imported);
      setDuplicatesCount(duplicates);
      setStep('complete');

      if (imported > 0) {
        toast.success(`${imported} fatura${imported !== 1 ? 's' : ''} importada${imported !== 1 ? 's' : ''} com sucesso`);
      }
      if (duplicates > 0) {
        toast.info(`${duplicates} fatura${duplicates !== 1 ? 's' : ''} duplicada${duplicates !== 1 ? 's' : ''} ignorada${duplicates !== 1 ? 's' : ''}`);
      }

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Erro na importacao');
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setStep('instructions');
    setInvoices([]);
    setErrors([]);
    setWarnings([]);
    setFileType(null);
    setImportProgress(0);
    setImportedCount(0);
    setDuplicatesCount(0);
  };

  const selectedCount = invoices.filter(inv => inv.selected).length;
  const grandTotal = invoices.filter(inv => inv.selected).reduce((sum, inv) => sum + inv.totalValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Importar SAFT-PT</h2>
        <p className="text-muted-foreground mt-1">
          Importe faturas diretamente do ficheiro SAFT-PT exportado do seu software de faturacao.
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
            <strong>Selecione um cliente</strong> antes de importar faturas.
          </AlertDescription>
        </Alert>
      )}

      {/* Instructions Step */}
      {step === 'instructions' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Importar Ficheiro SAFT-PT
            </CardTitle>
            <CardDescription>
              Siga os passos abaixo para exportar e importar as suas faturas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium">Exporte o ficheiro SAFT-PT</p>
                  <p className="text-sm text-muted-foreground">
                    No seu software de faturacao, exporte o ficheiro SAFT-PT (Portaria 302/2016) para o periodo desejado.
                  </p>
                </div>
              </div>

              <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Carregue o ficheiro XML</p>
                  <p className="text-sm text-muted-foreground">
                    Arraste ou selecione o ficheiro SAFT-PT (.xml) exportado
                  </p>
                </div>
              </div>

              <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Revise e importe</p>
                  <p className="text-sm text-muted-foreground">
                    Verifique as faturas e selecione quais deseja importar. Duplicados serao ignorados automaticamente.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Badge variant="secondary" className="gap-1">
                <FileCode className="h-3 w-3" />
                SAFT-PT (XML)
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                CSV
              </Badge>
            </div>

            <Button className="w-full gap-2" onClick={() => setStep('upload')}>
              <Upload className="h-4 w-4" />
              Continuar para Upload
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Carregar Ficheiro
              <Badge variant="outline" className="gap-1">
                <FileCode className="h-3 w-3" />
                SAFT-PT
              </Badge>
              <Badge variant="outline" className="gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                CSV
              </Badge>
            </CardTitle>
            <CardDescription>
              Arraste o ficheiro SAFT-PT (XML) ou CSV
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
              onClick={() => document.getElementById('saft-file-upload')?.click()}
            >
              <div className="flex justify-center gap-4 mb-4">
                <FileCode className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-2">Arraste o ficheiro aqui</p>
              <p className="text-sm text-muted-foreground mb-4">SAFT-PT (XML) ou CSV</p>
              <input
                type="file"
                accept=".csv,.xml"
                onChange={handleFileSelect}
                className="hidden"
                id="saft-file-upload"
              />
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Selecionar Ficheiro
              </Button>
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
              Voltar as instrucoes
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
                  Pre-visualizacao
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
                <Badge variant="secondary">{invoices.length} faturas</Badge>
              </CardTitle>
              <CardDescription>
                Selecione as faturas que deseja importar
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

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Selecionadas</p>
                  <p className="text-2xl font-bold">{selectedCount}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="text-lg font-bold">{invoiceType === 'sales' ? 'Vendas' : 'Compras'}</p>
                </div>
              </div>

              {/* Invoice List */}
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={invoices.every(inv => inv.selected)}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice, i) => (
                      <TableRow
                        key={i}
                        className={!invoice.selected ? 'opacity-50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={invoice.selected}
                            onCheckedChange={() => toggleInvoiceSelection(i)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {invoice.date.toLocaleDateString('pt-PT')}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {invoice.documentNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {invoice.documentType}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(invoice.baseValue)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(invoice.vatValue)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(invoice.totalValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={resetImport} className="gap-2">
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedCount === 0 || !effectiveClientId}
                  className="flex-1 gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Importar {selectedCount} Fatura{selectedCount !== 1 ? 's' : ''}
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
              <p className="text-lg font-medium">A importar faturas...</p>
              <Progress value={importProgress} className="w-64" />
              <p className="text-sm text-muted-foreground">{importProgress}% concluido</p>
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
              <p className="text-lg font-medium">Importacao Concluida</p>
              <div className="text-center space-y-1">
                <p className="text-muted-foreground">
                  <strong className="text-green-600">{importedCount}</strong> fatura{importedCount !== 1 ? 's' : ''} importada{importedCount !== 1 ? 's' : ''} com sucesso
                </p>
                {duplicatesCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {duplicatesCount} fatura{duplicatesCount !== 1 ? 's' : ''} duplicada{duplicatesCount !== 1 ? 's' : ''} ignorada{duplicatesCount !== 1 ? 's' : ''}
                  </p>
                )}
                {invoiceType === 'purchase' && importedCount > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    As faturas de compra estao a ser classificadas pela IA em segundo plano.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={resetImport} variant="outline">
                  Importar Mais
                </Button>
                {onComplete && (
                  <Button onClick={onComplete}>
                    Concluir
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
