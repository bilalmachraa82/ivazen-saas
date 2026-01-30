import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, Receipt, Shield, ChevronRight, Loader2 } from 'lucide-react';
import { useSalesInvoices } from '@/hooks/useSalesInvoices';
import { useProfile } from '@/hooks/useProfile';

// Coefficients for Social Security calculation
const CATEGORY_COEFFICIENTS: Record<string, number> = {
  'prestacao_servicos': 0.70,
  'vendas': 0.20,
  'outros_rendimentos': 0.70,
};

interface TaxFlowWidgetProps {
  currentQuarter?: string;
}

export function TaxFlowWidget({ currentQuarter }: TaxFlowWidgetProps) {
  const { invoices, loading: salesLoading } = useSalesInvoices();
  const { profile, isLoading: profileLoading } = useProfile();
  
  // Get current quarter if not provided
  const now = new Date();
  const quarter = currentQuarter || `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  
  // Calculate totals from validated sales invoices
  const validatedSales = invoices?.filter(inv => inv.status === 'validated') || [];
  
  // Total revenue
  const totalRevenue = validatedSales.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  
  // Total VAT
  const totalVAT = validatedSales.reduce((sum, inv) => sum + (inv.total_vat || 0), 0);
  
  // Calculate SS base using categories
  const ssBase = validatedSales.reduce((sum, inv) => {
    const category = inv.revenue_category || 'prestacao_servicos';
    const coefficient = CATEGORY_COEFFICIENTS[category] || 0.70;
    return sum + ((inv.total_amount || 0) * coefficient);
  }, 0);
  
  // SS contribution (default rate 21.4%)
  const ssRate = profile?.ss_contribution_rate || 21.4;
  const ssContribution = ssBase * (ssRate / 100);
  
  const isLoading = salesLoading || profileLoading;
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            Fluxo Fiscal
          </span>
          <Badge variant="secondary" className="text-xs">
            {quarter}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        {/* Flow diagram */}
        <div className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-xl">
          {/* Sales */}
          <Link to="/sales-validation" className="flex-1 group">
            <div className="text-center p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 transition-all group-hover:bg-rose-500/20 group-hover:border-rose-500/40">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-rose-600" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vendas</p>
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                {formatCurrency(totalRevenue)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {validatedSales.length} facturas
              </p>
            </div>
          </Link>
          
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          
          {/* VAT */}
          <Link to="/export" className="flex-1 group">
            <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-all group-hover:bg-amber-500/20 group-hover:border-amber-500/40">
              <Receipt className="h-5 w-5 mx-auto mb-1 text-amber-600" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">IVA</p>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {formatCurrency(totalVAT)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                a entregar
              </p>
            </div>
          </Link>
          
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          
          {/* SS */}
          <Link to="/seguranca-social" className="flex-1 group">
            <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 transition-all group-hover:bg-blue-500/20 group-hover:border-blue-500/40">
              <Shield className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">SS</p>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                {formatCurrency(ssContribution)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                estimado ({ssRate}%)
              </p>
            </div>
          </Link>
        </div>
        
        {/* Quick actions */}
        <div className="flex gap-2 mt-3">
          <Button variant="ghost" size="sm" asChild className="flex-1 text-xs h-8">
            <Link to="/upload?type=sales">
              + Factura Venda
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="flex-1 text-xs h-8">
            <Link to="/seguranca-social">
              Ver Declaração
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
