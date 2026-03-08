import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileOutput,
  FileSearch,
  Landmark,
  RefreshCw,
  Receipt,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ZenCard, ZenDecorations, ZenEmptyState, ZenHeader, ZenLoader } from '@/components/zen';
import { useAuth } from '@/hooks/useAuth';
import { useAccountantClients } from '@/hooks/useAccountantClients';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { useClientFiscalCenter } from '@/hooks/useClientFiscalCenter';
import { getCurrentQuarter, getQuarterLabel } from '@/lib/fiscalQuarter';
import { taxpayerKindBadge, taxpayerKindLabel, isObligationPrimary } from '@/lib/taxpayerKind';
import { cn } from '@/lib/utils';

type ObligationStatus = 'ready' | 'attention' | 'setup';

interface ObligationCardProps {
  title: string;
  icon: typeof Landmark;
  status: ObligationStatus;
  primary: boolean;
  description: string;
  metrics: Array<{ label: string; value: string }>;
  route: string;
  actionLabel: string;
}

function statusBadge(status: ObligationStatus) {
  if (status === 'ready') {
    return {
      label: 'Pronto',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      icon: CheckCircle2,
    };
  }
  if (status === 'attention') {
    return {
      label: 'Atenção',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      icon: AlertTriangle,
    };
  }
  return {
    label: 'Por configurar',
    className: 'border-muted-foreground/20 bg-muted/50 text-muted-foreground',
    icon: Sparkles,
  };
}

function formatSyncStatus(status: string | null) {
  switch (status) {
    case 'success':
      return 'Último sync concluído';
    case 'partial':
      return 'Último sync parcial';
    case 'error':
      return 'Último sync com erro';
    case 'running':
      return 'Sync em execução';
    default:
      return 'Sem sync recente';
  }
}

function formatSyncType(syncType: string) {
  switch (syncType) {
    case 'compras':
      return 'Compras';
    case 'vendas':
      return 'Vendas';
    case 'ambos':
      return 'Compras e vendas';
    default:
      return syncType;
  }
}

