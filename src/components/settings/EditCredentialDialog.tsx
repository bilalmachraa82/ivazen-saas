import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useImportCredentials } from '@/hooks/useATCredentials';

interface EditCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientNif: string;
  clientName?: string;
  onSuccess?: () => void;
}

export function EditCredentialDialog({
  open,
  onOpenChange,
  clientNif,
  clientName,
  onSuccess,
}: EditCredentialDialogProps) {
  const [password, setPassword] = useState('');
  const importCredentials = useImportCredentials();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      toast.error('Introduza a password do Portal AT');
      return;
    }

    try {
      await importCredentials.mutateAsync([
        {
          nif: clientNif,
          portal_password: password.trim(),
          full_name: clientName,
        },
      ]);
      toast.success('Credenciais AT atualizadas');
      setPassword('');
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error toast handled by the hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Credenciais AT
          </DialogTitle>
          <DialogDescription>
            Atualize a password do Portal das Finanças para{' '}
            {clientName || clientNif}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>NIF</Label>
            <Input value={clientNif} disabled className="font-mono" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="at-password">Password Portal AT</Label>
            <Input
              id="at-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Introduza a password"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={importCredentials.isPending || !password.trim()}
              className="zen-button"
            >
              {importCredentials.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
