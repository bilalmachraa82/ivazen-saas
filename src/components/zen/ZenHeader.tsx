import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZenHeaderProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  className?: string;
}

export function ZenHeader({ title, description, icon: Icon, className }: ZenHeaderProps) {
  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
