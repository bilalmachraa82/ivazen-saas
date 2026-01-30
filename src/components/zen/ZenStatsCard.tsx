import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ZenStatsCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'primary';
  animationDelay?: string;
  className?: string;
}

const variantStyles = {
  default: {
    iconBg: 'gradient-rose',
    iconColor: 'text-white',
    glowClass: 'shadow-glow-rose',
    hoverGlow: 'hover:shadow-glow-rose',
  },
  success: {
    iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
    iconColor: 'text-white',
    glowClass: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]',
  },
  warning: {
    iconBg: 'bg-gradient-to-br from-warning to-orange-500',
    iconColor: 'text-white',
    glowClass: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(251,191,36,0.4)]',
  },
  primary: {
    iconBg: 'gradient-rose',
    iconColor: 'text-white',
    glowClass: 'shadow-glow-rose',
    hoverGlow: 'hover:shadow-glow-rose-lg',
  },
};

export function ZenStatsCard({
  icon: Icon,
  value,
  label,
  variant = 'default',
  animationDelay,
  className,
}: ZenStatsCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        'relative overflow-hidden glass-stats spring-card-hover group',
        styles.hoverGlow,
        'hover:border-primary/30',
        className
      )}
      style={animationDelay ? { animationDelay } : undefined}
    >
      {/* Glass shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />

      {/* Zen circle decoration - glow rosa */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700 blur-sm" />

      <CardContent className="relative pt-6">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'p-3 rounded-xl transition-all duration-300 group-hover:scale-110 icon-spring-group',
              styles.iconBg,
              styles.glowClass
            )}
          >
            <Icon className={cn('h-5 w-5', styles.iconColor)} />
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
