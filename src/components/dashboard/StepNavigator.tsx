import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Step {
  label: string;
  path: string;
}

const STEPS: Step[] = [
  { label: 'Carregar', path: '/upload' },
  { label: 'Compras', path: '/validation' },
  { label: 'Vendas', path: '/sales' },
  { label: 'Apuramento', path: '/export' },
];

interface StepNavigatorProps {
  currentStep: number; // 0-indexed: 0=Upload, 1=Compras, 2=Vendas, 3=Apuramento
}

export function StepNavigator({ currentStep }: StepNavigatorProps) {
  const navigate = useNavigate();
  const prev = currentStep > 0 ? STEPS[currentStep - 1] : null;
  const next = currentStep < STEPS.length - 1 ? STEPS[currentStep + 1] : null;

  return (
    <div className="flex items-center justify-between pt-6 mt-6 border-t border-border/50">
      {/* Step indicator */}
      <div className="hidden sm:flex items-center gap-1.5">
        {STEPS.map((step, i) => (
          <button
            key={step.path}
            onClick={() => navigate(step.path)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              i === currentStep
                ? 'bg-primary text-primary-foreground'
                : i < currentStep
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border border-current/30">
              {i + 1}
            </span>
            {step.label}
          </button>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-3 ml-auto">
        {prev && (
          <Button
            variant="outline"
            onClick={() => navigate(prev.path)}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {prev.label}
          </Button>
        )}
        {next && (
          <Button
            onClick={() => navigate(next.path)}
            className="gap-2"
          >
            {next.label}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
