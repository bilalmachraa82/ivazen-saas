import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type MonthlyBreakdown, getMonthLabel } from '@/lib/ssMonthlyBreakdown';
import { getSSCoefficient } from '@/lib/ssCoefficients';
import { getVisibleSSRevenueCategories } from '@/lib/socialSecurityViewState';

interface SSRevenueBreakdownProps {
  monthlyBreakdown: MonthlyBreakdown;
  autoMonthlyBreakdown?: MonthlyBreakdown;
  quarterLabel: string;
  detectedCategory?: string | null;
  onCellSave?: (category: string, monthKey: string, value: number) => void | Promise<void>;
  isReadOnly?: boolean;
}

interface EditingCell {
  category: string;
  monthKey: string;
}

function formatAmount(value: number): string {
  return value.toFixed(2) + '€';
}

export function SSRevenueBreakdown({
  monthlyBreakdown,
  autoMonthlyBreakdown = {},
  quarterLabel,
  detectedCategory = null,
  onCellSave,
  isReadOnly = false,
}: SSRevenueBreakdownProps) {
  const monthKeys = Object.keys(monthlyBreakdown).sort();
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);

  const activeCategories = getVisibleSSRevenueCategories(monthlyBreakdown, detectedCategory);

  if (activeCategories.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Sem rendimentos registados para {quarterLabel}
        </CardContent>
      </Card>
    );
  }

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

  const startEditing = (category: string, monthKey: string, currentValue: number) => {
    if (!onCellSave || isReadOnly) return;
    setEditingCell({ category, monthKey });
    setDraftValue(currentValue.toFixed(2));
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setDraftValue('');
  };

  const commitEditingCell = async () => {
    if (!editingCell || !onCellSave || savingCellKey) return;

    const normalized = draftValue.replace(',', '.').trim();
    const nextValue = Number(normalized);
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      toast.error('Introduza um valor mensal válido');
      return;
    }

    const cellKey = `${editingCell.category}:${editingCell.monthKey}`;
    setSavingCellKey(cellKey);

    try {
      await onCellSave(editingCell.category, editingCell.monthKey, nextValue);
      cancelEditing();
    } catch {
      // The caller surfaces the actual failure reason.
    } finally {
      setSavingCellKey(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Rendimentos por mês</CardTitle>
          <Badge variant="secondary">{quarterLabel}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Valores sem IVA (base tributável) — calculados das facturas de vendas validadas
        </p>
        {onCellSave && !isReadOnly && (
          <p className="text-xs text-muted-foreground">
            Clique num valor para corrigir o total mensal. Não é permitido baixar abaixo do valor automático das facturas.
          </p>
        )}
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
                    const value = monthlyBreakdown[mk]?.[cat.value] ?? 0;
                    const autoValue = autoMonthlyBreakdown?.[mk]?.[cat.value] ?? 0;
                    const isEditing =
                      editingCell?.category === cat.value && editingCell?.monthKey === mk;
                    const cellKey = `${cat.value}:${mk}`;

                    return (
                      <TableCell key={mk} className="text-right tabular-nums">
                        {isEditing ? (
                          <Input
                            autoFocus
                            type="number"
                            min={autoValue}
                            step="0.01"
                            value={draftValue}
                            disabled={savingCellKey === cellKey}
                            onChange={event => setDraftValue(event.target.value)}
                            onBlur={() => void commitEditingCell()}
                            onKeyDown={event => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void commitEditingCell();
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                cancelEditing();
                              }
                            }}
                            className="ml-auto h-8 w-28 text-right tabular-nums"
                          />
                        ) : (
                          <button
                            type="button"
                            className="w-full rounded px-1 py-1 text-right transition hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
                            disabled={!onCellSave || isReadOnly}
                            onClick={() => startEditing(cat.value, mk, value)}
                            title={
                              onCellSave && !isReadOnly
                                ? `Editar ${getMonthLabel(mk)} (${formatAmount(value)})`
                                : undefined
                            }
                          >
                            {formatAmount(value)}
                          </button>
                        )}
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
