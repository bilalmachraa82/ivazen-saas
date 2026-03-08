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
  auth_failed: 'Autenticação AT',
  decrypt_failed: 'Desencriptação',
  timeout: 'Timeout',
  connector_down: 'Connector indisponível',
  network: 'Rede',
  no_credentials: 'Sem credenciais',
  portal_csrf: 'Portal AT (CSRF)',
  year_future: 'Ano futuro',
  time_window: 'Fora da janela AT',
  other: 'Outro',
};

// Semantic grouping: helps accountants distinguish what's actionable vs expected
const ERROR_GROUPS: Record<string, { label: string; keys: string[] }> = {
  config: { label: 'Configuração', keys: ['no_credentials', 'auth_failed', 'decrypt_failed'] },
  platform: { label: 'Plataforma', keys: ['timeout', 'connector_down', 'network'] },
  at_expected: { label: 'AT (esperado)', keys: ['time_window', 'year_future'] },
  channel: { label: 'Canal indisponível', keys: ['portal_csrf'] },
  other: { label: 'Outro', keys: ['other'] },
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
                  <div className="space-y-3">
                    {Object.entries(ERROR_GROUPS).map(([groupKey, group]) => {
                      const groupErrors = errorEntries.filter(([key]) => group.keys.includes(key));
                      if (groupErrors.length === 0) return null;
                      const groupTotal = groupErrors.reduce((sum, [, c]) => sum + c, 0);
                      return (
                        <div key={groupKey} className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                            <span>{group.label}</span>
                            <span className="text-xs">{groupTotal}</span>
                          </p>
                          {groupErrors
                            .sort(([, a], [, b]) => b - a)
                            .map(([reason, count]) => (
                              <div key={reason} className="flex items-center justify-between text-sm pl-2">
                                <span className="text-muted-foreground">{ERROR_LABELS[reason] || reason}</span>
                                <Badge variant="outline" className="text-xs">{count}</Badge>
                              </div>
                            ))}
                        </div>
                      );
                    })}
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

                {data.history_summary_7d && data.history_summary_7d.total > 0 && (
                  <div className="space-y-1.5 border-t pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Histórico 7 dias (SOAP)</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Taxa SOAP (success+partial)</span>
                      <Badge variant={data.history_summary_7d.api_success_rate >= 80 ? 'outline' : 'warning'}>
                        {data.history_summary_7d.api_success_rate}%
                      </Badge>
                    </div>
                    {data.history_summary_7d.portal_errors > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Portal (inoperável)</span>
                        <Badge variant="destructive" className="text-xs">{data.history_summary_7d.portal_errors} erros</Badge>
                      </div>
                    )}
                    {data.history_summary_7d.stuck_running > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Jobs stuck</span>
                        <Badge variant="warning" className="text-xs">{data.history_summary_7d.stuck_running}</Badge>
                      </div>
                    )}
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
