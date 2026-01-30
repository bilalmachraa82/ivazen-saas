import { Sparkles, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZenDecorationsProps {
  variant?: 'default' | 'minimal';
  className?: string;
}

export function ZenDecorations({ variant = 'default', className }: ZenDecorationsProps) {
  if (variant === 'minimal') {
    return (
      <div className={cn('absolute top-0 right-0 opacity-5 animate-zen-float pointer-events-none', className)}>
        <Sparkles className="h-40 w-40 text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className={cn('absolute top-0 right-0 opacity-5 animate-zen-float pointer-events-none', className)}>
        <Sparkles className="h-40 w-40 text-primary" />
      </div>
      <div className="absolute bottom-40 left-0 opacity-5 animate-zen-float-delayed pointer-events-none">
        <Leaf className="h-32 w-32 text-primary" />
      </div>
    </>
  );
}

interface ZenFloatingIconProps {
  icon: React.ElementType;
  position?: 'top-right' | 'bottom-left' | 'top-left' | 'bottom-right';
  size?: 'sm' | 'md' | 'lg';
  delayed?: boolean;
  className?: string;
}

const positionClasses = {
  'top-right': 'top-0 right-0',
  'bottom-left': 'bottom-20 left-0',
  'top-left': 'top-0 left-0',
  'bottom-right': 'bottom-20 right-0',
};

const sizeClasses = {
  sm: 'h-24 w-24',
  md: 'h-32 w-32',
  lg: 'h-40 w-40',
};

export function ZenFloatingIcon({
  icon: Icon,
  position = 'top-right',
  size = 'lg',
  delayed = false,
  className,
}: ZenFloatingIconProps) {
  return (
    <div
      className={cn(
        'absolute opacity-5 pointer-events-none',
        positionClasses[position],
        delayed ? 'animate-zen-float-delayed' : 'animate-zen-float',
        className
      )}
    >
      <Icon className={cn(sizeClasses[size], 'text-primary')} />
    </div>
  );
}
