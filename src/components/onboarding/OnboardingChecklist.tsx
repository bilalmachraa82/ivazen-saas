/**
 * OnboardingChecklist Component
 *
 * Interactive checklist widget shown on the Dashboard to guide new users
 * through the initial setup and key features of the application.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, ChevronDown, ChevronUp, PartyPopper } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useAccountant } from '@/hooks/useAccountant';
import { getOnboardingSteps, calculateProgress, isOnboardingComplete } from '@/lib/onboardingSteps';
import { cn } from '@/lib/utils';

export function OnboardingChecklist() {
  const { isAccountant } = useAccountant();
  const { completedSteps, isLoading, completeStep, dismissOnboarding, isDismissed } = useOnboardingProgress();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  const steps = getOnboardingSteps(isAccountant);
  const progress = calculateProgress(completedSteps, steps);
  const isComplete = isOnboardingComplete(completedSteps, steps);

  // Show confetti when completing onboarding
  useEffect(() => {
    if (isComplete && progress === 100) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [isComplete, progress]);

  // Don't render if dismissed or loading
  if (isDismissed || isLoading) {
    return null;
  }

  // Hide if complete
  if (isComplete) {
    return null;
  }

  const requiredSteps = steps.filter(step => !step.optional);
  const completedRequired = requiredSteps.filter(step => completedSteps.includes(step.id)).length;

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {showConfetti && <PartyPopper className="h-5 w-5 inline mr-2 text-primary animate-bounce" />}
                Comece Aqui
              </CardTitle>
              <Badge variant="outline" className="font-normal">
                {completedRequired}/{requiredSteps.length}
              </Badge>
            </div>
            <CardDescription className="mt-1">
              Complete estes passos para começar a usar a plataforma
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={dismissOnboarding}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Progress value={progress} className="h-2 mt-3" />
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.id);
            const StepIcon = step.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-all',
                  isCompleted
                    ? 'bg-success/5 border-success/20'
                    : 'bg-card border-border hover:border-primary/30'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center h-8 w-8 rounded-full shrink-0 mt-0.5',
                    isCompleted
                      ? 'bg-success text-success-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4
                      className={cn(
                        'font-medium text-sm',
                        isCompleted && 'line-through text-muted-foreground'
                      )}
                    >
                      {step.title}
                    </h4>
                    {step.optional && (
                      <Badge variant="secondary" className="text-xs">
                        Opcional
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {step.description}
                  </p>
                  {!isCompleted && (
                    <Link to={step.action.href}>
                      <Button size="sm" variant="outline" className="h-8">
                        {step.action.label}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {isComplete && (
            <div className="text-center pt-2">
              <p className="text-sm text-success font-medium">
                🎉 Parabéns! Completou a configuração inicial.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
