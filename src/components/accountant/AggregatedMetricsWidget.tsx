import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Calculator, 
  Receipt, 
  Shield, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Euro
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  full_name: string;
  company_name?: string | null;
  nif?: string | null;
  pending_invoices?: number;
  validated_invoices?: number;
  ssStatus?: string;
  ssContribution?: number;
}

interface Invoice {
  id: string;
  client_id: string;
  status?: string | null;
  total_amount: number;
  total_vat?: number | null;
  final_deductibility?: number | null;
  document_date: string;
}

interface AggregatedMetricsWidgetProps {
  clients: Client[];
  invoices: Invoice[];
  isLoading?: boolean;
}

export function AggregatedMetricsWidget({ 
  clients, 
  invoices,
  isLoading 
}: AggregatedMetricsWidgetProps) {
  const metrics = useMemo(() => {
    // Total VAT calculation from validated invoices
    const validatedInvoices = invoices.filter(inv => inv.status === 'validated');
    const totalVatDeductible = validatedInvoices.reduce((sum, inv) => {
      const vat = inv.total_vat || 0;
      const deductibility = (inv.final_deductibility || 0) / 100;
      return sum + (vat * deductibility);
    }, 0);

    // Total invoice amounts
    const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);

    // Pending invoices per client
    const clientPendingMap = new Map<string, number>();
    invoices.filter(inv => inv.status === 'classified').forEach(inv => {
      const count = clientPendingMap.get(inv.client_id) || 0;
      clientPendingMap.set(inv.client_id, count + 1);
    });

    // Clients with pending invoices
    const clientsWithPending = clients.filter(c => (clientPendingMap.get(c.id) || 0) > 0);

    // SS declarations pending
    const ssPending = clients.filter(c => c.ssStatus !== 'submitted').length;
    const ssTotalContributions = clients.reduce((sum, c) => sum + (c.ssContribution || 0), 0);

    // Validation progress
    const totalPending = invoices.filter(inv => inv.status === 'classified').length;
    const totalValidated = validatedInvoices.length;
    const validationProgress = invoices.length > 0 
      ? Math.round((totalValidated / invoices.length) * 100) 
      : 100;

    return {
      totalClients: clients.length,
      totalInvoices: invoices.length,
      totalVatDeductible,
      totalInvoiceAmount,
      totalPending,
      totalValidated,
      validationProgress,
      ssPending,
      ssTotalContributions,
      clientsWithPending,
      clientPendingMap,
    };
  }, [clients, invoices]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Resumo Agregado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasUrgentItems = metrics.totalPending > 0 || metrics.ssPending > 0;

  return (
    <Card className={cn(
      "transition-all",
      hasUrgentItems && "border-warning/50 shadow-warning/10 shadow-md"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Resumo Agregado
            </CardTitle>
            <CardDescription>
              Métricas consolidadas de {metrics.totalClients} cliente{metrics.totalClients !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          {hasUrgentItems && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Atenção
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* IVA Total */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 dark:bg-green-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/20">
              <Euro className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">IVA Total Dedutível</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(metrics.totalVatDeductible)}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-600/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {metrics.totalValidated} validadas
          </Badge>
        </div>

        {/* SS Pending */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg",
          metrics.ssPending > 0 ? "bg-blue-500/10 dark:bg-blue-500/5" : "bg-muted/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              metrics.ssPending > 0 ? "bg-blue-500/20" : "bg-muted"
            )}>
              <Shield className={cn(
                "h-4 w-4",
                metrics.ssPending > 0 ? "text-blue-600" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Segurança Social Pendente</p>
              <p className={cn(
                "text-lg font-bold",
                metrics.ssPending > 0 ? "text-blue-600" : "text-muted-foreground"
              )}>
                {metrics.ssPending} declaraç{metrics.ssPending !== 1 ? 'ões' : 'ão'}
              </p>
            </div>
          </div>
          {metrics.ssTotalContributions > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-semibold text-blue-600">
                {formatCurrency(metrics.ssTotalContributions)}
              </p>
            </div>
          )}
        </div>

        {/* Invoices Pending Validation */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg",
          metrics.totalPending > 0 ? "bg-yellow-500/10 dark:bg-yellow-500/5" : "bg-muted/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              metrics.totalPending > 0 ? "bg-yellow-500/20" : "bg-muted"
            )}>
              <Clock className={cn(
                "h-4 w-4",
                metrics.totalPending > 0 ? "text-yellow-600" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Facturas a Validar</p>
              <p className={cn(
                "text-lg font-bold",
                metrics.totalPending > 0 ? "text-yellow-600" : "text-muted-foreground"
              )}>
                {metrics.totalPending} factura{metrics.totalPending !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Clientes</p>
            <p className="text-sm font-semibold">
              {metrics.clientsWithPending.length}
            </p>
          </div>
        </div>

        <Separator />

        {/* Validation Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso de Validação</span>
            <span className="font-medium">{metrics.validationProgress}%</span>
          </div>
          <Progress value={metrics.validationProgress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{metrics.totalValidated} validadas</span>
            <span>{metrics.totalInvoices} total</span>
          </div>
        </div>

        {/* Clients with pending invoices breakdown */}
        {metrics.clientsWithPending.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Clientes com Pendentes
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {metrics.clientsWithPending.slice(0, 5).map(client => (
                  <div 
                    key={client.id} 
                    className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                  >
                    <span className="truncate max-w-[200px]">
                      {client.company_name || client.full_name}
                    </span>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600/30">
                      {metrics.clientPendingMap.get(client.id) || 0}
                    </Badge>
                  </div>
                ))}
                {metrics.clientsWithPending.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{metrics.clientsWithPending.length - 5} mais clientes
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Total Volume */}
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Volume Total Facturado</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(metrics.totalInvoiceAmount)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
