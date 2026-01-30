import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useSocialSecurity, REVENUE_CATEGORIES, REVENUE_COEFFICIENTS, getQuarterLabel } from '@/hooks/useSocialSecurity';
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
  BarChart3,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Copy,
  Euro,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { RevenueImporter } from '@/components/social-security/RevenueImporter';
import { PortalLinks } from '@/components/social-security/PortalLinks';
import { SubmissionGuide } from '@/components/social-security/SubmissionGuide';
import { RevenueCharts } from '@/components/social-security/RevenueCharts';
import { SubmissionSuccessDialog } from '@/components/social-security/SubmissionSuccessDialog';
import { ZenEmptyState } from '@/components/zen';

export default function SocialSecurity() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { isAccountant, clients, isLoadingClients } = useClientManagement();
  
  // Selected client for accountants
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  
  // Set default client when clients load (for accountants)
  useEffect(() => {
    if (isAccountant && clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [isAccountant, clients, selectedClientId]);
  
  // For accountants, use selected client; for regular users, use their own ID
  const effectiveClientId = isAccountant ? selectedClientId : user?.id;
  
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
    addRevenue,
    isAddingRevenue,
    deleteRevenue,
    saveDeclaration,
    isSavingDeclaration,
    bulkImport,
    createSalesInvoices,
    isDeadlineMonth,
    getQuarterLabel: getLabel,
  } = useSocialSecurity(undefined, effectiveClientId);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('prestacao_servicos');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [declarationNotes, setDeclarationNotes] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

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

  const contributionRate = profile?.ss_contribution_rate || 21.4;
  const contributionBase = totals.relevantIncome;
  const contributionAmount = contributionBase * (contributionRate / 100);

  const handleAddRevenue = () => {
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
Base de Incidência (70%): ${contributionBase.toFixed(2)}€
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

        {/* Client Selector for Accountants */}
        {isAccountant && clients.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <Label>Cliente:</Label>
                </div>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-full sm:w-[300px]">
                    <SelectValue placeholder="Seleccione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name || client.full_name} {client.nif ? `(${client.nif})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="declaration" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Declaração</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar</span>
            </TabsTrigger>
            <TabsTrigger value="submit" className="gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Submeter</span>
            </TabsTrigger>
            <TabsTrigger value="charts" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Gráficos</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="declaration" className="space-y-6">
            {/* Revenue Sources Overview Card */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Fontes de Receita</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getLabel(quarter)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Manual Entries */}
                  <div className="p-4 rounded-lg bg-background/50 border border-border/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium">Manual</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {revenueEntries.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2)}€
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {revenueEntries.length} entrada{revenueEntries.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Sales Invoices */}
                  <div className="p-4 rounded-lg bg-background/50 border border-green-500/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-sm font-medium">Facturas Vendas</span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        Auto
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {totals.salesInvoicesTotal?.toFixed(2) || '0.00'}€
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {totals.salesInvoicesCount || 0} factura{(totals.salesInvoicesCount || 0) !== 1 ? 's' : ''} validada{(totals.salesInvoicesCount || 0) !== 1 ? 's' : ''}
                      </p>
                      {(totals.salesInvoicesCount || 0) > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs px-2 text-green-600 hover:text-green-700"
                          onClick={() => navigate('/sales')}
                        >
                          Ver →
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Euro className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">Total Receitas</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {totals.total.toFixed(2)}€
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Base: {totals.relevantIncome.toFixed(2)}€ (coef. por categoria)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Rendimentos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Euro className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{totals.total.toFixed(2)}€</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Base Incidência (70%)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{contributionBase.toFixed(2)}€</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Taxa Contributiva</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{contributionRate}%</span>
                </CardContent>
              </Card>

              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardDescription>A Pagar</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Euro className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold text-primary">
                      {contributionAmount.toFixed(2)}€
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Calculation Card */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Cálculo Detalhado da Contribuição</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Trigger refetch of data
                      toast.info('A recalcular...');
                    }}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Recalcular
                  </Button>
                </div>
                <CardDescription>
                  Breakdown do cálculo por categoria de rendimento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Breakdown by Category */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Rendimento</TableHead>
                      <TableHead className="text-center">Coef.</TableHead>
                      <TableHead className="text-right">Base Incidência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {REVENUE_CATEGORIES.filter(cat => (totals.byCategory[cat.value] || 0) > 0).map((cat) => {
                      const categoryTotal = totals.byCategory[cat.value] || 0;
                      const coefficient = REVENUE_COEFFICIENTS[cat.value] || 0.70;
                      const categoryBase = categoryTotal * coefficient;
                      
                      return (
                        <TableRow key={cat.value}>
                          <TableCell className="font-medium">{cat.label}</TableCell>
                          <TableCell className="text-right">{categoryTotal.toFixed(2)}€</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{(coefficient * 100).toFixed(0)}%</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{categoryBase.toFixed(2)}€</TableCell>
                        </TableRow>
                      );
                    })}
                    {Object.keys(totals.byCategory).filter(k => (totals.byCategory[k] || 0) > 0).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          Sem rendimentos registados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Calculation Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Rendimentos Brutos:</span>
                      <span className="font-medium">{totals.total.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base de Incidência (ponderada):</span>
                      <span className="font-medium">{contributionBase.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa Contributiva:</span>
                      <span className="font-medium">{contributionRate}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center p-4 rounded-lg bg-primary/10 border border-primary/30">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Contribuição a Pagar</p>
                      <p className="text-3xl font-bold text-primary">
                        {contributionAmount.toFixed(2)}€
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {contributionBase.toFixed(2)}€ × {contributionRate}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Category */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Rendimentos por Categoria</CardTitle>
                  <CardDescription>
                    Adicione os seus rendimentos do trimestre
                  </CardDescription>
                </div>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar
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
                      <Button onClick={handleAddRevenue} disabled={isAddingRevenue}>
                        {isAddingRevenue && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Adicionar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Sem rendimentos registados para este trimestre
                        </TableCell>
                      </TableRow>
                    ) : (
                      revenueEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {REVENUE_CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.notes || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(entry.amount).toFixed(2)}€
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  aria-label="Eliminar rendimento"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Eliminar Rendimento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acção não pode ser revertida. O valor de <strong>{Number(entry.amount).toFixed(2)}€</strong> será removido do trimestre.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteRevenue(entry.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Sales Invoices Integration */}
                {salesInvoices.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Facturas de Vendas</span>
                        <Badge variant="secondary" className="text-xs">
                          Auto
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{totals.salesInvoicesTotal?.toFixed(2)}€</p>
                        <p className="text-xs text-muted-foreground">
                          {totals.salesInvoicesCount} factura{totals.salesInvoicesCount !== 1 ? 's' : ''} validada{totals.salesInvoicesCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Facturas de vendas validadas são automaticamente incluídas como "Vendas de Produtos" (coeficiente 20%).
                    </p>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 mt-1"
                      onClick={() => navigate('/sales')}
                    >
                      Ver facturas de vendas →
                    </Button>
                  </div>
                )}

                {/* Category Totals */}
                <div className="mt-6 pt-4 border-t space-y-2">
                  {REVENUE_CATEGORIES.map((cat) => {
                    const categoryTotal = totals.byCategory[cat.value] || 0;
                    const hasSalesInvoices = cat.value === 'vendas' && totals.salesInvoicesCount > 0;
                    
                    return (
                      <div key={cat.value} className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          {cat.label}
                          {hasSalesInvoices && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              inclui facturas
                            </Badge>
                          )}
                        </span>
                        <span className="font-medium">{categoryTotal.toFixed(2)}€</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>{totals.total.toFixed(2)}€</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Acções</CardTitle>
                <CardDescription>
                  Guarde a declaração ou copie os dados para a SS Directa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Notas da Declaração</Label>
                  <Textarea
                    placeholder="Notas opcionais..."
                    value={declarationNotes}
                    onChange={(e) => setDeclarationNotes(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-4 w-4" />
                    Copiar Dados
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleSaveDeclaration('draft')}
                    disabled={isSavingDeclaration}
                  >
                    {isSavingDeclaration && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Rascunho
                  </Button>

                  <Button
                    onClick={() => handleSaveDeclaration('submitted')}
                    disabled={isSavingDeclaration || totals.total === 0}
                    className="gap-2"
                  >
                    {isSavingDeclaration && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar como Submetida
                  </Button>
                </div>

                {declaration && (
                  <div className="flex items-center gap-2 pt-2">
                    <Badge variant={declaration.status === 'submitted' ? 'default' : 'secondary'}>
                      {declaration.status === 'submitted' ? 'Submetida' : 'Rascunho'}
                    </Badge>
                    {declaration.submitted_at && (
                      <span className="text-sm text-muted-foreground">
                        em {new Date(declaration.submitted_at).toLocaleDateString('pt-PT')}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
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
            <RevenueImporter 
              onImport={bulkImport} 
              onCreateSalesInvoices={createSalesInvoices}
              currentQuarter={quarter}
              userCAE={profile?.cae}
              activityDescription={profile?.activity_description}
            />
          </TabsContent>

          <TabsContent value="submit" className="space-y-6">
            <SubmissionGuide
              quarter={quarter}
              quarterLabel={getLabel(quarter)}
              totalRevenue={totals.total}
              contributionBase={contributionBase}
              contributionAmount={contributionAmount}
              contributionRate={contributionRate}
              hasAccountantSS={profile?.has_accountant_ss}
              isSubmitted={declaration?.status === 'submitted'}
            />
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            <RevenueCharts 
              declarationsHistory={declarationsHistory}
              getQuarterLabel={getLabel}
            />
          </TabsContent>

          <TabsContent value="history">
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
                            description="Ainda não existem declarações guardadas. Adicione rendimentos e guarde a sua primeira declaração."
                            variant="muted"
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
