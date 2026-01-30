import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ImageZoom } from '@/components/validation/ImageZoom';
import { ValidationHistory } from '@/components/validation/ValidationHistory';
import { SalesClassificationEditor } from '@/components/sales/SalesClassificationEditor';
import { useValidationHistory } from '@/hooks/useValidationHistory';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FileText, Image as ImageIcon, Calculator, User, ChevronLeft, ChevronRight, History } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type SalesInvoice = Tables<'sales_invoices'>;

interface SalesInvoiceDetailDialogProps {
  invoice: SalesInvoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate: (invoiceId: string, category: string, notes?: string) => Promise<boolean>;
  getSignedUrl: (imagePath: string) => Promise<string | null>;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
}

export function SalesInvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
  onValidate,
  getSignedUrl,
  onNavigate,
  canNavigatePrev = false,
  canNavigateNext = false,
}: SalesInvoiceDetailDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Validation history hook
  const {
    history,
    loading: historyLoading,
    error: historyError,
    logValidation,
    createChangesArray,
  } = useValidationHistory({
    invoiceId: invoice?.id || null,
    invoiceType: 'sales',
    enabled: open && !!invoice,
  });

  useEffect(() => {
    if (invoice?.image_path && open) {
      setLoadingImage(true);
      getSignedUrl(invoice.image_path)
        .then(setImageUrl)
        .finally(() => setLoadingImage(false));
    } else {
      setImageUrl(null);
    }
  }, [invoice?.image_path, invoice?.id, open]);

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

  const handleValidate = async (category: string, notes?: string) => {
    setIsValidating(true);

    // Prepare changes for logging
    const oldValues = {
      revenue_category: invoice.revenue_category,
      notes: invoice.notes,
      status: invoice.status,
    };

    const newValues = {
      revenue_category: category,
      notes: notes || null,
      status: 'validated',
    };

    const changes = createChangesArray(oldValues, newValues, [
      'revenue_category',
      'notes',
      'status',
    ]);

    const success = await onValidate(invoice.id, category, notes);

    if (success) {
      // Log the validation
      const hasCategoryChanged = oldValues.revenue_category !== newValues.revenue_category;
      const action = hasCategoryChanged ? 'classification_changed' : 'validated';
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
              <Badge variant={invoice.status === 'validated' ? 'success' : 'secondary'}>
                {invoice.status === 'validated' ? 'Validada' : 'Pendente'}
              </Badge>
              {invoice.validated_at && (
                <span className="text-[10px] text-muted-foreground">
                  Validada em {format(new Date(invoice.validated_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                </span>
              )}
            </div>
          </div>
          {onNavigate && (
            <p className="text-xs text-muted-foreground mt-1">
              <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">←</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">→</kbd> ou <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">K</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">J</kbd> navegar • <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">Esc</kbd> fechar
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
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Cliente</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Nome</p>
                          <p className="font-medium">{invoice.customer_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">NIF</p>
                          <p className="font-mono font-medium">{invoice.customer_nif || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Documento</h4>
                      </div>
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
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Valores</h4>
                      </div>
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

          {/* Right: Classification & Validation */}
          <div className="order-1 lg:order-2 mb-6 lg:mb-0">
            <SalesClassificationEditor
              invoice={{
                id: invoice.id,
                revenue_category: invoice.revenue_category,
                ai_category_confidence: invoice.ai_category_confidence,
                status: invoice.status,
              }}
              onValidate={handleValidate}
              isValidating={isValidating}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
