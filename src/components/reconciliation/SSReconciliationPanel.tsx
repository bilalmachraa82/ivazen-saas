import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ZenEmptyState, ZenSkeleton } from '@/components/zen';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface SSReconciliationPanelProps {
  clientId: string;
  fiscalYear: number;
  quarter: number;
  rangeStart: string;
  rangeEnd: string;
}

const fmt = (n: number) => `€${Number(n).toFixed(2)}`;

export function SSReconciliationPanel({ clientId, fiscalYear, quarter, rangeStart, rangeEnd }: SSReconciliationPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['ss-reconciliation', clientId, fiscalYear, quarter],
    queryFn: async () => {
      const [salesRes, ssRes, allQuartersRes] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select('total_amount, revenue_category, document_type, status')
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd),
        supabase
          .from('ss_declarations')
          .select('total_revenue, status, period_quarter, contribution_amount')
          .eq('client_id', clientId)
          .eq('period_quarter', `${fiscalYear}-Q${quarter}`)
          .maybeSingle(),
        supabase
          .from('ss_declarations')
          .select('period_quarter, total_revenue, status, contribution_amount')
          .eq('client_id', clientId)
          .like('period_quarter', `${fiscalYear}-%`)
          .order('period_quarter'),
      ]);

      const salesRows = salesRes.data || [];
      const totalSalesRevenue = salesRows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
      const recibosVerdes = salesRows.filter(r => r.document_type === 'FR' || r.document_type === 'FS');
      const recibosRevenue = recibosVerdes.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
      const pendingClassification = salesRows.filter(r => !r.revenue_category).length;

      const declaration = ssRes.data;
      const declaredRevenue = declaration?.total_revenue ?? null;
      const delta = declaredRevenue != null ? totalSalesRevenue - declaredRevenue : null;

      return {
        totalSalesRevenue,
        recibosRevenue,
        salesCount: salesRows.length,
        recibosCount: recibosVerdes.length,
        pendingClassification,
        declaredRevenue,
        declarationStatus: declaration?.status ?? null,
        contributionAmount: declaration?.contribution_amount ?? null,
        delta,
        quarterDeclarations: (allQuartersRes.data || []) as Array<{
          period_quarter: string;
          total_revenue: number;
          status: string;
          contribution_amount: number | null;
        }>,
      };
    },
    enabled: !!clientId,
  });

  if (isLoading) return <ZenSkeleton className="h-48 w-full" />;

  if (!data || (data.salesCount === 0 && data.declaredRevenue == null)) {
    return (
      <ZenEmptyState
        icon={CheckCircle}
        title="Sem dados para o período"
        description={`Nenhuma venda registada nem declaração SS para ${fiscalYear} Q${quarter}.`}
      />
    );
  }

  const deltaAbs = data.delta != null ? Math.abs(data.delta) : 0;
  const hasWarning = data.delta != null && deltaAbs > 1;
  const hasDanger = data.delta != null && deltaAbs > 100;

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{data.salesCount} vendas no período</Badge>
        {data.recibosCount > 0 && (
          <Badge variant="secondary">{data.recibosCount} recibos verdes</Badge>
        )}
        {data.pendingClassification > 0 && (
          <Badge variant="warning">{data.pendingClassification} sem categoria</Badge>
        )}
        {data.declaredRevenue == null && (
          <Badge variant="warning">Sem declaração SS</Badge>
        )}
        {data.delta != null && deltaAbs <= 1 && (
          <Badge className="bg-green-100 text-green-800">Alinhado</Badge>
        )}
        {hasWarning && !hasDanger && (
          <Badge variant="warning">Delta: {fmt(deltaAbs)}</Badge>
        )}
        {hasDanger && (
          <Badge variant="destructive">Delta: {fmt(deltaAbs)}</Badge>
        )}
      </div>

      {/* Comparison card */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-medium">Comparação Q{quarter} {fiscalYear}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Receita total de vendas</p>
            <p className="text-lg font-semibold">{fmt(data.totalSalesRevenue)}</p>
            {data.recibosRevenue > 0 && data.recibosRevenue !== data.totalSalesRevenue && (
              <p className="text-xs text-muted-foreground">
                Recibos verdes: {fmt(data.recibosRevenue)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Receita declarada SS</p>
            {data.declaredRevenue != null ? (
              <>
                <p className="text-lg font-semibold">{fmt(data.declaredRevenue)}</p>
                {data.contributionAmount != null && (
                  <p className="text-xs text-muted-foreground">
                    Contribuição: {fmt(data.contributionAmount)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-lg font-semibold text-muted-foreground">—</p>
            )}
          </div>
        </div>
        {data.delta != null && (
          <div className={`flex items-center gap-2 text-sm ${hasDanger ? 'text-red-600' : hasWarning ? 'text-amber-600' : 'text-green-600'}`}>
            {hasDanger || hasWarning ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            <span>
              {deltaAbs <= 1
                ? 'Receita vendas alinhada com declaração SS'
                : `Diferença de ${fmt(deltaAbs)} entre vendas e declaração SS`}
            </span>
          </div>
        )}
      </div>

      {/* Quarterly breakdown */}
      {data.quarterDeclarations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Declarações SS {fiscalYear}</h4>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trimestre</TableHead>
                  <TableHead className="text-right">Receita Declarada</TableHead>
                  <TableHead className="text-right">Contribuição</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.quarterDeclarations.map(d => (
                  <TableRow key={d.period_quarter}>
                    <TableCell className="font-medium">{d.period_quarter}</TableCell>
                    <TableCell className="text-right">{fmt(d.total_revenue)}</TableCell>
                    <TableCell className="text-right">
                      {d.contribution_amount != null ? fmt(d.contribution_amount) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{d.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
