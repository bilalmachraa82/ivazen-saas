import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ZenListProps {
  children: ReactNode;
  className?: string;
}

export function ZenList({ children, className }: ZenListProps) {
  return (
    <ul className={cn('space-y-3 text-sm text-muted-foreground', className)}>
      {children}
    </ul>
  );
}

interface ZenListItemProps {
  children: ReactNode;
  variant?: 'success' | 'primary' | 'warning' | 'muted';
  icon?: 'check' | 'dot' | 'number';
  number?: number;
  className?: string;
}

const variantStyles = {
  success: 'bg-green-500/20 text-green-500',
  primary: 'bg-primary/20 text-primary',
  warning: 'bg-warning/20 text-warning',
  muted: 'bg-muted text-muted-foreground',
};

const iconContent = {
  check: '✓',
  dot: '•',
  number: '',
};

export function ZenListItem({
  children,
  variant = 'success',
  icon = 'check',
  number,
  className,
}: ZenListItemProps) {
  return (
    <li
      className={cn(
        'flex items-start gap-3 hover:text-foreground transition-colors duration-300',
        className
      )}
    >
      <span
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
          variantStyles[variant]
        )}
      >
        {icon === 'number' ? number : iconContent[icon]}
      </span>
      <span>{children}</span>
    </li>
  );
}
