import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface VATCalculationData {
  vatCollected: number;
  vatDeductible: number;
  vatBalance: number;
  isRecoverable: boolean;
  salesCount: number;
  purchasesCount: number;
  period: string;
}

interface UseVATCalculationOptions {
  forClientId?: string | null;
  year?: number;
  quarter?: number;
}

export function useVATCalculation(options: UseVATCalculationOptions = {}) {
  const { user } = useAuth();
  const { forClientId, year, quarter } = options;

  const effectiveClientId = forClientId || user?.id;
  const effectiveYear = year || new Date().getFullYear();
  
  // Calculate quarter date range
  const getQuarterDateRange = (y: number, q: number) => {
    const startMonth = (q - 1) * 3;
    const startDate = new Date(y, startMonth, 1);
    const endDate = new Date(y, startMonth + 3, 0); // Last day of the quarter
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  };

  // Get current quarter if not specified
  const currentQuarter = quarter || Math.ceil((new Date().getMonth() + 1) / 3);
  const dateRange = getQuarterDateRange(effectiveYear, currentQuarter);

  // Query for sales invoices (VAT collected)
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['vat-sales', effectiveClientId, effectiveYear, currentQuarter],
    queryFn: async () => {
      if (!effectiveClientId) return null;

      const { data, error } = await supabase
        .from('sales_invoices')
        .select('total_vat, vat_standard, vat_intermediate, vat_reduced')
        .eq('client_id', effectiveClientId)
        .eq('status', 'validated')
        .gte('document_date', dateRange.start)
        .lte('document_date', dateRange.end);

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveClientId,
  });

  // Query for purchase invoices (VAT deductible)
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['vat-purchases', effectiveClientId, effectiveYear, currentQuarter],
    queryFn: async () => {
      if (!effectiveClientId) return null;

      const { data, error } = await supabase
        .from('invoices')
        .select('total_vat, vat_standard, vat_intermediate, vat_reduced, final_deductibility')
        .eq('client_id', effectiveClientId)
        .eq('status', 'validated')
        .gte('document_date', dateRange.start)
        .lte('document_date', dateRange.end);

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveClientId,
  });

  // Query for annual sales total (for exemption check)
  const { data: annualSalesData, isLoading: annualLoading } = useQuery({
    queryKey: ['annual-sales', effectiveClientId, effectiveYear],
    queryFn: async () => {
      if (!effectiveClientId) return null;

      const startOfYear = `${effectiveYear}-01-01`;
      const endOfYear = `${effectiveYear}-12-31`;

      const { data, error } = await supabase
        .from('sales_invoices')
        .select('total_amount')
        .eq('client_id', effectiveClientId)
        .eq('status', 'validated')
        .gte('document_date', startOfYear)
        .lte('document_date', endOfYear);

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveClientId,
  });

  // Calculate totals
  const vatCollected = salesData?.reduce((sum, inv) => {
    const total = (inv.total_vat ?? 0) || 
      ((inv.vat_standard ?? 0) + (inv.vat_intermediate ?? 0) + (inv.vat_reduced ?? 0));
    return sum + total;
  }, 0) ?? 0;

  const vatDeductible = purchasesData?.reduce((sum, inv) => {
    const totalVat = (inv.total_vat ?? 0) || 
      ((inv.vat_standard ?? 0) + (inv.vat_intermediate ?? 0) + (inv.vat_reduced ?? 0));
    // Apply deductibility percentage
    const deductibility = inv.final_deductibility ?? 100;
    return sum + (totalVat * deductibility / 100);
  }, 0) ?? 0;

  const vatBalance = vatCollected - vatDeductible;
  const isRecoverable = vatBalance < 0;

  const annualTurnover = annualSalesData?.reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0) ?? 0;

  const quarterLabels: Record<number, string> = {
    1: '1º Trimestre',
    2: '2º Trimestre',
    3: '3º Trimestre',
    4: '4º Trimestre',
  };

  const result: VATCalculationData = {
    vatCollected,
    vatDeductible,
    vatBalance: Math.abs(vatBalance),
    isRecoverable,
    salesCount: salesData?.length ?? 0,
    purchasesCount: purchasesData?.length ?? 0,
    period: `${quarterLabels[currentQuarter]} ${effectiveYear}`,
  };

  return {
    data: result,
    annualTurnover,
    isLoading: salesLoading || purchasesLoading || annualLoading,
    hasData: (salesData?.length ?? 0) > 0 || (purchasesData?.length ?? 0) > 0,
    dateRange,
    year: effectiveYear,
    quarter: currentQuarter,
  };
}
