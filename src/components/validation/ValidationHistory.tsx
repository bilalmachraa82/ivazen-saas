import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  CheckCircle,
  XCircle,
  Pencil,
  RefreshCw,
  Plus,
  ArrowRight,
  History,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  ValidationLogEntry,
  ValidationLogChange,
  getFieldDisplayName,
  getActionDisplayName,
  formatValueForDisplay,
} from '@/hooks/useValidationHistory';
import { cn } from '@/lib/utils';

interface ValidationHistoryProps {
  history: ValidationLogEntry[];
  loading: boolean;
  error?: string | null;
  className?: string;
}

// Get icon for action type
function getActionIcon(action: ValidationLogEntry['action']) {
  switch (action) {
    case 'validated':
      return CheckCircle;
    case 'rejected':
      return XCircle;
    case 'edited':
      return Pencil;
    case 'classification_changed':
      return RefreshCw;
    case 'created':
      return Plus;
    default:
      return History;
  }
}

// Get badge variant for action type
function getActionBadgeVariant(action: ValidationLogEntry['action']): 'success' | 'destructive' | 'secondary' | 'warning' | 'default' {
  switch (action) {
    case 'validated':
      return 'success';
    case 'rejected':
      return 'destructive';
    case 'edited':
      return 'secondary';
    case 'classification_changed':
      return 'warning';
    case 'created':
      return 'default';
    default:
      return 'secondary';
  }
}

// Get color classes for action type
function getActionColorClasses(action: ValidationLogEntry['action']) {
  switch (action) {
    case 'validated':
      return {
        dot: 'bg-success',
        icon: 'text-success',
        bg: 'bg-success/10',
      };
    case 'rejected':
      return {
        dot: 'bg-destructive',
        icon: 'text-destructive',
        bg: 'bg-destructive/10',
      };
    case 'edited':
      return {
        dot: 'bg-blue-500',
        icon: 'text-blue-500',
        bg: 'bg-blue-500/10',
      };
    case 'classification_changed':
      return {
        dot: 'bg-warning',
        icon: 'text-warning',
        bg: 'bg-warning/10',
      };
    case 'created':
      return {
        dot: 'bg-muted-foreground',
        icon: 'text-muted-foreground',
        bg: 'bg-muted',
      };
    default:
      return {
        dot: 'bg-muted-foreground',
        icon: 'text-muted-foreground',
        bg: 'bg-muted',
      };
  }
}

// User Avatar component
function UserAvatar({ name, email }: { name?: string; email?: string }) {
  const initials = useMemo(() => {
    if (name) {
      const parts = name.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return '??';
  }, [name, email]);

  return (
    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
      {initials}
    </div>
  );
}

// Single change item
function ChangeItem({ change }: { change: ValidationLogChange }) {
  const fieldName = getFieldDisplayName(change.field);
  const oldValue = formatValueForDisplay(change.field, change.old_value);
  const newValue = formatValueForDisplay(change.field, change.new_value);

  return (
    <div className="text-xs flex items-center gap-1.5 flex-wrap">
      <span className="font-medium text-muted-foreground">{fieldName}:</span>
      <span className="text-muted-foreground line-through">{oldValue}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="font-medium">{newValue}</span>
    </div>
  );
}

// Timeline entry component
function TimelineEntry({
  entry,
  isLast,
}: {
  entry: ValidationLogEntry;
  isLast: boolean;
}) {
  const Icon = getActionIcon(entry.action);
  const colors = getActionColorClasses(entry.action);
  const badgeVariant = getActionBadgeVariant(entry.action);
  const actionName = getActionDisplayName(entry.action);

  const displayName = entry.user_name || entry.user_email || 'Utilizador';
  const timeAgo = formatDistanceToNow(new Date(entry.created_at), {
    addSuffix: true,
    locale: pt,
  });
  const exactTime = format(new Date(entry.created_at), "dd/MM/yyyy 'as' HH:mm", {
    locale: pt,
  });

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-10 w-px h-[calc(100%-24px)] bg-border" />
      )}

      {/* Timeline dot */}
      <div
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
          colors.bg
        )}
      >
        <Icon className={cn('h-4 w-4', colors.icon)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-6">
        <div className="flex items-start gap-3">
          <UserAvatar name={entry.user_name} email={entry.user_email} />

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{displayName}</span>
              <Badge variant={badgeVariant} className="text-xs">
                {actionName}
              </Badge>
            </div>

            {/* Timestamp */}
            <p
              className="text-xs text-muted-foreground mt-0.5"
              title={exactTime}
            >
              {timeAgo}
            </p>

            {/* Changes */}
            {entry.changes.length > 0 && (
              <div className="mt-2 p-2 rounded-md bg-muted/50 space-y-1">
                {entry.changes.map((change, i) => (
                  <ChangeItem key={i} change={change} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Empty state component
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <History className="h-6 w-6 text-muted-foreground" />
      </div>
      <h4 className="font-medium text-sm">Sem historico</h4>
      <p className="text-xs text-muted-foreground mt-1 max-w-48">
        O historico de validacoes aparecera aqui apos as primeiras alteracoes.
      </p>
    </div>
  );
}

// Loading state component
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
      <p className="text-xs text-muted-foreground">A carregar historico...</p>
    </div>
  );
}

// Error state component
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h4 className="font-medium text-sm text-destructive">Erro</h4>
      <p className="text-xs text-muted-foreground mt-1">{message}</p>
    </div>
  );
}

export function ValidationHistory({
  history,
  loading,
  error,
  className,
}: ValidationHistoryProps) {
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (history.length === 0) {
    return <EmptyState />;
  }

  return (
    <ScrollArea className={cn('h-[400px] pr-4', className)}>
      <div className="space-y-0">
        {history.map((entry, index) => (
          <TimelineEntry
            key={entry.id}
            entry={entry}
            isLast={index === history.length - 1}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

// Compact version for smaller spaces
export function ValidationHistoryCompact({
  history,
  loading,
  error,
  maxItems = 3,
}: ValidationHistoryProps & { maxItems?: number }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>A carregar...</span>
      </div>
    );
  }

  if (error || history.length === 0) {
    return null;
  }

  const displayHistory = history.slice(0, maxItems);
  const remaining = history.length - maxItems;

  return (
    <div className="space-y-2">
      {displayHistory.map((entry) => {
        const Icon = getActionIcon(entry.action);
        const colors = getActionColorClasses(entry.action);
        const timeAgo = formatDistanceToNow(new Date(entry.created_at), {
          addSuffix: true,
          locale: pt,
        });

        return (
          <div key={entry.id} className="flex items-center gap-2 text-xs">
            <Icon className={cn('h-3 w-3', colors.icon)} />
            <span className="text-muted-foreground">
              {entry.user_name || 'Utilizador'}
            </span>
            <span className="text-muted-foreground">-</span>
            <span className="text-muted-foreground">{timeAgo}</span>
          </div>
        );
      })}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          +{remaining} {remaining === 1 ? 'entrada' : 'entradas'}
        </p>
      )}
    </div>
  );
}
