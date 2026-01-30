import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  Receipt,
  Percent,
  Building2
} from 'lucide-react';

interface ClientWithStats {
  id: string;
  full_name: string;
  company_name: string | null;
  invoiceCount: number;
  pendingCount: number;
  classifiedCount: number;
  validatedCount: number;
  totalVat: number;
  totalDeductible: number;
  ssContribution?: number;
}

interface ClientInvoice {
  id: string;
  client_id: string;
  document_date: string;
  total_amount: number;
  total_vat: number | null;
  status: string | null;
  final_classification: string | null;
  final_deductibility: number | null;
  fiscal_period: string | null;
}

interface AggregatedFiscalSummaryProps {
  clients: ClientWithStats[];
  invoices: ClientInvoice[];
}

export function AggregatedFiscalSummary({ clients, invoices }: AggregatedFiscalSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  // Get current and previous quarter
  const { currentQuarter, previousQuarter } = useMemo(() => {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    const year = now.getFullYear();
    
    const current = `${year}-T${q}`;
    const prev = q === 1 ? `${year - 1}-T4` : `${year}-T${q - 1}`;
    
    return { currentQuarter: current, previousQuarter: prev };
  }, []);

  // Calculate aggregated stats per period
  const periodStats = useMemo(() => {
    const periods: Record<string, {
      totalAmount: number;
      totalVat: number;
      totalDeductible: number;
      invoiceCount: number;
      validatedCount: number;
    }> = {};

    invoices.forEach(inv => {
      const period = inv.fiscal_period || 'unknown';
      if (!periods[period]) {
        periods[period] = {
          totalAmount: 0,
          totalVat: 0,
          totalDeductible: 0,
          invoiceCount: 0,
          validatedCount: 0,
        };
      }
      
      periods[period].totalAmount += inv.total_amount;
      periods[period].totalVat += inv.total_vat || 0;
      periods[period].invoiceCount++;
      
      if (inv.status === 'validated') {
        periods[period].validatedCount++;
        const deductibility = (inv.final_deductibility || 0) / 100;
        periods[period].totalDeductible += (inv.total_vat || 0) * deductibility;
      }
    });

    return periods;
  }, [invoices]);

  // Calculate classification breakdown
  const classificationBreakdown = useMemo(() => {
    const breakdown: Record<string, { amount: number; vat: number; count: number }> = {};
    
    invoices.filter(i => i.status === 'validated' && i.final_classification).forEach(inv => {
      const classification = inv.final_classification!;
      if (!breakdown[classification]) {
        breakdown[classification] = { amount: 0, vat: 0, count: 0 };
      }
      breakdown[classification].amount += inv.total_amount;
      breakdown[classification].vat += inv.total_vat || 0;
      breakdown[classification].count++;
    });

    return Object.entries(breakdown)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5);
  }, [invoices]);

  // Calculate client ranking by activity
  const clientRanking = useMemo(() => {
    return [...clients]
      .sort((a, b) => b.invoiceCount - a.invoiceCount)
      .slice(0, 5);
  }, [clients]);

  // Calculate totals for current quarter
  const currentQuarterStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQ = Math.ceil((now.getMonth() + 1) / 3);
    
    // Filter invoices for current quarter
    const qInvoices = invoices.filter(inv => {
      if (!inv.fiscal_period) return false;
      const [year, month] = inv.fiscal_period.split('-').map(Number);
      const invQ = Math.ceil(month / 3);
      return year === currentYear && invQ === currentQ;
    });

    const totalAmount = qInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalVat = qInvoices.reduce((sum, inv) => sum + (inv.total_vat || 0), 0);
    const totalDeductible = qInvoices
      .filter(i => i.status === 'validated')
      .reduce((sum, inv) => {
        const deductibility = (inv.final_deductibility || 0) / 100;
        return sum + (inv.total_vat || 0) * deductibility;
      }, 0);

    const totalSS = clients.reduce((sum, c) => sum + (c.ssContribution || 0), 0);

    return { totalAmount, totalVat, totalDeductible, totalSS, count: qInvoices.length };
  }, [invoices, clients]);

  const maxAmount = classificationBreakdown.length > 0 
    ? Math.max(...classificationBreakdown.map(([, d]) => d.amount))
    : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5" />
          Resumo Fiscal Agregado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quarter" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quarter">Trimestre</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
          </TabsList>

          <TabsContent value="quarter" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Despesas</span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(currentQuarterStats.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">{currentQuarterStats.count} facturas</p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">IVA Total</span>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(currentQuarterStats.totalVat)}</p>
                <p className="text-xs text-green-600">Dedutível: {formatCurrency(currentQuarterStats.totalDeductible)}</p>
              </div>
              
              <div className="p-4 rounded-lg bg-blue-500/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">SS Estimada</span>
                  <TrendingDown className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(currentQuarterStats.totalSS)}</p>
                <p className="text-xs text-muted-foreground">Todos os clientes</p>
              </div>
              
              <div className="p-4 rounded-lg bg-green-500/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Saldo IVA</span>
                  <Receipt className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(currentQuarterStats.totalDeductible - currentQuarterStats.totalVat * 0.1)}
                </p>
                <p className="text-xs text-muted-foreground">A recuperar (estimado)</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-3">
            {classificationBreakdown.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Sem dados de categorias validadas
              </p>
            ) : (
              classificationBreakdown.map(([category, data]) => (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate max-w-[150px]">{category}</span>
                      <Badge variant="outline" className="text-xs">{data.count}</Badge>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(data.amount)}</span>
                  </div>
                  <Progress value={(data.amount / maxAmount) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">IVA: {formatCurrency(data.vat)}</p>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="clients" className="space-y-3">
            {clientRanking.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Sem clientes associados
              </p>
            ) : (
              clientRanking.map((client, index) => (
                <div 
                  key={client.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {client.company_name || client.full_name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{client.invoiceCount} facturas</p>
                    <p className="text-xs text-green-600">{formatCurrency(client.totalDeductible)}</p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
