import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import {
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  MoreVertical,
  Smartphone,
  Zap,
  WifiOff,
  Bell,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface InstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstallClick?: () => Promise<boolean>;
}

export function InstallModal({ open, onOpenChange, onInstallClick }: InstallModalProps) {
  const { isIOS, isAndroid, browser, canInstall, remindLater } = usePWAInstall();
  const [step, setStep] = useState(0);

  const handleRemindLater = () => {
    remindLater();
    onOpenChange(false);
  };

  const handleInstall = async () => {
    if (onInstallClick) {
      const success = await onInstallClick();
      if (success) {
        onOpenChange(false);
      }
    }
  };

  const benefits = [
    { icon: Zap, text: 'Acesso instantâneo do ecrã inicial' },
    { icon: WifiOff, text: 'Funciona mesmo offline' },
    { icon: Bell, text: 'Notificações de prazos importantes' },
  ];

  const iosSteps = [
    {
      icon: Share,
      title: 'Toca no botão Partilhar',
      description: 'Procura o ícone na barra inferior do Safari',
      highlight: 'Ícone quadrado com seta para cima',
    },
    {
      icon: PlusSquare,
      title: 'Adicionar ao Ecrã Principal',
      description: 'Desliza para baixo na lista de opções',
      highlight: 'Pode ser necessário deslizar para ver a opção',
    },
    {
      icon: CheckCircle2,
      title: 'Confirma a instalação',
      description: 'Toca em "Adicionar" no canto superior direito',
      highlight: 'A app aparecerá no teu ecrã inicial',
    },
  ];

  const androidSteps = [
    {
      icon: MoreVertical,
      title: 'Abre o menu do Chrome',
      description: 'Toca nos 3 pontos no canto superior direito',
      highlight: 'Podes ver também um banner "Adicionar ao ecrã"',
    },
    {
      icon: PlusSquare,
      title: 'Adicionar ao ecrã principal',
      description: 'Seleciona "Instalar app" ou "Adicionar ao ecrã"',
      highlight: 'A opção pode ter nomes ligeiramente diferentes',
    },
    {
      icon: CheckCircle2,
      title: 'Confirma a instalação',
      description: 'Toca em "Instalar" para concluir',
      highlight: 'A app será instalada como uma app nativa',
    },
  ];

  const steps = isIOS ? iosSteps : androidSteps;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Smartphone className="h-5 w-5 text-primary" />
            Instalar IVAzen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* One-click install available */}
          {canInstall && onInstallClick && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center animate-zen-pulse">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Instalação Rápida</p>
                  <p className="text-sm text-muted-foreground">1 clique para instalar</p>
                </div>
              </div>
              <Button onClick={handleInstall} className="w-full zen-button gap-2">
                <Download className="h-4 w-4" />
                Instalar Agora
              </Button>
            </div>
          )}

          {/* Manual steps for iOS/browsers without one-click */}
          {(!canInstall || isIOS) && (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {isIOS 
                    ? 'O Safari requer alguns passos manuais:'
                    : browser.name === 'firefox'
                    ? 'O Firefox requer alguns passos manuais:'
                    : 'Segue estes passos para instalar:'}
                </p>
              </div>

              {/* Interactive steps */}
              <div className="space-y-3">
                {steps.map((stepItem, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                      step === index
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border/50 bg-secondary/30 hover:border-primary/30'
                    }`}
                    onClick={() => setStep(index)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                        step === index
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <stepItem.icon className={`h-4 w-4 ${step === index ? 'text-primary' : 'text-muted-foreground'}`} />
                          <h4 className="font-medium text-foreground">{stepItem.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">{stepItem.description}</p>
                        {step === index && (
                          <p className="text-xs text-primary mt-2 font-medium animate-fade-in">
                            💡 {stepItem.highlight}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Next step indicator */}
              {step < steps.length - 1 && (
                <Button
                  variant="ghost"
                  className="w-full gap-2 text-primary hover:text-primary"
                  onClick={() => setStep(step + 1)}
                >
                  Próximo passo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </>
          )}

          {/* Benefits */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm font-medium text-foreground mb-3">Vantagens da app:</p>
            <div className="space-y-2">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <benefit.icon className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{benefit.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Link to="/install" onClick={() => onOpenChange(false)}>
              <Button variant="outline" className="w-full gap-2">
                Ver instruções completas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground gap-2"
              onClick={handleRemindLater}
            >
              <Clock className="h-4 w-4" />
              Lembrar mais tarde
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
