import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAccountant } from '@/hooks/useAccountant';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiscalDeadlines } from '@/components/accountant/FiscalDeadlines';
import { AggregatedFiscalSummary } from '@/components/accountant/AggregatedFiscalSummary';
import { AggregatedMetricsWidget } from '@/components/accountant/AggregatedMetricsWidget';
import { RevenueExpenseCharts } from '@/components/accountant/RevenueExpenseCharts';
import { AttentionItems } from '@/components/dashboard/AttentionItems';
import { SyncHealthWidget } from '@/components/accountant/SyncHealthWidget';
import {
  isFiscallyEffectivePurchase,
  isPurchasePendingReview,
} from '@/lib/fiscalStatus';
import { getPurchaseDeductibleVat } from '@/lib/purchaseDeductibility';
import { getSupplierDisplayName } from '@/lib/supplierNameResolver';
import { 
  Users, 
  FileText, 
  Clock, 
  CheckCircle2, 
  Calculator,
  Building2,
  ChevronRight,
  Loader2,
  AlertCircle,
  Shield,
  Upload,
  ArrowRight,
  BarChart3,
  Filter,
  X,
  TrendingUp
} from 'lucide-react';

export default function AccountantDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [filterClientId, setFilterClientId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const {
    isAccountant,
    isCheckingRole,
    clients,
    isLoadingClients,
    allInvoices,
    allSalesInvoices,
    pendingInvoices,
    isLoadingInvoices,
    metrics,
    batchValidate,
    isBatchValidating,
    validateInvoice,
    isValidating,
  } = useAccountant(filterClientId);

  const { setSelectedClientId: setGlobalSelectedClientId } = useSelectedClient();
  const hasClientFilter = Boolean(filterClientId);

  // Local expand/collapse state for client list (not global context)
  const selectedClientInvoices = useMemo(() => {
    if (!allInvoices || !selectedClientId) return [];
    return allInvoices.filter(inv => inv.client_id === selectedClientId);
  }, [allInvoices, selectedClientId]);

  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  // Filter data based on selected client
  const filteredInvoices = useMemo(() => {
    if (!allInvoices) return [];
    return allInvoices;
  }, [allInvoices]);

  const filteredPendingInvoices = useMemo(() => {
    return pendingInvoices;
  }, [pendingInvoices]);

  const filteredClients = useMemo(() => {
    if (!filterClientId) return clients;
    return clients.filter(c => c.id === filterClientId);
  }, [clients, filterClientId]);

  const filteredSalesInvoices = useMemo(() => {
    if (!allSalesInvoices) return [];
    return allSalesInvoices;
  }, [allSalesInvoices]);

  const filteredMetrics = useMemo(() => {
    if (!filterClientId || !allInvoices) return metrics;
    
    const clientInvoices = allInvoices.filter(inv => inv.client_id === filterClientId);
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    return {
      totalClients: 1,
      totalInvoices: clientInvoices.length,
      pendingValidation: clientInvoices.filter(isPurchasePendingReview).length,
      validatedThisMonth: clientInvoices.filter(inv => inv.status === 'validated' && inv.fiscal_period === currentMonth).length,
      totalVatDeductible: clientInvoices
        .filter(isFiscallyEffectivePurchase)
        .reduce((sum, inv) => sum + getPurchaseDeductibleVat(inv), 0),
      ssDeclarationsPending: clients.find(c => c.id === filterClientId)?.ssStatus !== 'submitted' ? 1 : 0,
      ssTotalContributions: clients.find(c => c.id === filterClientId)?.ssContribution || 0,
    };
  }, [filterClientId, allInvoices, clients, metrics]);

  const selectedClientName = filterClientId 
    ? clients.find(c => c.id === filterClientId)?.company_name || clients.find(c => c.id === filterClientId)?.full_name
    : null;

  useEffect(() => {
    if (!filterClientId) {
      setSelectedClientId(null);
      setSelectedInvoices([]);
      return;
    }

    setSelectedClientId(filterClientId);
  }, [filterClientId]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || !user || isCheckingRole) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAccountant) {
    return (
      <DashboardLayout>
        <Card className="border-destructive/50">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-6">
              Esta página é apenas para contabilistas. O seu perfil não tem permissões de contabilista.
            </p>
            <Button onClick={() => navigate('/')}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoices(filteredPendingInvoices.map(inv => inv.id));
    } else {
      setSelectedInvoices([]);
    }
  };

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    if (checked) {
      setSelectedInvoices(prev => [...prev, invoiceId]);
    } else {
      setSelectedInvoices(prev => prev.filter(id => id !== invoiceId));
    }
  };

  const handleBatchValidate = () => {
    if (selectedInvoices.length > 0) {
      batchValidate(selectedInvoices);
      setSelectedInvoices([]);
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.company_name || client?.full_name || 'Cliente';
  };

  const showDetailedAccountantView = hasClientFilter;

  const handleClientFilterChange = (value: string) => {
    const nextClientId = value === 'all' ? null : value;
    setFilterClientId(nextClientId);
  };

  const handleToggleClientDetails = (clientId: string) => {
    if (selectedClientId === clientId) {
      setSelectedClientId(null);
      setFilterClientId(null);
      setSelectedInvoices([]);
      return;
    }

    setSelectedClientId(clientId);
    setFilterClientId(clientId);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel do Contabilista</h1>
            <p className="text-muted-foreground mt-1">
              {filterClientId 
                ? `A ver dados de: ${selectedClientName}`
                : 'Visão global da carteira. Selecione um cliente para abrir detalhe de compras, fiscalidade e reconciliação.'
              }
            </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/bulk-sync')}>
              <Upload className="h-4 w-4 mr-2" />
              Sincronização em Massa
            </Button>
            
            {/* Client Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={filterClientId || 'all'}
                onValueChange={handleClientFilterChange}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name || client.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filterClientId && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleClientFilterChange('all')}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clientes</p>
                  <p className="text-2xl font-bold">{filteredMetrics.totalClients}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Compras</p>
                  <p className="text-2xl font-bold">{filteredMetrics.totalInvoices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Por Rever</p>
                  <p className="text-2xl font-bold">{filteredMetrics.pendingValidation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Validadas</p>
                  <p className="text-2xl font-bold">{filteredMetrics.validatedThisMonth}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <Calculator className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IVA Ded.</p>
                  <p className="text-lg font-bold text-success">
                    {showDetailedAccountantView ? formatCurrency(filteredMetrics.totalVatDeductible) : 'Selecione cliente'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SS Pend.</p>
                  <p className="text-2xl font-bold text-primary">{filteredMetrics.ssDeclarationsPending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SS Total</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(filteredMetrics.ssTotalContributions)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {showDetailedAccountantView ? (
          <>
            <AggregatedMetricsWidget
              clients={filteredClients.map(c => ({
                ...c,
                ssStatus: c.ssStatus,
                ssContribution: c.ssContribution,
              }))}
              invoices={filteredInvoices.map(inv => ({
                id: inv.id,
                client_id: inv.client_id,
                status: inv.status,
                total_amount: inv.total_amount,
                total_vat: inv.total_vat,
                final_deductibility: inv.final_deductibility,
                document_date: inv.document_date,
              }))}
              isLoading={isLoadingInvoices}
            />

            <AttentionItems
              pendingValidation={filteredMetrics.pendingValidation}
              lowConfidence={filteredPendingInvoices.filter(inv => (inv.ai_confidence ?? 100) < 80).length}
            />
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Detalhe Operacional</CardTitle>
              <CardDescription>
                A visão global da carteira fica leve e imediata. Escolha um cliente para abrir compras, IVA, reconciliação e gráficos sem carregar a base inteira no browser.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Fiscal Overview Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FiscalDeadlines
            ssDeclarationsPending={filteredMetrics.ssDeclarationsPending}
            pendingValidation={filteredMetrics.pendingValidation}
            ivaCadence="both"
          />
          {showDetailedAccountantView ? (
            <AggregatedFiscalSummary
              clients={filteredClients}
              invoices={filteredInvoices}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Resumo Fiscal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Selecione um cliente para ver IVA dedutível, categorias e resumo trimestral com detalhe documental.
                </p>
              </CardContent>
            </Card>
          )}
          <SyncHealthWidget />
        </div>

        <Tabs defaultValue="clients" className="space-y-6">
          <TabsList>
            <TabsTrigger value="clients" className="gap-2">
              <Users className="h-4 w-4" />
              Clientes ({filteredClients.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pendentes ({filteredMetrics.pendingValidation})
            </TabsTrigger>
            <TabsTrigger value="charts" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Gráficos
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          {/* Pending Invoices Tab */}
          <TabsContent value="pending">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Compras Pendentes de Validação</CardTitle>
                  <CardDescription>
                    Compras classificadas pela IA aguardando aprovação
                  </CardDescription>
                </div>
                {showDetailedAccountantView && selectedInvoices.length > 0 && (
                  <Button 
                    onClick={handleBatchValidate}
                    disabled={isBatchValidating}
                    className="gap-2"
                  >
                    {isBatchValidating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Validar {selectedInvoices.length} Seleccionadas
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!showDetailedAccountantView ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecione um cliente para abrir a fila detalhada de validação.</p>
                    <p className="text-sm mt-2">
                      A visão global mostra totais da carteira; o detalhe documental é carregado cliente a cliente.
                    </p>
                  </div>
                ) : isLoadingInvoices ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredPendingInvoices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Não há facturas pendentes de validação</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedInvoices.length === filteredPendingInvoices.length}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Classificação IA</TableHead>
                          <TableHead className="text-right">Confiança</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPendingInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedInvoices.includes(invoice.id)}
                                onCheckedChange={(checked) => 
                                  handleSelectInvoice(invoice.id, checked as boolean)
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {getClientName(invoice.client_id)}
                            </TableCell>
                            <TableCell>
                              {new Date(invoice.document_date).toLocaleDateString('pt-PT')}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{getSupplierDisplayName(invoice.supplier_name, invoice.supplier_nif)}</p>
                                <p className="text-xs text-muted-foreground">{invoice.supplier_nif}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(invoice.total_amount)}
                            </TableCell>
                            <TableCell>
                              <div>
                                <Badge variant="outline">{invoice.ai_classification}</Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Campo {invoice.ai_dp_field} • {invoice.ai_deductibility}%
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={invoice.ai_confidence && invoice.ai_confidence >= 80 ? 'success' : 'warning'}>
                                {invoice.ai_confidence}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => validateInvoice(invoice.id)}
                                disabled={isValidating}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Clientes</CardTitle>
                <CardDescription>
                  Clientes associados à sua conta de contabilista
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingClients ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Não tem clientes associados</p>
                    <p className="text-sm mt-2">
                      Os clientes podem associar-se a si nas definições usando o seu NIF
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => navigate('/settings')}
                    >
                      Gerir Clientes
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredClients.map((client) => (
                      <Card 
                        key={client.id} 
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 rounded-lg bg-muted">
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{client.company_name || client.full_name}</p>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  {client.nif && <span>NIF: {client.nif}</span>}
                                  {client.cae && <span>CAE: {client.cae}</span>}
                                </div>
                              </div>
                            </div>
                            
                            {/* Stats */}
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="text-center px-3">
                                <p className="text-xs text-muted-foreground">Compras</p>
                                <p className="font-medium">{client.invoiceCount}</p>
                              </div>
                              <div className="text-center px-3">
                                <p className="text-xs text-muted-foreground">Por Rever</p>
                                <p className="font-medium text-warning">{client.pendingCount}</p>
                              </div>
                              <div className="text-center px-3">
                                <p className="text-xs text-muted-foreground">Validadas</p>
                                <p className="font-medium text-success">{client.validatedCount}</p>
                              </div>
                              <div className="text-center px-3">
                                <p className="text-xs text-muted-foreground">SS</p>
                                <Badge variant={
                                  client.ssStatus === 'submitted' ? 'success' :
                                  client.ssStatus === 'pending' ? 'warning' : 'outline'
                                }>
                                  {client.ssStatus === 'submitted' ? 'Submetida' :
                                   client.ssStatus === 'pending' ? 'Pendente' : 'N/A'}
                                </Badge>
                              </div>
                            </div>
                            
                            {/* Quick Actions */}
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGlobalSelectedClientId(client.id);
                                  navigate('/validation');
                                }}
                                className="gap-1"
                              >
                                <FileText className="h-3 w-3" />
                                Compras
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGlobalSelectedClientId(client.id);
                                  navigate('/seguranca-social');
                                }}
                                className="gap-1"
                              >
                                <Shield className="h-3 w-3" />
                                SS
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGlobalSelectedClientId(client.id);
                                  navigate('/upload');
                                }}
                                className="gap-1"
                              >
                                <Upload className="h-3 w-3" />
                              </Button>
                              <ChevronRight 
                                className={`h-5 w-5 text-muted-foreground transition-transform cursor-pointer ${
                                  selectedClientId === client.id ? 'rotate-90' : ''
                                }`}
                                onClick={() => handleToggleClientDetails(client.id)}
                              />
                            </div>
                          </div>

                          {/* Expanded client invoices */}
                          {selectedClientId === client.id && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-sm font-medium mb-3">Últimas compras</p>
                              {isLoadingInvoices ? (
                                <div className="space-y-2">
                                  {[...Array(3)].map((_, index) => (
                                    <Skeleton key={index} className="h-10 w-full" />
                                  ))}
                                </div>
                              ) : selectedClientInvoices.length > 0 ? (
                                <>
                                  <div className="space-y-2">
                                    {selectedClientInvoices.slice(0, 5).map((inv) => (
                                      <div 
                                        key={inv.id} 
                                        className="flex items-center justify-between p-2 bg-muted/50 rounded"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Badge variant={
                                            inv.status === 'validated' ? 'success' :
                                            inv.status === 'classified' ? 'warning' : 'outline'
                                          }>
                                            {inv.status === 'validated' ? 'Validada' :
                                             inv.status === 'classified' ? 'Classificada' : 'Pendente'}
                                          </Badge>
                                          <span className="text-sm">
                                            {new Date(inv.document_date).toLocaleDateString('pt-PT')}
                                          </span>
                                          <span className="text-sm text-muted-foreground">
                                            {getSupplierDisplayName(inv.supplier_name, inv.supplier_nif)}
                                          </span>
                                        </div>
                                        <span className="font-medium">
                                          {formatCurrency(inv.total_amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-3 gap-1"
                                    onClick={() => {
                                      setGlobalSelectedClientId(client.id);
                                      navigate('/validation');
                                    }}
                                  >
                                    Ver todas as compras
                                    <ArrowRight className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Não há compras carregadas para este cliente no período disponível.
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts">
            {showDetailedAccountantView ? (
              <RevenueExpenseCharts 
                expenseInvoices={filteredInvoices}
                salesInvoices={filteredSalesInvoices}
                months={12}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Gráficos Financeiros</CardTitle>
                  <CardDescription>
                    Selecione um cliente para cruzar compras e vendas sem sobrecarregar o painel agregado.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios e Exportação</CardTitle>
              <CardDescription>
                  Gere relatórios fiscais e abra o detalhe operacional por cliente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    className="h-24 flex-col gap-2"
                    onClick={() => navigate('/reports')}
                  >
                    <Calculator className="h-6 w-6" />
                    <span>Relatório IVA</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex-col gap-2"
                    onClick={() => navigate('/seguranca-social')}
                  >
                    <Shield className="h-6 w-6" />
                    <span>Segurança Social</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-24 flex-col gap-2"
                    onClick={() => navigate('/modelo-10')}
                  >
                    <FileText className="h-6 w-6" />
                    <span>Modelo 10</span>
                  </Button>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">
                    Estatísticas Rápidas
                    {filterClientId && <Badge variant="outline" className="ml-2">Filtrado</Badge>}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Compras Validadas</p>
                      <p className="text-lg font-bold">{filteredMetrics.validatedThisMonth}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">IVA Dedutível</p>
                      <p className="text-lg font-bold text-success">
                        {showDetailedAccountantView ? formatCurrency(filteredMetrics.totalVatDeductible) : 'Selecione cliente'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SS Pendentes</p>
                      <p className="text-lg font-bold text-warning">{filteredMetrics.ssDeclarationsPending}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SS Total</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(filteredMetrics.ssTotalContributions)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
