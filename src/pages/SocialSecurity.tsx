import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useClientFiscalProfile } from '@/hooks/useClientFiscalProfile';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { useSocialSecurity, REVENUE_CATEGORIES } from '@/hooks/useSocialSecurity';
import { detectCategoryFromCAE } from '@/lib/csvParser';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  FileText,
  History,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { RevenueImporter } from '@/components/social-security/RevenueImporter';
import { PortalLinks } from '@/components/social-security/PortalLinks';
import { RevenueCharts } from '@/components/social-security/RevenueCharts';
import { SSRevenueBreakdown } from '@/components/social-security/SSRevenueBreakdown';
import { SSCalculationSummary } from '@/components/social-security/SSCalculationSummary';
import { SubmissionSuccessDialog } from '@/components/social-security/SubmissionSuccessDialog';
import { ZenEmptyState } from '@/components/zen';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';

export default function SocialSecurity() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAccountant, clients, isLoadingClients } = useClientManagement();
  const { selectedClientId, setSelectedClientId } = useSelectedClient();
  
  // For accountants, use selected client; for regular users, use their own ID
  const effectiveClientId = isAccountant ? selectedClientId : undefined;
  const { profile, isLoading: profileLoading } = useClientFiscalProfile(effectiveClientId);
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  
  const {
    quarter,
    setQuarter,
    revenueEntries,
    salesInvoices,
    declaration,
    declarationsHistory,
    totals,
    availableQuarters,
    isLoading,
    isSubmittedQuarterLocked,
    addRevenue,
    isAddingRevenue,
    deleteRevenue,
    saveDeclaration,
    isSavingDeclaration,
    bulkImport,
    createSalesInvoices,
    isDeadlineMonth,
    getQuarterLabel: getLabel,
    calculatedContribution,
  } = useSocialSecurity(undefined, effectiveClientId, variationPercent);

  const [variationPercent, setVariationPercent] = useState(-25);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Auto-detect default category from client's CAE
  const detectedCategory = useMemo(() => {
    if (profile?.cae || profile?.activity_description) {
      return detectCategoryFromCAE(profile?.cae, profile?.activity_description);
    }
    return null;
  }, [profile?.cae, profile?.activity_description]);

  const [newCategory, setNewCategory] = useState('prestacao_servicos');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [declarationNotes, setDeclarationNotes] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const readOnlyQuarterMessage = `O trimestre ${getLabel(quarter)} já foi marcado como submetido e está em modo só leitura.`;

  // Redirect if not logged in
  if (!authLoading && !user) {
    navigate('/auth');
    return null;
  }

  if (authLoading || profileLoading || isLoading || isLoadingClients) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }
  
  // For accountants without clients selected, show empty state
  if (isAccountant && clients.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Segurança Social</h1>
              <p className="text-muted-foreground">Declaração trimestral de rendimentos</p>
            </div>
          </div>
          <ZenEmptyState
            icon={Users}
            title="Sem clientes associados"
            description="Adicione clientes na página de Definições para gerir as suas declarações de Segurança Social."
            action={{
              label: "Ir para Definições",
              onClick: () => navigate('/settings'),
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (isAccountant && clients.length > 0 && !selectedClientId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Segurança Social</h1>
              <p className="text-muted-foreground">Declaração trimestral de rendimentos</p>
            </div>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <Label>Cliente:</Label>
                </div>
                <ClientSearchSelector
                  clients={clients}
                  selectedClientId={selectedClientId}
                  onSelect={setSelectedClientId}
                  placeholder="Selecione um cliente"
                  className="w-full sm:w-[320px]"
                />
              </div>
            </CardContent>
          </Card>

          <ZenEmptyState
            icon={Users}
            title="Selecione um cliente"
            description="Escolha explicitamente o cliente antes de calcular, importar ou submeter Segurança Social."
          />
        </div>
      </DashboardLayout>
    );
  }
  
  // Check if exempt - first year
  if (profile?.is_first_year) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Segurança Social</h1>
              <p className="text-muted-foreground">Declaração trimestral de rendimentos</p>
            </div>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">Isenção 1º Ano</h3>
                  <p className="text-muted-foreground">
                    Está marcado como estando no primeiro ano de actividade, pelo que está isento de contribuições.
                  </p>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto mt-2"
                    onClick={() => navigate('/settings')}
                  >
                    Alterar nas definições
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Check if accountant manages SS
  if (profile?.has_accountant_ss) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Segurança Social</h1>
              <p className="text-muted-foreground">Declaração trimestral de rendimentos</p>
            </div>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">Contabilidade Organizada</h3>
                  <p className="text-muted-foreground">
                    As suas contribuições para a Segurança Social são geridas pelo seu contabilista.
                    Contacte-o para esclarecimentos sobre valores ou prazos.
                  </p>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto mt-2"
                    onClick={() => navigate('/settings')}
                  >
                    Alterar nas definições
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const contributionRate = calculatedContribution.isExempt ? 0 : (profile?.ss_contribution_rate || 21.4);
  const contributionBase = calculatedContribution.base;
  const contributionAmount = calculatedContribution.amount;

  const handleAddRevenue = () => {
    if (isSubmittedQuarterLocked) {
      toast.error(readOnlyQuarterMessage);
      return;
    }

    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Introduza um valor válido');
      return;
    }

    addRevenue({
      category: newCategory,
      amount,
      notes: newNotes || undefined,
    });

    setNewAmount('');
    setNewNotes('');
    setAddDialogOpen(false);
  };

  const handleSaveDeclaration = (status: 'draft' | 'submitted') => {
    if (isSubmittedQuarterLocked) {
      toast.error(readOnlyQuarterMessage);
      return;
    }

    saveDeclaration({
      contributionRate,
      status,
      notes: declarationNotes || undefined,
    }, {
      onSuccess: () => {
        if (status === 'submitted') {
          setShowSuccessDialog(true);
        }
      }
    });
  };

  const openSSPortal = () => {
    window.open('https://app.seg-social.pt/', '_blank', 'noopener,noreferrer');
  };

  const copyToClipboard = () => {
    const text = `Declaração Trimestral Segurança Social
Período: ${getLabel(quarter)}
Total de Rendimentos: ${totals.total.toFixed(2)}€
Base de Incidência Contributiva: ${contributionBase.toFixed(2)}€
Variação: ${variationPercent > 0 ? '+' : ''}${variationPercent}%
Taxa Contributiva: ${contributionRate}%
Contribuição a Pagar: ${contributionAmount.toFixed(2)}€`;

    navigator.clipboard.writeText(text);
    toast.success('Dados copiados para a área de transferência');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Segurança Social</h1>
              <p className="text-muted-foreground">Declaração trimestral de rendimentos</p>
            </div>
          </div>

        {isSubmittedQuarterLocked && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <p className="font-medium">Trimestre fechado</p>
              <p className="text-sm text-muted-foreground">
                {readOnlyQuarterMessage}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Client Selector for Accountants */}
        {isAccountant && clients.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <Label>Cliente:</Label>
                </div>
                <ClientSearchSelector
                  clients={clients}
                  selectedClientId={selectedClientId}
                  onSelect={setSelectedClientId}
                  placeholder="Seleccione um cliente"
                  className="w-full sm:w-[300px]"
                />
                {selectedClient?.nif && (
                  <Badge variant="outline" className="w-fit font-mono text-[11px]">
                    {selectedClient.nif}
                  </Badge>
                )}
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableQuarters.map((q) => (
                      <SelectItem key={q} value={q}>
                        {getLabel(q)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quarter selector for regular users */}
        {!isAccountant && (
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableQuarters.map((q) => (
                <SelectItem key={q} value={q}>
                  {getLabel(q)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        </div>

        {calculatedContribution.isExempt && !profile?.is_first_year && !profile?.has_accountant_ss && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Contribuição isenta neste trimestre</p>
                  <p className="text-sm text-muted-foreground">
                    {calculatedContribution.exemptReason || 'Sem contribuição de Segurança Social para o período selecionado.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deadline Alert */}
        {isDeadlineMonth && !declaration?.status?.includes('submitted') && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Período de Entrega</p>
                  <p className="text-sm text-muted-foreground">
                    Este é um mês de entrega da declaração trimestral. Prazo até dia 15.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="declaration" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="declaration" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Declaração</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="declaration" className="space-y-4">
            {calculatedContribution.isExempt ? (
              <SSCalculationSummary
                totals={totals}
                contributionBase={0}
                contributionAmount={0}
                contributionRate={contributionRate}
                variationPercent={variationPercent}
                onVariationChange={setVariationPercent}
                isExempt={true}
                exemptReason={calculatedContribution.exemptReason}
                quarterLabel={getLabel(quarter)}
                clientName={selectedClient?.full_name || profile?.full_name || ''}
                clientNif={selectedClient?.nif || profile?.nif || ''}
                monthlyBreakdown={totals.monthlyBreakdown}
                onMarkSubmitted={() => handleSaveDeclaration('submitted')}
                isSubmittedLocked={isSubmittedQuarterLocked}
                isSaving={isSavingDeclaration}
              />
            ) : (
              <>
                {/* Section 2: Monthly Revenue Breakdown */}
                <SSRevenueBreakdown
                  monthlyBreakdown={totals.monthlyBreakdown}
                  quarterLabel={getLabel(quarter)}
                />

                {/* Manual entry button */}
                <div className="flex justify-end">
                  <Dialog
                    open={addDialogOpen}
                    onOpenChange={(nextOpen) => {
                      if (nextOpen && isSubmittedQuarterLocked) {
                        toast.error(readOnlyQuarterMessage);
                        return;
                      }
                      if (nextOpen && detectedCategory) {
                        setNewCategory(detectedCategory.category);
                      }
                      setAddDialogOpen(nextOpen);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2" disabled={isSubmittedQuarterLocked}>
                        <Plus className="h-4 w-4" />
                        Adicionar rendimento manual
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Rendimento</DialogTitle>
                        <DialogDescription>
                          Introduza o valor do rendimento para a categoria seleccionada
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Categoria</Label>
                          <Select value={newCategory} onValueChange={setNewCategory}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {REVENUE_CATEGORIES.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {detectedCategory && detectedCategory.confidence !== 'low' && (
                            <p className="text-xs text-muted-foreground">
                              Sugestão: {REVENUE_CATEGORIES.find(c => c.value === detectedCategory.category)?.label || detectedCategory.category} ({detectedCategory.reason})
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Valor (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={newAmount}
                            onChange={(e) => setNewAmount(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Notas (opcional)</Label>
                          <Textarea
                            placeholder="Descrição opcional..."
                            value={newNotes}
                            onChange={(e) => setNewNotes(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddRevenue} disabled={isAddingRevenue || isSubmittedQuarterLocked}>
                          {isAddingRevenue && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Adicionar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Section 3: Calculation + Actions */}
                <SSCalculationSummary
                  totals={totals}
                  contributionBase={contributionBase}
                  contributionAmount={contributionAmount}
                  contributionRate={contributionRate}
                  variationPercent={variationPercent}
                  onVariationChange={setVariationPercent}
                  isExempt={false}
                  exemptReason=""
                  quarterLabel={getLabel(quarter)}
                  clientName={selectedClient?.full_name || profile?.full_name || ''}
                  clientNif={selectedClient?.nif || profile?.nif || ''}
                  monthlyBreakdown={totals.monthlyBreakdown}
                  onMarkSubmitted={() => handleSaveDeclaration('submitted')}
                  isSubmittedLocked={isSubmittedQuarterLocked}
                  isSaving={isSavingDeclaration}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-6">
            {/* Quick Upload Sales Invoice */}
            <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Upload className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Carregar Factura de Venda</CardTitle>
                      <CardDescription>
                        Adicione facturas de venda individuais para contabilizar receitas
                      </CardDescription>
                    </div>
                  </div>
                  <Button 
                    onClick={() => navigate('/upload?type=sales')} 
                    disabled={isSubmittedQuarterLocked}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Upload className="h-4 w-4" />
                    Carregar Factura
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Facturas validadas são automaticamente incluídas nas receitas do trimestre</span>
                </div>
              </CardContent>
            </Card>

            <PortalLinks />
            {isSubmittedQuarterLocked ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  {readOnlyQuarterMessage}
                </CardContent>
              </Card>
            ) : (
              <RevenueImporter 
                onImport={bulkImport} 
                onCreateSalesInvoices={createSalesInvoices}
                currentQuarter={quarter}
                userCAE={profile?.cae}
                activityDescription={profile?.activity_description}
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <RevenueCharts
              declarationsHistory={declarationsHistory}
              getQuarterLabel={getLabel}
            />
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Declarações</CardTitle>
                <CardDescription>
                  Todas as suas declarações trimestrais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Rendimento</TableHead>
                      <TableHead>Contribuição</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {declarationsHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8">
                          <ZenEmptyState
                            icon={History}
                            title="Sem histórico"
                            description="Ainda não existem declarações guardadas. Importe recibos verdes para calcular contribuições."
                            variant="muted"
                            action={{
                              label: 'Importar Rendimentos',
                              onClick: () => navigate('/centro-importacao'),
                              icon: Upload,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      declarationsHistory.map((decl) => (
                        <TableRow key={decl.id}>
                          <TableCell className="font-medium">
                            {getLabel(decl.period_quarter)}
                          </TableCell>
                          <TableCell>{Number(decl.total_revenue).toFixed(2)}€</TableCell>
                          <TableCell>{Number(decl.contribution_amount).toFixed(2)}€</TableCell>
                          <TableCell>
                            <Badge variant={decl.status === 'submitted' ? 'default' : 'secondary'}>
                              {decl.status === 'submitted' ? 'Submetida' : 'Rascunho'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {decl.submitted_at 
                              ? new Date(decl.submitted_at).toLocaleDateString('pt-PT')
                              : new Date(decl.created_at).toLocaleDateString('pt-PT')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Success Dialog */}
        <SubmissionSuccessDialog
          open={showSuccessDialog}
          onOpenChange={setShowSuccessDialog}
          quarterLabel={getLabel(quarter)}
          contributionAmount={contributionAmount}
          onOpenPortal={openSSPortal}
        />
      </div>
    </DashboardLayout>
  );
}
