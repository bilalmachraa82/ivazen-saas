/**
 * ClientValidationDialog Component
 *
 * Modal dialog shown to accountants when they try to upload without
 * selecting a client. Prevents critical errors.
 */

import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ClientValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectClient: () => void;
}

export function ClientValidationDialog({
  open,
  onOpenChange,
  onSelectClient,
}: ClientValidationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Cliente Não Selecionado
          </DialogTitle>
          <DialogDescription>
            Tem de selecionar um cliente antes de fazer upload de faturas.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sem seleção de cliente, as faturas serão associadas à sua própria
            conta, o que pode causar problemas de contabilidade.
          </AlertDescription>
        </Alert>

        <div className="mt-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            Por favor, selecione um cliente no dropdown no topo da página antes
            de continuar.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onSelectClient();
            }}
          >
            Selecionar Cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
