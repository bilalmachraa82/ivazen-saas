import { Copy, ExternalLink, CheckCircle, Euro } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MonthlyBreakdown, getMonthLabel } from '@/lib/ssMonthlyBreakdown';
import { SS_REVENUE_CATEGORIES } from '@/lib/ssCoefficients';

interface SSCalculationSummaryProps {
  totals: { total: number; relevantIncome: number };
  contributionBase: number;
  contributionAmount: number;
  contributionRate: number;
  variationPercent: number;
  onVariationChange: (percent: number) => void;
  isExempt: boolean;
  exemptReason: string;
  quarterLabel: string;
  clientName: string;
  clientNif: string;
  monthlyBreakdown: MonthlyBreakdown;
  onMarkSubmitted: () => void;
  isSubmittedLocked: boolean;
  isSaving: boolean;
}

function buildClipboardText(
  quarterLabel: string,
  clientName: string,
  clientNif: string,
  monthlyBreakdown: MonthlyBreakdown,
  variationPercent: number,
  contributionAmount: number,
): string {
  const lines: string[] = [
    `Declaração Trimestral SS — ${quarterLabel}`,
    `Cliente: ${clientName} (NIF ${clientNif})`,
    '',
  ];

  const monthKeys = Object.keys(monthlyBreakdown).sort();

  for (const category of SS_REVENUE_CATEGORIES) {
    // Check if this category has any amounts across all months
    const hasData = monthKeys.some(
      mk => (monthlyBreakdown[mk]?.[category.value] ?? 0) !== 0,
    );
    if (!hasData) continue;

    lines.push(`${category.label}:`);
    for (const mk of monthKeys) {
      const amount = monthlyBreakdown[mk]?.[category.value] ?? 0;
      lines.push(`  ${getMonthLabel(mk)}: ${amount.toFixed(2)} EUR`);
    }
    lines.push('');
  }

  lines.push(`Variação: ${variationPercent}%`);
  lines.push(`Contribuição mensal prevista: ${contributionAmount.toFixed(2)} EUR`);

  return lines.join('\n');
}

export function SSCalculationSummary({
  contributionBase,
  contributionAmount,
  contributionRate,
  variationPercent,
  onVariationChange,
  isExempt,
  exemptReason,
  quarterLabel,
  clientName,
  clientNif,
  monthlyBreakdown,
  totals,
  onMarkSubmitted,
  isSubmittedLocked,
  isSaving,
}: SSCalculationSummaryProps) {
  if (isExempt) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/30">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-900 dark:text-emerald-100">Contribuição isenta</p>
            {exemptReason && (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{exemptReason}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCopy = async () => {
    const text = buildClipboardText(
      quarterLabel,
      clientName,
      clientNif,
      monthlyBreakdown,
      variationPercent,
      contributionAmount,
    );
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado para a área de transferência');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const handleOpenSS = () => {
    window.open('https://app.seg-social.pt/', '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <CardContent className="p-4">
        {/* Calculation grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Rendimento relevante */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rendimento relevante
            </span>
            <span className="tabular-nums text-sm font-semibold text-foreground">
              {totals.relevantIncome.toFixed(2)} €
            </span>
          </div>

          {/* Base incidência */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Base incidência
            </span>
            <span className="tabular-nums text-sm font-semibold text-foreground">
              {contributionBase.toFixed(2)} €
            </span>
          </div>

          {/* Variação */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Variação
            </span>
            <Select
              value={String(variationPercent)}
              onValueChange={val => onVariationChange(Number(val))}
              disabled={isSubmittedLocked}
            >
              <SelectTrigger className="h-8 w-32 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-25">-25%</SelectItem>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="25">+25%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contribuição mensal — headline KPI, full width */}
        <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 dark:border-primary/30 dark:bg-primary/10">
          <span className="text-sm font-medium text-muted-foreground">
            Contribuição / mês
          </span>
          <div className="flex items-baseline gap-1.5">
            <Euro className="mb-0.5 h-5 w-5 shrink-0 text-primary" />
            <span className="tabular-nums text-2xl font-bold text-primary">
              {contributionAmount.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({contributionRate}%)
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-1.5 h-4 w-4" />
            Copiar para SS Directa
          </Button>

          <Button variant="outline" size="sm" onClick={handleOpenSS}>
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Abrir SS Directa
          </Button>

          <div className="ml-auto">
            {isSubmittedLocked ? (
              <Button size="sm" variant="secondary" disabled>
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Submetido
              </Button>
            ) : (
              <Button size="sm" variant="default" onClick={onMarkSubmitted} disabled={isSaving}>
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Marcar submetido
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
