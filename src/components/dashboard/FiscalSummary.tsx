/**
 * FiscalSummary Component
 * Dashboard widget showing unified fiscal overview:
 * - IVA a entregar/recuperar
 * - Segurança Social próxima
 * - Retenções sofridas (para IRS)
 */

import { useMemo } from 'react';
import { ZenCard } from '@/components/zen';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Receipt, 
  Calculator,
  ArrowRight,
  Info
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FiscalSummaryProps {
  clientId?: string | null;
  year?: number;
  compact?: boolean;
}

export function FiscalSummary({ clientId, year, compact = false }: FiscalSummaryProps) {
  const { user } = useAuth();
  const effectiveClientId = clientId || user?.id;
  const fiscalYear = year || new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  // Fetch IVA data (vendas - compras)
  const { data: ivaData, isLoading: ivaLoading } = useQuery({
    queryKey: ['fiscal-summary-iva', effectiveClientId, fiscalYear, currentQuarter],
    queryFn: async () => {
      if (!effectiveClientId) return { liquidado: 0, dedutivel: 0, saldo: 0 };

      // IVA liquidado (vendas)
      const { data: salesData } = await supabase
        .from('sales_invoices')
        .select('total_vat')
        .eq('client_id', effectiveClientId)
        .gte('document_date', `${fiscalYear}-01-01`)
        .lte('document_date', `${fiscalYear}-12-31`);

      const liquidado = salesData?.reduce((sum, inv) => sum + (Number(inv.total_vat) || 0), 0) || 0;

      // IVA dedutível (compras validadas)
      const { data: purchaseData } = await supabase
        .from('invoices')
        .select('vat_reduced, vat_intermediate, vat_standard, ai_deductibility, final_deductibility')
        .eq('client_id', effectiveClientId)
        .eq('status', 'validated')
        .gte('document_date', `${fiscalYear}-01-01`)
        .lte('document_date', `${fiscalYear}-12-31`);

      let dedutivel = 0;
      purchaseData?.forEach(inv => {
        const totalVat = (Number(inv.vat_reduced) || 0) + 
                         (Number(inv.vat_intermediate) || 0) + 
                         (Number(inv.vat_standard) || 0);
        const deductibility = (inv.final_deductibility ?? inv.ai_deductibility ?? 100) / 100;
        dedutivel += totalVat * deductibility;
      });

      return {
        liquidado,
        dedutivel,
        saldo: liquidado - dedutivel
      };
    },
    enabled: !!effectiveClientId,
    staleTime: 60000,
  });

  // Fetch retenções sofridas (para trabalhadores independentes)
  const { data: retencoesData, isLoading: retencoesLoading } = useQuery({
    queryKey: ['fiscal-summary-retencoes', effectiveClientId, fiscalYear],
    queryFn: async () => {
      if (!effectiveClientId) return { total: 0, count: 0 };

      // Check if there are any withholdings where beneficiary_nif matches the client's NIF
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nif')
        .eq('id', effectiveClientId)
        .single();

      if (!profileData?.nif) return { total: 0, count: 0 };

      // Get withholdings where this client is the beneficiary (retenções sofridas)
      const { data: withholdings } = await supabase
        .from('tax_withholdings')
        .select('withholding_amount')
        .eq('beneficiary_nif', profileData.nif)
        .eq('fiscal_year', fiscalYear);

      const total = withholdings?.reduce((sum, w) => sum + (Number(w.withholding_amount) || 0), 0) || 0;

      return {
        total,
        count: withholdings?.length || 0
      };
    },
    enabled: !!effectiveClientId,
    staleTime: 60000,
  });

  // Fetch SS estimate (simplified)
  const { data: ssData, isLoading: ssLoading } = useQuery({
    queryKey: ['fiscal-summary-ss', effectiveClientId, fiscalYear, currentQuarter],
    queryFn: async () => {
      if (!effectiveClientId) return { estimate: 0, base: 0 };

      // Get revenue for SS calculation
      const { data: salesData } = await supabase
        .from('sales_invoices')
        .select('total_amount, revenue_category')
        .eq('client_id', effectiveClientId)
        .gte('document_date', `${fiscalYear}-01-01`)
        .lte('document_date', `${fiscalYear}-12-31`);

      // Calculate base with coefficients (simplified)
      let base = 0;
      salesData?.forEach(sale => {
        const amount = Number(sale.total_amount) || 0;
        // Default coefficient for services is 70%
        const coefficient = sale.revenue_category === 'vendas' ? 0.20 : 0.70;
        base += amount * coefficient;
      });

      // SS rate is 21.4%
      const estimate = base * 0.214;

      return {
        estimate,
        base
      };
    },
    enabled: !!effectiveClientId,
    staleTime: 60000,
  });

  const isLoading = ivaLoading || retencoesLoading || ssLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <CompactMetric
          label="IVA"
          value={ivaData?.saldo || 0}
          loading={ivaLoading}
          positive={ivaData?.saldo ? ivaData.saldo < 0 : undefined}
          href="/iva-calculator"
        />
        <CompactMetric
          label="SS Estimada"
          value={ssData?.estimate || 0}
          loading={ssLoading}
          href="/seguranca-social"
        />
        <CompactMetric
          label="Retenções"
          value={retencoesData?.total || 0}
          loading={retencoesLoading}
          href="/modelo-10"
          tooltip="Retenções na fonte sofridas (para IRS)"
        />
      </div>
    );
  }

  return (
    <ZenCard variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Resumo Fiscal {fiscalYear}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* IVA */}
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">IVA a Entregar/Recuperar</span>
            <Link to="/iva-calculator" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver detalhes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="flex items-center gap-2">
              {(ivaData?.saldo || 0) >= 0 ? (
                <TrendingUp className="h-5 w-5 text-amber-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-green-500" />
              )}
              <span className={`text-2xl font-bold ${(ivaData?.saldo || 0) >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {formatCurrency(Math.abs(ivaData?.saldo || 0))}
              </span>
              <Badge variant="secondary" className="text-xs">
                {(ivaData?.saldo || 0) >= 0 ? 'A pagar' : 'A recuperar'}
              </Badge>
            </div>
          )}
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>Liquidado: {formatCurrency(ivaData?.liquidado || 0)}</span>
            <span>Dedutível: {formatCurrency(ivaData?.dedutivel || 0)}</span>
          </div>
        </div>

        {/* SS */}
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Segurança Social (próximo)</span>
            <Link to="/seguranca-social" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver detalhes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-blue-600">
                {formatCurrency(ssData?.estimate || 0)}
              </span>
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            Base tributável: {formatCurrency(ssData?.base || 0)}
          </div>
        </div>

        {/* Retenções Sofridas */}
        {(retencoesData?.total || 0) > 0 && (
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 cursor-help">
                      Retenções Sofridas (IRS)
                      <Info className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">
                      Retenções na fonte feitas por clientes sobre os seus recibos verdes.
                      Este valor será deduzido no seu IRS.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Link to="/modelo-10" className="text-xs text-primary hover:underline flex items-center gap-1">
                Ver detalhes <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold text-purple-600">
                  {formatCurrency(retencoesData?.total || 0)}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {retencoesData?.count} recibos
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </ZenCard>
  );
}

interface CompactMetricProps {
  label: string;
  value: number;
  loading: boolean;
  positive?: boolean;
  href: string;
  tooltip?: string;
}

function CompactMetric({ label, value, loading, positive, href, tooltip }: CompactMetricProps) {
  const formatCurrency = (v: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(v));
  };

  const content = (
    <Link 
      to={href}
      className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors block"
    >
      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
        {label}
        {tooltip && <Info className="h-3 w-3" />}
      </div>
      {loading ? (
        <Skeleton className="h-6 w-16" />
      ) : (
        <div className={`text-lg font-bold ${
          positive === true ? 'text-green-600' : 
          positive === false ? 'text-amber-600' : 
          'text-foreground'
        }`}>
          {formatCurrency(value)}
        </div>
      )}
    </Link>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
