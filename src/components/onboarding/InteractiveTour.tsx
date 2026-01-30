import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  CheckCircle, 
  FileText, 
  Settings,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  icon: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  spotlightPadding?: number;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="stats-grid"]',
    title: 'Estatísticas Rápidas',
    description: 'Veja o resumo das suas facturas: total, pendentes, validadas e com baixa confiança da IA.',
    icon: <FileText className="h-5 w-5" />,
    position: 'bottom',
  },
  {
    target: '[data-tour="new-invoice"]',
    title: 'Carregar Factura',
    description: 'Clique aqui para digitalizar uma nova factura. Use a câmara para ler o código QR automaticamente.',
    icon: <Upload className="h-5 w-5" />,
    position: 'bottom',
  },
  {
    target: '[data-tour="quick-actions"]',
    title: 'Ações Rápidas',
    description: 'Acesso directo às funcionalidades principais: carregar, validar e exportar facturas.',
    icon: <CheckCircle className="h-5 w-5" />,
    position: 'top',
  },
  {
    target: '[data-tour="nav-validation"]',
    title: 'Validar Classificações',
    description: 'Reveja as classificações feitas pela IA. Quanto mais validar, mais precisa fica!',
    icon: <Sparkles className="h-5 w-5" />,
    position: 'right',
  },
  {
    target: '[data-tour="nav-settings"]',
    title: 'Configurações',
    description: 'Configure a sua chave API Gemini para activar a classificação automática por IA.',
    icon: <Settings className="h-5 w-5" />,
    position: 'right',
  },
];

const STORAGE_KEY = 'ivazen-interactive-tour-completed';

interface InteractiveTourProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function InteractiveTour({ forceShow = false, onComplete }: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightPosition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const updateSpotlight = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    const element = document.querySelector(step.target);
    if (!element) {
      // Element not found, try next step
      if (currentStep < TOUR_STEPS.length - 1) {
        setCurrentStep(s => s + 1);
      }
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = step.spotlightPadding ?? 8;

    setSpotlight({
      top: rect.top - padding + window.scrollY,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate tooltip position
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const margin = 16;
    
    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = rect.top - tooltipHeight - margin + window.scrollY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + margin + window.scrollY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
        left = rect.left - tooltipWidth - margin;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
        left = rect.right + margin;
        break;
      default:
        top = rect.bottom + margin + window.scrollY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
    }

    // Keep tooltip within viewport
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));
    top = Math.max(margin, top);

    setTooltipPosition({ top, left });
  }, [currentStep]);

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      setCurrentStep(0);
      return;
    }

    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Delay to allow DOM to render
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  useEffect(() => {
    if (!isVisible) return;

    updateSpotlight();

    const handleResize = () => updateSpotlight();
    const handleScroll = () => updateSpotlight();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isVisible, currentStep, updateSpotlight]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleComplete();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, currentStep]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onComplete?.();
  };

  if (!isVisible || !spotlight) return null;

  const step = TOUR_STEPS[currentStep];

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Tour interactivo">
      {/* Overlay with cutout */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ height: document.documentElement.scrollHeight }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.left}
              y={spotlight.top}
              width={spotlight.width}
              height={spotlight.height}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
          className="pointer-events-auto"
          onClick={handleNext}
        />
      </svg>

      {/* Spotlight border glow */}
      <div
        className="absolute rounded-xl border-2 border-primary shadow-lg shadow-primary/30 pointer-events-none animate-pulse"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
        }}
      />

      {/* Tooltip */}
      <Card
        className="absolute w-80 shadow-2xl border-primary/20 animate-scale-in z-[101]"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {step.icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <span className="text-xs text-muted-foreground">
                  Passo {currentStep + 1} de {TOUR_STEPS.length}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 -mr-2 -mt-1"
              onClick={handleComplete}
              aria-label="Fechar tour"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4">
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {TOUR_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  index === currentStep
                    ? 'w-6 bg-primary'
                    : index < currentStep
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-muted-foreground/30'
                )}
                aria-label={`Ir para passo ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1"
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Começar' : 'Próximo'}
              {currentStep < TOUR_STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>

          {/* Keyboard hint */}
          <p className="text-[10px] text-center text-muted-foreground/60 mt-3">
            Use ← → para navegar, Esc para sair
          </p>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}

export function useInteractiveTour() {
  const resetTour = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const isTourCompleted = () => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  };

  return { resetTour, isTourCompleted };
}