function ObligationCard({
  title,
  icon: Icon,
  status,
  primary,
  description,
  metrics,
  route,
  actionLabel,
}: ObligationCardProps) {
  const meta = statusBadge(status);
  const StatusIcon = meta.icon;

  return (
    <ZenCard
      withLine
      hoverScale
      gradient={primary ? 'primary' : 'muted'}
      className={cn(
        'h-full border-primary/10',
        !primary && 'opacity-90',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div
                className={cn(
                  'rounded-2xl p-3 shadow-sm',
                  primary ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span>{title}</span>
                  {!primary && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      Secundário
                    </Badge>
                  )}
                </div>
              </div>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge variant="outline" className={cn('gap-1.5', meta.className)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{metric.value}</div>
            </div>
          ))}
        </div>
        <Button asChild className="w-full justify-between gap-2">
          <Link to={route}>
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </ZenCard>
  );
}

export default function ClientFiscalCenter() {
  const { user, loading: authLoading, roles } = useAuth();
  const navigate = useNavigate();
  const isAccountant = roles?.includes('accountant');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const { selectedClientId, setSelectedClientId } = useSelectedClient();
  const { clients, isLoading: isLoadingClients, getClientById } = useAccountantClients();
  const effectiveClientId = isAccountant ? selectedClientId : (user?.id ?? undefined);
  const selectedClient = selectedClientId ? getClientById(selectedClientId) : null;
  const { data, taxpayerKind, isLoading } = useClientFiscalCenter({
    clientId: effectiveClientId,
    fiscalYear: selectedYear,
    quarter: selectedQuarter,
  });
  const periodLabel = getQuarterLabel(selectedYear, selectedQuarter);
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);
  const quarterOptions = [1, 2, 3, 4];
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

  const displayName =
    data?.client?.company_name ||
    data?.client?.full_name ||
    selectedClient?.company_name ||
    selectedClient?.full_name ||
    'Cliente';

  const nextActions = useMemo(() => {
    if (!data) return [];

    const actions = [];

    if (data.purchases.pending > 0) {
      actions.push({
        title: `${data.purchases.pending} compra(s) por validar`,
        description: `Existem compras pendentes ou classificações com impacto fiscal em ${periodLabel}.`,
        route: '/validation',
        label: 'Rever compras',
      });
    }

    if (data.sales.total === 0) {
      actions.push({
        title: 'Sem vendas importadas',
        description: `Importe vendas ou recibos verdes para destravar Segurança Social e apuramento de IVA em ${periodLabel}.`,
        route: isAccountant ? '/efatura' : '/upload',
        label: isAccountant ? 'Importar vendas' : 'Carregar documentos',
      });
    } else if (data.sales.pending > 0) {
      actions.push({
        title: `${data.sales.pending} venda(s) por rever`,
        description: `Ainda existem vendas pendentes que não entram totalmente nas obrigações fiscais de ${periodLabel}.`,
        route: '/sales',
        label: 'Rever vendas',
      });
    }

    if (data.modelo10.pendingCandidates > 0) {
      actions.push({
        title: `${data.modelo10.pendingCandidates} candidato(s) de retenção por rever`,
        description: 'Existem retenções automáticas à espera de validação antes de integrarem o Modelo 10.',
        route: '/modelo-10',
        label: 'Rever candidatos',
      });
    }

    if (data.at.hasCredentials && data.at.lastSyncStatus !== 'success') {
      actions.push({
        title: 'Convém reexecutar o sync AT',
        description: 'As credenciais estão configuradas, mas o último sync não ficou concluído com sucesso.',
        route: isAccountant ? '/efatura' : '/upload',
        label: isAccountant ? 'Ver sync AT' : 'Ver importações',
      });
    }

    return actions.slice(0, 4);
  }, [data, isAccountant, periodLabel]);

  if (authLoading) {
    return <ZenLoader fullScreen text="A carregar..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isLoading || (isAccountant && isLoadingClients)) {
    return <ZenLoader fullScreen text="A preparar centro fiscal..." />;
  }

  const ivaStatus: ObligationStatus =
    !data || (data.purchases.total === 0 && data.sales.total === 0)
      ? 'setup'
      : data.purchases.pending > 0 || data.sales.pending > 0
        ? 'attention'
        : 'ready';

  const ssStatus: ObligationStatus =
    !data || data.sales.total === 0
      ? 'setup'
      : data.sales.pending > 0
        ? 'attention'
        : 'ready';

  const modelo10Status: ObligationStatus =
    !data || (data.modelo10.withholdingsCount === 0 && data.modelo10.pendingCandidates === 0)
      ? 'setup'
      : data.modelo10.pendingCandidates > 0
        ? 'attention'
        : 'ready';

  return (
    <DashboardLayout>
      <div className="relative space-y-8">
        <ZenDecorations />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <ZenHeader
              icon={Briefcase}
              title="Centro Fiscal do Cliente"
              description="Uma visão única do que está pronto, do que falta e do próximo passo fiscal para este cliente."
            />
            {data?.client && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 px-3 py-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {displayName}
                </Badge>
                {data.client.nif && (
                  <Badge variant="secondary" className="font-mono">
                    NIF {data.client.nif}
                  </Badge>
                )}
                {taxpayerKind && (
                  <Badge variant="outline" className="gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {taxpayerKindLabel(taxpayerKind)}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[320px]">
            {isAccountant && clients.length > 0 && (
              <ClientSearchSelector
                clients={clients}
                selectedClientId={selectedClientId}
                onSelect={setSelectedClientId}
                isLoading={isLoadingClients}
                placeholder="Selecionar cliente..."
                className="w-full sm:w-[320px]"
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
                <SelectTrigger className="w-full bg-background/80">
                  <SelectValue placeholder="Ano fiscal" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedQuarter)} onValueChange={(value) => setSelectedQuarter(Number(value))}>
                <SelectTrigger className="w-full bg-background/80">
                  <SelectValue placeholder="Trimestre" />
                </SelectTrigger>
                <SelectContent>
                  {quarterOptions.map((quarter) => (
                    <SelectItem key={quarter} value={String(quarter)}>
                      {getQuarterLabel(selectedYear, quarter)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isAccountant && clients.length === 0 && !isLoadingClients && (
          <ZenCard gradient="primary" withCircle className="shadow-xl">
            <CardContent className="py-12">
              <ZenEmptyState
                icon={Users}
                title="Ainda não há clientes associados"
                description="Assim que tiver clientes ligados à conta, este cockpit passa a mostrar o estado fiscal de cada um."
                action={{
                  label: 'Ir para Definições',
                  onClick: () => navigate('/settings'),
                  icon: ArrowRight,
                }}
                variant="primary"
              />
            </CardContent>
          </ZenCard>
        )}

        {isAccountant && clients.length > 0 && !selectedClientId && (
          <ZenCard gradient="warning" withLine className="shadow-xl">
            <CardContent className="py-12">
              <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <Users className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-semibold">Selecione um cliente para abrir o cockpit fiscal</h2>
                <p className="mt-3 text-muted-foreground">
                  O centro fiscal mostra estado por obrigação, origem dos dados e próximas ações. A seleção é sempre explícita para evitar contexto errado.
                </p>
              </div>
            </CardContent>
          </ZenCard>
        )}

        {(!isAccountant || selectedClientId) && data && (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
              <ZenCard gradient="primary" withLine className="shadow-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl">Estado operacional</CardTitle>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Obrigações principais priorizadas para {taxpayerKind ? taxpayerKindBadge(taxpayerKind) : 'o perfil atual'}, sem esconder as restantes, com foco em {periodLabel}.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs uppercase tracking-wide">
                        {periodLabel}
                      </Badge>
                      {taxpayerKind && (
                        <Badge variant="outline" className="text-xs uppercase tracking-wide">
                          {taxpayerKindBadge(taxpayerKind)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <ObligationCard
                    title="IVA"
                    icon={Landmark}
                    status={ivaStatus}
                    primary={isObligationPrimary('iva', taxpayerKind)}
                    description={`Compras e vendas prontas para apuramento e exportação em ${periodLabel}.`}
                    metrics={[
                      { label: 'Compras no período', value: `${data.purchases.effective}` },
                      { label: 'Por validar', value: `${data.purchases.pending}` },
                    ]}
                    route="/export"
                    actionLabel="Abrir apuramento"
                  />
                  <ObligationCard
                    title="Segurança Social"
                    icon={Shield}
                    status={ssStatus}
                    primary={isObligationPrimary('ss', taxpayerKind)}
                    description={`Receita e declaração trimestral de ${periodLabel}.`}
                    metrics={[
                      { label: 'Receita', value: formatCurrency(data.ss.currentRevenue) },
                      { label: 'Declaração', value: data.ss.currentDeclarationStatus || 'Por preparar' },
                    ]}
                    route="/seguranca-social"
                    actionLabel="Abrir SS"
                  />
                  <ObligationCard
                    title="Modelo 10"
                    icon={Receipt}
                    status={modelo10Status}
                    primary={isObligationPrimary('modelo10', taxpayerKind)}
                    description={`Retenções e revisão anual (${data.modelo10.fiscalYear}).`}
                    metrics={[
                      { label: 'Retenções', value: `${data.modelo10.withholdingsCount}` },
                      { label: 'Em revisão', value: `${data.modelo10.pendingCandidates}` },
                    ]}
                    route="/modelo-10"
                    actionLabel="Abrir Modelo 10"
                  />
                </CardContent>
              </ZenCard>

              <div className="grid grid-cols-1 gap-6">
                <ZenCard gradient="default" withCircle className="shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Origem dos dados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Credenciais AT</div>
                        <div className="mt-1 text-sm font-semibold">
                          {data.at.hasCredentials ? 'Configuradas' : 'Em falta'}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Último sync</div>
                        <div className="mt-1 text-sm font-semibold">{formatSyncStatus(data.at.lastSyncStatus)}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Compras no período</div>
                        <div className="mt-1 text-sm font-semibold">{data.purchases.total} documento(s)</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Vendas no período</div>
                        <div className="mt-1 text-sm font-semibold">{data.sales.total} documento(s)</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {data.at.recentSyncs.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                          Ainda não existe histórico recente de importação automática para este cliente.
                        </div>
                      ) : (
                        data.at.recentSyncs.map((sync) => (
                          <div
                            key={`${sync.created_at}-${sync.sync_type}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{formatSyncType(sync.sync_type)}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(sync.created_at).toLocaleString('pt-PT')}
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <div className="font-medium">
                                {sync.records_imported} importados
                              </div>
                              {sync.records_errors > 0 && (
                                <div className="text-amber-600 dark:text-amber-300">
                                  {sync.records_errors} erro(s)
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </ZenCard>

                <ZenCard gradient="muted" withLine className="shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Próximas ações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {nextActions.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 text-sm text-emerald-700 dark:text-emerald-300">
                        Este cliente está num estado fiscal limpo para {periodLabel}. O próximo passo provável é só revisão final e exportação.
                      </div>
                    ) : (
                      nextActions.map((action) => (
                        <div
                          key={action.title}
                          className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold">{action.title}</div>
                              <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                            </div>
                            <Button asChild size="sm" variant="outline" className="shrink-0">
                              <Link to={action.route}>{action.label}</Link>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </ZenCard>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ZenCard gradient="default" withLine className="shadow-lg lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Resumo do cliente</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Baixa confiança</div>
                    <div className="mt-1 text-2xl font-semibold">{data.purchases.lowConfidence}</div>
                    <div className="text-xs text-muted-foreground">em {periodLabel}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Regime IVA</div>
                    <div className="mt-1 text-base font-semibold">{data.client?.vat_regime || 'Não definido'}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">SS do período</div>
                    <div className="mt-1 text-base font-semibold">
                      {data.ss.currentDeclarationStatus || 'Sem declaração'}
                    </div>
                    {data.ss.currentRevenue !== null && (
                      <div className="text-xs text-muted-foreground">
                        Receita {formatCurrency(data.ss.currentRevenue)}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Workflow ativo</div>
                    <div className="mt-1 text-base font-semibold">
                      {taxpayerKind ? taxpayerKindLabel(taxpayerKind) : 'Completo'}
                    </div>
                  </div>
                </CardContent>
              </ZenCard>

                <ZenCard gradient="primary" withCircle className="shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Atalhos rápidos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                  {isAccountant ? (
                    <Button asChild variant="outline" className="w-full justify-between">
                      <Link to="/efatura">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Sincronizar AT
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full justify-between">
                      <Link to="/upload">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Importar documentos
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {isAccountant && (
                    <Button asChild variant="outline" className="w-full justify-between">
                      <Link to="/upload">
                        <span className="flex items-center gap-2">
                          <FileSearch className="h-4 w-4" />
                          Importar documentos
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" className="w-full justify-between">
                    <Link to="/export">
                      <span className="flex items-center gap-2">
                        <FileOutput className="h-4 w-4" />
                        Exportar obrigações
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-between">
                    <Link to="/reconciliation">
                      <span className="flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Reconciliação
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 text-xs text-muted-foreground">
                    <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                      <CalendarClock className="h-4 w-4 text-primary" />
                      Regra do cockpit
                    </div>
                    O centro fiscal prioriza o que é principal para este cliente, mas nunca esconde obrigações com dados já existentes.
                  </div>
                </CardContent>
              </ZenCard>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
