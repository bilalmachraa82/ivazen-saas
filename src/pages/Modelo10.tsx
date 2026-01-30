import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZenHeader, ZenLoader } from '@/components/zen';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { WithholdingForm } from '@/components/modelo10/WithholdingForm';
import { WithholdingList } from '@/components/modelo10/WithholdingList';
import { WithholdingSummary } from '@/components/modelo10/WithholdingSummary';
import { WithholdingExport } from '@/components/modelo10/WithholdingExport';
import { WithholdingDashboard } from '@/components/modelo10/WithholdingDashboard';
import { WithholdingHistory } from '@/components/modelo10/WithholdingHistory';
import { BulkUploadTab } from '@/components/modelo10/BulkUploadTab';
import { BulkUploadBanner } from '@/components/modelo10/BulkUploadBanner';
import { BackgroundUploadTab } from '@/components/modelo10/BackgroundUploadTab';
import { MultiClientExport } from '@/components/modelo10/MultiClientExport';
import { ATRecibosImporter } from '@/components/modelo10/ATRecibosImporter';
import { EmailNotificationImporter } from '@/components/modelo10/EmailNotificationImporter';
import { CreateClientDialog } from '@/components/settings/CreateClientDialog';
import { useAuth } from '@/hooks/useAuth';
import { useWithholdings } from '@/hooks/useWithholdings';
import { useClientManagement } from '@/hooks/useClientManagement';
import { FileText, List, BarChart3, Download, PieChart, History, Upload, CloudUpload, Sparkles, Users, FileStack, UserPlus, Settings, FileSpreadsheet, Mail } from 'lucide-react';

