import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSalesInvoices } from '@/hooks/useSalesInvoices';
import { useAccountant } from '@/hooks/useAccountant';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ZenHeader, ZenCard, ZenStatsCard, ZenDecorations, ZenLoader, ZenEmptyState } from '@/components/zen';
import { FiscalSetupWizard } from '@/components/onboarding/FiscalSetupWizard';
import { SalesInvoiceFilters } from '@/components/sales/SalesInvoiceFilters';
import { SalesInvoiceTable } from '@/components/sales/SalesInvoiceTable';
import { SalesInvoiceDetailDialog } from '@/components/sales/SalesInvoiceDetailDialog';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { CardContent } from '@/components/ui/card';
import { Clock, CheckCircle, TrendingUp, Users } from 'lucide-react';
import { matchesRecentImportWindow } from '@/lib/recentImports';
import { StepNavigator } from '@/components/dashboard/StepNavigator';
import type { Tables } from '@/integrations/supabase/types';

type SalesInvoice = Tables<'sales_invoices'>;

export default function SalesValidation() {
  const { user, loading: authLoading } = useAuth();
  const { needsFiscalSetup, isLoading: profileLoading } = useProfile();
  const { isAccountant, isCheckingRole } = useAccountant();
  const { clients, isLoadingClients } = useClientManagement();
  const { selectedClientId, setSelectedClientId } = useSelectedClient();
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();

  // Match purchase validation semantics: never fetch the global portfolio for accountants.
  const effectiveClientId = isCheckingRole
    ? null
    : (isAccountant ? (selectedClientId || null) : undefined);
  const {
    invoices,
    loading,
    filters,
    setFilters,
    validateInvoice,
    getSignedUrl,
    getFiscalPeriods,
    refetch,
  } = useSalesInvoices(effectiveClientId);

  // Navigation between invoices
  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedInvoice) return;
    const currentIndex = invoices.findIndex((inv) => inv.id === selectedInvoice.id);
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < invoices.length) {
      setSelectedInvoice(invoices[newIndex]);
    }
  };

  const canNavigatePrev = selectedInvoice
    ? invoices.findIndex((inv) => inv.id === selectedInvoice.id) > 0
    : false;
  const canNavigateNext = selectedInvoice
    ? invoices.findIndex((inv) => inv.id === selectedInvoice.id) < invoices.length - 1
    : false;

  useEffect(() => {
    const status = searchParams.get('status') || 'all';
    const recent = searchParams.get('recent') || 'all';
    setFilters((prev) => (
      prev.status === status && (prev.recentWindow || 'all') === recent
        ? prev
        : { ...prev, status, recentWindow: recent as 'all' | '24h' | '7d' }
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey, setFilters]);

  if (authLoading || profileLoading || isCheckingRole || isLoadingClients) {
    return <ZenLoader fullScreen text="A carregar..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Show fiscal setup wizard for new users (skip for accountants)
  if (needsFiscalSetup && !isAccountant) {
    return (
      <DashboardLayout>
        <div className="space-y-8 relative">
          <ZenDecorations />
          <FiscalSetupWizard onComplete={() => refetch()} />
        </div>
      </DashboardLayout>
    );
  }

  if (isAccountant && clients.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-8 relative">
          <ZenDecorations />
          <ZenHeader
            title="Facturas de Vendas"
            description="Reveja e valide as facturas de vendas dos seus clientes"
            icon={TrendingUp}
          />
          <ZenEmptyState
            icon={Users}
            title="Sem clientes associados"
            description="Adicione ou associe clientes antes de rever facturas de vendas."
          />
        </div>
      </DashboardLayout>
    );
  }

  if (isAccountant && clients.length > 0 && !selectedClientId) {
    return (
      <DashboardLayout>
        <div className="space-y-8 relative">
          <ZenDecorations />
          <ZenHeader
            title="Facturas de Vendas"
            description="Reveja e valide as facturas de vendas dos seus clientes"
            icon={TrendingUp}
          />
          <ZenCard className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Cliente</span>
              </div>
              <ClientSearchSelector
                clients={clients}
                selectedClientId={selectedClientId}
                onSelect={setSelectedClientId}
                isLoading={isLoadingClients}
                placeholder="Selecionar cliente..."
              />
            </div>
          </ZenCard>
          <ZenEmptyState
            icon={Users}
            title="Selecione um cliente"
            description="Escolha explicitamente o cliente antes de rever ou validar vendas."
          />
        </div>
      </DashboardLayout>
    );
  }

  // Calculate stats
  const pendingCount = invoices.filter((inv) => inv.status === 'pending').length;
  const validatedCount = invoices.filter((inv) => inv.status === 'validated').length;
  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
  const recentImportsCount = invoices.filter((invoice) =>
    matchesRecentImportWindow(invoice.created_at, '24h'),
  ).length;

  return (
    <DashboardLayout>
      <ZenDecorations />

      <ZenHeader
        title="Facturas de Vendas"
        description={isAccountant ? "Reveja e valide as facturas de vendas dos seus clientes" : "Reveja e valide as suas facturas de vendas (receitas)"}
        icon={TrendingUp}
      />


      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <ZenStatsCard
          label="Pendentes"
          value={pendingCount}
          icon={Clock}
          variant={pendingCount > 0 ? 'warning' : 'default'}
          onClick={() => {
            setFilters((prev) => ({ ...prev, status: 'pending' }));
            setSearchParams({ status: 'pending', ...(filters.recentWindow && filters.recentWindow !== 'all' ? { recent: filters.recentWindow } : {}) });
          }}
        />
        <ZenStatsCard
          label="Validadas"
          value={validatedCount}
          icon={CheckCircle}
          variant="success"
          onClick={() => {
            setFilters((prev) => ({ ...prev, status: 'validated' }));
            setSearchParams({ status: 'validated', ...(filters.recentWindow && filters.recentWindow !== 'all' ? { recent: filters.recentWindow } : {}) });
          }}
        />
        <ZenStatsCard
          label="Total Receitas"
          value={`€${totalAmount.toFixed(2)}`}
          icon={TrendingUp}
          variant="default"
          onClick={() => {
            setFilters((prev) => ({ ...prev, status: 'all' }));
            setSearchParams(filters.recentWindow && filters.recentWindow !== 'all' ? { recent: filters.recentWindow } : {});
          }}
        />
        <ZenStatsCard
          label="Importadas 24h"
          value={recentImportsCount}
          icon={TrendingUp}
          variant="default"
          onClick={() => {
            setFilters((prev) => ({ ...prev, status: 'all', recentWindow: '24h' }));
            setSearchParams({ recent: '24h' });
          }}
        />
      </div>

      {/* Filters and Table */}
      <ZenCard className="p-6">
        <div className="space-y-6">
          <SalesInvoiceFilters
            filters={filters}
            onFiltersChange={setFilters}
            fiscalPeriods={getFiscalPeriods()}
          />

          <SalesInvoiceTable
            invoices={invoices}
            loading={loading}
            onSelectInvoice={(invoice) => {
              setSelectedInvoice(invoice);
              setDialogOpen(true);
            }}
          />
        </div>
      </ZenCard>

      <StepNavigator currentStep={2} />

      {/* Detail Dialog */}
      <SalesInvoiceDetailDialog
        invoice={selectedInvoice}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onValidate={validateInvoice}
        getSignedUrl={getSignedUrl}
        onNavigate={handleNavigate}
        canNavigatePrev={canNavigatePrev}
        canNavigateNext={canNavigateNext}
      />
    </DashboardLayout>
  );
}
