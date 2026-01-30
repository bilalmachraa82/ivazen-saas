import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Plus, Pencil, Trash2 } from 'lucide-react';
import { WithholdingLog, TaxWithholding } from '@/hooks/useWithholdings';

interface WithholdingHistoryProps {
  logs: WithholdingLog[];
  withholdings: TaxWithholding[];
}

export function WithholdingHistory({ logs, withholdings }: WithholdingHistoryProps) {
  const getWithholdingInfo = (withholdingId: string) => {
    const w = withholdings.find(w => w.id === withholdingId);
    return w ? `${w.beneficiary_name || w.beneficiary_nif}` : 'Retenção eliminada';
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'updated':
        return <Pencil className="h-4 w-4 text-amber-500" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'created':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Criada</Badge>;
      case 'updated':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Editada</Badge>;
      case 'deleted':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Eliminada</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatChanges = (changes: Record<string, { old: unknown; new: unknown }>) => {
    if (!changes || Object.keys(changes).length === 0) return null;

    const fieldLabels: Record<string, string> = {
      beneficiary_name: 'Nome',
      beneficiary_nif: 'NIF',
      gross_amount: 'Valor Bruto',
      withholding_amount: 'Retenção',
      withholding_rate: 'Taxa',
      payment_date: 'Data Pagamento',
      income_category: 'Categoria',
      location_code: 'Localização',
      status: 'Estado',
      notes: 'Notas',
      is_non_resident: 'Não Residente',
      country_code: 'País',
    };

    return Object.entries(changes).map(([key, { old, new: newVal }]) => (
      <div key={key} className="text-xs text-muted-foreground">
        <span className="font-medium">{fieldLabels[key] || key}:</span>{' '}
        <span className="line-through text-destructive/70">
          {old?.toString() || '(vazio)'}
        </span>
        {' → '}
        <span className="text-green-600">
          {newVal?.toString() || '(vazio)'}
        </span>
      </div>
    ));
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Alterações
          </CardTitle>
          <CardDescription>
            Registo de todas as alterações nas retenções
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Ainda não existem alterações registadas.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Alterações
        </CardTitle>
        <CardDescription>
          Últimas {logs.length} alterações nas retenções
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="p-2 rounded-full bg-background border">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getActionBadge(log.action)}
                    <span className="text-sm font-medium truncate">
                      {getWithholdingInfo(log.withholding_id)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                  </p>
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="mt-2 pl-2 border-l-2 border-muted-foreground/20 space-y-1">
                      {formatChanges(log.changes)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
