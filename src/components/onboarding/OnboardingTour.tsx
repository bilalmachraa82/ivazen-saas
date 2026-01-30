import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle, FileSpreadsheet, Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    icon: <Upload className="h-8 w-8 text-primary" />,
    title: 'Carregar Facturas',
    description: 'Tire uma foto ou faça upload de facturas. O código QR será lido automaticamente para extrair os dados.',
  },
  {
    icon: <CheckCircle className="h-8 w-8 text-success" />,
    title: 'Classificação IA',
    description: 'A IA classifica automaticamente cada factura. Quanto mais validar, mais precisa fica a classificação.',
  },
  {
    icon: <FileSpreadsheet className="h-8 w-8 text-warning" />,
    title: 'Validar e Exportar',
    description: 'Reveja as classificações, faça ajustes se necessário, e exporte para Excel ou SAFT-PT.',
  },
  {
    icon: <Keyboard className="h-8 w-8 text-muted-foreground" />,
    title: 'Atalhos de Teclado',
    description: 'Use Enter para validar, Esc para fechar, e ←/→ para navegar entre facturas rapidamente.',
  },
];

const STORAGE_KEY = 'raquel-onboarding-completed';

interface OnboardingTourProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ forceShow = false, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Delay showing to allow page to load
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onComplete?.();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isVisible) return null;

  const step = ONBOARDING_STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleSkip}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-muted">{step.icon}</div>
          </div>
          <CardTitle className="text-center text-xl">{step.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">{step.description}</p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {ONBOARDING_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  index === currentStep
                    ? 'bg-primary w-6'
                    : index < currentStep
                    ? 'bg-primary/50'
                    : 'bg-muted-foreground/30'
                )}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            Anterior
          </Button>
          <Button onClick={handleNext}>
            {currentStep === ONBOARDING_STEPS.length - 1 ? 'Começar' : 'Próximo'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export function useOnboarding() {
  const resetOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const isOnboardingCompleted = () => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  };

  return { resetOnboarding, isOnboardingCompleted };
}
