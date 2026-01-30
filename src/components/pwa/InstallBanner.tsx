import { Link } from 'react-router-dom';
import { X, Smartphone, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function InstallBanner() {
  const { showInstallPrompt, isIOS, canInstall, promptInstall, dismissBanner } = usePWAInstall();

  if (!showInstallPrompt) return null;

  const handleInstall = async () => {
    if (canInstall) {
      await promptInstall();
    }
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20 px-4 py-3 animate-fade-in">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground">
              Instale a app no seu dispositivo
            </p>
            <p className="text-xs text-muted-foreground">
              Acesso rápido e funcionamento offline
            </p>
          </div>
          <p className="sm:hidden text-sm font-medium text-foreground">
            Instale a app
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isIOS || !canInstall ? (
            <Link to="/install">
              <Button size="sm" className="gap-2 text-xs sm:text-sm">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Ver instruções</span>
                <span className="sm:hidden">Instalar</span>
              </Button>
            </Link>
          ) : (
            <Button size="sm" className="gap-2 text-xs sm:text-sm" onClick={handleInstall}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Instalar agora</span>
              <span className="sm:hidden">Instalar</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={dismissBanner}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
