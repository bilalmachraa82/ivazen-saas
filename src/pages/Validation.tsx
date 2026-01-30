import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useInvoices } from '@/hooks/useInvoices';
import { useClientManagement } from '@/hooks/useClientManagement';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent } from '@/components/ui/card';
import { InvoiceFilters } from '@/components/validation/InvoiceFilters';
import { InvoiceTable } from '@/components/validation/InvoiceTable';
import { InvoiceDetailDialog } from '@/components/validation/InvoiceDetailDialog';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { FiscalSetupWizard } from '@/components/onboarding/FiscalSetupWizard';
import { ZenCard, ZenCardHeader, ZenHeader, ZenDecorations, ZenStatsCard, ZenLoader } from '@/components/zen';
import { Clock, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;

export default function Validation() {
  const { user, loading: authLoading } = useAuth();
  const { needsFiscalSetup, isLoading: profileLoading } = useProfile();
  const { isAccountant, clients } = useClientManagement();
  const navigate = useNavigate();
  const { 
    invoices, 
    loading, 
    filters, 
    setFilters, 
    validateInvoice, 
    getSignedUrl,
    getFiscalPeriods,
    refetch,
  } = useInvoices();
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const selectedIndex = selectedInvoice 
    ? invoices.findIndex(inv => inv.id === selectedInvoice.id) 
    : -1;

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (selectedIndex === -1) return;
    
    const newIndex = direction === 'prev' ? selectedIndex - 1 : selectedIndex + 1;
    if (newIndex >= 0 && newIndex < invoices.length) {
      setSelectedInvoice(invoices[newIndex]);
    }
  }, [selectedIndex, invoices]);

  if (authLoading || profileLoading) {
    return <ZenLoader fullScreen text="A carregar..." />;
  }

  if (!user) return null;

  // Show fiscal setup wizard for new users
  if (needsFiscalSetup) {
    return (
      <DashboardLayout>
        <div className="space-y-8 relative">
          <ZenDecorations />
          <FiscalSetupWizard onComplete={() => refetch()} />
        </div>
      </DashboardLayout>
    );
  }

  const pendingCount = invoices.filter(inv => inv.status === 'pending').length;
  const classifiedCount = invoices.filter(inv => inv.status === 'classified').length;
  const validatedCount = invoices.filter(inv => inv.status === 'validated').length;

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDialogOpen(true);
  };

  const handleValidate = async (invoiceId: string, classification: {
    final_classification: string;
    final_dp_field: number;
    final_deductibility: number;
  }) => {
    return await validateInvoice(invoiceId, classification);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in relative">
        <ZenDecorations />

        <ZenHeader
          icon={CheckCircle}
          title="Validação"
          description="Reveja e valide as classificações de IA das suas facturas com serenidade"
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ZenStatsCard
            icon={Clock}
            value={pendingCount}
            label="Pendentes"
            variant="default"
            animationDelay="0ms"
          />
          <ZenStatsCard
            icon={AlertCircle}
            value={classifiedCount}
            label="Para validar"
            variant="warning"
            animationDelay="50ms"
          />
          <ZenStatsCard
            icon={CheckCircle}
            value={validatedCount}
            label="Validadas"
            variant="success"
            animationDelay="100ms"
          />
        </div>

        {/* Filters & Table Card */}
        <ZenCard withLine animationDelay="150ms" className="shadow-xl">
          <ZenCardHeader title="Facturas" icon={FileText} />
          <CardContent className="space-y-6">
            <InvoiceFilters
              filters={filters}
              onFiltersChange={setFilters}
              fiscalPeriods={getFiscalPeriods()}
              clients={clients}
              showClientFilter={isAccountant}
            />
            
            <InvoiceTable
              invoices={invoices}
              loading={loading}
              onSelectInvoice={handleSelectInvoice}
            />
          </CardContent>
        </ZenCard>
      </div>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onValidate={handleValidate}
        getSignedUrl={getSignedUrl}
        onNavigate={handleNavigate}
        canNavigatePrev={selectedIndex > 0}
        canNavigateNext={selectedIndex < invoices.length - 1}
      />

      <OnboardingTour />
    </DashboardLayout>
  );
}
