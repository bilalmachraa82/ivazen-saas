import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useAccountantRequest } from '@/hooks/useAccountantRequest';
import { useAccountantClients } from '@/hooks/useAccountantClients';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ZenCard, ZenHeader, ZenDecorations, ZenStatsCard, ZenEmptyState, ZenLoader } from '@/components/zen';
import { UnifiedOnboarding } from '@/components/onboarding/UnifiedOnboarding';
import { TaxFlowWidget } from '@/components/dashboard/TaxFlowWidget';
import { AttentionItems } from '@/components/dashboard/AttentionItems';
import { FiscalDeadlines } from '@/components/accountant/FiscalDeadlines';
import { useClientReadiness } from '@/hooks/useClientReadiness';
import { PortfolioReadinessCard } from '@/components/dashboard/PortfolioReadinessCard';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Upload,
  ArrowRight,
  LayoutDashboard,
  Shield,
  Receipt,
  Briefcase,
  Sparkles,
  Users,
  BookOpen,
  HelpCircle,
} from 'lucide-react';

export default function Dashboard() {
  const { user, loading, hasRole } = useAuth();
  const { profile } = useProfile();
  const isAccountant = hasRole('accountant');
  const currentYear = new Date().getFullYear();
  const [dashboardYearFilter, setDashboardYearFilter] = useState<string>(String(currentYear));
  const { selectedClientId } = useSelectedClient();
  const { getClientById } = useAccountantClients({ enabled: isAccountant });
  const selectedClient = isAccountant ? getClientById(selectedClientId) : null;
  const { data: selectedClientTaxProfile, isLoading: selectedClientTaxProfileLoading } = useQuery({
    queryKey: ['dashboard-selected-client-tax-profile', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('vat_regime, iva_cadence')
        .eq('id', selectedClientId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: isAccountant && !!selectedClientId,
    staleTime: 30000,
  });
  const hasSelectedClient = !isAccountant || !!selectedClientId;
  const selectedDashboardYear = isAccountant && dashboardYearFilter !== 'all'
    ? Number(dashboardYearFilter)
    : null;
  const yearOptions = useMemo(
    () => Array.from({ length: 4 }, (_, index) => currentYear - index),
    [currentYear],
  );
  const { stats, recentInvoices, isLoading: statsLoading } = useDashboardStats(
    isAccountant ? (selectedClientId ?? null) : undefined,
    { year: selectedDashboardYear },
  );
  const { myRequest } = useAccountantRequest();
  const { clients: accountantClients, summary, totalClients, readinessMap, isLoading: readinessLoading } = useClientReadiness();
  const navigate = useNavigate();
  const rawVatRegime = isAccountant
    ? (selectedClientTaxProfile?.vat_regime ?? null)
    : (profile?.vat_regime ?? null);
  const vatRegime = rawVatRegime;
  // Infer cadence from vat_regime when iva_cadence is not explicitly set
  const rawCadence = isAccountant
    ? (selectedClientTaxProfile?.iva_cadence ?? null)
    : (profile?.iva_cadence ?? null);
  const ivaCadence: 'monthly' | 'quarterly' | 'both' = rawCadence
    ?? (rawVatRegime === 'normal_monthly' ? 'monthly'
      : rawVatRegime === 'normal_quarterly' ? 'quarterly'
      : 'quarterly');

  const hasPendingRequest = myRequest?.status === 'pending';
  const showAccountantPromo = !isAccountant && !hasPendingRequest;
  const selectedClientName = selectedClient?.company_name || selectedClient?.full_name || selectedClient?.nif || 'selecionado';
  const accountantPeriodLabel = selectedDashboardYear ? `Ano ${selectedDashboardYear}` : 'Todos os anos';
  const accountantPeriodDescription = selectedDashboardYear
    ? `Resumo de compras de ${selectedDashboardYear}.`
    : 'Resumo de compras de todos os anos.';
  const recentSectionTitle = isAccountant ? 'Compras Recentes' : 'Facturas Recentes';
  const recentEmptyTitle = isAccountant
    ? selectedDashboardYear
      ? `Sem compras em ${selectedDashboardYear}`
      : 'Sem compras para este cliente'
    : 'Nenhuma factura ainda';
  const recentEmptyDescription = isAccountant
    ? selectedDashboardYear
      ? `Não existem compras registadas em ${selectedDashboardYear} para este cliente. Pode mudar o período para ver anos anteriores ou importar novas compras.`
      : 'Importe compras do AT, SIRE ou carregue documentos manualmente na página de Importação.'
    : 'Comece por carregar a sua primeira factura para organizar as suas despesas';
  const validationQuery = selectedDashboardYear ? `?year=${selectedDashboardYear}` : '';
  const openValidationQuery = selectedDashboardYear ? `?status=open&year=${selectedDashboardYear}` : '?status=open';
  const validatedValidationQuery = selectedDashboardYear ? `?status=validated&year=${selectedDashboardYear}` : '?status=validated';
  const lowConfidenceValidationQuery = selectedDashboardYear ? `?review=needs_review&year=${selectedDashboardYear}` : '?review=needs_review';
  const buildInvoiceValidationRoute = (invoiceId: string) => {
    const params = new URLSearchParams();
    params.set('invoice', invoiceId);
    if (selectedDashboardYear) {
      params.set('year', String(selectedDashboardYear));
    }
    return `/validation?${params.toString()}`;
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || statsLoading || selectedClientTaxProfileLoading) {
    return <ZenLoader fullScreen text="A carregar..." />;
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      {/* Unified Onboarding System - handles all onboarding phases */}
      <UnifiedOnboarding>
        <div className="space-y-8 relative">
          <ZenDecorations />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <ZenHeader
            icon={LayoutDashboard}
            title={isAccountant ? "Carteira" : "Dashboard"}
            description={isAccountant
              ? hasSelectedClient
                ? `Visão geral do cliente ${selectedClientName}. ${accountantPeriodDescription}`
                : "Visão geral da sua carteira. Selecione um cliente no menu para ver os dados reais do Centro Fiscal."
              : "Bem-vindo de volta! Aqui está o resumo das suas facturas."
            }
          />
          <Link to={isAccountant ? "/centro-importacao" : "/upload"} data-tour="new-invoice">
            <Button className="gap-2 zen-button shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
              <Upload className="h-4 w-4" />
              {isAccountant ? 'Importar Dados' : 'Nova Factura'}
            </Button>
          </Link>
        </div>

        {isAccountant && !hasSelectedClient ? (
          <>
            {/* Portfolio readiness summary — single instance avoids unmount/remount */}
            {readinessLoading || totalClients > 0 ? (
              <PortfolioReadinessCard
                clients={accountantClients}
                readinessMap={readinessMap}
                summary={summary}
                totalClients={totalClients}
                isLoading={readinessLoading}
              />
            ) : (
              <ZenEmptyState
                icon={Users}
                title="Sem clientes associados"
                description="Adicione clientes na página de Definições para começar."
                action={{
                  label: 'Ir para Definições',
                  onClick: () => navigate('/settings'),
                }}
              />
            )}

            {/* Quick-start guide for accountants — only when they have clients */}
            {totalClients > 0 && <ZenCard withLine animationDelay="150ms" className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  Como Começar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Link to="/centro-fiscal" className="group rounded-lg border p-4 hover:border-primary/40 hover:bg-primary/5 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">1</span>
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">Selecionar Cliente</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Escolha no menu lateral e abra o Centro Fiscal</p>
                  </Link>
                  <Link to="/centro-importacao" className="group rounded-lg border p-4 hover:border-primary/40 hover:bg-primary/5 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">2</span>
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">Importar Dados</span>
                    </div>
                    <p className="text-xs text-muted-foreground">SIRE CSV, recibos verdes Excel, ou upload manual</p>
                  </Link>
                  <Link to="/validation" className="group rounded-lg border p-4 hover:border-primary/40 hover:bg-primary/5 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">3</span>
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">Validar e Trabalhar</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Compras, Vendas, SS ou Modelo 10 conforme o cliente</p>
                  </Link>
                  <Link to="/export" className="group rounded-lg border p-4 hover:border-primary/40 hover:bg-primary/5 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">4</span>
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">Exportar</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Gerar apuramento IVA, PDF ou Excel</p>
                  </Link>
                </div>
                <div className="mt-3 flex justify-end">
                  <Link to="/guide" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    Ver guia completo
                  </Link>
                </div>
              </CardContent>
            </ZenCard>}
          </>
        ) : (
          <>
            {isAccountant && (
              <ZenCard withLine animationDelay="250ms" className="shadow-lg">
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Carteira de Compras</Badge>
                      <Badge variant="outline">{accountantPeriodLabel}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Estas métricas resumem compras do cliente selecionado. Para vendas e recibos verdes use o módulo de Vendas ou o Centro Fiscal.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="w-full sm:w-[180px]">
                      <Select value={dashboardYearFilter} onValueChange={setDashboardYearFilter}>
                        <SelectTrigger aria-label="Período do dashboard">
                          <SelectValue placeholder="Período" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os anos</SelectItem>
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={String(year)}>
                              Ano {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Link to="/sales">
                      <Button variant="outline" className="w-full sm:w-auto">
                        Ver Vendas
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </ZenCard>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="stats-grid">
              <ZenStatsCard
                icon={FileText}
                value={stats.total}
                label={isAccountant ? 'Total Compras' : 'Total Facturas'}
                variant="primary"
                animationDelay="0ms"
                href={`/validation${validationQuery}`}
              />
              <ZenStatsCard
                icon={Clock}
                value={stats.pending}
                label={isAccountant ? 'Compras por Rever' : 'Por Rever'}
                variant="warning"
                animationDelay="100ms"
                href={`/validation${openValidationQuery}`}
              />
              <ZenStatsCard
                icon={CheckCircle}
                value={stats.validated}
                label={isAccountant ? 'Compras Validadas' : 'Validadas'}
                variant="success"
                animationDelay="200ms"
                href={`/validation${validatedValidationQuery}`}
              />
              <ZenStatsCard
                icon={AlertTriangle}
                value={stats.lowConfidence}
                label={isAccountant ? 'Compras com Baixa Confiança' : 'Baixa Confiança'}
                variant="default"
                animationDelay="300ms"
                href={`/validation${lowConfidenceValidationQuery}`}
              />
            </div>

            {/* Onboarding progress card is now handled by UnifiedOnboarding */}

            {/* Attention Items */}
            <AttentionItems
              pendingValidation={stats.pending}
              lowConfidence={stats.lowConfidence}
              documentLabel={isAccountant ? 'compras' : 'facturas'}
              querySuffix={validationQuery}
            />

            {/* Fiscal Deadlines */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FiscalDeadlines
                ssDeclarationsPending={0}
                pendingValidation={stats.pending}
                ivaCadence={ivaCadence}
                vatRegime={vatRegime}
              />
            </div>

            {/* Recent Purchases / Invoices */}
            <ZenCard withLine animationDelay="400ms" className="shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-semibold flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  {recentSectionTitle}
                </CardTitle>
                <Link to={`/validation${validationQuery}`}>
                  <Button variant="ghost" size="sm" className="gap-1 group">
                    Ver todas
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {recentInvoices.length === 0 ? (
                  <ZenEmptyState
                    icon={FileText}
                    title={recentEmptyTitle}
                    description={recentEmptyDescription}
                    variant="primary"
                    action={{
                      label: isAccountant ? 'Ir para Importação' : 'Carregar Factura',
                      onClick: () => navigate(isAccountant ? '/centro-importacao' : '/upload'),
                      icon: Upload,
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    {recentInvoices.map((invoice, index) => (
                      <div
                        key={invoice.id}
                        className="flex cursor-pointer items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all duration-300 group animate-fade-in"
                        style={{ animationDelay: `${500 + index * 100}ms` }}
                        onClick={() => navigate(buildInvoiceValidationRoute(invoice.id))}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{invoice.supplier}</p>
                            <p className="text-sm text-muted-foreground">{invoice.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold text-foreground">
                              €{invoice.amount.toFixed(2)}
                            </p>
                            <div className="flex items-center gap-1 justify-end">
                              <div 
                                className={`h-1.5 w-1.5 rounded-full ${
                                  invoice.confidence >= 80 ? 'bg-success' : 
                                  invoice.confidence >= 60 ? 'bg-warning' : 'bg-destructive'
                                }`} 
                              />
                              <p className="text-xs text-muted-foreground">
                                {invoice.confidence}% confiança
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant={invoice.status === 'validated' ? 'default' : 'secondary'}
                            className={invoice.status === 'validated' ? 'bg-success/10 text-success border-success/20' : ''}
                          >
                            {invoice.status === 'validated' ? 'Validada' : 'Pendente'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(buildInvoiceValidationRoute(invoice.id));
                            }}
                          >
                            Abrir
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </ZenCard>

            {/* Tax Flow Widget */}
            <div className="animate-fade-in" style={{ animationDelay: '450ms' }}>
              <TaxFlowWidget clientId={isAccountant ? selectedClientId : undefined} />
            </div>
          </>
        )}

        {/* Become Accountant Promo */}
        {showAccountantPromo && (
          <Link to="/become-accountant" className="block animate-fade-in" style={{ animationDelay: '475ms' }}>
            <ZenCard hoverScale className="overflow-hidden border-primary/20 hover:border-primary/40 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
              <CardContent className="p-6 flex items-center gap-6 relative">
                <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl shrink-0">
                  <Briefcase className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground text-lg">É Contabilista Certificado?</h3>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Novo
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Registe-se como contabilista e gerencie os seus clientes directamente na plataforma. Acesso a ferramentas exclusivas e dashboard agregado.
                  </p>
                </div>
                <Button className="gap-2 shrink-0">
                  Saber Mais
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </ZenCard>
          </Link>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4" data-tour="quick-actions">
          <Link to="/upload" className="animate-slide-up" style={{ animationDelay: '500ms' }}>
            <ZenCard hoverScale withCircle gradient="primary" className="h-full">
              <div className="absolute top-0 left-0 w-0 h-1 bg-primary group-hover:w-full transition-all duration-500" />
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {isAccountant ? 'Importar Compras' : 'Carregar Factura'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isAccountant ? 'AT, SIRE CSV ou upload manual' : 'Scan QR code ou upload'}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </CardContent>
            </ZenCard>
          </Link>

          <Link to="/validation" className="animate-slide-up" style={{ animationDelay: '600ms' }}>
            <ZenCard hoverScale withCircle gradient="success" className="h-full">
              <div className="absolute top-0 left-0 w-0 h-1 bg-green-500 group-hover:w-full transition-all duration-500" />
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {isAccountant ? 'Validar Compras' : 'Validar Facturas'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isAccountant ? 'Rever compras e classificações IA' : 'Rever classificações IA'}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </CardContent>
            </ZenCard>
          </Link>

          <Link to="/export" className="animate-slide-up" style={{ animationDelay: '700ms' }}>
            <ZenCard hoverScale withCircle gradient="muted" className="h-full">
              <div className="absolute top-0 left-0 w-0 h-1 bg-accent group-hover:w-full transition-all duration-500" />
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-accent/20 to-accent/5 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Exportar Dados</h3>
                  <p className="text-sm text-muted-foreground">Excel por período fiscal</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </CardContent>
            </ZenCard>
          </Link>

          <Link to="/seguranca-social" className="animate-slide-up" style={{ animationDelay: '800ms' }}>
            <ZenCard hoverScale withCircle gradient="muted" className="h-full">
              <div className="absolute top-0 left-0 w-0 h-1 bg-blue-500 group-hover:w-full transition-all duration-500" />
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Shield className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Segurança Social</h3>
                  <p className="text-sm text-muted-foreground">Declaração trimestral</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </CardContent>
            </ZenCard>
          </Link>

          <Link to="/modelo-10" className="animate-slide-up" style={{ animationDelay: '900ms' }}>
            <ZenCard hoverScale withCircle gradient="muted" className="h-full">
              <div className="absolute top-0 left-0 w-0 h-1 bg-orange-500 group-hover:w-full transition-all duration-500" />
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-orange-500/20 to-orange-500/5 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Receipt className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Modelo 10</h3>
                  <p className="text-sm text-muted-foreground">Retenções na Fonte</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </CardContent>
            </ZenCard>
          </Link>
        </div>

        {/* Interactive tour is now handled by UnifiedOnboarding */}
        </div>
      </UnifiedOnboarding>
    </DashboardLayout>
  );
}
