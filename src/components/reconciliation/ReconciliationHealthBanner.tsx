import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import type { ReconciliationSummary } from '@/hooks/useReconciliationData';

interface ReconciliationHealthBannerProps {
  data: ReconciliationSummary;
}

const STATUS_CONFIG = {
  ok: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30', label: 'Reconciliado' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', label: 'Atenção' },
  error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', label: 'Divergência' },
  no_data: { icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted/30', label: 'Sem dados' },
} as const;

function StatusBadge({ status, label, detail }: { status: keyof typeof STATUS_CONFIG; label: string; detail?: string }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg}`}>
      <Icon className={`h-4 w-4 ${cfg.color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground truncate">{detail}</p>}
      </div>
    </div>
  );
}

export function ReconciliationHealthBanner({ data }: ReconciliationHealthBannerProps) {
  const purchasesDetail = data.purchases.status === 'no_data'
    ? undefined
    : `${data.purchases.atCount} AT, ${data.purchases.uploadCount} upload`;

  const m10Detail = data.modelo10.status === 'no_data'
    ? undefined
    : data.modelo10.nifMismatchCount > 0
      ? `${data.modelo10.nifMismatchCount} NIFs com delta`
      : `${data.modelo10.atSourceCount} AT, ${data.modelo10.ocrSourceCount} OCR`;

  const ssDetail = data.ss.status === 'no_data'
    ? undefined
    : data.ss.declaredRevenue == null
      ? 'Sem declaração SS'
      : data.ss.delta > 1
        ? `Delta: €${data.ss.delta.toFixed(2)}`
        : 'Receita alinhada';

  const wDetail = data.withholdings.status === 'no_data'
    ? undefined
    : data.withholdings.pendingCandidates > 0
      ? `${data.withholdings.pendingCandidates} candidatos pendentes`
      : `${data.withholdings.totalCount} retenções`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatusBadge status={data.purchases.status} label="IVA Compras" detail={purchasesDetail} />
      <StatusBadge status={data.modelo10.status} label="Modelo 10" detail={m10Detail} />
      <StatusBadge status={data.ss.status} label="Seg. Social" detail={ssDetail} />
      <StatusBadge status={data.withholdings.status} label="Retenções" detail={wDetail} />
    </div>
  );
}
