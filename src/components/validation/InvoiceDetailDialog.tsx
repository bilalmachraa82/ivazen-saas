import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClassificationEditor } from './ClassificationEditor';
import { ImageZoom } from './ImageZoom';
import { ValidationHistory } from './ValidationHistory';
import { useValidationHistory } from '@/hooks/useValidationHistory';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FileText, Image as ImageIcon, Calculator, Building2, ChevronLeft, ChevronRight, History, Save, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { validatePortugueseNIF } from '@/lib/nifValidator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle as AlertTriangleIcon } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;

interface InvoiceDetailDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate: (invoiceId: string, classification: {
    final_classification: string;
    final_dp_field: number;
    final_deductibility: number;
  }) => Promise<boolean>;
  getSignedUrl: (imagePath: string) => Promise<string | null>;
  onReExtract: (invoiceId: string) => Promise<{
    success: boolean;
    error?: string;
    warnings?: string[];
    changes?: Array<{ field: string; old_value: unknown; new_value: unknown }>;
  }>;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
  onDataUpdated?: () => void;
}

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
  onValidate,
  getSignedUrl,
  onReExtract,
  onNavigate,
  canNavigatePrev = false,
  canNavigateNext = false,
  onDataUpdated,
}: InvoiceDetailDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);

  // Editable fields
  const [editSupplierNif, setEditSupplierNif] = useState('');
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editDocumentDate, setEditDocumentDate] = useState('');
  const [editDocumentNumber, setEditDocumentNumber] = useState('');
  const [editTotalAmount, setEditTotalAmount] = useState('');
  const [editTotalVat, setEditTotalVat] = useState('');
  const [nifError, setNifError] = useState('');

  // Validation history hook
  const {
    history,
    loading: historyLoading,
    error: historyError,
    logValidation,
    createChangesArray,
  } = useValidationHistory({
    invoiceId: invoice?.id || null,
    invoiceType: 'purchase',
    enabled: open && !!invoice,
  });

  // Reset edit state when invoice changes
  useEffect(() => {
    if (invoice) {
      setEditSupplierNif(invoice.supplier_nif || '');
      setEditSupplierName(invoice.supplier_name || '');
      setEditDocumentDate(invoice.document_date || '');
      setEditDocumentNumber(invoice.document_number || '');
      setEditTotalAmount(String(invoice.total_amount || 0));
      setEditTotalVat(String(invoice.total_vat || 0));
      setIsEditing(false);
      setNifError('');
    }
  }, [invoice?.id]);

  useEffect(() => {
    if (invoice?.image_path && open) {
      setLoadingImage(true);
      getSignedUrl(invoice.image_path)
        .then(setImageUrl)
        .finally(() => setLoadingImage(false));
    } else {
      setImageUrl(null);
    }
  }, [invoice?.image_path, open]);

  // Keyboard shortcuts for navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K') && canNavigatePrev && onNavigate) {
        e.preventDefault();
        onNavigate('prev');
      } else if ((e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J') && canNavigateNext && onNavigate) {
        e.preventDefault();
        onNavigate('next');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, canNavigatePrev, canNavigateNext, onNavigate, onOpenChange]);

  if (!invoice) return null;

  const handleNifChange = (value: string) => {
    setEditSupplierNif(value);
    const cleaned = value.trim();
    // Only validate as PT NIF if it's exactly 9 digits
    if (/^\d{9}$/.test(cleaned)) {
      const valid = validatePortugueseNIF(cleaned);
      setNifError(valid ? '' : 'NIF inválido (check digit)');
    } else if (/^\d+$/.test(cleaned) && cleaned.length < 9) {
      setNifError('NIF PT deve ter 9 dígitos');
    } else if (cleaned.length > 0 && /^[A-Z]{2}/.test(cleaned)) {
      // Foreign VAT ID (e.g. IE3668997OH) - accept without validation
      setNifError('');
    } else if (cleaned.length === 0) {
      setNifError('');
    } else {
      setNifError('');
    }
  };

  // Check if document date is in the future
  const isFutureDate = editDocumentDate && new Date(editDocumentDate) > new Date();

  // Reclassify single invoice with AI
  const handleReclassify = async () => {
    setIsReclassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-invoice', {
        body: { invoice_id: invoice.id },
      });
      if (error) throw error;
      toast.success('Factura reclassificada com IA');
      onDataUpdated?.();
    } catch (err) {
      console.error('Reclassify error:', err);
      toast.error('Erro ao reclassificar');
    } finally {
      setIsReclassifying(false);
    }
  };

  const handleReExtract = async () => {
    setIsReExtracting(true);
    try {
      const result = await onReExtract(invoice.id);
      if (!result.success) {
        toast.error(result.error || 'Erro ao reextrair dados');
        return;
      }

      if (result.changes && result.changes.length > 0) {
        await logValidation('edited', result.changes);
      } else {
        await logValidation('edited', [
          {
            field: 'reextract',
            old_value: null,
            new_value: new Date().toISOString(),
          },
        ]);
      }

      if (result.warnings && result.warnings.length > 0) {
        toast.warning('Reextração concluída com avisos', {
          description: result.warnings.slice(0, 2).join(' | '),
        });
      } else {
        toast.success('Dados reextraídos com sucesso');
      }

      setIsEditing(false);
      onDataUpdated?.();
    } catch (error) {
      console.error('Re-extract error:', error);
      toast.error('Erro ao reextrair dados');
    } finally {
      setIsReExtracting(false);
    }
  };

  const handleSaveData = async () => {
    if (nifError) {
      toast.error('Corrija o NIF antes de guardar');
      return;
    }

    setIsSaving(true);
    try {
      // Recalculate fiscal_period from date
      const fiscalPeriod = editDocumentDate
        ? editDocumentDate.substring(0, 7).replace('-', '')
        : invoice.fiscal_period;

      // For NIF: keep as-is (supports foreign VAT IDs)
      const nifValue = editSupplierNif.trim() || invoice.supplier_nif;

      const updates: Record<string, any> = {
        supplier_nif: nifValue,
        supplier_name: editSupplierName || invoice.supplier_name,
        document_date: editDocumentDate || invoice.document_date,
        document_number: editDocumentNumber || invoice.document_number,
        total_amount: parseFloat(editTotalAmount) || invoice.total_amount,
        total_vat: parseFloat(editTotalVat) || invoice.total_vat,
        fiscal_period: fiscalPeriod,
      };

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success('Dados da factura actualizados');
      setIsEditing(false);
      onDataUpdated?.();
    } catch (error) {
      console.error('Error updating invoice data:', error);
      toast.error('Erro ao guardar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async (classification: {
    final_classification: string;
    final_dp_field: number;
    final_deductibility: number;
  }) => {
    setIsValidating(true);

    const oldValues = {
      final_classification: invoice.final_classification || invoice.ai_classification,
      final_dp_field: invoice.final_dp_field || invoice.ai_dp_field,
      final_deductibility: invoice.final_deductibility || invoice.ai_deductibility,
      status: invoice.status,
    };

    const newValues = {
      final_classification: classification.final_classification,
      final_dp_field: classification.final_dp_field,
      final_deductibility: classification.final_deductibility,
      status: 'validated',
    };

    const changes = createChangesArray(oldValues, newValues, [
      'final_classification',
      'final_dp_field',
      'final_deductibility',
      'status',
    ]);

    const success = await onValidate(invoice.id, classification);

    if (success) {
      const hasClassificationChanged = oldValues.final_classification !== newValues.final_classification;
      const action = hasClassificationChanged ? 'classification_changed' : 'validated';
      await logValidation(action, changes);
      onOpenChange(false);
    }

    setIsValidating(false);
    return success;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onNavigate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onNavigate('prev')}
                  disabled={!canNavigatePrev}
                  aria-label="Factura anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <DialogTitle className="text-xl">
                Factura {invoice.document_number || invoice.id.slice(0, 8)}
              </DialogTitle>
              {onNavigate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onNavigate('next')}
                  disabled={!canNavigateNext}
                  aria-label="Próxima factura"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={invoice.status === 'validated' ? 'success' : 'warning'}>
                {invoice.status === 'validated' ? 'Confirmada' : 'Por Confirmar'}
              </Badge>
              {invoice.validated_at && (
                <span className="text-[10px] text-muted-foreground">
                  Confirmada em {format(new Date(invoice.validated_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                </span>
              )}
            </div>
          </div>
          {onNavigate && (
            <p className="text-xs text-muted-foreground mt-1">
              <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">←</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">→</kbd> ou <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">K</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">J</kbd> navegar • <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">Enter</kbd> validar • <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">Esc</kbd> fechar
            </p>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6 px-6 pb-6">
          {/* Left: Invoice Image */}
          <div className="order-2 lg:order-1">
            <Tabs defaultValue="image" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="image" className="flex-1 gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Imagem
                </TabsTrigger>
                <TabsTrigger value="details" className="flex-1 gap-2">
                  <FileText className="h-4 w-4" />
                  Detalhes
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 gap-2">
                  <History className="h-4 w-4" />
                  Historico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="image" className="mt-4">
                {loadingImage ? (
                  <div className="aspect-[3/4] bg-muted rounded-lg flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : imageUrl ? (
                  <ImageZoom src={imageUrl} alt="Invoice" />
                ) : (
                  <div className="aspect-[3/4] bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-2" />
                    <p className="text-sm">Imagem não disponível</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="details" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-6">
                    {/* Edit toggle */}
                    <div className="flex justify-end">
                      {!isEditing ? (
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
                          <Pencil className="h-3.5 w-3.5" />
                          Editar dados
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setIsEditing(false);
                            // Reset to original values
                            setEditSupplierNif(invoice.supplier_nif || '');
                            setEditSupplierName(invoice.supplier_name || '');
                            setEditDocumentDate(invoice.document_date || '');
                            setEditDocumentNumber(invoice.document_number || '');
                            setEditTotalAmount(String(invoice.total_amount || 0));
                            setEditTotalVat(String(invoice.total_vat || 0));
                            setNifError('');
                          }}>
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={handleSaveData} disabled={isSaving || !!nifError} className="gap-1.5">
                            <Save className="h-3.5 w-3.5" />
                            {isSaving ? 'A guardar...' : 'Guardar'}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Supplier */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Fornecedor</h4>
                      </div>
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-supplier-name" className="text-xs text-muted-foreground">Nome</Label>
                            <Input
                              id="edit-supplier-name"
                              value={editSupplierName}
                              onChange={(e) => setEditSupplierName(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-supplier-nif" className="text-xs text-muted-foreground">NIF</Label>
                            <Input
                              id="edit-supplier-nif"
                              value={editSupplierNif}
                              onChange={(e) => handleNifChange(e.target.value)}
                              className={`h-8 text-sm font-mono ${nifError ? 'border-destructive' : ''}`}
                              maxLength={20}
                            />
                            {nifError && <p className="text-[10px] text-destructive">{nifError}</p>}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Nome</p>
                            <p className="font-medium">{invoice.supplier_name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">NIF/VAT</p>
                            <p className="font-mono font-medium">{invoice.supplier_nif}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Document */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Documento</h4>
                      </div>
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-doc-date" className="text-xs text-muted-foreground">Data</Label>
                            <Input
                              id="edit-doc-date"
                              type="date"
                              value={editDocumentDate}
                              onChange={(e) => setEditDocumentDate(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-doc-number" className="text-xs text-muted-foreground">Número</Label>
                            <Input
                              id="edit-doc-number"
                              value={editDocumentNumber}
                              onChange={(e) => setEditDocumentNumber(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Tipo</p>
                            <p className="font-medium">{invoice.document_type || 'Factura'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Número</p>
                            <p className="font-medium">{invoice.document_number || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Data</p>
                            <p className="font-medium">
                              {format(new Date(invoice.document_date), 'dd/MM/yyyy', { locale: pt })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">ATCUD</p>
                            <p className="font-mono text-xs">{invoice.atcud || 'N/A'}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Values */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Valores</h4>
                      </div>
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-total" className="text-xs text-muted-foreground">Total (€)</Label>
                            <Input
                              id="edit-total"
                              type="number"
                              step="0.01"
                              value={editTotalAmount}
                              onChange={(e) => setEditTotalAmount(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-vat" className="text-xs text-muted-foreground">IVA Total (€)</Label>
                            <Input
                              id="edit-vat"
                              type="number"
                              step="0.01"
                              value={editTotalVat}
                              onChange={(e) => setEditTotalVat(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-medium">€{Number(invoice.total_amount).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">IVA Total</span>
                            <span className="font-medium">€{Number(invoice.total_vat || 0).toFixed(2)}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Base Normal (23%)</span>
                            <span>€{Number(invoice.base_standard || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Base Intermédia (13%)</span>
                            <span>€{Number(invoice.base_intermediate || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Base Reduzida (6%)</span>
                            <span>€{Number(invoice.base_reduced || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Base Isenta</span>
                            <span>€{Number(invoice.base_exempt || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <ValidationHistory
                  history={history}
                  loading={historyLoading}
                  error={historyError}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Classification Editor */}
          <div className="order-1 lg:order-2 mb-6 lg:mb-0">
            {isFutureDate && (
              <Alert className="mb-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                  A data deste documento ({editDocumentDate}) é no futuro. Edite nos detalhes para corrigir.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Classificação</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReExtract}
                  disabled={isReExtracting || isReclassifying}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isReExtracting ? 'animate-spin' : ''}`} />
                  {isReExtracting ? 'A reextrair...' : 'Re-extrair OCR'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReclassify}
                  disabled={isReclassifying || isReExtracting}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isReclassifying ? 'animate-spin' : ''}`} />
                  {isReclassifying ? 'A classificar...' : 'Reclassificar IA'}
                </Button>
              </div>
            </div>
            <ClassificationEditor
              invoice={invoice}
              onValidate={handleValidate}
              isValidating={isValidating}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
