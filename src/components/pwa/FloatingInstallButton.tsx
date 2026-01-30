import { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { InstallModal } from './InstallModal';

export function FloatingInstallButton() {
  const { 
    showFloatingButton, 
    isIOS, 
    canInstall, 
    promptInstall, 
    dismissFloatingButton 
  } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (!showFloatingButton) return null;

  const handleClick = async () => {
    if (canInstall) {
      const installed = await promptInstall();
      if (!installed) {
        // If user dismissed native prompt, show modal with more info
        setShowModal(true);
      }
    } else {
      // iOS or browser doesn't support one-click install
      setShowModal(true);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 animate-fade-in">
        {/* Dismiss button */}
        <button
          onClick={dismissFloatingButton}
          className="w-8 h-8 rounded-full bg-secondary/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary spring-hover spring-active"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Main install button */}
        <button
          onClick={handleClick}
          className="group flex items-center gap-3 px-5 py-3 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 fab-spring"
        >
          <div className="relative">
            <Smartphone className="h-5 w-5 icon-wiggle-group" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" />
          </div>
          <span className="font-medium text-sm">
            {canInstall ? 'Instalar App' : 'Instalar'}
          </span>
          <Download className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity icon-spring-group" />
        </button>
      </div>

      <InstallModal 
        open={showModal} 
        onOpenChange={setShowModal}
        onInstallClick={canInstall ? promptInstall : undefined}
      />
    </>
  );
}
