import { AlertCircle, XOctagon, ShoppingCart, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const TYPE_STYLES = {
  purchase: {
    chipBg: 'bg-indigo-500/20',
    icon: 'text-indigo-600',
    text: 'text-indigo-700 dark:text-indigo-300',
    cta: 'bg-indigo-600 hover:bg-indigo-700',
  },
  sales: {
    chipBg: 'bg-rose-500/20',
    icon: 'text-rose-600',
    text: 'text-rose-700 dark:text-rose-300',
    cta: 'bg-rose-600 hover:bg-rose-700',
  },
} as const;

interface TypeMismatchWarningProps {
  selectedType: 'purchase' | 'sales';
  detectedType: 'purchase' | 'sales';
  reason: string;
  onConfirm: () => void;
  onChangeType: () => void;
  isProcessing?: boolean;
  /** If true, blocks the upload entirely instead of just warning */
  blockUpload?: boolean;
}

export function TypeMismatchWarning({
  selectedType,
  detectedType,
  reason,
  onConfirm,
  onChangeType,
  isProcessing = false,
  blockUpload = true,
}: TypeMismatchWarningProps) {
  const selectedLabel = selectedType === 'purchase' ? 'Compra' : 'Venda';
  const detectedLabel = detectedType === 'purchase' ? 'Compra' : 'Venda';
  
  const SelectedIcon = selectedType === 'purchase' ? ShoppingCart : TrendingUp;
  const DetectedIcon = detectedType === 'purchase' ? ShoppingCart : TrendingUp;
  const selectedStyle = TYPE_STYLES[selectedType];
  const detectedStyle = TYPE_STYLES[detectedType];

  if (blockUpload) {
    // Blocking mode - requires user to change type, cannot force
    return (
      <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
        <XOctagon className="h-5 w-5" />
        <AlertTitle className="text-base font-semibold flex items-center gap-2">
          Tipo de Factura Incorreto
          <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
        </AlertTitle>
        <AlertDescription className="mt-3 space-y-4">
          <p className="text-sm">{reason}</p>
          
          <div className="flex items-center gap-3 p-3 bg-background/60 rounded-lg border border-border/50">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${selectedStyle.chipBg}`}>
              <SelectedIcon className={`h-4 w-4 ${selectedStyle.icon}`} />
              <span className={`text-sm font-medium ${selectedStyle.text}`}>
                Seleccionado: {selectedLabel}
              </span>
            </div>
            <span className="text-muted-foreground">≠</span>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${detectedStyle.chipBg}`}>
              <DetectedIcon className={`h-4 w-4 ${detectedStyle.icon}`} />
              <span className={`text-sm font-medium ${detectedStyle.text}`}>
                Detectado: {detectedLabel}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 pt-2">
            <Button 
              onClick={onChangeType}
              disabled={isProcessing}
              className={detectedStyle.cta}
            >
              <DetectedIcon className="h-4 w-4 mr-2" />
              Corrigir para {detectedLabel} e Continuar
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onConfirm}
              disabled={isProcessing}
              className="text-muted-foreground hover:text-foreground"
            >
              Tenho a certeza, manter como {selectedLabel}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            Para evitar erros de classificação, recomendamos corrigir o tipo antes de continuar.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Warning mode (original behavior)
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-3">
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Possível inconsistência detectada
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            {reason}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/50 text-amber-700">
            Menu: {selectedLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">→</span>
          <Badge variant="outline" className="border-blue-500/50 text-blue-700">
            Detectado: {detectedLabel}
          </Badge>
        </div>

        <div className="flex gap-2 pt-1">
          <Button 
            size="sm" 
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1"
          >
            Manter como {selectedLabel}
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onChangeType}
            disabled={isProcessing}
            className="flex-1"
          >
            Mudar para {detectedLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
