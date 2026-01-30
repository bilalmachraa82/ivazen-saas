import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface QRInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (qrContent: string) => void;
  isProcessing?: boolean;
  imagePreview?: string;
}

export function QRInputDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isProcessing,
  imagePreview 
}: QRInputDialogProps) {
  const [qrContent, setQrContent] = useState('');

  const handleSubmit = () => {
    if (qrContent.trim()) {
      onSubmit(qrContent.trim());
    }
  };

  const handleClose = () => {
    setQrContent('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Introduzir QR Code</DialogTitle>
          <DialogDescription>
            Cole o conteúdo do QR code da factura para processar automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {imagePreview && (
            <div className="rounded-lg overflow-hidden bg-muted">
              <img 
                src={imagePreview} 
                alt="Factura" 
                className="w-full max-h-48 object-contain"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="qr-content">Conteúdo do QR Code</Label>
            <Textarea
              id="qr-content"
              placeholder="A:123456789*B:999999990*C:PT*D:FS*E:N*F:20240115*..."
              value={qrContent}
              onChange={(e) => setQrContent(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Formato: campos separados por * (ex: A:NIF*B:NIF*...)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!qrContent.trim() || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A processar...
              </>
            ) : (
              'Processar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
