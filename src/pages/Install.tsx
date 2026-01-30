import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimateOnScroll } from "@/hooks/useScrollAnimation";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { 
  Download,
  Smartphone,
  Share,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  ArrowLeft,
  Wifi,
  WifiOff,
  Zap,
  Bell,
  Leaf,
  Clock,
  Chrome,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

import logoIcon from "@/assets/logo-icon.png";

const Install = () => {
  const navigate = useNavigate();
  const { 
    isInstalled, 
    isIOS, 
    isAndroid, 
    canInstall, 
    browser, 
    promptInstall,
    remindLater 
  } = usePWAInstall();
  const [activeStep, setActiveStep] = useState(0);

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      toast.success("App instalada com sucesso!", {
        description: "Já podes aceder ao IVAzen a partir do ecrã inicial.",
      });
    }
  };

  const handleRemindLater = () => {
    remindLater();
    toast("Vamos lembrar-te amanhã!", {
      description: "Receberás uma notificação para instalar a app.",
    });
    navigate(-1);
  };

  const getBrowserName = () => {
    switch (browser.name) {
      case 'chrome': return 'Chrome';
      case 'safari': return 'Safari';
      case 'firefox': return 'Firefox';
      case 'edge': return 'Edge';
      case 'samsung': return 'Samsung Internet';
      case 'opera': return 'Opera';
      default: return 'o teu navegador';
    }
  };

  const getBrowserIcon = () => {
    switch (browser.name) {
      case 'chrome': return Chrome;
      case 'safari': return Globe;
      case 'firefox': return Globe;
      case 'edge': return Globe;
      default: return Globe;
    }
  };

  const BrowserIcon = getBrowserIcon();

  const benefits = [
    {
      icon: Zap,
      title: "Acesso Instantâneo",
      description: "Abre diretamente do ecrã inicial, sem navegador"
    },
    {
      icon: WifiOff,
      title: "Funciona Offline",
      description: "Captura faturas mesmo sem internet"
    },
    {
      icon: Bell,
      title: "Notificações",
      description: "Recebe alertas sobre prazos e atualizações"
    }
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img 
              src={logoIcon} 
              alt="IVAzen" 
              className="h-8 w-8 transition-transform duration-500 group-hover:rotate-12"
            />
            <span className="font-semibold text-lg text-foreground">IVAzen</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/auth">
              <Button size="sm" className="zen-button">
                Entrar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 relative overflow-hidden">
        {/* Zen background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-zen-float" />
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-success/5 rounded-full blur-3xl animate-zen-float-delayed" />
        </div>

        <div className="container mx-auto max-w-2xl relative">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="mb-8 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm mb-6 animate-fade-in">
              <Leaf className="h-4 w-4" />
              <span>Experiência otimizada</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 animate-slide-up">
              Instala a App IVAzen
            </h1>
            <p className="text-lg text-muted-foreground animate-fade-in animation-delay-200">
              Acede mais rapidamente e desfruta de funcionalidades exclusivas
            </p>
          </div>

          {/* Installation status */}
          {isInstalled ? (
            <AnimateOnScroll animation="scale">
              <Card className="p-8 text-center border-success/50 bg-success/5">
                <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  App Instalada!
                </h2>
                <p className="text-muted-foreground mb-6">
                  O IVAzen já está no teu dispositivo. Abre a partir do ecrã inicial.
                </p>
                <Link to="/dashboard">
                  <Button className="zen-button">
                    Ir para o Dashboard
                  </Button>
                </Link>
              </Card>
            </AnimateOnScroll>
          ) : canInstall ? (
            <AnimateOnScroll animation="fade-up">
              <Card className="p-8 text-center border-primary/30 bg-card">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-zen-pulse">
                  <Download className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Instalação Rápida
                </h2>
                <p className="text-muted-foreground mb-4">
                  O {getBrowserName()} permite instalação com 1 clique!
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-success mb-6">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Instalação com 1 clique disponível</span>
                </div>
                <div className="flex flex-col gap-3">
                  <Button size="lg" onClick={handleInstall} className="zen-button gap-2">
                    <Download className="h-5 w-5" />
                    Instalar Agora
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRemindLater}
                    className="text-muted-foreground gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Lembrar mais tarde
                  </Button>
                </div>
              </Card>
            </AnimateOnScroll>
          ) : (
            <div className="space-y-8">
              {/* Browser detection info */}
              <AnimateOnScroll animation="fade-up">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-secondary/30">
                  <BrowserIcon className="h-4 w-4" />
                  <span>A usar {getBrowserName()}</span>
                  {!browser.supportsOneClick && (
                    <span className="text-warning">• Instalação manual necessária</span>
                  )}
                </div>
              </AnimateOnScroll>

              {/* iOS Instructions */}
              {isIOS && (
                <AnimateOnScroll animation="fade-up">
                  <Card className="p-6 border-border/50">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <Smartphone className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          Instalar no iPhone/iPad
                        </h3>
                        <p className="text-sm text-muted-foreground">Safari requer 3 passos simples</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <InteractiveStep 
                        number={1}
                        icon={Share}
                        title="Toca no botão Partilhar"
                        description="Na barra inferior do Safari, procura o ícone quadrado com seta para cima"
                        hint="O ícone está normalmente ao centro da barra de navegação"
                        isActive={activeStep === 0}
                        onClick={() => setActiveStep(0)}
                      />
                      <InteractiveStep 
                        number={2}
                        icon={PlusSquare}
                        title="Adicionar ao Ecrã Principal"
                        description="Desliza para baixo na lista e seleciona 'Adicionar ao ecrã principal'"
                        hint="Pode ser necessário deslizar para ver esta opção"
                        isActive={activeStep === 1}
                        onClick={() => setActiveStep(1)}
                      />
                      <InteractiveStep 
                        number={3}
                        icon={CheckCircle2}
                        title="Confirma a instalação"
                        description="Toca em 'Adicionar' no canto superior direito"
                        hint="A app aparecerá no teu ecrã inicial!"
                        isActive={activeStep === 2}
                        onClick={() => setActiveStep(2)}
                      />
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/30">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemindLater}
                        className="w-full text-muted-foreground gap-2"
                      >
                        <Clock className="h-4 w-4" />
                        Lembrar mais tarde
                      </Button>
                    </div>
                  </Card>
                </AnimateOnScroll>
              )}

              {/* Android Instructions */}
              {isAndroid && !canInstall && (
                <AnimateOnScroll animation="fade-up">
                  <Card className="p-6 border-border/50">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <Smartphone className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          Instalar no Android
                        </h3>
                        <p className="text-sm text-muted-foreground">3 passos rápidos</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <InteractiveStep 
                        number={1}
                        icon={MoreVertical}
                        title="Abre o menu do Chrome"
                        description="Toca nos 3 pontos no canto superior direito"
                        hint="Podes também ver um banner 'Adicionar ao ecrã' na parte inferior"
                        isActive={activeStep === 0}
                        onClick={() => setActiveStep(0)}
                      />
                      <InteractiveStep 
                        number={2}
                        icon={PlusSquare}
                        title="Adicionar ao ecrã principal"
                        description="Seleciona 'Instalar app' ou 'Adicionar ao ecrã principal'"
                        hint="A opção pode ter nomes ligeiramente diferentes"
                        isActive={activeStep === 1}
                        onClick={() => setActiveStep(1)}
                      />
                      <InteractiveStep 
                        number={3}
                        icon={CheckCircle2}
                        title="Confirma a instalação"
                        description="Toca em 'Instalar' para concluir"
                        hint="A app será instalada como uma app nativa!"
                        isActive={activeStep === 2}
                        onClick={() => setActiveStep(2)}
                      />
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/30">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemindLater}
                        className="w-full text-muted-foreground gap-2"
                      >
                        <Clock className="h-4 w-4" />
                        Lembrar mais tarde
                      </Button>
                    </div>
                  </Card>
                </AnimateOnScroll>
              )}

              {/* Generic Instructions */}
              {!isIOS && !isAndroid && (
                <AnimateOnScroll animation="fade-up">
                  <Card className="p-6 border-border/50">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <Wifi className="h-5 w-5 text-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Instalar no teu dispositivo
                      </h3>
                    </div>
                    
                    <p className="text-muted-foreground mb-4">
                      Para instalar o IVAzen, procura a opção "Instalar" ou "Adicionar ao ecrã principal" 
                      no menu do {getBrowserName()}.
                    </p>
                    
                    <div className="p-4 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
                      <strong className="text-foreground">Dica:</strong> No Chrome, procura o ícone de instalação 
                      na barra de endereços ou no menu (⋮).
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/30">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemindLater}
                        className="w-full text-muted-foreground gap-2"
                      >
                        <Clock className="h-4 w-4" />
                        Lembrar mais tarde
                      </Button>
                    </div>
                  </Card>
                </AnimateOnScroll>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-4xl">
          <AnimateOnScroll animation="fade-up">
            <h2 className="text-2xl font-bold text-foreground text-center mb-12">
              Vantagens da App
            </h2>
          </AnimateOnScroll>

          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <AnimateOnScroll key={index} animation="fade-up" delay={index * 100}>
                <Card className="p-6 text-center border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Continue in browser */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-md text-center">
          <AnimateOnScroll animation="fade-up">
            <p className="text-muted-foreground mb-4">
              Preferes continuar no navegador?
            </p>
            <Link to="/auth">
              <Button variant="outline" className="zen-button-outline">
                Continuar no Browser
              </Button>
            </Link>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50 bg-secondary/20">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={logoIcon} alt="IVAzen" className="h-5 w-5" />
              <span className="text-sm text-muted-foreground">IVAzen</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} IVAzen
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Interactive step component with active state
const InteractiveStep = ({ 
  number, 
  icon: Icon, 
  title, 
  description,
  hint,
  isActive,
  onClick,
}: { 
  number: number; 
  icon: React.ElementType; 
  title: string; 
  description: string;
  hint?: string;
  isActive?: boolean;
  onClick?: () => void;
}) => (
  <div 
    className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
      isActive 
        ? 'border-primary bg-primary/5 shadow-md' 
        : 'border-border/50 bg-secondary/30 hover:border-primary/30'
    }`}
    onClick={onClick}
  >
    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
      isActive 
        ? 'bg-primary text-primary-foreground' 
        : 'bg-secondary text-muted-foreground'
    }`}>
      {number}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <h4 className="font-medium text-foreground">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {isActive && hint && (
        <p className="text-xs text-primary mt-2 font-medium animate-fade-in">
          💡 {hint}
        </p>
      )}
    </div>
  </div>
);

// Simple install step for non-interactive version
const InstallStep = ({ 
  number, 
  icon: Icon, 
  title, 
  description 
}: { 
  number: number; 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) => (
  <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 transition-colors hover:bg-secondary/50">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
      {number}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="font-medium text-foreground">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

export default Install;
