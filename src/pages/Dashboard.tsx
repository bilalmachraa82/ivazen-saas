import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useProfile } from '@/hooks/useProfile';
import { useAccountantRequest } from '@/hooks/useAccountantRequest';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZenCard, ZenHeader, ZenDecorations, ZenStatsCard, ZenEmptyState, ZenLoader } from '@/components/zen';
import { UnifiedOnboarding } from '@/components/onboarding/UnifiedOnboarding';
import { TaxFlowWidget } from '@/components/dashboard/TaxFlowWidget';
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
  Sparkles
} from 'lucide-react';

export default function Dashboard() {
  const { user, loading, hasRole } = useAuth();
  const { stats, recentInvoices, isLoading: statsLoading, refetch } = useDashboardStats();
  const { profile, needsFiscalSetup, isLoading: profileLoading } = useProfile();
  const { myRequest } = useAccountantRequest();
  const navigate = useNavigate();
  
  const isAccountant = hasRole('accountant');
  const hasPendingRequest = myRequest?.status === 'pending';
  const showAccountantPromo = !isAccountant && !hasPendingRequest;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || statsLoading || profileLoading) {
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
            title="Dashboard"
            description="Bem-vindo de volta! Aqui está o resumo das suas facturas."
          />
          <Link to="/upload" data-tour="new-invoice">
            <Button className="gap-2 zen-button shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
              <Upload className="h-4 w-4" />
              Nova Factura
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="stats-grid">
          <ZenStatsCard
            icon={FileText}
            value={stats.total}
            label="Total Facturas"
            variant="primary"
            animationDelay="0ms"
          />
          <ZenStatsCard
            icon={Clock}
            value={stats.pending}
            label="Pendentes"
            variant="warning"
            animationDelay="100ms"
          />
          <ZenStatsCard
            icon={CheckCircle}
            value={stats.validated}
            label="Validadas"
            variant="success"
            animationDelay="200ms"
          />
          <ZenStatsCard
            icon={AlertTriangle}
            value={stats.lowConfidence}
            label="Baixa Confiança"
            variant="default"
            animationDelay="300ms"
          />
        </div>

        {/* Onboarding progress card is now handled by UnifiedOnboarding */}

        {/* Recent Invoices */}
        <ZenCard withLine animationDelay="400ms" className="shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              Facturas Recentes
            </CardTitle>
            <Link to="/validation">
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
                title="Nenhuma factura ainda"
                description="Comece por carregar a sua primeira factura para organizar as suas despesas"
                variant="primary"
                action={{
                  label: 'Carregar Factura',
                  onClick: () => navigate('/upload'),
                  icon: Upload,
                }}
              />
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice, index) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all duration-300 group animate-fade-in"
                    style={{ animationDelay: `${500 + index * 100}ms` }}
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </ZenCard>

        {/* Tax Flow Widget */}
        <div className="animate-fade-in" style={{ animationDelay: '450ms' }}>
          <TaxFlowWidget />
        </div>

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
                  <h3 className="font-semibold text-foreground">Carregar Factura</h3>
                  <p className="text-sm text-muted-foreground">Scan QR code ou upload</p>
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
                  <h3 className="font-semibold text-foreground">Validar Facturas</h3>
                  <p className="text-sm text-muted-foreground">Rever classificações IA</p>
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
