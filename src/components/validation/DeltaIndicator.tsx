/**
 * Delta Indicator Component
 * Visual badge for showing delta status (✅/⚠️/❌)
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/reconciliationEngine';

export type DeltaStatus = 'perfect' | 'tolerance' | 'warning' | 'error';

interface DeltaIndicatorProps {
  delta: number;
  tolerance?: number;
  showValue?: boolean;
  compact?: boolean;
  className?: string;
}

function getDeltaStatus(delta: number, tolerance: number): DeltaStatus {
  if (delta === 0) return 'perfect';
  if (delta <= tolerance) return 'tolerance';
  if (delta <= 1) return 'warning';
  return 'error';
}

const STATUS_CONFIG = {
  perfect: {
    icon: CheckCircle2,
    label: 'Perfeito',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-300 dark:border-green-700',
  },
  tolerance: {
    icon: CheckCircle2,
    label: 'Dentro da tolerância',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-600 dark:text-green-500',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Pequena diferença',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-700 dark:text-amber-400',
    borderColor: 'border-amber-300 dark:border-amber-700',
  },
  error: {
    icon: XCircle,
    label: 'Discrepância',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-300 dark:border-red-700',
  },
};

export function DeltaIndicator({ 
  delta, 
  tolerance = 0.01, 
  showValue = true,
  compact = false,
  className 
}: DeltaIndicatorProps) {
  const status = getDeltaStatus(delta, tolerance);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  const content = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-mono',
        config.bgColor,
        config.textColor,
        config.borderColor,
        compact ? 'text-xs px-1.5 py-0' : 'text-sm',
        className
      )}
    >
      <Icon className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-4 w-4')} />
      {showValue && (
        <span>
          {delta === 0 ? '€0.00' : formatCurrency(delta)}
        </span>
      )}
    </Badge>
  );
  
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
          <p className="font-mono text-xs">{formatCurrency(delta)}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return content;
}

// Summary variant for totals
interface DeltaSummaryProps {
  label: string;
  excelValue: number;
  systemValue: number;
  tolerance?: number;
  className?: string;
}

export function DeltaSummary({ 
  label, 
  excelValue, 
  systemValue, 
  tolerance = 0.01,
  className 
}: DeltaSummaryProps) {
  const delta = Math.abs(excelValue - systemValue);
  const status = getDeltaStatus(delta, tolerance);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  return (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-lg border',
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Excel: {formatCurrency(excelValue)}</span>
          <span>Sistema: {formatCurrency(systemValue)}</span>
        </div>
      </div>
      <div className={cn('flex items-center gap-2', config.textColor)}>
        <Icon className="h-5 w-5" />
        <span className="font-mono font-medium">
          {formatCurrency(delta)}
        </span>
      </div>
    </div>
  );
}

// Zero Delta badge for final result
interface ZeroDeltaBadgeProps {
  isZeroDelta: boolean;
  className?: string;
}

export function ZeroDeltaBadge({ isZeroDelta, className }: ZeroDeltaBadgeProps) {
  if (isZeroDelta) {
    return (
      <Badge 
        className={cn(
          'gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-base',
          className
        )}
      >
        <CheckCircle2 className="h-5 w-5" />
        Zero Delta ✓
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="destructive"
      className={cn('gap-2 px-4 py-2 text-base', className)}
    >
      <XCircle className="h-5 w-5" />
      Discrepâncias Detectadas
    </Badge>
  );
}
