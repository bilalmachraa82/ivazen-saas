import { ReactNode, MouseEventHandler } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface ZenCardProps {
  children: ReactNode;
  className?: string;
  gradient?: 'default' | 'primary' | 'success' | 'warning' | 'muted';
  variant?: 'default' | 'glass' | 'glass-premium';
  withLine?: boolean;
  withCircle?: boolean;
  hoverScale?: boolean;
  animationDelay?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

const gradientMap = {
  default: 'from-card/80 via-card/60 to-primary/5',
  primary: 'from-primary/10 via-primary/5 to-background',
  success: 'from-green-500/10 via-primary/5 to-background',
  warning: 'from-warning/10 via-warning/5 to-background',
  muted: 'from-muted/30 via-background to-primary/5',
};

const variantStyles = {
  default: 'border border-primary/10 shadow-lg backdrop-blur-md',
  glass: 'glass-card border-0',
  'glass-premium': 'glass-premium border-0',
};

export function ZenCard({
  children,
  className,
  gradient = 'default',
  variant = 'default',
  withLine = false,
  withCircle = false,
  hoverScale = false,
  animationDelay,
  onClick,
}: ZenCardProps) {
  const isGlassVariant = variant === 'glass' || variant === 'glass-premium';

  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        variantStyles[variant],
        // Only apply gradient for default variant
        !isGlassVariant && `bg-gradient-to-br ${gradientMap[gradient]}`,
        // Glass variants get special dark mode handling
        isGlassVariant && 'dark:glass-card-dark',
        hoverScale && 'spring-card-hover hover:shadow-glow-rose hover:border-primary/20 group cursor-pointer',
        !hoverScale && 'transition-all duration-500',
        className
      )}
      style={animationDelay ? { animationDelay } : undefined}
      onClick={onClick}
    >
      {/* Zen line decoration - rosa premium */}
      {withLine && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-accent to-transparent" />
      )}

      {/* Zen circle decoration - glow rosa */}
      {withCircle && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700 blur-sm" />
      )}

      {/* Glass shimmer effect */}
      {isGlassVariant && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none" />
      )}

      {children}
    </Card>
  );
}

interface ZenCardHeaderProps {
  title: string;
  icon?: LucideIcon;
  className?: string;
}

export function ZenCardHeader({ title, icon: Icon, className }: ZenCardHeaderProps) {
  return (
    <CardHeader className={cn('relative', className)}>
      <CardTitle className="text-lg flex items-center gap-3 group/header">
        {Icon && (
          <div className="p-2 rounded-xl gradient-rose shadow-glow icon-spring-hover">
            <Icon className="h-5 w-5 text-white" />
          </div>
        )}
        <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">{title}</span>
      </CardTitle>
    </CardHeader>
  );
}

export { CardContent as ZenCardContent };
