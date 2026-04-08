import { FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type MonthlyBreakdown, getMonthLabel } from '@/lib/ssMonthlyBreakdown';
import { SS_REVENUE_CATEGORIES, getSSCoefficient } from '@/lib/ssCoefficients';

interface SSRevenueBreakdownProps {
  monthlyBreakdown: MonthlyBreakdown;
  quarterLabel: string; // e.g. "Janeiro - Março 2026"
}

function formatAmount(value: number): string {
  return value.toFixed(2) + '€';
}

export function SSRevenueBreakdown({ monthlyBreakdown, quarterLabel }: SSRevenueBreakdownProps) {
  const monthKeys = Object.keys(monthlyBreakdown).sort();

  // Determine which categories have any revenue > 0 in any month
  const activeCategories = SS_REVENUE_CATEGORIES.filter(cat =>
    monthKeys.some(mk => (monthlyBreakdown[mk]?.[cat.value] ?? 0) > 0),
  );

  if (activeCategories.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Sem rendimentos registados para {quarterLabel}
        </CardContent>
      </Card>
    );
  }

  // Pre-compute row totals and column totals
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const cat of activeCategories) {
    let rowSum = 0;
    for (const mk of monthKeys) {
      const v = monthlyBreakdown[mk]?.[cat.value] ?? 0;
      rowSum += v;
      colTotals[mk] = (colTotals[mk] ?? 0) + v;
    }
    rowTotals[cat.value] = rowSum;
    grandTotal += rowSum;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Rendimentos por mês</CardTitle>
          <Badge variant="secondary">{quarterLabel}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Valores sem IVA (base tributável) — calculados das facturas de vendas validadas
        </p>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Categoria</TableHead>
              {monthKeys.map(mk => (
                <TableHead key={mk} className="text-right tabular-nums">
                  {getMonthLabel(mk)}
                </TableHead>
              ))}
              <TableHead className="text-right tabular-nums font-semibold">Total</TableHead>
              <TableHead className="text-right">Coef.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeCategories.map(cat => {
              const coeff = getSSCoefficient(cat.value);
              return (
                <TableRow key={cat.value}>
                  <TableCell className="pl-4 font-medium">{cat.label}</TableCell>
                  {monthKeys.map(mk => {
                    const v = monthlyBreakdown[mk]?.[cat.value] ?? 0;
                    return (
                      <TableCell key={mk} className="text-right tabular-nums">
                        {formatAmount(v)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatAmount(rowTotals[cat.value])}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{Math.round(coeff * 100)}%</Badge>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Totals row */}
            <TableRow className="border-t-2 font-bold">
              <TableCell className="pl-4">Total</TableCell>
              {monthKeys.map(mk => (
                <TableCell key={mk} className="text-right tabular-nums">
                  {formatAmount(colTotals[mk] ?? 0)}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">{formatAmount(grandTotal)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
