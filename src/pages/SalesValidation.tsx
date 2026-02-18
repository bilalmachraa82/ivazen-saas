import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSalesInvoices } from '@/hooks/useSalesInvoices';
import { useAccountant } from '@/hooks/useAccountant';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ZenHeader, ZenCard, ZenStatsCard, ZenDecorations, ZenLoader } from '@/components/zen';
import { FiscalSetupWizard } from '@/components/onboarding/FiscalSetupWizard';
import { SalesInvoiceFilters } from '@/components/sales/SalesInvoiceFilters';
import { SalesInvoiceTable } from '@/components/sales/SalesInvoiceTable';
import { SalesInvoiceDetailDialog } from '@/components/sales/SalesInvoiceDetailDialog';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { StepNavigator } from '@/components/dashboard/StepNavigator';
import type { Tables } from '@/integrations/supabase/types';

type SalesInvoice = Tables<'sales_invoices'>;

export default function SalesValidation() {
  const { user, loading: authLoading } = useAuth();
  const { needsFiscalSetup, isLoading: profileLoading } = useProfile();
  const { isAccountant, isCheckingRole } = useAccountant();
  const { clients } = useClientManagement();
  const { selectedClientId, setSelectedClientId } = useSelectedClient();
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Wait for role check; null prevents fetch for accountants without selection
  const effectiveClientId = isCheckingRole
    ? undefined
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

  if (authLoading || profileLoading) {
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

  // Calculate stats
  const pendingCount = invoices.filter((inv) => inv.status === 'pending').length;
  const validatedCount = invoices.filter((inv) => inv.status === 'validated').length;
  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  return (
    <DashboardLayout>
      <ZenDecorations />

      <ZenHeader
        title="Facturas de Vendas"
        description={isAccountant ? "Reveja e valide as facturas de vendas dos seus clientes" : "Reveja e valide as suas facturas de vendas (receitas)"}
        icon={TrendingUp}
      />


      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <ZenStatsCard
          label="Pendentes"
          value={pendingCount}
          icon={Clock}
          variant={pendingCount > 0 ? 'warning' : 'default'}
        />
        <ZenStatsCard
          label="Validadas"
          value={validatedCount}
          icon={CheckCircle}
          variant="success"
        />
        <ZenStatsCard
          label="Total Receitas"
          value={`€${totalAmount.toFixed(2)}`}
          icon={TrendingUp}
          variant="default"
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
