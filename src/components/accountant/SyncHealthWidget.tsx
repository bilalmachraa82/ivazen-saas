import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { useSyncHealth } from '@/hooks/useSyncHealth';

const ERROR_LABELS: Record<string, string> = {
  auth_failed: 'Autenticação',
  timeout: 'Timeout',
  network: 'Rede',
  no_credentials: 'Sem credenciais',
  year_future: 'Ano futuro',
  other: 'Outro',
};

export function SyncHealthWidget() {
  const { data, isLoading, error } = useSyncHealth();
  const [expanded, setExpanded] = useState(false);

  if (error) return null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const rate = data.success_rate;
  const variant: 'success' | 'warning' | 'destructive' =
    rate >= 95 ? 'success' : rate >= 80 ? 'warning' : 'destructive';

  const statusColor =
    variant === 'success'
      ? 'text-green-600 dark:text-green-400'
      : variant === 'warning'
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';

  const errorEntries = Object.entries(data.error_breakdown || {});
  const hasErrors = errorEntries.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Saúde do Sync AT
          </CardTitle>
          <Badge variant={variant}>
            {rate}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taxa de sucesso (24h)</span>
            <span className={`font-medium ${statusColor}`}>{data.completed_24h}/{data.total_syncs_24h}</span>
          </div>
          <Progress value={rate} className="h-2" />
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Em curso</p>
                  <p className="text-lg font-semibold">{data.currently_processing}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Jobs pendentes ou em processamento</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Retry
                  </p>
                  <p className="text-lg font-semibold">{data.pending_retries}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Jobs com retry pendente</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> DLQ
                  </p>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">{data.dead_letter_count}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Dead Letter Queue — erros permanentes sem retry</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Expandable error breakdown */}
        {(hasErrors || data.last_automation_run) && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              <span className="text-xs">
                {hasErrors ? `${data.errors_24h} erros nas últimas 24h` : 'Detalhes'}
              </span>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>

            {expanded && (
              <div className="mt-2 space-y-3">
                {hasErrors && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Erros por tipo</p>
                    {errorEntries
                      .sort(([, a], [, b]) => b - a)
                      .map(([reason, count]) => (
                        <div key={reason} className="flex items-center justify-between text-sm">
                          <span>{ERROR_LABELS[reason] || reason}</span>
                          <Badge variant="outline" className="text-xs">{count}</Badge>
                        </div>
                      ))}
                  </div>
                )}

                {data.credentials_with_failures > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Credenciais com falhas</span>
                    <Badge variant="warning">{data.credentials_with_failures}</Badge>
                  </div>
                )}

                {data.avg_duration_ms > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Duração média
                    </span>
                    <span className="font-medium">
                      {data.avg_duration_ms > 1000
                        ? `${(data.avg_duration_ms / 1000).toFixed(1)}s`
                        : `${data.avg_duration_ms}ms`}
                    </span>
                  </div>
                )}

                {data.last_automation_run && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Última execução automática: {data.last_automation_run.slot} —{' '}
                    {new Date(data.last_automation_run.local_time).toLocaleString('pt-PT')} —{' '}
                    {data.last_automation_run.total_jobs} jobs
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
