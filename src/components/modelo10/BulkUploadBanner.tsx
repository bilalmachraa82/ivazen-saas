/**
 * BulkUploadBanner Component
 *
 * Informative banner shown on first visit to the Bulk Upload tab.
 * Educates users about the new bulk upload feature and its benefits.
 */

import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const BANNER_DISMISSED_KEY = 'bulk-upload-banner-dismissed';

export function BulkUploadBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    setShow(!dismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <Alert className="mb-4 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background animate-slide-down">
      <Sparkles className="h-5 w-5 text-primary" />
      <AlertTitle className="flex items-center justify-between">
        <span className="text-base font-semibold">
          🎉 Nova Funcionalidade: Upload em Massa!
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-6 w-6 p-0 hover:bg-primary/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p className="text-sm leading-relaxed">
          Pode agora processar <strong>até 50 documentos de uma vez</strong>.
          A IA extrai automaticamente todos os dados e atribui um score de
          confiança com código de cores:
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-success/10 text-success-foreground border border-success/20">
            <span className="h-2 w-2 rounded-full bg-success"></span>
            Verde (≥95%): Alta confiança
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning/10 text-warning-foreground border border-warning/20">
            <span className="h-2 w-2 rounded-full bg-warning"></span>
            Amarelo (80-94%): Rever
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 text-destructive-foreground border border-destructive/20">
            <span className="h-2 w-2 rounded-full bg-destructive"></span>
            Vermelho (&lt;80%): Atenção
          </span>
        </div>
        <p className="text-sm font-medium text-primary">
          ⚡ Poupe 70-80% do tempo vs. entrada manual!
        </p>
      </AlertDescription>
    </Alert>
  );
}
