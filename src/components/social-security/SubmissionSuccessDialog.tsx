import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, PartyPopper, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubmissionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quarterLabel: string;
  contributionAmount: number;
  onOpenPortal: () => void;
}

export function SubmissionSuccessDialog({
  open,
  onOpenChange,
  quarterLabel,
  contributionAmount,
  onOpenPortal,
}: SubmissionSuccessDialogProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    if (open) {
      // Animate elements sequentially
      setShowConfetti(false);
      setShowCheck(false);
      
      const timer1 = setTimeout(() => setShowCheck(true), 200);
      const timer2 = setTimeout(() => setShowConfetti(true), 500);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          {/* Animated success icon */}
          <div className="relative mb-4">
            <div
              className={cn(
                'w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center transition-all duration-500',
                showCheck 
                  ? 'scale-100 opacity-100' 
                  : 'scale-50 opacity-0'
              )}
            >
              <CheckCircle2 
                className={cn(
                  'w-12 h-12 text-green-600 dark:text-green-400 transition-all duration-500 delay-200',
                  showCheck 
                    ? 'scale-100 opacity-100' 
                    : 'scale-0 opacity-0'
                )}
              />
            </div>
            
            {/* Confetti effect */}
            {showConfetti && (
              <div className="absolute -top-2 -right-2 animate-bounce">
                <PartyPopper className="w-8 h-8 text-amber-500" />
              </div>
            )}
          </div>

          <DialogTitle className="text-xl font-semibold text-green-700 dark:text-green-400">
            Declaração Marcada como Submetida!
          </DialogTitle>
          
          <DialogDescription className="text-center space-y-2 pt-2">
            <p>
              A sua declaração trimestral de <strong>{quarterLabel}</strong> foi registada com sucesso.
            </p>
            <p className="text-lg font-semibold text-foreground">
              Contribuição: {contributionAmount.toFixed(2)}€
            </p>
          </DialogDescription>
        </DialogHeader>

        {/* Next steps */}
        <div className="bg-muted/50 rounded-lg p-4 mt-4 text-left space-y-2">
          <h4 className="font-medium text-sm">Próximos Passos:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Submeta oficialmente na SS Directa até dia 15</li>
            <li>Efectue o pagamento até ao final do mês</li>
            <li>Guarde o comprovativo de submissão</li>
          </ol>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Fechar
          </Button>
          <Button
            onClick={() => {
              onOpenPortal();
              onOpenChange(false);
            }}
            className="flex-1 gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir SS Directa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
