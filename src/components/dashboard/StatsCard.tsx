import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend,
  variant = 'default' 
}: StatsCardProps) {
  const variantStyles = {
    default: 'bg-card/80 border-border/50',
    primary: 'bg-primary/5 border-primary/20',
    success: 'bg-success/5 border-success/20',
    warning: 'bg-warning/5 border-warning/20',
  };

  const iconStyles = {
    default: 'bg-gradient-to-br from-muted to-muted/50 text-muted-foreground',
    primary: 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary',
    success: 'bg-gradient-to-br from-success/20 to-success/5 text-success',
    warning: 'bg-gradient-to-br from-warning/20 to-warning/5 text-warning',
  };

  const accentColors = {
    default: 'via-muted-foreground/30',
    primary: 'via-primary/50',
    success: 'via-success/50',
    warning: 'via-warning/50',
  };

  return (
    <Card className={cn(
      'border backdrop-blur-sm overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5', 
      variantStyles[variant]
    )}>
      <div className={cn(
        'absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent to-transparent',
        accentColors[variant]
      )} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                "inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full",
                trend.isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </div>
            )}
          </div>
          <div className={cn(
            'p-3 rounded-xl group-hover:scale-110 transition-transform duration-300', 
            iconStyles[variant]
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
