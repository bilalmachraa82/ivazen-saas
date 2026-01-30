import { Sparkles, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZenLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  variant?: 'spinner' | 'dots' | 'pulse';
  className?: string;
  fullScreen?: boolean;
}

const sizeStyles = {
  sm: {
    container: 'w-8 h-8',
    icon: 'h-3 w-3',
    border: 'border-2',
    text: 'text-xs',
  },
  md: {
    container: 'w-16 h-16',
    icon: 'h-6 w-6',
    border: 'border-4',
    text: 'text-sm',
  },
  lg: {
    container: 'w-24 h-24',
    icon: 'h-10 w-10',
    border: 'border-4',
    text: 'text-base',
  },
};

export function ZenLoader({
  size = 'md',
  text,
  variant = 'spinner',
  className,
  fullScreen = false,
}: ZenLoaderProps) {
  const styles = sizeStyles[size];

  const content = (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {variant === 'spinner' && (
        <div className="relative">
          <div 
            className={cn(
              'rounded-full border-primary/30 border-t-primary border-r-accent animate-spin shadow-glow',
              styles.container,
              styles.border
            )} 
          />
          <Sparkles 
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-premium-pulse',
              styles.icon
            )} 
          />
        </div>
      )}

      {variant === 'dots' && (
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'rounded-full gradient-rose animate-bounce shadow-glow',
                size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
              )}
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      )}

      {variant === 'pulse' && (
        <div className="relative">
          <div 
            className={cn(
              'rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 animate-premium-pulse shadow-glow',
              styles.container
            )} 
          />
          <Leaf 
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-premium-float',
              styles.icon
            )} 
          />
        </div>
      )}

      {text && (
        <p className={cn('text-muted-foreground animate-pulse', styles.text)}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {content}
      </div>
    );
  }

  return content;
}

// Skeleton variants for different content types
interface ZenSkeletonProps {
  variant?: 'card' | 'text' | 'avatar' | 'button';
  className?: string;
  lines?: number;
}

export function ZenSkeleton({ variant = 'text', className, lines = 1 }: ZenSkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={cn('rounded-xl bg-gradient-to-br from-muted/30 via-card/50 to-primary/5 animate-pulse border border-primary/10 backdrop-blur-sm', className)}>
        <div className="p-6 space-y-4">
          <div className="h-4 bg-gradient-to-r from-primary/20 to-primary/10 rounded w-1/3" />
          <div className="space-y-2">
            <div className="h-3 bg-muted/50 rounded w-full" />
            <div className="h-3 bg-muted/30 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div className={cn('rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-muted/30 animate-pulse shadow-glow', className)} />
    );
  }

  if (variant === 'button') {
    return (
      <div className={cn('h-10 rounded-lg bg-gradient-to-br from-primary/20 via-accent/10 to-muted/30 animate-pulse', className)} />
    );
  }

  // Text variant
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gradient-to-r from-primary/20 via-muted/30 to-primary/10 rounded animate-pulse"
          style={{ 
            width: i === lines - 1 && lines > 1 ? '60%' : '100%',
            animationDelay: `${i * 100}ms`
          }}
        />
      ))}
    </div>
  );
}
