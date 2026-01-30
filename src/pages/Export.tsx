import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileSpreadsheet, Table as TableIcon, Loader2, Receipt, Calculator, TrendingUp, AlertTriangle, TrendingDown, Euro } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useExport } from '@/hooks/useExport';
import { useSalesExport } from '@/hooks/useSalesExport';
import { Skeleton } from '@/components/ui/skeleton';
import { ZenCard, ZenCardHeader, ZenHeader, ZenDecorations, ZenStatsCard } from '@/components/zen';

export default function Export() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'purchases' | 'sales'>('purchases');
  
  // Purchases export
  const {
    selectedPeriod: purchasePeriod,
    setSelectedPeriod: setPurchasePeriod,
    exportFormat: purchaseFormat,
    setExportFormat: setPurchaseFormat,
    isLoading: isLoadingPurchases,
    dpFieldSummaries,
    totals: purchaseTotals,
    exportData: exportPurchases,
    isExporting: isExportingPurchases,
  } = useExport();

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
  } = useSalesExport();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  const currentYear = new Date().getFullYear();
  const purchasePeriods = Array.from({ length: 12 }, (_, i) => {
    const month = (i + 1).toString().padStart(2, '0');
    return `${currentYear}-${month}`;
  });

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
          title="Exportar Dados"
          description="Exporte as suas facturas validadas para Excel ou CSV"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ZenStatsCard
                icon={Receipt}
                value={purchaseTotals.invoiceCount}
                label="Facturas Validadas"
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
                value={formatCurrency(purchaseTotals.vatDeductible)}
                label="IVA Dedutível"
                variant="success"
                animationDelay="100ms"
              />
            </div>

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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="purchase-period" className="text-sm font-medium">Período Fiscal</Label>
                      <Select value={purchasePeriod} onValueChange={setPurchasePeriod}>
                        <SelectTrigger id="purchase-period" className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                          <SelectValue placeholder="Seleccione o mês" />
                        </SelectTrigger>
                        <SelectContent>
                          {purchasePeriods.map((p) => (
                            <SelectItem key={p} value={p}>
                              {new Date(p + '-01').toLocaleDateString('pt-PT', { 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="purchase-format" className="text-sm font-medium">Formato</Label>
                      <Select value={purchaseFormat} onValueChange={(v) => setPurchaseFormat(v as 'xlsx' | 'csv')}>
                        <SelectTrigger id="purchase-format" className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                          <SelectItem value="csv">CSV (.csv)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                      Os dados exportados são para referência. Verifique a conformidade fiscal antes de submeter à AT.
                    </AlertDescription>
                  </Alert>

                  <Button 
                    className="w-full sm:w-auto zen-button gap-2 shadow-lg hover:shadow-xl transition-all duration-300" 
                    disabled={!purchasePeriod || isExportingPurchases || purchaseTotals.invoiceCount === 0}
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
                ? 'O ficheiro exportado incluirá duas folhas: uma com o detalhe das facturas e outra com o resumo por campo DP.'
                : 'O ficheiro exportado incluirá duas folhas: uma com o detalhe das facturas de venda e outra com o resumo por período.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(activeTab === 'purchases' 
                ? ['Data', 'NIF Fornecedor', 'Fornecedor', 'Nº Documento', 'Base Tributável', 'IVA', 'Total', 'Campo DP', 'Classificação', 'Dedutibilidade %', 'IVA Dedutível', 'Validado']
                : ['Data', 'NIF Cliente', 'Cliente', 'Nº Documento', 'Tipo', 'Base 23%', 'Base 13%', 'Base 6%', 'IVA Total', 'Total']
              ).map((col, index) => (
                <div 
                  key={col} 
                  className="px-3 py-2 bg-gradient-to-br from-muted to-muted/50 rounded-lg text-sm border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
                  style={{ animationDelay: `${350 + index * 30}ms` }}
                >
                  {col}
                </div>
              ))}
            </div>
          </CardContent>
        </ZenCard>
      </div>
    </DashboardLayout>
  );
}
