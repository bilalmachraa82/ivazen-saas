import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { ReconciliationTab } from '@/components/validation/ReconciliationTab';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { ZenCard, ZenCardHeader, ZenHeader, ZenDecorations, ZenStatsCard, ZenLoader, ZenEmptyState } from '@/components/zen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, CheckCircle, FileText, AlertCircle, Copy, AlertTriangle, RefreshCw, CheckSquare, Download, Trash2, X, ArrowLeftRight, Users, Upload as UploadIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { matchesRecentImportWindow } from '@/lib/recentImports';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  // Wait for role check; null prevents fetch during role check and for accountants without selection
  const effectiveClientId = isCheckingRole
    ? null
    : (isAccountant ? (selectedClientId || null) : undefined);
  const { 
    invoices, 
    loading, 
    filters, 
    setFilters, 
    validateInvoice,
    rejectInvoice,
    setAccountingExcluded,
    setAccountingExcludedBulk,
    reExtractInvoice,
    getSignedUrl,
    getFiscalPeriods,
    excludedCount,
    refetch,
  } = useInvoices(effectiveClientId);
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkReclassifying, setBulkReclassifying] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingAccountingBulk, setIsUpdatingAccountingBulk] = useState(false);

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

  // Clear selection when filters change (avoid acting on invisible invoices)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

  useEffect(() => {
    const status = searchParams.get('status') || 'all';
    const review = searchParams.get('review') || 'all';
    const year = searchParams.get('year') || 'all';
    const recent = searchParams.get('recent') || 'all';
    setFilters((prev) => {
      if (
        prev.status === status &&
        (prev.reviewFilter || 'all') === review &&
        prev.year === year &&
        (prev.recentWindow || 'all') === recent
      ) {
        return prev;
      }

      return {
        ...prev,
        status,
        reviewFilter: review,
        year,
        recentWindow: recent as 'all' | '24h' | '7d',
      };
    });
  }, [searchParams, searchParamsKey, setFilters]);

  useEffect(() => {
    const clientFromQuery = searchParams.get('client');
    if (!isAccountant || !clientFromQuery) return;
    if (selectedClientId === clientFromQuery) return;
    setSelectedClientId(clientFromQuery);
  }, [isAccountant, searchParams, selectedClientId, setSelectedClientId]);

  const handleSelectInvoiceById = useCallback(async (invoiceId: string) => {
    const existingInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    if (existingInvoice) {
      setSelectedInvoice(existingInvoice);
      setDialogOpen(true);
      return;
    }

    let query = supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId);

    if (effectiveClientId) {
      query = query.eq('client_id', effectiveClientId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error opening invoice from reconciliation:', error);
      toast.error('Não foi possível abrir a factura seleccionada');
      return;
    }

    if (!data) {
      toast.error('A factura seleccionada não está disponível para este cliente');
      return;
    }

    setSelectedInvoice(data as Invoice);
    setDialogOpen(true);
  }, [effectiveClientId, invoices]);

  useEffect(() => {
    const invoiceFromQuery = searchParams.get('invoice');
    if (!invoiceFromQuery || dialogOpen) return;
    if (authLoading || profileLoading || isCheckingRole || loading) return;
    if (isAccountant && !selectedClientId) return;

    void handleSelectInvoiceById(invoiceFromQuery);
  }, [
    authLoading,
    dialogOpen,
    handleSelectInvoiceById,
    isAccountant,
    isCheckingRole,
    loading,
    profileLoading,
    searchParams,
    selectedClientId,
  ]);

  const syncFilterParams = useCallback((updates: Partial<{
    status: string;
    review: string;
    year: string;
    recent: string;
  }>) => {
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    next.delete('review');
    next.delete('year');
    next.delete('recent');

    const status = updates.status ?? filters.status;
    const review = updates.review ?? (filters.reviewFilter || 'all');
    const year = updates.year ?? filters.year;
    const recent = updates.recent ?? (filters.recentWindow || 'all');

    if (status !== 'all') next.set('status', status);
    if (review !== 'all') next.set('review', review);
    if (year !== 'all') next.set('year', year);
    if (recent !== 'all') next.set('recent', recent);

    setSearchParams(next);
  }, [filters.reviewFilter, filters.recentWindow, filters.status, filters.year, searchParams, setSearchParams]);

  if (authLoading || profileLoading) {
    return <ZenLoader fullScreen text="A carregar..." />;
  }

  if (!user) return null;

  // Show fiscal setup wizard for new users
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

  // Accountant with no clients
  if (isAccountant && clients.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-8 relative">
          <ZenDecorations />
          <ZenHeader icon={CheckCircle} title="Compras" description="Reveja e valide as classificações de IA das facturas dos seus clientes" />
          <ZenEmptyState
            icon={Users}
            title="Sem clientes associados"
            description="Adicione clientes na página de Definições para começar a validar compras."
            action={{ label: "Ir para Definições", onClick: () => navigate('/settings') }}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Accountant with clients but no client selected
  if (isAccountant && clients.length > 0 && !selectedClientId) {
    return (
      <DashboardLayout>
        <div className="space-y-8 relative">
          <ZenDecorations />
          <ZenHeader icon={CheckCircle} title="Compras" description="Reveja e valide as classificações de IA das facturas dos seus clientes" />
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
                placeholder="Selecionar cliente..."
              />
            </div>
          </ZenCard>
          <ZenEmptyState
            icon={Users}
            title="Selecione um cliente"
            description="Escolha um cliente antes de validar facturas de compra."
          />
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
  const needsReviewCount = invoices.filter(inv => inv.requires_accountant_validation === true).length;
  const autoApprovedCount = invoices.filter(inv => inv.requires_accountant_validation === false).length;
  const selectedClient = clients.find((client) => client.id === selectedClientId);

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);

    if (!open && searchParams.has('invoice')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('invoice');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleValidate = async (invoiceId: string, classification: {
    final_classification: string;
    final_dp_field: number | null;
    final_deductibility: number;
  }) => {
    return await validateInvoice(invoiceId, classification);
  };

  const handleExportSelected = async () => {
    const selected = invoices.filter(inv => selectedIds.has(inv.id));
    if (selected.length === 0) return;

    const { default: XLSX } = await import('xlsx');
    const rows = selected.map(inv => ({
      'Data': inv.document_date || '',
      'Fornecedor': inv.supplier_name || '',
      'NIF': inv.supplier_nif || '',
      'Valor Total': Number(inv.total_amount),
      'IVA Total': Number(inv.total_vat || 0),
      'Classificação': inv.final_classification || inv.ai_classification || '',
      'Campo DP': inv.final_dp_field ?? inv.ai_dp_field ?? '',
      'Dedutibilidade %': inv.final_deductibility ?? inv.ai_deductibility ?? '',
      'Confiança IA %': inv.ai_confidence || '',
      'Estado': inv.status,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
    XLSX.writeFile(wb, `facturas_selecionadas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${selected.length} factura(s) exportada(s)`);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);

    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('invoices')
      .delete()
      .in('id', ids);

    if (error) {
      toast.error(`Erro ao eliminar: ${error.message}`);
    } else {
      toast.success(`${ids.length} factura(s) eliminada(s)`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      refetch();
    }
    setIsDeleting(false);
  };

  const handleBulkAccountingToggle = async () => {
    if (selectedIds.size === 0) return;

    const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
    if (selectedInvoices.length === 0) return;

    const shouldExclude = !selectedInvoices.every((inv) => inv.accounting_excluded);
    setIsUpdatingAccountingBulk(true);

    const ok = await setAccountingExcludedBulk(
      selectedInvoices.map((invoice) => invoice.id),
      shouldExclude,
    );

    if (ok) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    }

    setIsUpdatingAccountingBulk(false);
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  const filteredInvoiceIds = invoices.map((invoice) => invoice.id);
  const allFilteredSelected = invoices.length > 0 && filteredInvoiceIds.every((id) => selectedIds.has(id));
  const selectedInvoices = invoices.filter((invoice) => selectedIds.has(invoice.id));
  const allSelectedAccountingExcluded = selectedInvoices.length > 0
    && selectedInvoices.every((invoice) => invoice.accounting_excluded);
  const recentImportsCount = invoices.filter((invoice) =>
    matchesRecentImportWindow(invoice.created_at, '24h'),
  ).length;

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in relative">
        <ZenDecorations />

        <ZenHeader
          icon={CheckCircle}
          title="Validação"
          description="Reveja e valide as classificações de IA das suas facturas com serenidade"
        />

        {isAccountant && clients.length > 0 && (
          <ZenCard withLine animationDelay="75ms" className="shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Cliente ativo para compras</p>
                  <p className="text-xs text-muted-foreground">
                    A validação e qualquer ação em massa só correm sobre o cliente explicitamente escolhido.
                  </p>
                </div>
                <ClientSearchSelector
                  clients={clients}
                  selectedClientId={selectedClientId}
                  onSelect={setSelectedClientId}
                  placeholder="Selecionar cliente..."
                  className="w-full lg:w-[320px]"
                />
              </div>

              {selectedClient ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Cliente:</span>
                  <span className="font-medium text-foreground">
                    {selectedClient.full_name || selectedClient.company_name || 'Cliente'}
                  </span>
                  {selectedClient.nif && (
                    <span className="font-mono">{selectedClient.nif}</span>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Selecione um cliente antes de validar, exportar ou eliminar facturas.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </ZenCard>
        )}


        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <ZenStatsCard
            icon={Clock}
            value={pendingCount}
            label="Pendentes"
            variant="default"
            animationDelay="0ms"
            onClick={() => {
              setFilters((prev) => ({ ...prev, status: 'pending', reviewFilter: 'all' }));
              syncFilterParams({ status: 'pending', review: 'all' });
            }}
          />
          <ZenStatsCard
            icon={AlertTriangle}
            value={needsReviewCount}
            label="Requer revisão"
            variant="warning"
            animationDelay="50ms"
            onClick={() => {
              setFilters((prev) => ({ ...prev, status: 'all', reviewFilter: 'needs_review' }));
              syncFilterParams({ status: 'all', review: 'needs_review' });
            }}
          />
          <ZenStatsCard
            icon={CheckCircle}
            value={autoApprovedCount}
            label="Auto-aprovadas"
            variant="success"
            animationDelay="100ms"
            onClick={() => {
              setFilters((prev) => ({ ...prev, status: 'all', reviewFilter: 'auto_approved' }));
              syncFilterParams({ status: 'all', review: 'auto_approved' });
            }}
          />
          <ZenStatsCard
            icon={CheckCircle}
            value={validatedCount}
            label="Validadas"
            variant="success"
            animationDelay="150ms"
            onClick={() => {
              setFilters((prev) => ({ ...prev, status: 'validated', reviewFilter: 'all' }));
              syncFilterParams({ status: 'validated', review: 'all' });
            }}
          />
          <ZenStatsCard
            icon={AlertCircle}
            value={excludedCount}
            label="Não contabilizar"
            variant="default"
            animationDelay="175ms"
            onClick={() => {
              setFilters((prev) => ({ ...prev, status: 'accounting_excluded', reviewFilter: 'all' }));
              syncFilterParams({ status: 'accounting_excluded', review: 'all' });
            }}
          />
          <ZenStatsCard
            icon={UploadIcon}
            value={recentImportsCount}
            label="Importadas 24h"
            variant="default"
            animationDelay="200ms"
            onClick={() => {
              setFilters((prev) => ({ ...prev, status: 'all', reviewFilter: 'all', recentWindow: '24h' }));
              syncFilterParams({ status: 'all', review: 'all', recent: '24h' });
            }}
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
            <TabsTrigger value="reconciliation" className="gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Reconciliação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <ZenCard withLine animationDelay="150ms" className="shadow-xl">
              <div className="flex items-center justify-between px-6 pt-6">
                <ZenCardHeader title="Facturas" icon={FileText} />
                <div className="flex items-center gap-3">
                  {bulkReclassifying && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>A reclassificar {bulkProgress.current}/{bulkProgress.total}</span>
                      <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="w-24 h-2" />
                    </div>
                  )}
                  {classifiableInvoices.length > 0 && (
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
                  )}
                  {invoices.length > 0 && (
                    <Button
                      variant={selectionMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={toggleSelectionMode}
                      className="gap-1.5"
                    >
                      {selectionMode ? <X className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                      {selectionMode ? 'Cancelar' : 'Selecionar'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Bulk Action Bar */}
              {selectionMode && (
                <div className="mx-6 mt-3 flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="text-sm font-medium">
                    {selectedIds.size} factura{selectedIds.size !== 1 ? 's' : ''} selecionada{selectedIds.size !== 1 ? 's' : ''}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIds(new Set(filteredInvoiceIds))}
                      disabled={allFilteredSelected || invoices.length === 0}
                      className="gap-1.5"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      Selecionar filtradas ({invoices.length})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIds(new Set())}
                      disabled={selectedIds.size === 0}
                    >
                      Limpar
                    </Button>
                    {selectedIds.size > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleBulkAccountingToggle}
                        disabled={isUpdatingAccountingBulk}
                        className="gap-1.5"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        {allSelectedAccountingExcluded ? 'Voltar a contabilizar' : `Não contabilizar (${selectedIds.size})`}
                      </Button>
                    )}
                    {selectedIds.size > 0 && (
                    <Button variant="outline" size="sm" onClick={handleExportSelected} className="gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      Exportar Excel
                    </Button>
                    )}
                    {selectedIds.size > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting} className="gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar ({selectedIds.size})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar {selectedIds.size} factura{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação vai eliminar permanentemente as facturas selecionadas. Esta ação não pode ser revertida.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteSelected}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                  </div>
                </div>
              )}
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
                  selectable={selectionMode}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
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

          <TabsContent value="reconciliation">
            <ZenCard withLine animationDelay="150ms" className="shadow-xl">
              <ZenCardHeader title="Reconciliação AT" icon={ArrowLeftRight} />
              <CardContent>
                {(effectiveClientId || (!isAccountant && user?.id)) ? (
                  <ReconciliationTab
                    clientId={(effectiveClientId || user?.id)!}
                    onCleanupComplete={() => refetch()}
                    onOpenInvoice={handleSelectInvoiceById}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground py-4">
                    Seleccione um cliente para ver a reconciliação.
                  </p>
                )}
              </CardContent>
            </ZenCard>
          </TabsContent>
        </Tabs>

        <StepNavigator currentStep={1} />
      </div>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onValidate={handleValidate}
        onReExtract={reExtractInvoice}
        onReject={rejectInvoice}
        onExcludeFromAccounting={setAccountingExcluded}
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
