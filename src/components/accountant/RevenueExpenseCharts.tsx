import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, FileDown, FileSpreadsheet } from 'lucide-react';
import { format, startOfMonth, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  document_date: string;
  total_amount: number;
  total_vat?: number | null;
  status?: string | null;
  final_deductibility?: number | null;
  client_id: string;
}

interface SalesInvoice {
  id: string;
  document_date: string;
  total_amount: number;
  total_vat?: number | null;
  client_id: string;
}

interface RevenueExpenseChartsProps {
  expenseInvoices: Invoice[];
  salesInvoices?: SalesInvoice[];
  months?: number;
}

export function RevenueExpenseCharts({ 
  expenseInvoices, 
  salesInvoices = [],
  months = 12 
}: RevenueExpenseChartsProps) {
  
  const chartData = useMemo(() => {
    const now = new Date();
    const monthsData: Record<string, { 
      month: string; 
      monthLabel: string;
      expenses: number; 
      revenue: number;
      vatDeductible: number;
      vatCollected: number;
    }> = {};

    // Initialize months
    for (let i = months - 1; i >= 0; i--) {
      const date = startOfMonth(subMonths(now, i));
      const key = format(date, 'yyyy-MM');
      monthsData[key] = {
        month: key,
        monthLabel: format(date, 'MMM yy', { locale: pt }),
        expenses: 0,
        revenue: 0,
        vatDeductible: 0,
        vatCollected: 0,
      };
    }

    // Aggregate expenses
    expenseInvoices.forEach(inv => {
      const key = inv.document_date.slice(0, 7);
      if (monthsData[key]) {
        monthsData[key].expenses += Number(inv.total_amount) || 0;
        const vat = Number(inv.total_vat) || 0;
        const deductibility = (inv.final_deductibility || 100) / 100;
        monthsData[key].vatDeductible += vat * deductibility;
      }
    });

    // Aggregate revenue
    salesInvoices.forEach(inv => {
      const key = inv.document_date.slice(0, 7);
      if (monthsData[key]) {
        monthsData[key].revenue += Number(inv.total_amount) || 0;
        monthsData[key].vatCollected += Number(inv.total_vat) || 0;
      }
    });

    return Object.values(monthsData);
  }, [expenseInvoices, salesInvoices, months]);

  const totals = useMemo(() => {
    const totalExpenses = chartData.reduce((sum, d) => sum + d.expenses, 0);
    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalVatDeductible = chartData.reduce((sum, d) => sum + d.vatDeductible, 0);
    const totalVatCollected = chartData.reduce((sum, d) => sum + d.vatCollected, 0);
    
    // Calculate trend (last 3 months vs previous 3 months)
    const recent3 = chartData.slice(-3);
    const prev3 = chartData.slice(-6, -3);
    
    const recentExpenses = recent3.reduce((sum, d) => sum + d.expenses, 0);
    const prevExpenses = prev3.reduce((sum, d) => sum + d.expenses, 0);
    const recentRevenue = recent3.reduce((sum, d) => sum + d.revenue, 0);
    const prevRevenue = prev3.reduce((sum, d) => sum + d.revenue, 0);
    
    const expenseTrend = prevExpenses > 0 ? ((recentExpenses - prevExpenses) / prevExpenses) * 100 : 0;
    const revenueTrend = prevRevenue > 0 ? ((recentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    
    return {
      totalExpenses,
      totalRevenue,
      totalVatDeductible,
      totalVatCollected,
      netVat: totalVatCollected - totalVatDeductible,
      profit: totalRevenue - totalExpenses,
      expenseTrend,
      revenueTrend,
    };
  }, [chartData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyPrecise = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Evolução Financeira', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Últimos ${months} meses - Gerado em ${format(new Date(), 'dd/MM/yyyy', { locale: pt })}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo do Período', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryData = [
      ['Total Receitas', formatCurrencyPrecise(totals.totalRevenue)],
      ['Total Despesas', formatCurrencyPrecise(totals.totalExpenses)],
      ['Resultado (Lucro/Prejuízo)', formatCurrencyPrecise(totals.profit)],
      ['IVA Liquidado', formatCurrencyPrecise(totals.totalVatCollected)],
      ['IVA Dedutível', formatCurrencyPrecise(totals.totalVatDeductible)],
      ['IVA Líquido', formatCurrencyPrecise(totals.netVat)],
    ];

    summaryData.forEach(([label, value]) => {
      doc.text(`${label}:`, margin, y);
      doc.text(value, margin + 60, y);
      y += 5;
    });
    y += 8;

    // Monthly data table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados Mensais', margin, y);
    y += 8;

    // Table header
    const colWidths = [30, 35, 35, 35, 35, 35, 35];
    const headers = ['Mês', 'Receitas', 'Despesas', 'Resultado', 'IVA Liq.', 'IVA Ded.', 'IVA Líq.'];

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, colWidths.reduce((a, b) => a + b, 0), 7, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    let xPos = margin;
    headers.forEach((header, index) => {
      doc.text(header, xPos + 2, y);
      xPos += colWidths[index];
    });
    y += 6;

    // Table rows
    doc.setFont('helvetica', 'normal');
    chartData.forEach((row) => {
      if (y > 190) {
        doc.addPage();
        y = margin;
      }

      xPos = margin;
      const profit = row.revenue - row.expenses;
      const netVat = row.vatCollected - row.vatDeductible;
      const rowData = [
        row.monthLabel,
        formatCurrencyPrecise(row.revenue),
        formatCurrencyPrecise(row.expenses),
        formatCurrencyPrecise(profit),
        formatCurrencyPrecise(row.vatCollected),
        formatCurrencyPrecise(row.vatDeductible),
        formatCurrencyPrecise(netVat),
      ];

      rowData.forEach((value, index) => {
        doc.text(value, xPos + 2, y);
        xPos += colWidths[index];
      });
      y += 5;
    });

    doc.save(`Evolucao_Financeira_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exportado com sucesso');
  };

  const exportToExcel = () => {
    // Prepare monthly data
    const monthlyData = chartData.map(row => ({
      'Mês': row.monthLabel,
      'Período': row.month,
      'Receitas (€)': Number(row.revenue.toFixed(2)),
      'Despesas (€)': Number(row.expenses.toFixed(2)),
      'Resultado (€)': Number((row.revenue - row.expenses).toFixed(2)),
      'IVA Liquidado (€)': Number(row.vatCollected.toFixed(2)),
      'IVA Dedutível (€)': Number(row.vatDeductible.toFixed(2)),
      'IVA Líquido (€)': Number((row.vatCollected - row.vatDeductible).toFixed(2)),
    }));

    // Prepare summary data
    const summaryData = [
      { 'Indicador': 'Total Receitas', 'Valor (€)': Number(totals.totalRevenue.toFixed(2)) },
      { 'Indicador': 'Total Despesas', 'Valor (€)': Number(totals.totalExpenses.toFixed(2)) },
      { 'Indicador': 'Resultado (Lucro/Prejuízo)', 'Valor (€)': Number(totals.profit.toFixed(2)) },
      { 'Indicador': 'IVA Liquidado', 'Valor (€)': Number(totals.totalVatCollected.toFixed(2)) },
      { 'Indicador': 'IVA Dedutível', 'Valor (€)': Number(totals.totalVatDeductible.toFixed(2)) },
      { 'Indicador': 'IVA Líquido', 'Valor (€)': Number(totals.netVat.toFixed(2)) },
      { 'Indicador': 'Tendência Receitas (%)', 'Valor (€)': Number(totals.revenueTrend.toFixed(1)) },
      { 'Indicador': 'Tendência Despesas (%)', 'Valor (€)': Number(totals.expenseTrend.toFixed(1)) },
    ];

    const wb = XLSX.utils.book_new();
    
    // Monthly sheet
    const wsMonthly = XLSX.utils.json_to_sheet(monthlyData);
    wsMonthly['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, 
      { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Dados Mensais');

    // Summary sheet
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

    XLSX.writeFile(wb, `Evolucao_Financeira_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel exportado com sucesso');
  };

  const TrendIndicator = ({ value }: { value: number }) => {
    if (Math.abs(value) < 1) {
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
    if (value > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Export Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={exportToPDF}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
        <Button variant="outline" size="sm" onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Receitas</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalRevenue)}</p>
              </div>
              <TrendIndicator value={totals.revenueTrend} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.revenueTrend > 0 ? '+' : ''}{totals.revenueTrend.toFixed(1)}% vs trim. anterior
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Despesas</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.totalExpenses)}</p>
              </div>
              <TrendIndicator value={-totals.expenseTrend} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.expenseTrend > 0 ? '+' : ''}{totals.expenseTrend.toFixed(1)}% vs trim. anterior
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Resultado</p>
              <p className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totals.profit)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receitas - Despesas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">IVA Líquido</p>
              <p className={`text-2xl font-bold ${totals.netVat >= 0 ? 'text-blue-600' : 'text-green-600'}`}>
                {formatCurrency(totals.netVat)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.netVat >= 0 ? 'A pagar ao Estado' : 'A recuperar'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Receitas e Despesas</CardTitle>
          <CardDescription>Últimos {months} meses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Receitas"
                  stroke="hsl(var(--chart-2))" 
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  name="Despesas"
                  stroke="hsl(var(--chart-1))" 
                  fill="url(#colorExpenses)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* VAT Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução do IVA</CardTitle>
          <CardDescription>IVA liquidado vs IVA dedutível</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  dataKey="vatCollected" 
                  name="IVA Liquidado"
                  fill="hsl(var(--chart-3))" 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="vatDeductible" 
                  name="IVA Dedutível"
                  fill="hsl(var(--chart-4))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
