import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useInvoices } from '@/hooks/useInvoices';
import { useAccountant } from '@/hooks/useAccountant';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvoiceFilters } from '@/components/validation/InvoiceFilters';
import { InvoiceTable } from '@/components/validation/InvoiceTable';
import { InvoiceDetailDialog } from '@/components/validation/InvoiceDetailDialog';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { FiscalSetupWizard } from '@/components/onboarding/FiscalSetupWizard';
import { DuplicateManager } from '@/components/validation/DuplicateManager';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { ZenCard, ZenCardHeader, ZenHeader, ZenDecorations, ZenStatsCard, ZenLoader } from '@/components/zen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, FileText, AlertCircle, Copy, AlertTriangle, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StepNavigator } from '@/components/dashboard/StepNavigator';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;

export default function Validation() {
  const { user, loading: authLoading } = useAuth();
  const { needsFiscalSetup, isLoading: profileLoading } = useProfile();
  const { isAccountant, isCheckingRole } = useAccountant();
  const { clients } = useClientManagement();
  const { selectedClientId, setSelectedClientId } = useSelectedClient();
  const navigate = useNavigate();
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
    reExtractInvoice,
    getSignedUrl,
    getFiscalPeriods,
    refetch,
  } = useInvoices(effectiveClientId);
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkReclassifying, setBulkReclassifying] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

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

  useEffect(() => {
    if (!selectedInvoice) return;
    const updated = invoices.find(inv => inv.id === selectedInvoice.id);
    if (updated && updated !== selectedInvoice) {
      setSelectedInvoice(updated);
    }
  }, [invoices, selectedInvoice]);

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

  const classifiableInvoices = invoices.filter(inv => inv.status === 'classified' || inv.status === 'pending');
  
  const handleBulkReclassify = async () => {
    if (classifiableInvoices.length === 0) {
      toast.info('Não há facturas para reclassificar');
      return;
    }
    setBulkReclassifying(true);
    setBulkProgress({ current: 0, total: classifiableInvoices.length });
    
    let success = 0;
    for (let i = 0; i < classifiableInvoices.length; i += 2) {
      const batch = classifiableInvoices.slice(i, i + 2);
      await Promise.all(batch.map(async (inv) => {
        try {
          await supabase.functions.invoke('classify-invoice', {
            body: { invoice_id: inv.id },
          });
          success++;
        } catch (err) {
          console.error(`Reclassify failed for ${inv.id}:`, err);
        }
      }));
      setBulkProgress({ current: Math.min(i + 2, classifiableInvoices.length), total: classifiableInvoices.length });
    }
    
    toast.success(`${success}/${classifiableInvoices.length} facturas reclassificadas`);
    setBulkReclassifying(false);
    refetch();
  };

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

        {/* Tabs: Facturas / Duplicados */}
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Facturas
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-2">
              <Copy className="h-4 w-4" />
              Duplicados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <ZenCard withLine animationDelay="150ms" className="shadow-xl">
              <div className="flex items-center justify-between px-6 pt-6">
                <ZenCardHeader title="Facturas" icon={FileText} />
                {classifiableInvoices.length > 0 && (
                  <div className="flex items-center gap-3">
                    {bulkReclassifying && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>A reclassificar {bulkProgress.current}/{bulkProgress.total}</span>
                        <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="w-24 h-2" />
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkReclassify}
                      disabled={bulkReclassifying}
                      className="gap-1.5"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${bulkReclassifying ? 'animate-spin' : ''}`} />
                      Reclassificar Todas ({classifiableInvoices.length})
                    </Button>
                  </div>
                )}
              </div>
              <CardContent className="space-y-6">
                <InvoiceFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  fiscalPeriods={getFiscalPeriods()}
                />
                
                <InvoiceTable
                  invoices={invoices}
                  loading={loading}
                  onSelectInvoice={handleSelectInvoice}
                />
              </CardContent>
            </ZenCard>
          </TabsContent>

          <TabsContent value="duplicates">
            <ZenCard withLine animationDelay="150ms" className="shadow-xl">
              <ZenCardHeader title="Gestão de Duplicados" icon={Copy} />
              <CardContent>
                <DuplicateManager onCleanupComplete={() => refetch()} />
              </CardContent>
            </ZenCard>
          </TabsContent>
        </Tabs>

        <StepNavigator currentStep={1} />
      </div>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onValidate={handleValidate}
        onReExtract={reExtractInvoice}
        getSignedUrl={getSignedUrl}
        onNavigate={handleNavigate}
        canNavigatePrev={selectedIndex > 0}
        canNavigateNext={selectedIndex < invoices.length - 1}
        onDataUpdated={refetch}
      />

      <OnboardingTour />
    </DashboardLayout>
  );
}
