import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, AlertTriangle, Keyboard, HelpCircle } from 'lucide-react';

const CLASSIFICATIONS = [
  'Mercadorias',
  'Matérias-primas',
  'Fornecimentos e serviços externos',
  'Gastos com pessoal',
  'Imobilizado corpóreo',
  'Imobilizado incorpóreo',
  'Outros gastos',
  'Não dedutível',
];

const DP_FIELDS = [
  { value: 20, label: 'Campo 20 - Imobilizado (activo fixo tangível)' },
  { value: 21, label: 'Campo 21 - Existências (mercadorias, matérias-primas)' },
  { value: 22, label: 'Campo 22 - Outros bens e serviços' },
  { value: 23, label: 'Campo 23 - Não dedutível (Art.21º CIVA)' },
  { value: 24, label: 'Campo 24 - Gasóleo, GPL, GNV (50% dedutível)' },
];

interface ClassificationEditorProps {
  invoice: {
    ai_classification: string | null;
    ai_dp_field: number | null;
    ai_deductibility: number | null;
    ai_reason: string | null;
    ai_confidence: number | null;
    final_classification: string | null;
    final_dp_field: number | null;
    final_deductibility: number | null;
    status: string | null;
  };
  onValidate: (classification: {
    final_classification: string;
    final_dp_field: number;
    final_deductibility: number;
  }) => Promise<boolean>;
  isValidating: boolean;
}

export function ClassificationEditor({ invoice, onValidate, isValidating }: ClassificationEditorProps) {
  const [classification, setClassification] = useState(
    invoice.final_classification || invoice.ai_classification || ''
  );
  const [dpField, setDpField] = useState(
    invoice.final_dp_field || invoice.ai_dp_field || 22
  );
  const [deductibility, setDeductibility] = useState(
    invoice.final_deductibility || invoice.ai_deductibility || 100
  );

  useEffect(() => {
    setClassification(invoice.final_classification || invoice.ai_classification || '');
    setDpField(invoice.final_dp_field || invoice.ai_dp_field || 22);
    setDeductibility(invoice.final_deductibility || invoice.ai_deductibility || 100);
  }, [invoice]);

  const handleValidate = useCallback(async () => {
    if (!classification || isValidating) return;
    
    await onValidate({
      final_classification: classification,
      final_dp_field: dpField,
      final_deductibility: deductibility,
    });
  }, [classification, dpField, deductibility, onValidate, isValidating]);

  // Keyboard shortcut: Enter to validate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if focus is on a select or input
        if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleValidate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleValidate]);

  const isValidated = invoice.status === 'validated';
  const hasAIClassification = invoice.ai_classification !== null;

  return (
    <div className="space-y-6">
      {hasAIClassification && (
        <div className="p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${
              (invoice.ai_confidence || 0) >= 80 ? 'bg-success/10 text-success' :
              (invoice.ai_confidence || 0) >= 60 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
            }`}>
              {(invoice.ai_confidence || 0) >= 80 ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Sugestão da IA ({invoice.ai_confidence}% confiança)</p>
              <p className="text-sm text-muted-foreground mt-1">
                {invoice.ai_reason || 'Sem justificação disponível'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="classification">Classificação</Label>
          <Select
            value={classification}
            onValueChange={setClassification}
            disabled={isValidated}
          >
            <SelectTrigger id="classification">
              <SelectValue placeholder="Seleccionar classificação" />
            </SelectTrigger>
            <SelectContent>
              {CLASSIFICATIONS.map((cls) => (
                <SelectItem key={cls} value={cls}>
                  {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="dp-field">Campo DP</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-64">
                  <p className="text-xs">
                    Declaração Periódica de IVA - Campo onde o IVA dedutível será declarado à AT
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select
            value={dpField.toString()}
            onValueChange={(v) => setDpField(Number(v))}
            disabled={isValidated}
          >
            <SelectTrigger id="dp-field">
              <SelectValue placeholder="Seleccionar campo" />
            </SelectTrigger>
            <SelectContent>
              {DP_FIELDS.map((field) => (
                <SelectItem key={field.value} value={field.value.toString()}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Dedutibilidade</Label>
            <span className="text-sm font-medium">{deductibility}%</span>
          </div>
          <Slider
            value={[deductibility]}
            onValueChange={([value]) => setDeductibility(value)}
            max={100}
            step={1}
            disabled={isValidated}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Ajuste a percentagem de IVA dedutível conforme Art. 21º CIVA
          </p>
        </div>
      </div>

      {!isValidated && (
        <div className="space-y-3">
          <Button
            onClick={handleValidate}
            disabled={!classification || isValidating}
            className="w-full"
            size="lg"
          >
            {isValidating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                A validar...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Classificação
              </>
            )}
          </Button>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Keyboard className="h-3 w-3" />
            <span>Prima <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground font-mono">Enter</kbd> para validar</span>
          </div>
        </div>
      )}

      {isValidated && (
        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Factura validada</span>
          </div>
        </div>
      )}
    </div>
  );
}