export default function Modelo10() {
  const { user, loading: authLoading, roles } = useAuth();
  const navigate = useNavigate();
  const isAccountant = roles?.includes('accountant');
  
  // Client selection for accountants
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const { clients, isLoadingClients } = useClientManagement();

  // Set own account as default for accountants (so they can see their own data first)
  useEffect(() => {
    if (isAccountant && user?.id && !selectedClientId) {
      setSelectedClientId(user.id);
    }
  }, [isAccountant, user?.id, selectedClientId]);

  const {
    withholdings,
    logs,
    summary,
    totals,
    isLoading,
    selectedYear,
    setSelectedYear,
    addWithholding,
    updateWithholding,
    deleteWithholding,
    extractFromImage,
    isAdding,
    isUpdating,
    isDeleting,
  } = useWithholdings(isAccountant ? selectedClientId : null);

  const [activeTab, setActiveTab] = useState('list');

  // Generate year options (current year and 4 previous years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Get selected client name
  const selectedClient = clients.find(c => c.id === selectedClientId);

  if (authLoading) {
    return <ZenLoader text="A carregar..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <ZenHeader
            icon={FileText}
            title="Modelo 10"
            description="Declaração de Rendimentos e Retenções na Fonte"
          />
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Client Selector for Accountants */}
            {isAccountant && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedClientId || ''}
                  onValueChange={(value) => setSelectedClientId(value)}
                  disabled={isLoadingClients}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={isLoadingClients ? "A carregar..." : "Selecionar cliente"} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Option to view own account data */}
                    {user?.id && (
                      <SelectItem key="__self__" value={user.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">Minha conta</span>
                          <span className="text-xs text-muted-foreground">Ver os meus próprios dados</span>
                        </div>
                      </SelectItem>
                    )}
                    {clients.length > 0 && user?.id && (
                      <div className="border-t my-1" />
                    )}
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex flex-col">
                          <span>{client.full_name || client.company_name}</span>
                          {client.nif && (
                            <span className="text-xs text-muted-foreground">NIF: {client.nif}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    {clients.length === 0 && !isLoadingClients && !user?.id && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Nenhum cliente associado
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ano Fiscal:</span>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Client Info Banner for Accountants */}
        {isAccountant && selectedClientId && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    A trabalhar nas retenções de: <span className="text-primary">
                      {selectedClientId === user?.id ? 'Minha conta' : (selectedClient?.full_name || selectedClient?.company_name || 'Cliente')}
                    </span>
                  </p>
                  {selectedClient?.nif && selectedClientId !== user?.id && (
                    <p className="text-xs text-muted-foreground">NIF: {selectedClient.nif}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warning if no client selected (accountants) */}
        {isAccountant && !selectedClientId && !isLoadingClients && clients.length > 0 && (
          <Card className="border-yellow-500/20 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="py-3 px-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Seleccione um cliente para visualizar e gerir as retenções.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Warning if no clients (accountants) - with CTAs */}
        {isAccountant && clients.length === 0 && !isLoadingClients && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-6 px-4">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Sem clientes associados</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione clientes para começar a gerir as retenções do Modelo 10.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setShowCreateClient(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar Novo Cliente
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/settings')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Gestão de Clientes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Client Dialog */}
        <CreateClientDialog 
          open={showCreateClient} 
          onOpenChange={setShowCreateClient}
        />

        {isLoading ? (
          <ZenLoader text="A carregar retenções..." />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className={`grid w-full grid-cols-4 ${isAccountant ? 'lg:grid-cols-11' : 'lg:grid-cols-10'}`}>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Retenções</span>
              </TabsTrigger>
              <TabsTrigger value="add" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Adicionar</span>
              </TabsTrigger>
              <TabsTrigger value="import-at" className="flex items-center gap-2 relative">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Import AT</span>
              </TabsTrigger>
              <TabsTrigger value="import-email" className="flex items-center gap-2 relative">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Emails</span>
                <Badge
                  variant="secondary"
                  className="bg-green-500/10 text-green-600 border-green-500/20 ml-1 text-[10px] px-1.5 py-0 h-4 gap-0.5"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  NOVO
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk (100)</span>
              </TabsTrigger>
              <TabsTrigger value="bulk-bg" className="flex items-center gap-2">
                <CloudUpload className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk (500+)</span>
              </TabsTrigger>
              <TabsTrigger value="summary" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Resumo</span>
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exportar</span>
              </TabsTrigger>
              {isAccountant && (
                <TabsTrigger value="multi-export" className="flex items-center gap-2">
                  <FileStack className="h-4 w-4" />
                  <span className="hidden sm:inline">Multi-Cliente</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              <WithholdingList
                withholdings={withholdings}
                onDelete={async (id) => { await deleteWithholding({ id }); }}
                onUpdate={async (id, data, previousData) => { await updateWithholding({ id, data, previousData }); }}
                isDeleting={isDeleting}
                isUpdating={isUpdating}
                fiscalYear={selectedYear}
              />
            </TabsContent>

            <TabsContent value="add">
              <WithholdingForm
                onSubmit={async (data) => { await addWithholding(data); }}
                onExtract={extractFromImage}
                isSubmitting={isAdding}
                defaultYear={selectedYear}
              />
            </TabsContent>

            <TabsContent value="import-at">
              <ATRecibosImporter
                selectedClientId={isAccountant ? selectedClientId : user?.id}
                selectedYear={selectedYear}
                clientName={isAccountant ? selectedClient?.full_name || selectedClient?.company_name : null}
                onImportComplete={() => setActiveTab('list')}
                isAccountantOwnAccount={isAccountant && selectedClientId === user?.id}
              />
            </TabsContent>

            <TabsContent value="import-email">
              <EmailNotificationImporter
                selectedClientId={isAccountant ? selectedClientId : user?.id}
                selectedYear={selectedYear}
                clientName={isAccountant ? selectedClient?.full_name || selectedClient?.company_name : null}
                onImportComplete={() => setActiveTab('list')}
                isAccountantOwnAccount={isAccountant && selectedClientId === user?.id}
              />
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4">
              <BulkUploadBanner />
              <BulkUploadTab
                selectedClientId={isAccountant ? selectedClientId : user?.id}
                selectedYear={selectedYear}
                clientName={isAccountant ? selectedClient?.full_name || selectedClient?.company_name : null}
                isAccountantOwnAccount={isAccountant && selectedClientId === user?.id}
              />
            </TabsContent>

            <TabsContent value="bulk-bg">
              <BackgroundUploadTab
                selectedClientId={isAccountant ? selectedClientId : user?.id}
                selectedYear={selectedYear}
                isAccountantOwnAccount={isAccountant && selectedClientId === user?.id}
              />
            </TabsContent>

            <TabsContent value="summary">
              <WithholdingSummary
                summary={summary}
                totals={totals}
                selectedYear={selectedYear}
              />
            </TabsContent>

            <TabsContent value="dashboard">
              <WithholdingDashboard
                withholdings={withholdings}
                selectedYear={selectedYear}
              />
            </TabsContent>

            <TabsContent value="export">
              <WithholdingExport
                withholdings={withholdings}
                summary={summary}
                totals={totals}
                selectedYear={selectedYear}
                clientProfile={isAccountant && selectedClientId !== user?.id ? selectedClient : null}
                clientName={isAccountant && selectedClientId !== user?.id ? (selectedClient?.full_name || selectedClient?.company_name) : null}
              />
            </TabsContent>

            {isAccountant && (
              <TabsContent value="multi-export">
                <MultiClientExport
                  clients={clients}
                  selectedYear={selectedYear}
                />
              </TabsContent>
            )}

            <TabsContent value="history">
              <WithholdingHistory
                logs={logs}
                withholdings={withholdings}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
