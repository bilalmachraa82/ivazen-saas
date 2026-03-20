import { useNavigate } from 'react-router-dom';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZenCard } from '@/components/zen';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface AttentionItemsProps {
  pendingValidation: number;
  lowConfidence: number;
  /** Optional overdue deadline count */
  overdueDeadlines?: number;
  documentLabel?: 'facturas' | 'compras';
  querySuffix?: string;
}

interface AttentionItem {
  id: string;
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  severity: 'warning' | 'destructive' | 'default';
  route: string;
  actionLabel: string;
}

export function AttentionItems({
  pendingValidation,
  lowConfidence,
  overdueDeadlines = 0,
  documentLabel = 'facturas',
  querySuffix = '',
}: AttentionItemsProps) {
  const navigate = useNavigate();
  const isPurchaseMode = documentLabel === 'compras';
  const buildRoute = (basePath: string, params?: Record<string, string>) => {
    const search = new URLSearchParams(querySuffix.startsWith('?') ? querySuffix.slice(1) : querySuffix);
    Object.entries(params ?? {}).forEach(([key, value]) => search.set(key, value));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const items: AttentionItem[] = [];

  if (pendingValidation > 0) {
    items.push({
      id: 'pending',
      icon: Clock,
      label: isPurchaseMode ? 'Compras por rever' : 'Facturas por rever',
      count: pendingValidation,
      severity: pendingValidation > 10 ? 'destructive' : 'warning',
      route: buildRoute('/validation', { status: 'open' }),
      actionLabel: 'Rever',
    });
  }

  if (lowConfidence > 0) {
    items.push({
      id: 'low-confidence',
      icon: AlertTriangle,
      label: isPurchaseMode ? 'Compras com baixa confiança' : 'Classificações com baixa confiança',
      count: lowConfidence,
      severity: 'warning',
      route: buildRoute('/validation', { review: 'needs_review' }),
      actionLabel: 'Rever',
    });
  }

  if (overdueDeadlines > 0) {
    items.push({
      id: 'deadlines',
      icon: AlertCircle,
      label: 'Prazos fiscais vencidos',
      count: overdueDeadlines,
      severity: 'destructive',
      route: '/reports',
      actionLabel: 'Ver prazos',
    });
  }

  const totalItems = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <ZenCard withLine animationDelay="350ms">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-warning/20 to-warning/10">
            {totalItems > 0 ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <Sparkles className="h-5 w-5 text-success" />
            )}
          </div>
          {totalItems > 0 ? 'Itens que Precisam de Atenção' : 'Tudo em Dia!'}
          {totalItems > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {totalItems}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-success/5 border border-success/20">
            <CheckCircle className="h-5 w-5 text-success shrink-0" />
            <p className="text-sm text-muted-foreground">
              Sem itens pendentes. Todas as {documentLabel} estão validadas e os prazos em dia.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all group"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${
                    item.severity === 'destructive'
                      ? 'bg-destructive/10'
                      : 'bg-warning/10'
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      item.severity === 'destructive'
                        ? 'text-destructive'
                        : 'text-warning'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                  </div>
                  <Badge variant={item.severity === 'destructive' ? 'destructive' : 'secondary'}>
                    {item.count}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => navigate(item.route)}
                  >
                    {item.actionLabel}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </ZenCard>
  );
}
