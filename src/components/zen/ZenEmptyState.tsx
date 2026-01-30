import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ZenEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  variant?: 'default' | 'primary' | 'muted';
  className?: string;
}

const variantStyles = {
  default: {
    iconBg: 'from-muted to-muted/50',
    iconColor: 'text-muted-foreground/50',
    pulse: 'bg-muted/50',
  },
  primary: {
    iconBg: 'from-primary/20 to-primary/10',
    iconColor: 'text-primary/50',
    pulse: 'bg-primary/10',
  },
  muted: {
    iconBg: 'from-muted/30 to-muted/20',
    iconColor: 'text-muted-foreground/30',
    pulse: 'bg-muted/30',
  },
};

export function ZenEmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: ZenEmptyStateProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn('text-center py-16', className)}>
      <div className="relative inline-block">
        {/* Zen pulse animation */}
        <div className={cn('absolute inset-0 rounded-full blur-xl animate-zen-pulse', styles.pulse)} />
        
        {/* Icon container */}
        <div className={cn(
          'relative mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-6',
          'bg-gradient-to-br shadow-lg',
          styles.iconBg
        )}>
          <Icon className={cn('h-10 w-10', styles.iconColor)} />
        </div>
      </div>

      <h3 className="text-xl font-semibold text-foreground mb-2">
        {title}
      </h3>
      
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        {description}
      </p>

      {action && (
        <Button
          onClick={action.onClick}
          variant="outline"
          className="gap-2 hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-md hover:shadow-lg"
        >
          {action.icon && <action.icon className="h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
