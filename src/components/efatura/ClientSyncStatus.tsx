/**
 * Client Sync Status Component
 * Badge/card showing sync status for a client
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

export type SyncStatus = 'synced' | 'pending' | 'error' | 'never' | 'syncing';

interface ClientSyncStatusProps {
  status: SyncStatus;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
  compact?: boolean;
}

export function ClientSyncStatus({
  status,
  lastSyncAt,
  lastSyncError,
  onSync,
  isSyncing,
  compact = false,
}: ClientSyncStatusProps) {
  const effectiveStatus = isSyncing ? 'syncing' : status;

  const getStatusConfig = () => {
    switch (effectiveStatus) {
      case 'synced':
        return {
          icon: CheckCircle2,
          label: 'Sincronizado',
          variant: 'default' as const,
          className: 'bg-green-600',
        };
      case 'pending':
        return {
          icon: Clock,
          label: 'Pendente',
          variant: 'outline' as const,
          className: 'text-amber-600 border-amber-300',
        };
      case 'error':
        return {
          icon: XCircle,
          label: 'Erro',
          variant: 'destructive' as const,
          className: '',
        };
      case 'never':
        return {
          icon: Clock,
          label: 'Nunca sincronizado',
          variant: 'secondary' as const,
          className: '',
        };
      case 'syncing':
        return {
          icon: Loader2,
          label: 'A sincronizar...',
          variant: 'outline' as const,
          className: 'text-primary border-primary',
        };
      default:
        return {
          icon: AlertTriangle,
          label: 'Desconhecido',
          variant: 'outline' as const,
          className: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const timeAgo = lastSyncAt
    ? formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: pt })
    : null;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant={config.variant} className={cn('gap-1', config.className)}>
            <Icon className={cn('h-3 w-3', effectiveStatus === 'syncing' && 'animate-spin')} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {timeAgo && <p>Última sync: {timeAgo}</p>}
          {lastSyncError && <p className="text-destructive">{lastSyncError}</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn(
        'p-2 rounded-full',
        effectiveStatus === 'synced' && 'bg-green-100 text-green-600',
        effectiveStatus === 'pending' && 'bg-amber-100 text-amber-600',
        effectiveStatus === 'error' && 'bg-red-100 text-red-600',
        effectiveStatus === 'never' && 'bg-gray-100 text-gray-600',
        effectiveStatus === 'syncing' && 'bg-primary/10 text-primary',
      )}>
        <Icon className={cn('h-5 w-5', effectiveStatus === 'syncing' && 'animate-spin')} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{config.label}</p>
        {timeAgo && (
          <p className="text-xs text-muted-foreground truncate">{timeAgo}</p>
        )}
        {lastSyncError && effectiveStatus === 'error' && (
          <p className="text-xs text-destructive truncate">{lastSyncError}</p>
        )}
      </div>

      {onSync && effectiveStatus !== 'syncing' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSync}
          disabled={isSyncing}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Helper to derive status from AT credentials
export function deriveSyncStatus(
  lastSyncStatus?: string | null,
  hasCredentials?: boolean
): SyncStatus {
  if (!hasCredentials) return 'never';
  
  switch (lastSyncStatus) {
    case 'success':
      return 'synced';
    case 'error':
      return 'error';
    case 'partial':
      return 'pending';
    case 'never':
      return 'never';
    default:
      return 'pending';
  }
}
