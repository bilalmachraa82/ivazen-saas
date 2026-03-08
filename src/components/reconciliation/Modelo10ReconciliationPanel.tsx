import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ZenEmptyState, ZenSkeleton } from '@/components/zen';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface Modelo10ReconciliationPanelProps {
  clientId: string;
  fiscalYear: number;
}

interface WithholdingRow {
  beneficiary_nif: string;
  beneficiary_name: string | null;
  gross_amount: number;
  withholding_amount: number;
  import_source: string | null;
}

const fmt = (n: number) => `€${Number(n).toFixed(2)}`;

export function Modelo10ReconciliationPanel({ clientId, fiscalYear }: Modelo10ReconciliationPanelProps) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['m10-reconciliation', clientId, fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_withholdings')
        .select('beneficiary_nif, beneficiary_name, gross_amount, withholding_amount, import_source')
        .eq('client_id', clientId)
        .eq('fiscal_year', fiscalYear);
      if (error) throw error;
      return (data || []) as WithholdingRow[];
    },
    enabled: !!clientId,
  });

  const { nifComparison, summary } = useMemo(() => {
    const atByNif = new Map<string, { name: string | null; gross: number; withholding: number; count: number }>();
    const ocrByNif = new Map<string, { name: string | null; gross: number; withholding: number; count: number }>();

    rows.forEach(r => {
      const nif = r.beneficiary_nif || '';
      const isAT = ['at_csv', 'at_sire', 'at_sire_detection'].includes(r.import_source || '');
      const map = isAT ? atByNif : ocrByNif;
      const existing = map.get(nif) || { name: null, gross: 0, withholding: 0, count: 0 };
      existing.name = existing.name || r.beneficiary_name;
      existing.gross += Number(r.gross_amount || 0);
      existing.withholding += Number(r.withholding_amount || 0);
      existing.count += 1;
      map.set(nif, existing);
    });

    const allNifs = new Set([...atByNif.keys(), ...ocrByNif.keys()]);
    const comparison: Array<{
      nif: string;
      name: string | null;
      atGross: number;
      atWithholding: number;
      ocrGross: number;
      ocrWithholding: number;
      delta: number;
      status: 'match' | 'mismatch' | 'at_only' | 'ocr_only';
    }> = [];

    allNifs.forEach(nif => {
      const at = atByNif.get(nif);
      const ocr = ocrByNif.get(nif);
      const atW = at?.withholding || 0;
      const ocrW = ocr?.withholding || 0;
      const delta = Math.abs(atW - ocrW);

      let status: 'match' | 'mismatch' | 'at_only' | 'ocr_only';
      if (!at) status = 'ocr_only';
      else if (!ocr) status = 'at_only';
      else if (delta <= 1) status = 'match';
      else status = 'mismatch';

      comparison.push({
        nif,
        name: at?.name || ocr?.name || null,
        atGross: at?.gross || 0,
        atWithholding: atW,
        ocrGross: ocr?.gross || 0,
        ocrWithholding: ocrW,
        delta,
        status,
      });
    });

    comparison.sort((a, b) => {
      const order = { mismatch: 0, ocr_only: 1, at_only: 2, match: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4) || b.delta - a.delta;
    });

    return {
      nifComparison: comparison,
      summary: {
        totalNifs: allNifs.size,
        matched: comparison.filter(c => c.status === 'match').length,
        mismatched: comparison.filter(c => c.status === 'mismatch').length,
        atOnly: comparison.filter(c => c.status === 'at_only').length,
        ocrOnly: comparison.filter(c => c.status === 'ocr_only').length,
      },
    };
  }, [rows]);

  if (isLoading) return <ZenSkeleton className="h-48 w-full" />;

  if (rows.length === 0) {
    return (
      <ZenEmptyState
        icon={CheckCircle}
        title="Sem dados de retenção"
        description={`Nenhuma retenção registada para ${fiscalYear}.`}
      />
    );
  }

  const allMatch = summary.mismatched === 0 && summary.ocrOnly === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{summary.totalNifs} beneficiários</Badge>
        <Badge variant={allMatch ? 'default' : 'outline'} className={allMatch ? 'bg-green-100 text-green-800' : ''}>
          {summary.matched} reconciliados
        </Badge>
        {summary.mismatched > 0 && (
          <Badge variant="destructive">{summary.mismatched} com delta</Badge>
        )}
        {summary.atOnly > 0 && (
          <Badge variant="secondary">{summary.atOnly} só AT</Badge>
        )}
        {summary.ocrOnly > 0 && (
          <Badge variant="warning">{summary.ocrOnly} só OCR/manual</Badge>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NIF</TableHead>
              <TableHead>Beneficiário</TableHead>
              <TableHead className="text-right">Retenção AT</TableHead>
              <TableHead className="text-right">Retenção OCR</TableHead>
              <TableHead className="text-right">Delta</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nifComparison.slice(0, 100).map(row => (
              <TableRow key={row.nif} className={row.status === 'mismatch' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                <TableCell className="font-mono text-sm">{row.nif}</TableCell>
                <TableCell className="max-w-[200px] truncate">{row.name || '—'}</TableCell>
                <TableCell className="text-right">{row.atWithholding > 0 ? fmt(row.atWithholding) : '—'}</TableCell>
                <TableCell className="text-right">{row.ocrWithholding > 0 ? fmt(row.ocrWithholding) : '—'}</TableCell>
                <TableCell className={`text-right font-medium ${row.delta > 1 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {row.delta > 0 ? fmt(row.delta) : '—'}
                </TableCell>
                <TableCell>
                  {row.status === 'match' && <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">OK</Badge>}
                  {row.status === 'mismatch' && <Badge variant="destructive" className="text-xs">Delta</Badge>}
                  {row.status === 'at_only' && <Badge variant="secondary" className="text-xs">Só AT</Badge>}
                  {row.status === 'ocr_only' && <Badge variant="warning" className="text-xs">Só OCR</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {nifComparison.length > 100 && (
        <p className="text-xs text-muted-foreground">A mostrar 100 de {nifComparison.length} beneficiários.</p>
      )}
    </div>
  );
}
