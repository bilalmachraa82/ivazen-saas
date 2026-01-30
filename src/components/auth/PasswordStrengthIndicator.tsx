import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface StrengthCriteria {
  label: string;
  met: boolean;
}

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const criteria: StrengthCriteria[] = useMemo(() => [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { label: 'Letra maiúscula', met: /[A-Z]/.test(password) },
    { label: 'Letra minúscula', met: /[a-z]/.test(password) },
    { label: 'Número', met: /[0-9]/.test(password) },
    { label: 'Caractere especial (!@#$...)', met: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/'`~;]/.test(password) },
  ], [password]);

  const strength = useMemo(() => {
    const metCount = criteria.filter((c) => c.met).length;
    if (metCount === 0) return { level: 0, label: '', color: '' };
    if (metCount <= 2) return { level: 1, label: 'Fraca', color: 'bg-destructive' };
    if (metCount <= 3) return { level: 2, label: 'Razoável', color: 'bg-amber-500' };
    if (metCount <= 4) return { level: 3, label: 'Boa', color: 'bg-primary' };
    return { level: 4, label: 'Forte', color: 'bg-green-500' };
  }, [criteria]);

  if (!password) return null;

  return (
    <div className={cn('space-y-3 animate-fade-in', className)}>
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Força da password</span>
          <span className={cn(
            'text-xs font-medium',
            strength.level <= 1 && 'text-destructive',
            strength.level === 2 && 'text-amber-500',
            strength.level === 3 && 'text-primary',
            strength.level === 4 && 'text-green-500',
          )}>
            {strength.label}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-300',
                level <= strength.level ? strength.color : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Criteria checklist */}
      <div className="grid grid-cols-1 gap-1">
        {criteria.map((item) => (
          <div
            key={item.label}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors duration-200',
              item.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
            )}
          >
            {item.met ? (
              <Check className="h-3 w-3 flex-shrink-0" />
            ) : (
              <X className="h-3 w-3 flex-shrink-0 opacity-50" />
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
