import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Cloud,
  FileCode,
  FileSpreadsheet,
  FileText,
  Image,
  Layers,
  Receipt,
  RefreshCw,
  Upload,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZenCard, ZenDecorations, ZenEmptyState, ZenHeader, ZenLoader } from '@/components/zen';
import { useAuth } from '@/hooks/useAuth';
import { useAccountantClients } from '@/hooks/useAccountantClients';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { useImportChannelHealth, type ChannelId, type ChannelStatus } from '@/hooks/useImportChannelHealth';
import { useTaxpayerKind } from '@/hooks/useTaxpayerKind';
import { isObligationPrimary, taxpayerKindLabel, taxpayerKindBadge } from '@/lib/taxpayerKind';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─── Channel metadata ────────────────────────────────────────────────

interface ChannelMeta {
  id: ChannelId;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  route: string;
  routeParams?: string;
  actionLabel: string;
  obligation: 'iva' | 'ss' | 'modelo10' | null;
  tip: string;
}

const CHANNELS: ChannelMeta[] = [
  {
    id: 'at_soap',
    title: 'Sincronizar AT (Webservice)',
    shortTitle: 'AT Sync',
    description: 'Ligação direta ao e-Fatura. Importa compras automaticamente via certificado digital.',
    icon: Cloud,
    route: '/efatura',
    actionLabel: 'Configurar sync',
    obligation: 'iva',
    tip: 'Requer certificado AT configurado. Ideal para importação recorrente.',
  },
  {
    id: 'csv_excel',
    title: 'Importar ficheiro AT (CSV/Excel)',
    shortTitle: 'CSV/Excel',
    description: 'Carregue o ficheiro exportado do Portal das Finanças com as suas compras.',
    icon: FileSpreadsheet,
    route: '/efatura',
    actionLabel: 'Importar ficheiro',
    obligation: 'iva',
    tip: 'Exporte as despesas do Portal e-Fatura (faturas.portaldasfinancas.gov.pt) em CSV.',
  },
  {
    id: 'pdf_ocr',
    title: 'Carregar PDFs / Imagens',
    shortTitle: 'PDF/OCR',
    description: 'Upload individual ou em bulk de faturas. Extração automática por QR ou IA.',
    icon: Image,
    route: '/upload',
    actionLabel: 'Carregar documentos',
    obligation: null,
    tip: 'Suporta PDF, JPEG, PNG. QR code lido automaticamente; IA extrai o resto.',
  },
  {
    id: 'saft',
    title: 'Importar SAF-T / Exportações',
    shortTitle: 'SAF-T',
    description: 'Importe dados estruturados de software de faturação (SAF-T PT, CSV genérico).',
    icon: FileCode,
    route: '/upload',
    routeParams: '?mode=saft',
    actionLabel: 'Importar SAF-T',
    obligation: null,
    tip: 'Compatível com ficheiros de Primavera, Sage, PHC e outros via SAF-T XML.',
  },
  {
    id: 'modelo10',
    title: 'Retenções na Fonte (Modelo 10)',
    shortTitle: 'Modelo 10',
    description: 'Importar retenções do Portal AT, emails de notificação ou documentos OCR.',
    icon: Receipt,
    route: '/modelo-10',
    actionLabel: 'Gerir retenções',
    obligation: 'modelo10',
    tip: 'Portal AT (Excel), emails da AT ou bulk de PDFs com OCR automático.',
  },
];

// ─── Status presentation ─────────────────────────────────────────────

