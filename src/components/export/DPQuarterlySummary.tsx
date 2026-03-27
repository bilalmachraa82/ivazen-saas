import { useMemo, useCallback, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatVatRegime } from '@/lib/formatVatRegime';

interface DPFieldSummary {
  field: number;
  label: string;
  baseTotal: number;
  vatTotal: number;
  vatDeductible: number;
  invoiceCount: number;
}

interface DPQuarterlySummaryProps {
  dpFieldSummaries: DPFieldSummary[];
  totals: {
    baseTotal: number;
    vatTotal: number;
    vatDeductible: number;
    invoiceCount: number;
  };
  pendingCount?: number;
  duplicatesRemoved?: number;
  vatRegime?: string;
  period?: string;
}

const fmt = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);

export function DPQuarterlySummary({
  dpFieldSummaries,
  totals,
  pendingCount = 0,
  duplicatesRemoved = 0,
  vatRegime,
  period,
}: DPQuarterlySummaryProps) {
  const activeFields = useMemo(
    () => dpFieldSummaries.filter(s => s.invoiceCount > 0 || s.baseTotal > 0),
    [dpFieldSummaries]
  );

  const [copiedField, setCopiedField] = useState<number | null>(null);

  const copyFieldValue = useCallback((field: number, value: number) => {
    const formatted = value.toFixed(2);
    navigator.clipboard.writeText(formatted);
    setCopiedField(field);
    toast.success(`Campo ${field}: ${formatted} copiado`);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const copyAllFields = useCallback(() => {
    const lines = activeFields.map(s =>
      `Campo ${s.field} — ${s.label}: Base ${s.baseTotal.toFixed(2)} | IVA ${s.vatTotal.toFixed(2)} | Dedutível ${s.vatDeductible.toFixed(2)}`
    );
    lines.push('');
    lines.push(`TOTAL: Base ${totals.baseTotal.toFixed(2)} | IVA ${totals.vatTotal.toFixed(2)} | Dedutível ${totals.vatDeductible.toFixed(2)}`);
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Todos os campos DP copiados para a área de transferência');
  }, [activeFields, totals]);

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {pendingCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {pendingCount} factura{pendingCount !== 1 ? 's' : ''} por classificar neste período.
            Classifique antes de exportar para garantir exactidão.
          </AlertDescription>
        </Alert>
      )}

      {duplicatesRemoved > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {duplicatesRemoved} duplicado{duplicatesRemoved !== 1 ? 's' : ''} removido{duplicatesRemoved !== 1 ? 's' : ''} automaticamente.
          </AlertDescription>
        </Alert>
      )}

      {vatRegime && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Regime IVA: <Badge variant="outline">{formatVatRegime(vatRegime)}</Badge>
          {period && <span>| Período: <strong>{period}</strong></span>}
        </div>
      )}

      {/* Summary Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Campo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Facturas</TableHead>
              <TableHead className="text-right">Base Incidência</TableHead>
              <TableHead className="text-right">IVA Total</TableHead>
              <TableHead className="text-right">IVA Dedutível</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dpFieldSummaries.map(summary => (
              <TableRow
                key={summary.field}
                className={summary.invoiceCount === 0 ? 'text-muted-foreground opacity-50' : ''}
              >
                <TableCell className="font-mono font-bold">{summary.field}</TableCell>
                <TableCell>{summary.label}</TableCell>
                <TableCell className="text-right">{summary.invoiceCount}</TableCell>
                <TableCell className="text-right">{fmt(summary.baseTotal)}</TableCell>
                <TableCell className="text-right">{fmt(summary.vatTotal)}</TableCell>
                <TableCell className="text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    {fmt(summary.vatDeductible)}
                    {summary.invoiceCount > 0 && (
                      <button
                        onClick={() => copyFieldValue(summary.field, summary.vatDeductible)}
                        className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted transition-colors"
                        title={`Copiar valor do Campo ${summary.field}`}
                        aria-label={`Copiar ${summary.vatDeductible.toFixed(2)} do Campo ${summary.field}`}
                      >
                        {copiedField === summary.field
                          ? <ClipboardCheck className="h-3 w-3 text-green-600" />
                          : <Copy className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            ))}

            {/* Totals row */}
            <TableRow className="font-bold border-t-2">
              <TableCell></TableCell>
              <TableCell>TOTAL</TableCell>
              <TableCell className="text-right">{totals.invoiceCount}</TableCell>
              <TableCell className="text-right">{fmt(totals.baseTotal)}</TableCell>
              <TableCell className="text-right">{fmt(totals.vatTotal)}</TableCell>
              <TableCell className="text-right">{fmt(totals.vatDeductible)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Quick stats */}
      {activeFields.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-muted-foreground">IVA a recuperar</div>
            <div className="text-lg font-bold text-green-600">{fmt(totals.vatDeductible)}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-muted-foreground">IVA não dedutível</div>
            <div className="text-lg font-bold text-red-600">
              {fmt(totals.vatTotal - totals.vatDeductible)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-muted-foreground">Taxa dedução média</div>
            <div className="text-lg font-bold">
              {totals.vatTotal > 0
                ? `${((totals.vatDeductible / totals.vatTotal) * 100).toFixed(1)}%`
                : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Delivery actions */}
      {activeFields.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={copyAllFields} className="gap-2">
            <Copy className="h-4 w-4" />
            Copiar todos os campos DP
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open('https://iva.portaldasfinancas.gov.pt/dpiva/portal/dp', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Declaração Periódica (AT)
          </Button>
        </div>
      )}
    </div>
  );
}
