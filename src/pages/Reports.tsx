import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useInvoices } from '@/hooks/useInvoices';
import { useSalesInvoices } from '@/hooks/useSalesInvoices';
import { useProfile } from '@/hooks/useProfile';
import { useClientManagement } from '@/hooks/useClientManagement';
import { FileText, FileSpreadsheet, TrendingUp, TrendingDown, Receipt, Shield, Euro, Users, Calculator } from 'lucide-react';
import { format, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

type PeriodType = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'year';
type ReportType = 'vat' | 'ss' | 'expenses';

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

const quarters: { value: PeriodType; label: string }[] = [
  { value: 'Q1', label: '1º Trimestre (Jan-Mar)' },
  { value: 'Q2', label: '2º Trimestre (Abr-Jun)' },
  { value: 'Q3', label: '3º Trimestre (Jul-Set)' },
  { value: 'Q4', label: '4º Trimestre (Out-Dez)' },
  { value: 'year', label: 'Ano Completo' },
];

const revenueCoefficients: Record<string, number> = {
  prestacao_servicos: 0.75,
  vendas: 0.15,
  outros_rendimentos: 1.0,
};

export default function Reports() {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('Q4');
  const [activeTab, setActiveTab] = useState<ReportType>('vat');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  
  const { profile } = useProfile();
  const { isAccountant, clients } = useClientManagement();
  
  const { invoices, filters: invoiceFilters, setFilters: setInvoiceFilters } = useInvoices();
  const { invoices: salesInvoices, filters: salesFilters, setFilters: setSalesFilters } = useSalesInvoices();
  
  // Update invoice filters when client changes (for accountants)
  useEffect(() => {
    if (isAccountant) {
      setInvoiceFilters({ ...invoiceFilters, clientId: selectedClientId });
      setSalesFilters({ ...salesFilters, clientId: selectedClientId });
    }
  }, [isAccountant, selectedClientId]);
  
  // Get selected client name for reports
  const selectedClientName = useMemo(() => {
    if (!isAccountant || selectedClientId === 'all') return profile?.full_name || '';
    const client = clients.find(c => c.id === selectedClientId);
    return client?.full_name || client?.company_name || '';
  }, [isAccountant, selectedClientId, clients, profile]);

  // Calculate date range
  const dateRange = useMemo(() => {
    const baseDate = new Date(selectedYear, 0, 1);
    if (selectedPeriod === 'year') {
      return { start: startOfYear(baseDate), end: endOfYear(baseDate) };
    }
    const quarterIndex = parseInt(selectedPeriod.replace('Q', '')) - 1;
    const quarterDate = new Date(selectedYear, quarterIndex * 3, 1);
    return { start: startOfQuarter(quarterDate), end: endOfQuarter(quarterDate) };
  }, [selectedYear, selectedPeriod]);

  // Filter invoices by date range
  const filteredPurchases = useMemo(() => {
    return (invoices || []).filter(inv => {
      const date = new Date(inv.document_date);
      return isWithinInterval(date, dateRange) && inv.status === 'validated';
    });
  }, [invoices, dateRange]);

  const filteredSales = useMemo(() => {
    return (salesInvoices || []).filter(inv => {
      const date = new Date(inv.document_date);
      return isWithinInterval(date, dateRange);
    });
  }, [salesInvoices, dateRange]);

  // VAT calculations
  const vatData = useMemo(() => {
    const totalVatCollected = filteredSales.reduce((sum, inv) => sum + Number(inv.total_vat || 0), 0);
    const totalVatDeductible = filteredPurchases.reduce((sum, inv) => {
      const deductibility = inv.final_deductibility ?? inv.ai_deductibility ?? 100;
      return sum + (Number(inv.total_vat || 0) * deductibility / 100);
    }, 0);
    const vatBalance = totalVatCollected - totalVatDeductible;
    
    return {
      collected: totalVatCollected,
      deductible: totalVatDeductible,
      balance: vatBalance,
      toPayOrReceive: vatBalance > 0 ? 'pagar' : 'receber',
      salesCount: filteredSales.length,
      purchasesCount: filteredPurchases.length,
    };
  }, [filteredSales, filteredPurchases]);

  // SS calculations
  const ssData = useMemo(() => {
    const byCategory = {
      prestacao_servicos: 0,
      vendas: 0,
      outros_rendimentos: 0,
    };
    
    filteredSales.forEach(inv => {
      const category = inv.revenue_category || 'prestacao_servicos';
      if (category in byCategory) {
        byCategory[category as keyof typeof byCategory] += Number(inv.total_amount || 0);
      }
    });

    const relevantIncome = 
      byCategory.prestacao_servicos * revenueCoefficients.prestacao_servicos +
      byCategory.vendas * revenueCoefficients.vendas +
      byCategory.outros_rendimentos * revenueCoefficients.outros_rendimentos;

    const rate = profile?.ss_contribution_rate || 21.4;
    const contribution = relevantIncome * (rate / 100);

    return {
      byCategory,
      totalRevenue: Object.values(byCategory).reduce((a, b) => a + b, 0),
      relevantIncome,
      rate,
      contribution,
    };
  }, [filteredSales, profile]);

  // Expenses by category
  const expensesData = useMemo(() => {
    const byCategory: Record<string, { count: number; total: number; vat: number }> = {};
    
    filteredPurchases.forEach(inv => {
      const category = inv.final_classification || inv.ai_classification || 'Não classificado';
      if (!byCategory[category]) {
        byCategory[category] = { count: 0, total: 0, vat: 0 };
      }
      byCategory[category].count++;
      byCategory[category].total += Number(inv.total_amount || 0);
      byCategory[category].vat += Number(inv.total_vat || 0);
    });

    const sorted = Object.entries(byCategory)
      .sort((a, b) => b[1].total - a[1].total);

    return {
      byCategory: sorted,
      totalExpenses: filteredPurchases.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0),
      totalVat: filteredPurchases.reduce((sum, inv) => sum + Number(inv.total_vat || 0), 0),
      count: filteredPurchases.length,
    };
  }, [filteredPurchases]);

  const periodLabel = selectedPeriod === 'year' 
    ? `Ano ${selectedYear}` 
    : `${selectedPeriod} ${selectedYear}`;

  const formatCurrency = (value: number) => 
    value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

  // Export to PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    let y = margin;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório Fiscal - ${periodLabel}`, margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: pt })}`, margin, y);
    y += 15;

    // VAT Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO IVA', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`IVA Liquidado (vendas): ${formatCurrency(vatData.collected)}`, margin, y);
    y += 6;
    doc.text(`IVA Dedutível (compras): ${formatCurrency(vatData.deductible)}`, margin, y);
    y += 6;
    doc.text(`Saldo IVA: ${formatCurrency(Math.abs(vatData.balance))} a ${vatData.toPayOrReceive}`, margin, y);
    y += 12;

    // SS Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SEGURANÇA SOCIAL', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receita Total: ${formatCurrency(ssData.totalRevenue)}`, margin, y);
    y += 6;
    doc.text(`Rendimento Relevante: ${formatCurrency(ssData.relevantIncome)}`, margin, y);
    y += 6;
    doc.text(`Taxa: ${ssData.rate}%`, margin, y);
    y += 6;
    doc.text(`Contribuição Estimada: ${formatCurrency(ssData.contribution)}`, margin, y);
    y += 12;

    // Expenses Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DESPESAS POR CATEGORIA', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    expensesData.byCategory.slice(0, 10).forEach(([category, data]) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      doc.text(`${category}: ${formatCurrency(data.total)} (${data.count} docs)`, margin, y);
      y += 6;
    });

    doc.save(`Relatorio_Fiscal_${selectedYear}_${selectedPeriod}.pdf`);
  };

  // Export to Excel
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // VAT Sheet
    const vatSheet = XLSX.utils.aoa_to_sheet([
      ['Relatório IVA', periodLabel],
      [],
      ['Descrição', 'Valor (€)'],
      ['IVA Liquidado', vatData.collected],
      ['IVA Dedutível', vatData.deductible],
      ['Saldo', vatData.balance],
      [],
      ['Nº Vendas', vatData.salesCount],
      ['Nº Compras', vatData.purchasesCount],
    ]);
    XLSX.utils.book_append_sheet(wb, vatSheet, 'IVA');

    // SS Sheet
    const ssSheet = XLSX.utils.aoa_to_sheet([
      ['Segurança Social', periodLabel],
      [],
      ['Categoria', 'Valor (€)', 'Coeficiente', 'Relevante (€)'],
      ['Prestação Serviços', ssData.byCategory.prestacao_servicos, 0.75, ssData.byCategory.prestacao_servicos * 0.75],
      ['Vendas', ssData.byCategory.vendas, 0.15, ssData.byCategory.vendas * 0.15],
      ['Outros Rendimentos', ssData.byCategory.outros_rendimentos, 1.0, ssData.byCategory.outros_rendimentos],
      [],
      ['Total Receita', ssData.totalRevenue],
      ['Rendimento Relevante', ssData.relevantIncome],
      ['Taxa (%)', ssData.rate],
      ['Contribuição', ssData.contribution],
    ]);
    XLSX.utils.book_append_sheet(wb, ssSheet, 'Segurança Social');

    // Expenses Sheet
    const expensesRows = [
      ['Despesas por Categoria', periodLabel],
      [],
      ['Categoria', 'Nº Docs', 'Total (€)', 'IVA (€)'],
      ...expensesData.byCategory.map(([cat, data]) => [cat, data.count, data.total, data.vat]),
      [],
      ['TOTAL', expensesData.count, expensesData.totalExpenses, expensesData.totalVat],
    ];
    const expensesSheet = XLSX.utils.aoa_to_sheet(expensesRows);
    XLSX.utils.book_append_sheet(wb, expensesSheet, 'Despesas');

    // Detailed Sales
    const salesRows = [
      ['Vendas Detalhadas', periodLabel],
      [],
      ['Data', 'Nº Doc', 'Cliente NIF', 'Total', 'IVA', 'Categoria'],
      ...filteredSales.map(inv => [
        format(new Date(inv.document_date), 'dd/MM/yyyy'),
        inv.document_number || '-',
        inv.customer_nif || '-',
        Number(inv.total_amount),
        Number(inv.total_vat || 0),
        inv.revenue_category || 'prestacao_servicos',
      ]),
    ];
    const salesSheet = XLSX.utils.aoa_to_sheet(salesRows);
    XLSX.utils.book_append_sheet(wb, salesSheet, 'Vendas Detalhe');

    // Detailed Purchases
    const purchasesRows = [
      ['Compras Detalhadas', periodLabel],
      [],
      ['Data', 'Fornecedor', 'NIF', 'Total', 'IVA', 'Classificação', 'Dedutibilidade'],
      ...filteredPurchases.map(inv => [
        format(new Date(inv.document_date), 'dd/MM/yyyy'),
        inv.supplier_name || '-',
        inv.supplier_nif,
        Number(inv.total_amount),
        Number(inv.total_vat || 0),
        inv.final_classification || inv.ai_classification || '-',
        `${inv.final_deductibility ?? inv.ai_deductibility ?? 100}%`,
      ]),
    ];
    const purchasesSheet = XLSX.utils.aoa_to_sheet(purchasesRows);
    XLSX.utils.book_append_sheet(wb, purchasesSheet, 'Compras Detalhe');

    XLSX.writeFile(wb, `Relatorio_Fiscal_${selectedYear}_${selectedPeriod}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios Fiscais</h1>
            <p className="text-muted-foreground">Resumo de IVA, Segurança Social e despesas</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Client Selector for Accountants */}
            {isAccountant && clients.length > 0 && (
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-[180px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name || client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as PeriodType)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quarters.map(q => (
                  <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button variant="outline" onClick={exportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" onClick={exportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={vatData.balance > 0 ? 'border-destructive/30' : 'border-primary/30'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                IVA a {vatData.toPayOrReceive}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(Math.abs(vatData.balance))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {vatData.salesCount} vendas, {vatData.purchasesCount} compras
              </p>
            </CardContent>
          </Card>

          <Card className="border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Contribuição SS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(ssData.contribution)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Base: {formatCurrency(ssData.relevantIncome)} × {ssData.rate}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Total Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(expensesData.totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {expensesData.count} facturas validadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vat" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              IVA
            </TabsTrigger>
            <TabsTrigger value="ss" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Segurança Social
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Despesas
            </TabsTrigger>
          </TabsList>

          {/* VAT Tab */}
          <TabsContent value="vat" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resumo de IVA - {periodLabel}</CardTitle>
                <CardDescription>Cálculo do IVA a entregar ou recuperar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      IVA Liquidado (Vendas)
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(vatData.collected)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {vatData.salesCount} facturas de venda
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <TrendingDown className="h-4 w-4" />
                      IVA Dedutível (Compras)
                    </div>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(vatData.deductible)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {vatData.purchasesCount} facturas de compra
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div>
                    <div className="text-sm text-muted-foreground">Saldo IVA</div>
                    <div className="text-3xl font-bold">
                      {formatCurrency(Math.abs(vatData.balance))}
                    </div>
                  </div>
                  <Badge variant={vatData.balance > 0 ? 'destructive' : 'default'} className="text-lg px-4 py-2">
                    A {vatData.toPayOrReceive}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SS Tab */}
          <TabsContent value="ss" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Segurança Social - {periodLabel}</CardTitle>
                <CardDescription>Cálculo da contribuição com base nas receitas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                    <div>Categoria</div>
                    <div className="text-right">Receita</div>
                    <div className="text-right">Coeficiente</div>
                    <div className="text-right">Relevante</div>
                  </div>
                  
                  {Object.entries(ssData.byCategory).map(([cat, value]) => (
                    <div key={cat} className="grid grid-cols-4 gap-4 text-sm">
                      <div className="font-medium">
                        {cat === 'prestacao_servicos' ? 'Prestação de Serviços' : 
                         cat === 'vendas' ? 'Vendas' : 'Outros Rendimentos'}
                      </div>
                      <div className="text-right">{formatCurrency(value)}</div>
                      <div className="text-right text-muted-foreground">
                        {(revenueCoefficients[cat] * 100).toFixed(0)}%
                      </div>
                      <div className="text-right font-medium">
                        {formatCurrency(value * revenueCoefficients[cat])}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Receita Total</div>
                    <div className="text-xl font-bold">{formatCurrency(ssData.totalRevenue)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Rendimento Relevante</div>
                    <div className="text-xl font-bold">{formatCurrency(ssData.relevantIncome)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calculator className="h-3 w-3" />
                      Contribuição ({ssData.rate}%)
                    </div>
                    <div className="text-xl font-bold text-amber-600">{formatCurrency(ssData.contribution)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Despesas por Categoria - {periodLabel}</CardTitle>
                <CardDescription>Análise das compras validadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                    <div>Categoria</div>
                    <div className="text-right">Documentos</div>
                    <div className="text-right">Total</div>
                    <div className="text-right">IVA</div>
                  </div>
                  
                  {expensesData.byCategory.map(([category, data]) => (
                    <div key={category} className="grid grid-cols-4 gap-4 text-sm py-2 border-b border-border/50">
                      <div className="font-medium truncate">{category}</div>
                      <div className="text-right">
                        <Badge variant="secondary">{data.count}</Badge>
                      </div>
                      <div className="text-right">{formatCurrency(data.total)}</div>
                      <div className="text-right text-muted-foreground">{formatCurrency(data.vat)}</div>
                    </div>
                  ))}

                  {expensesData.byCategory.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Sem despesas validadas neste período
                    </div>
                  )}
                </div>

                {expensesData.byCategory.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-4 gap-4 text-sm font-bold">
                      <div>TOTAL</div>
                      <div className="text-right">{expensesData.count}</div>
                      <div className="text-right">{formatCurrency(expensesData.totalExpenses)}</div>
                      <div className="text-right">{formatCurrency(expensesData.totalVat)}</div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