function channelStatusBadge(status: ChannelStatus) {
  switch (status) {
    case 'active':
      return { label: 'Ativo', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 };
    case 'configured':
      return { label: 'Configurado', className: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300', icon: BadgeCheck };
    case 'available':
      return { label: 'Disponível', className: 'border-muted-foreground/20 bg-muted/50 text-muted-foreground', icon: Wifi };
    default:
      return { label: 'Indisponível', className: 'border-red-500/20 bg-red-500/5 text-red-600', icon: WifiOff };
  }
}

// ─── Channel Card ────────────────────────────────────────────────────

interface ChannelCardProps {
  meta: ChannelMeta;
  status: ChannelStatus;
  lastActivity: string | null;
  recordsImported: number;
  lastError: string | null;
  trackingMode: 'dedicated' | 'derived' | 'none';
  primary: boolean;
}

function ChannelCard({ meta, status, lastActivity, recordsImported, lastError, trackingMode, primary }: ChannelCardProps) {
  const badge = channelStatusBadge(status);
  const StatusIcon = badge.icon;
  const fullRoute = meta.route + (meta.routeParams || '');
  const hasTracking = trackingMode !== 'none';
  const recordsLabel = trackingMode === 'derived' ? 'Registos derivados' : 'Registos';
  const recordsValue = hasTracking ? recordsImported.toLocaleString('pt-PT') : 'Sob procura';
  const recordsHint =
    trackingMode === 'none'
      ? 'Sem tracking dedicado por canal'
      : trackingMode === 'derived'
        ? 'Contagem inferida a partir dos registos finais'
        : null;
  const lastUsageValue = hasTracking && lastActivity
    ? formatDistanceToNow(new Date(lastActivity), { addSuffix: true, locale: pt })
    : hasTracking
      ? '—'
      : 'Consultar detalhe';

  return (
    <ZenCard
      withLine
      hoverScale
      gradient={primary ? 'primary' : 'muted'}
      className={cn(
        'h-full border-primary/10 flex flex-col',
        !primary && 'opacity-90',
      )}
    >
      <CardHeader className="pb-3 flex-none">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0 flex-1">
            <CardTitle className="flex items-center gap-3 text-base">
              <div className={cn(
                'rounded-2xl p-2.5 shadow-sm shrink-0',
                primary ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
              )}>
                <meta.icon className="h-5 w-5" />
              </div>
              <span className="truncate">{meta.title}</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">{meta.description}</p>
          </div>
          <Badge variant="outline" className={cn('gap-1.5 shrink-0', badge.className)}>
            <StatusIcon className="h-3 w-3" />
            {badge.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col justify-end">
        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{recordsLabel}</div>
            <div className="mt-0.5 text-lg font-semibold text-foreground">
              {recordsValue}
            </div>
            {recordsHint && (
              <div className="mt-1 text-[10px] leading-tight text-muted-foreground">
                {recordsHint}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Último uso</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {lastUsageValue}
            </div>
          </div>
        </div>

        {/* Error alert */}
        {lastError && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
            {lastError}
          </div>
        )}

        {/* Tip */}
        <p className="text-xs text-muted-foreground/80 leading-relaxed">{meta.tip}</p>

        {/* Action */}
        <Button asChild className="w-full justify-between gap-2">
          <Link to={fullRoute}>
            {status === 'active' ? 'Abrir' : meta.actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </ZenCard>
  );
}

// ─── Recommended next action ─────────────────────────────────────────

interface NextAction {
  title: string;
  description: string;
  route: string;
  label: string;
}

function computeNextActions(
  data: ReturnType<typeof useImportChannelHealth>['data'],
  taxpayerKind: string | null,
): NextAction[] {
  if (!data) return [];
  const actions: NextAction[] = [];

  // 1. AT credentials not configured → suggest setup
  if (!data.hasATCredentials) {
    actions.push({
      title: 'Configurar credenciais AT',
      description: 'Configure as credenciais do Portal das Finanças para ativar a importação automática de compras.',
      route: '/efatura',
      label: 'Configurar AT',
    });
  }

  // 2. No records at all → suggest first import
  // Uses totalImported (real table counts) — not per-channel counts which are incomplete.
  if (data.totalImported === 0) {
    actions.push({
      title: 'Importar primeiros documentos',
      description: 'Ainda não existem documentos importados. Comece por ficheiro CSV, upload de PDFs ou sync AT.',
      route: '/upload',
      label: 'Importar documentos',
    });
  }

  // 3. AT sync has error
  if (data.channels.at_soap.lastError) {
    actions.push({
      title: 'Resolver erro de sync AT',
      description: 'O último sync automático falhou. Verifique as credenciais e tente novamente.',
      route: '/efatura',
      label: 'Ver sync AT',
    });
  }

  // 4. If company/mixed and no withholdings → suggest Modelo 10
  if (
    (taxpayerKind === 'company' || taxpayerKind === 'mixed') &&
    data.channels.modelo10.recordsImported === 0
  ) {
    actions.push({
      title: 'Importar retenções (Modelo 10)',
      description: 'Ainda não existem retenções na fonte. Importe do Portal AT ou via documentos.',
      route: '/modelo-10',
      label: 'Importar retenções',
    });
  }

  return actions.slice(0, 3);
}

// ─── Page ────────────────────────────────────────────────────────────

export default function ImportCenter() {
  const { user, loading: authLoading } = useAuth();
  const { selectedClientId, setSelectedClientId } = useSelectedClient();
  const { clients, isLoading: isLoadingClients, getClientById } = useAccountantClients();
  const selectedClient = selectedClientId ? getClientById(selectedClientId) : null;
  const { taxpayerKind, isLoading: isLoadingTK } = useTaxpayerKind(selectedClientId);
  const { data, isLoading, refetch } = useImportChannelHealth({
    clientId: selectedClientId,
  });

  const displayName =
    selectedClient?.company_name ||
    selectedClient?.full_name ||
    'Cliente';

  const nextActions = useMemo(
    () => computeNextActions(data, taxpayerKind),
    [data, taxpayerKind],
  );

  // ── Auth guard ──
  if (authLoading) return <ZenLoader fullScreen text="A carregar..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (isLoading || isLoadingClients || isLoadingTK) {
    return <ZenLoader fullScreen text="A preparar centro de importação..." />;
  }

  // ── No clients ──
  if (clients.length === 0 && !isLoadingClients) {
    return (
      <DashboardLayout>
        <ZenEmptyState
          icon={Briefcase}
          title="Sem clientes"
          description="Associe pelo menos um cliente para utilizar o centro de importação."
          actionLabel="Gestão de Clientes"
          actionRoute="/settings"
        />
      </DashboardLayout>
    );
  }

  // ── No client selected ──
  if (!selectedClientId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <ZenHeader
            icon={Layers}
            title="Centro de Importação"
            description="Selecione um cliente para ver e lançar importações."
          />
          <ZenCard>
            <CardHeader>
              <CardTitle>Selecionar cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientSearchSelector
                clients={clients}
                selectedClientId={selectedClientId}
                onSelect={setSelectedClientId}
                isLoading={isLoadingClients}
                placeholder="Selecionar cliente..."
              />
            </CardContent>
          </ZenCard>
        </div>
      </DashboardLayout>
    );
  }

  // ── Main content ──
  return (
    <DashboardLayout>
      <div className="relative space-y-8">
        <ZenDecorations />

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <ZenHeader
              icon={Layers}
              title="Centro de Importação"
              description="Uma superfície única para lançar e monitorizar todas as importações do cliente."
            />
            {selectedClient && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 px-3 py-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {displayName}
                </Badge>
                {selectedClient.nif && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    NIF {selectedClient.nif}
                  </Badge>
                )}
                {taxpayerKind && (
                  <Badge variant="outline" className={taxpayerKindBadge(taxpayerKind)}>
                    {taxpayerKindLabel(taxpayerKind)}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ClientSearchSelector
              clients={clients}
              selectedClientId={selectedClientId}
              onSelect={setSelectedClientId}
              isLoading={isLoadingClients}
              placeholder="Mudar cliente..."
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* ── Summary bar ── */}
        {data && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <SummaryMetric
              label="Total importado"
              value={data.totalImported.toLocaleString('pt-PT')}
            />
            <SummaryMetric
              label="Tracking por canal"
              value={Object.values(data.channels).some((ch) => ch.trackingMode === 'none') ? 'Parcial' : 'Completo'}
            />
            <SummaryMetric
              label="Credenciais AT"
              value={data.hasATCredentials ? 'Configuradas' : 'Sem credenciais'}
            />
            <SummaryMetric
              label="Ambiente AT"
              value={data.atEnvironment === 'production' ? 'Produção' : data.atEnvironment === 'test' ? 'Teste' : '—'}
            />
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            O total importado reflete todos os registos já carregados no cliente. Apenas alguns canais mostram
            tracking dedicado; os restantes funcionam por disponibilidade e ação manual.
          </p>
        )}

        {/* ── Next actions ── */}
        {nextActions.length > 0 && (
          <ZenCard withLine>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Próximas ações recomendadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {nextActions.map((action) => (
                  <div
                    key={action.route + action.title}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-background/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
                      <Link to={action.route}>
                        {action.label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </ZenCard>
        )}

        {/* ── Channel cards grid ── */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Canais de importação</h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {CHANNELS.map((meta) => {
              const ch = data?.channels[meta.id];
              const primary = meta.obligation
                ? isObligationPrimary(meta.obligation, taxpayerKind)
                : true;
              return (
                <ChannelCard
                  key={meta.id}
                  meta={meta}
                  status={ch?.status ?? 'available'}
                  lastActivity={ch?.lastActivity ?? null}
                  recordsImported={ch?.recordsImported ?? 0}
                  lastError={ch?.lastError ?? null}
                  trackingMode={ch?.trackingMode ?? 'none'}
                  primary={primary}
                />
              );
            })}
          </div>
        </div>

        {/* ── Quick links ── */}
        <ZenCard gradient="muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Atalhos rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <QuickLink label="Carregar em bulk" route="/upload?mode=bulk" icon={Upload} />
              <QuickLink label="Importar SAF-T" route="/upload?mode=saft" icon={FileCode} />
              <QuickLink label="e-Fatura CSV" route="/efatura" icon={FileSpreadsheet} />
              <QuickLink label="Modelo 10 Import" route="/modelo-10" icon={Receipt} />
              <QuickLink label="Centro Fiscal" route="/centro-fiscal" icon={Briefcase} />
            </div>
          </CardContent>
        </ZenCard>
      </div>
    </DashboardLayout>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <ZenCard gradient="muted">
      <CardContent className="pt-5 pb-4">
        <div className="text-xl font-bold text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </ZenCard>
  );
}

function QuickLink({ label, route, icon: Icon }: { label: string; route: string; icon: LucideIcon }) {
  return (
    <Button asChild variant="outline" size="sm" className="gap-2">
      <Link to={route}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Link>
    </Button>
  );
}
