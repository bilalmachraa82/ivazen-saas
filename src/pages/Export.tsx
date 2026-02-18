import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountant } from '@/hooks/useAccountant';
import { useClientManagement } from '@/hooks/useClientManagement';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileSpreadsheet, Table as TableIcon, Loader2, Receipt, Calculator, TrendingUp, AlertTriangle, TrendingDown, Euro, Info, Copy, ChevronDown, CheckCircle2, XCircle, Save } from 'lucide-react';
import { StepNavigator } from '@/components/dashboard/StepNavigator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { useExport } from '@/hooks/useExport';
import { useSalesExport } from '@/hooks/useSalesExport';
import { Skeleton } from '@/components/ui/skeleton';
import { ZenCard, ZenCardHeader, ZenHeader, ZenDecorations, ZenStatsCard } from '@/components/zen';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useQueryClient } from '@tanstack/react-query';

export default function Export() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAccountant, isCheckingRole } = useAccountant();
  const { clients, isLoadingClients } = useClientManagement();
  const { selectedClientId, setSelectedClientId } = useSelectedClient();
  const [activeTab, setActiveTab] = useState<'purchases' | 'sales'>('purchases');
  const [deductibilityEdits, setDeductibilityEdits] = useState<Record<string, number>>({});
  const [exclusionEdits, setExclusionEdits] = useState<Record<string, string | null>>({});
  const [isSavingDeductibility, setIsSavingDeductibility] = useState(false);
  const [isSavingExclusions, setIsSavingExclusions] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Effective client ID: wait for role check before determining client
  const effectiveClientId = isCheckingRole
    ? undefined
    : (isAccountant ? selectedClientId : user?.id);

  // Purchases export
  const {
    selectedPeriod: purchasePeriod,
    setSelectedPeriod: setPurchasePeriod,
    exportFormat: purchaseFormat,
    setExportFormat: setPurchaseFormat,
    periodType,
    setPeriodType,
    isLoading: isLoadingPurchases,
    dpFieldSummaries,
    totals: purchaseTotals,
    exportData: exportPurchases,
    isExporting: isExportingPurchases,
    recuperarAnterior,
    setRecuperarAnterior,
    regFavorEstado,
    setRegFavorEstado,
    regSujeitoPassivo,
    setRegSujeitoPassivo,
    duplicatesRemoved,
    invoices: purchaseInvoices,
  } = useExport(effectiveClientId);

  // Sales export
  const {
    selectedPeriod: salesPeriod,
    setSelectedPeriod: setSalesPeriod,
    exportFormat: salesFormat,
    setExportFormat: setSalesFormat,
    isLoading: isLoadingSales,
    periodSummaries,
    totals: salesTotals,
    exportData: exportSales,
    isExporting: isExportingSales,
    availablePeriods: salesAvailablePeriods,
  } = useSalesExport(effectiveClientId);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleDeductibilityChange = useCallback((invoiceId: string, value: number) => {
    setDeductibilityEdits(prev => ({ ...prev, [invoiceId]: Math.min(100, Math.max(0, value)) }));
  }, []);

  const saveDeductibilityEdits = useCallback(async () => {
    const entries = Object.entries(deductibilityEdits);
    if (entries.length === 0) return;
    setIsSavingDeductibility(true);
    try {
      const updates = await Promise.all(
        entries.map(([id, val]) => supabase.from('invoices').update({ final_deductibility: val }).eq('id', id))
      );

      const firstError = updates.find(r => r.error)?.error;
      if (firstError) throw firstError;

      setDeductibilityEdits({});
      // Refetch without losing UI state (period selection, scroll, etc.)
      await queryClient.invalidateQueries({ queryKey: ['export-invoices'] });
    } catch {
      console.error('Failed to save deductibility');
    } finally {
      setIsSavingDeductibility(false);
    }
  }, [deductibilityEdits, queryClient]);

  const saveExclusionEdits = useCallback(async () => {
    const entries = Object.entries(exclusionEdits);
    if (entries.length === 0) return;
    setIsSavingExclusions(true);
    try {
      const updates = await Promise.all(
        entries.map(([id, reason]) => supabase.from('invoices').update({ exclusion_reason: reason }).eq('id', id))
      );

      const firstError = updates.find(r => r.error)?.error;
      if (firstError) throw firstError;

      setExclusionEdits({});
      await queryClient.invalidateQueries({ queryKey: ['export-invoices'] });
    } catch {
      console.error('Failed to save exclusions');
    } finally {
      setIsSavingExclusions(false);
    }
  }, [exclusionEdits, queryClient]);

  const hasDeductibilityEdits = Object.keys(deductibilityEdits).length > 0;
  const hasExclusionEdits = Object.keys(exclusionEdits).length > 0;

  if (loading || !user) return null;

  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  const quarterlyPeriods = Array.from({ length: 4 }, (_, i) => ({
    value: `${selectedYear}-Q${i + 1}`,
    label: `${i + 1}º Trimestre ${selectedYear}`,
  }));

  const monthlyPeriods = Array.from({ length: 12 }, (_, i) => {
    const month = (i + 1).toString().padStart(2, '0');
    return {
      value: `${selectedYear}-${month}`,
      label: new Date(selectedYear, i).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
    };
  });

  const purchasePeriods = periodType === 'quarterly' ? quarterlyPeriods : monthlyPeriods;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in relative">
        <ZenDecorations />

        <ZenHeader
          icon={Download}
          title="Apuramento"
          description="Declaração Periódica de IVA — exporte os dados validados"
        />


        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'purchases' | 'sales')} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="purchases" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              Compras (Despesas)
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Vendas (Receitas)
            </TabsTrigger>
          </TabsList>

          {/* PURCHASES TAB */}
          <TabsContent value="purchases" className="space-y-6">
            {/* Stats Cards */}
            {(() => {
              const campo24 = dpFieldSummaries.find(s => s.field === 24);
              const campo10 = dpFieldSummaries.find(s => s.field === 10);
              const vatDedCampo24 = campo24?.vatDeductible ?? 0;
              const vatDedCampo10 = campo10?.vatDeductible ?? 0;
              const hasCampo10 = vatDedCampo10 > 0;
              return (
                <div className={`grid grid-cols-1 ${hasCampo10 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
                  <ZenStatsCard
                    icon={Receipt}
                    value={purchaseTotals.invoiceCount}
                    label="Facturas no Período"
                    variant="primary"
                    animationDelay="0ms"
                  />
                  <ZenStatsCard
                    icon={Calculator}
                    value={formatCurrency(purchaseTotals.vatTotal)}
                    label="IVA Total"
                    variant="warning"
                    animationDelay="50ms"
                  />
                  <ZenStatsCard
                    icon={FileSpreadsheet}
                    value={formatCurrency(vatDedCampo24)}
                    label="IVA Dedutível (Campo 24)"
                    variant="success"
                    animationDelay="100ms"
                  />
                  {hasCampo10 && (
                    <ZenStatsCard
                      icon={Euro}
                      value={formatCurrency(vatDedCampo10)}
                      label="Intracomunitário (C.10)"
                      variant="default"
                      animationDelay="150ms"
                    />
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Export Configuration Card */}
              <ZenCard gradient="default" withLine className="lg:col-span-2 shadow-xl" animationDelay="150ms">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <Download className="h-5 w-5 text-primary" />
                    </div>
                    Exportar Compras
                  </CardTitle>
                  <CardDescription>
                    Seleccione o período e formato de exportação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Ano Fiscal</Label>
                      <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); setPurchasePeriod(''); }}>
                        <SelectTrigger className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableYears.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Periodicidade</Label>
                      <Select value={periodType} onValueChange={(v) => { setPeriodType(v as 'monthly' | 'quarterly'); setPurchasePeriod(''); }}>
                        <SelectTrigger className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="purchase-period" className="text-sm font-medium">Período Fiscal</Label>
                      <Select value={purchasePeriod} onValueChange={setPurchasePeriod}>
                        <SelectTrigger id="purchase-period" className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                          <SelectValue placeholder={periodType === 'quarterly' ? 'Seleccione o trimestre' : 'Seleccione o mês'} />
                        </SelectTrigger>
                        <SelectContent>
                          {purchasePeriods.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Crédito anterior (Campo 61)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={recuperarAnterior || ''}
                        onChange={(e) => setRecuperarAnterior(Number(e.target.value) || 0)}
                        placeholder="0.00"
                        className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Regularization fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Reg. Sujeito Passivo (Campo 40)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={regSujeitoPassivo || ''}
                        onChange={(e) => setRegSujeitoPassivo(Number(e.target.value) || 0)}
                        placeholder="0.00"
                        className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Reg. Favor Estado (Campo 41)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={regFavorEstado || ''}
                        onChange={(e) => setRegFavorEstado(Number(e.target.value) || 0)}
                        placeholder="0.00"
                        className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Duplicates indicator */}
                  {purchasePeriod && duplicatesRemoved > 0 && (
                    <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                        {purchaseTotals.invoiceCount} facturas únicas carregadas ({duplicatesRemoved} duplicado{duplicatesRemoved !== 1 ? 's' : ''} removido{duplicatesRemoved !== 1 ? 's' : ''})
                      </AlertDescription>
                    </Alert>
                  )}

                  {purchasePeriod && duplicatesRemoved === 0 && purchaseTotals.invoiceCount > 0 && (
                    <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                      <Info className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
                        {purchaseTotals.invoiceCount} facturas únicas — sem duplicados detectados
                      </AlertDescription>
                    </Alert>
                  )}

                  <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                      Os dados exportados são para referência. Verifique a conformidade fiscal antes de submeter à AT.
                    </AlertDescription>
                  </Alert>

                  <Button 
                    className="w-full sm:w-auto zen-button gap-2 shadow-lg hover:shadow-xl transition-all duration-300" 
                    disabled={!purchasePeriod || isExportingPurchases || purchaseTotals.invoiceCount === 0 || !effectiveClientId}
                    onClick={exportPurchases}
                  >
                    {isExportingPurchases ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isExportingPurchases ? 'A exportar...' : 'Exportar Compras'}
                  </Button>

                  {purchasePeriod && purchaseTotals.invoiceCount === 0 && !isLoadingPurchases && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      Não existem facturas validadas para este período.
                    </p>
                  )}
                </CardContent>
              </ZenCard>

              {/* DP Field Summary Card */}
              <ZenCard gradient="muted" withCircle animationDelay="200ms">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    Resumo por Campo DP
                  </CardTitle>
                  <CardDescription>
                    Agregação para Declaração Periódica
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPurchases ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-6 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm">
                      {dpFieldSummaries.map((summary) => (
                        <div 
                          key={summary.field} 
                          className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors duration-200 group"
                        >
                          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                            Campo {summary.field} ({summary.label})
                          </span>
                          <span className="font-medium text-foreground">{formatCurrency(summary.vatDeductible)}</span>
                        </div>
                      ))}
                      <div className="border-t border-primary/20 pt-3 mt-3 flex justify-between font-medium p-2 rounded-lg bg-green-500/10">
                        <span className="text-foreground">Total IVA Dedutível</span>
                        <span className="text-green-600 font-bold">{formatCurrency(purchaseTotals.vatDeductible)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </ZenCard>
            </div>

            {/* Detailed DP Field Table */}
            {purchasePeriod && (
              <ZenCard gradient="default" withLine className="shadow-xl" animationDelay="250ms">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <TableIcon className="h-5 w-5 text-primary" />
                    </div>
                    Detalhe por Campo da Declaração Periódica
                  </CardTitle>
                  <CardDescription>
                    Valores agregados para preenchimento da DP de IVA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPurchases ? (
                    <div className="space-y-2">
                      {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="font-semibold">Campo DP</TableHead>
                            <TableHead className="font-semibold">Descrição</TableHead>
                            <TableHead className="text-right font-semibold">Base Tributável</TableHead>
                            <TableHead className="text-right font-semibold">IVA Total</TableHead>
                            <TableHead className="text-right font-semibold">IVA Dedutível</TableHead>
                            <TableHead className="text-right font-semibold">Nº Facturas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dpFieldSummaries.map((summary, index) => (
                            <TableRow 
                              key={summary.field}
                              className="hover:bg-muted/20 transition-colors duration-200"
                              style={{ animationDelay: `${300 + index * 50}ms` }}
                            >
                              <TableCell className="font-medium">
                                <span className="px-2 py-1 bg-primary/10 rounded-md text-primary">
                                  Campo {summary.field}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{summary.label}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(summary.baseTotal)}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(summary.vatTotal)}</TableCell>
                              <TableCell className="text-right font-mono font-medium text-green-600">
                                {formatCurrency(summary.vatDeductible)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="px-2 py-1 bg-muted rounded-full text-sm">
                                  {summary.invoiceCount}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 font-medium border-t-2 border-primary/20">
                            <TableCell colSpan={2} className="font-bold text-foreground">
                              TOTAL
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">{formatCurrency(purchaseTotals.baseTotal)}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{formatCurrency(purchaseTotals.vatTotal)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-green-600">
                              {formatCurrency(purchaseTotals.vatDeductible)}
                            </TableCell>
                            <TableCell className="text-right font-bold">{purchaseTotals.invoiceCount}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </ZenCard>
            )}

            {/* Reconciliation Panel */}
            {purchasePeriod && purchaseInvoices && purchaseInvoices.length > 0 && (
              <Collapsible defaultOpen>
                <ZenCard gradient="muted" withLine animationDelay="300ms">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          Reconciliação — Detalhe por Factura
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="rounded-xl border border-border/50 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableHead className="font-semibold">NIF</TableHead>
                              <TableHead className="font-semibold">Fornecedor</TableHead>
                              <TableHead className="font-semibold">Data</TableHead>
                              <TableHead className="text-right font-semibold">IVA Total</TableHead>
                              <TableHead className="text-right font-semibold w-24">% Ded.</TableHead>
                              <TableHead className="text-right font-semibold">IVA Dedutível</TableHead>
                              <TableHead className="font-semibold">Campo DP</TableHead>
                              <TableHead className="font-semibold">Excluir</TableHead>
                              <TableHead className="font-semibold">Motivo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {purchaseInvoices.map((inv) => {
                              const dpField = inv.final_dp_field ?? inv.ai_dp_field ?? 24;
                              const currentDed = deductibilityEdits[inv.id] ?? inv.final_deductibility ?? inv.ai_deductibility ?? 0;
                              const ivaTotal = inv.total_vat || 0;
                              const currentReason = exclusionEdits[inv.id] ?? inv.exclusion_reason ?? null;
                              const isExcluded = !!(currentReason || '').trim();
                              const ivaDed = isExcluded ? 0 : ivaTotal * (currentDed / 100);
                              const isEdited = inv.id in deductibilityEdits;
                              return (
                                <TableRow key={inv.id} className={`hover:bg-muted/20 transition-colors ${isEdited ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                                  <TableCell className="font-mono text-xs">{inv.supplier_nif}</TableCell>
                                  <TableCell className="text-sm">{inv.supplier_name || '—'}</TableCell>
                                  <TableCell className="text-sm">{inv.document_date}</TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(ivaTotal)}</TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={currentDed}
                                      onChange={(e) => handleDeductibilityChange(inv.id, Number(e.target.value))}
                                      disabled={isExcluded}
                                      className="w-20 h-8 text-right text-sm font-mono ml-auto"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-medium text-green-600">{formatCurrency(ivaDed)}</TableCell>
                                  <TableCell>
                                    <span className="px-2 py-1 bg-primary/10 rounded-md text-primary text-xs">
                                      Campo {dpField}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant={isExcluded ? 'destructive' : 'outline'}
                                      className="h-8"
                                      onClick={() => {
                                        setExclusionEdits(prev => ({
                                          ...prev,
                                          [inv.id]: isExcluded ? null : (prev[inv.id] ?? inv.exclusion_reason ?? 'Excluída manualmente pela contabilidade'),
                                        }));
                                      }}
                                    >
                                      {isExcluded ? 'Excluída' : 'Excluir'}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={currentReason || '__NONE__'}
                                      onValueChange={(value) => {
                                        setExclusionEdits(prev => ({
                                          ...prev,
                                          [inv.id]: value === '__NONE__' ? null : value,
                                        }));
                                      }}
                                    >
                                      <SelectTrigger className="h-8 min-w-[240px]">
                                        <SelectValue placeholder="Sem exclusão" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__NONE__">Sem exclusão</SelectItem>
                                        <SelectItem value="Fora da atividade">Fora da atividade</SelectItem>
                                        <SelectItem value="Fornecedor internacional (fora do apuramento PT)">Fornecedor internacional (fora do apuramento PT)</SelectItem>
                                        <SelectItem value="Documento não aceite para dedução">Documento não aceite para dedução</SelectItem>
                                        <SelectItem value="Excluída manualmente pela contabilidade">Exclusão manual da contabilidade</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Save button for deductibility edits */}
                      {hasDeductibilityEdits && (
                        <div className="mt-3 flex items-center gap-3">
                          <Button
                            size="sm"
                            onClick={saveDeductibilityEdits}
                            disabled={isSavingDeductibility}
                            className="gap-2"
                          >
                            {isSavingDeductibility ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Guardar Dedutibilidades ({Object.keys(deductibilityEdits).length})
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeductibilityEdits({})}>
                            Cancelar
                          </Button>
                        </div>
                      )}

                      {hasExclusionEdits && (
                        <div className="mt-3 flex items-center gap-3">
                          <Button
                            size="sm"
                            onClick={saveExclusionEdits}
                            disabled={isSavingExclusions}
                            className="gap-2"
                            variant="secondary"
                          >
                            {isSavingExclusions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Guardar Exclusões ({Object.keys(exclusionEdits).length})
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setExclusionEdits({})}>
                            Cancelar
                          </Button>
                        </div>
                      )}

                      {/* Summary comparison */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                          <p className="text-xs text-muted-foreground">Campo 24 (OBS)</p>
                          <p className="text-lg font-bold font-mono">{formatCurrency(dpFieldSummaries.find(s => s.field === 24)?.vatDeductible || 0)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                          <p className="text-xs text-muted-foreground">Campo 61 (Anterior)</p>
                          <p className="text-lg font-bold font-mono">{formatCurrency(recuperarAnterior)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                          <p className="text-xs text-muted-foreground">Campo 96 (A Recuperar)</p>
                          <p className="text-lg font-bold font-mono text-green-600">
                            {formatCurrency(
                              purchaseTotals.vatDeductible + regSujeitoPassivo + recuperarAnterior - regFavorEstado
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </ZenCard>
              </Collapsible>
            )}
          </TabsContent>

          {/* SALES TAB */}
          <TabsContent value="sales" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ZenStatsCard
                icon={Receipt}
                value={salesTotals.invoiceCount}
                label="Facturas Validadas"
                variant="primary"
                animationDelay="0ms"
              />
              <ZenStatsCard
                icon={Euro}
                value={formatCurrency(salesTotals.total)}
                label="Total Vendas"
                variant="success"
                animationDelay="50ms"
              />
              <ZenStatsCard
                icon={Calculator}
                value={formatCurrency(salesTotals.vatTotal)}
                label="IVA Liquidado"
                variant="warning"
                animationDelay="100ms"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Export Configuration Card */}
              <ZenCard gradient="default" withLine className="lg:col-span-2 shadow-xl" animationDelay="150ms">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    Exportar Vendas
                  </CardTitle>
                  <CardDescription>
                    Exporte as facturas de vendas validadas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sales-period" className="text-sm font-medium">Período</Label>
                      <Select value={salesPeriod} onValueChange={setSalesPeriod}>
                        <SelectTrigger id="sales-period" className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                          <SelectValue placeholder="Seleccione o período" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesAvailablePeriods.length === 0 ? (
                            <SelectItem value="none" disabled>Sem períodos disponíveis</SelectItem>
                          ) : (
                            salesAvailablePeriods.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p.match(/^\d{4}-\d{2}$/) 
                                  ? new Date(p + '-01').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
                                  : p}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sales-format" className="text-sm font-medium">Formato</Label>
                      <Select value={salesFormat} onValueChange={(v) => setSalesFormat(v as 'xlsx' | 'csv')}>
                        <SelectTrigger id="sales-format" className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                          <SelectItem value="csv">CSV (.csv)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    className="w-full sm:w-auto zen-button gap-2 shadow-lg hover:shadow-xl transition-all duration-300" 
                    disabled={!salesPeriod || isExportingSales || salesTotals.invoiceCount === 0}
                    onClick={exportSales}
                  >
                    {isExportingSales ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isExportingSales ? 'A exportar...' : 'Exportar Vendas'}
                  </Button>

                  {salesPeriod && salesTotals.invoiceCount === 0 && !isLoadingSales && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      Não existem facturas de venda validadas para este período.
                    </p>
                  )}

                  {salesAvailablePeriods.length === 0 && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      Não existem facturas de venda validadas. Valide primeiro as suas facturas na página de Vendas.
                    </p>
                  )}
                </CardContent>
              </ZenCard>

              {/* Period Summary Card */}
              <ZenCard gradient="muted" withCircle animationDelay="200ms">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Resumo por Período
                  </CardTitle>
                  <CardDescription>
                    Vendas agregadas por mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSales ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-6 w-full" />
                      ))}
                    </div>
                  ) : periodSummaries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Sem dados de vendas
                    </p>
                  ) : (
                    <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
                      {periodSummaries.slice(0, 6).map((summary) => (
                        <div 
                          key={summary.period} 
                          className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors duration-200 group cursor-pointer"
                          onClick={() => setSalesPeriod(summary.period)}
                        >
                          <div>
                            <span className="text-foreground font-medium block">
                              {summary.periodLabel}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {summary.invoiceCount} factura{summary.invoiceCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <span className="font-medium text-foreground">{formatCurrency(summary.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </ZenCard>
            </div>
          </TabsContent>
        </Tabs>

        {/* Export Format Info */}
        <ZenCard gradient="muted" withLine animationDelay="300ms">
          <ZenCardHeader title="Formato de Exportação" icon={FileSpreadsheet} />
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {activeTab === 'purchases' 
                ? 'O ficheiro Excel segue o formato oficial da Declaração Periódica de IVA (AT), com Resumo DP e Detalhe mensal por fornecedor.'
                : 'O ficheiro exportado incluirá duas folhas: uma com o detalhe das facturas de venda e outra com o resumo por período.'}
            </p>
          </CardContent>
        </ZenCard>

        <StepNavigator currentStep={3} />
      </div>
    </DashboardLayout>
  );
}
