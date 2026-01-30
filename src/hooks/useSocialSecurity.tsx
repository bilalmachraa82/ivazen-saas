import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

interface RevenueEntry {
  id: string;
  client_id: string;
  period_quarter: string;
  category: string;
  amount: number;
  source: string;
  notes: string | null;
  created_at: string;
}

interface SSDeclaration {
  id: string;
  client_id: string;
  period_quarter: string;
  total_revenue: number;
  contribution_base: number;
  contribution_amount: number;
  contribution_rate: number;
  status: string;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
}

// IAS values by year (Indexante dos Apoios Sociais)
export const IAS_VALUES: Record<number, number> = {
  2024: 509.26,
  2025: 522.50,
  2026: 537.13,
};

// Get IAS for a specific year (defaults to current year, falls back to latest known)
export const getIAS = (year?: number): number => {
  const targetYear = year || new Date().getFullYear();
  
  // If we have the exact year, return it
  if (IAS_VALUES[targetYear]) {
    return IAS_VALUES[targetYear];
  }
  
  // Otherwise, return the latest known value
  const knownYears = Object.keys(IAS_VALUES).map(Number).sort((a, b) => b - a);
  return IAS_VALUES[knownYears[0]];
};

// Get IAS for quarter period (format: "2025-Q1")
export const getIASForQuarter = (quarter: string): number => {
  const year = parseInt(quarter.split('-')[0], 10);
  return getIAS(year);
};

// Contribution limits based on IAS (dynamic based on year)
export const getSSLimits = (year?: number) => {
  const ias = getIAS(year);
  return {
    IAS: ias,
    MIN_BASE_ORGANIZED: ias * 1.5,       // minimum for organized accounting
    MAX_BASE: ias * 12,                   // maximum contribution base
    TCO_EXEMPTION_LIMIT: ias * 4,        // exemption threshold for TCO
    MIN_CONTRIBUTION: 20.00,              // Minimum contribution amount
  };
};

// Legacy export for backwards compatibility (uses current year)
export const IAS_2025 = 522.50;
export const SS_LIMITS = getSSLimits(2025);

// Coefficients for calculating relevant income by category (official rates)
export const REVENUE_COEFFICIENTS: Record<string, number> = {
  prestacao_servicos: 0.70,    // 70% - Services
  vendas: 0.20,                 // 20% - Sales of goods
  hotelaria: 0.20,              // 20% - Hotels/Restaurants
  producao_agricola: 0.20,      // 20% - Agricultural production
  rendas: 0.95,                 // 95% - Rental income
  capitais: 0.95,               // 95% - Capital income
  prop_intelectual: 0.50,       // 50% - Intellectual property (first transfer)
  subsidios: 0.70,              // 70% - Subsidies
  outros: 0.70,                 // 70% - Other income
};

export const REVENUE_CATEGORIES = [
  { value: 'prestacao_servicos', label: 'Prestação de Serviços (Cat. B)', coefficient: 0.70 },
  { value: 'vendas', label: 'Vendas de Produtos', coefficient: 0.20 },
  { value: 'hotelaria', label: 'Actividades Hoteleiras/Restauração', coefficient: 0.20 },
  { value: 'producao_agricola', label: 'Produção Agrícola', coefficient: 0.20 },
  { value: 'rendas', label: 'Rendimentos Prediais (Cat. F)', coefficient: 0.95 },
  { value: 'capitais', label: 'Rendimentos de Capitais (Cat. E)', coefficient: 0.95 },
  { value: 'prop_intelectual', label: 'Propriedade Intelectual', coefficient: 0.50 },
  { value: 'subsidios', label: 'Subsídios', coefficient: 0.70 },
  { value: 'outros', label: 'Outros Rendimentos', coefficient: 0.70 },
] as const;

// Official contribution rates
export const SS_RATES = [
  { value: '0', label: '0% - Isento' },
  { value: '21.4', label: '21.4% - Trabalhadores Independentes' },
  { value: '25.2', label: '25.2% - Produtores Agrícolas / ENI' },
];

// Contribution rates by worker type (official rates from ISS manual)
export const CONTRIBUTION_RATES_BY_TYPE: Record<string, number> = {
  independent: 21.4,      // Trabalhadores Independentes
  eni: 25.2,              // Empresários em Nome Individual
  eirl: 25.2,             // EIRL
  agricultural: 25.2,     // Produtores Agrícolas
};

// Rate descriptions with legal references
export const RATE_DESCRIPTIONS: Record<string, string> = {
  independent: 'Taxa geral para trabalhadores independentes (Art. 168º Código Contributivo)',
  eni: 'Taxa para ENI com rendimentos comerciais/industriais',
  eirl: 'Taxa para titulares de EIRL',
  agricultural: 'Taxa para produtores agrícolas e cônjuges',
};

// Worker types
export const WORKER_TYPES = [
  { value: 'independent', label: 'Trabalhador Independente', rate: 21.4 },
  { value: 'eni', label: 'Empresário em Nome Individual (ENI)', rate: 25.2 },
  { value: 'eirl', label: 'EIRL - Estab. Individual Resp. Limitada', rate: 25.2 },
  { value: 'agricultural', label: 'Produtor Agrícola', rate: 25.2 },
];

// Accounting regimes
export const ACCOUNTING_REGIMES = [
  { value: 'simplified', label: 'Regime Simplificado' },
  { value: 'organized', label: 'Contabilidade Organizada' },
];

// Calculate contribution rate dynamically based on user profile
export function calculateContributionRate(
  workerType: string,
  accountingRegime: string,
  hasOtherEmployment: boolean,
  otherEmploymentSalary: number,
  monthlyRelevantIncome: number,
  isFirstYear: boolean
): { rate: number; isExempt: boolean; reason: string } {
  // Exemption: First year of activity
  if (isFirstYear) {
    return { 
      rate: 0, 
      isExempt: true, 
      reason: 'Isento - Primeiros 12 meses de atividade (Secção D1 do Manual ISS)' 
    };
  }
  
  // Exemption: TCO accumulation
  if (hasOtherEmployment && 
      otherEmploymentSalary >= IAS_2025 && 
      monthlyRelevantIncome < SS_LIMITS.TCO_EXEMPTION_LIMIT) {
    return { 
      rate: 0, 
      isExempt: true, 
      reason: 'Isento - Acumulação com TCO, rendimento relevante < 4×IAS (Secção E1 do Manual ISS)' 
    };
  }
  
  // Determine base rate by worker type
  const baseRate = CONTRIBUTION_RATES_BY_TYPE[workerType] || 21.4;
  const description = RATE_DESCRIPTIONS[workerType] || 'Taxa padrão';
  
  return { 
    rate: baseRate, 
    isExempt: false, 
    reason: description 
  };
}

export function getCurrentQuarter(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${quarter}`;
}

export function getPreviousQuarter(quarter: string): string {
  const [year, q] = quarter.split('-Q');
  const qNum = parseInt(q);
  if (qNum === 1) {
    return `${parseInt(year) - 1}-Q4`;
  }
  return `${year}-Q${qNum - 1}`;
}

export function getQuarterLabel(quarter: string): string {
  const [year, q] = quarter.split('-Q');
  const quarterNum = parseInt(q);
  const months = {
    1: 'Janeiro - Março',
    2: 'Abril - Junho',
    3: 'Julho - Setembro',
    4: 'Outubro - Dezembro',
  };
  return `${months[quarterNum as keyof typeof months]} ${year}`;
}

export function getDeadlineMonth(quarter: string): { month: number; year: number } {
  const [year, q] = quarter.split('-Q');
  const quarterNum = parseInt(q);
  // Deadline is the month after the quarter ends
  const deadlineMonths = { 1: 4, 2: 7, 3: 10, 4: 1 };
  const deadlineYear = quarterNum === 4 ? parseInt(year) + 1 : parseInt(year);
  return { month: deadlineMonths[quarterNum as keyof typeof deadlineMonths], year: deadlineYear };
}

export function isDeadlineMonth(): boolean {
  const now = new Date();
  const month = now.getMonth() + 1;
  return [1, 4, 7, 10].includes(month);
}

// Calculate relevant income with proper coefficients
export function calculateRelevantIncome(entries: RevenueEntry[]): number {
  return entries.reduce((sum, entry) => {
    const coefficient = REVENUE_COEFFICIENTS[entry.category] || 0.70;
    return sum + (Number(entry.amount) * coefficient);
  }, 0);
}

// Check if exempt from SS contributions due to TCO (trabalho por conta de outrem)
export function checkTCOExemption(
  hasOtherEmployment: boolean,
  otherEmploymentSalary: number,
  monthlyRelevantIncome: number
): boolean {
  if (!hasOtherEmployment) return false;
  
  // Exempt if: has TCO with salary >= 1 IAS AND relevant income < 4 IAS
  return otherEmploymentSalary >= IAS_2025 && monthlyRelevantIncome < SS_LIMITS.TCO_EXEMPTION_LIMIT;
}

// Helper to get quarter from date
function getQuarterFromDate(dateStr: string): string {
  const date = new Date(dateStr);
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `${date.getFullYear()}-Q${quarter}`;
}

export function useSocialSecurity(selectedQuarter?: string, selectedClientId?: string) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const [quarter, setQuarter] = useState(selectedQuarter || getCurrentQuarter());
  
  // For accountants, use selected client ID; for regular users, use their own ID
  const effectiveClientId = selectedClientId || user?.id;

  // Fetch revenue entries for quarter
  const { data: revenueEntries = [], isLoading: isLoadingRevenue } = useQuery({
    queryKey: ['revenue-entries', effectiveClientId, quarter],
    queryFn: async () => {
      if (!effectiveClientId) return [];

      const { data, error } = await supabase
        .from('revenue_entries')
        .select('*')
        .eq('client_id', effectiveClientId)
        .eq('period_quarter', quarter)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as RevenueEntry[];
    },
    enabled: !!effectiveClientId,
  });

  // Fetch validated sales invoices for quarter
  const { data: salesInvoices = [], isLoading: isLoadingSales } = useQuery({
    queryKey: ['sales-invoices-ss', effectiveClientId, quarter],
    queryFn: async () => {
      if (!effectiveClientId) return [];

      // Get quarter date range
      const [year, q] = quarter.split('-Q');
      const quarterNum = parseInt(q);
      const startMonth = (quarterNum - 1) * 3;
      const startDate = new Date(parseInt(year), startMonth, 1);
      const endDate = new Date(parseInt(year), startMonth + 3, 0); // Last day of quarter

      const { data, error } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('client_id', effectiveClientId)
        .eq('status', 'validated')
        .gte('document_date', startDate.toISOString().split('T')[0])
        .lte('document_date', endDate.toISOString().split('T')[0])
        .order('document_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveClientId,
  });

  // Fetch declaration for quarter
  const { data: declaration, isLoading: isLoadingDeclaration } = useQuery({
    queryKey: ['ss-declaration', effectiveClientId, quarter],
    queryFn: async () => {
      if (!effectiveClientId) return null;

      const { data, error } = await supabase
        .from('ss_declarations')
        .select('*')
        .eq('client_id', effectiveClientId)
        .eq('period_quarter', quarter)
        .maybeSingle();

      if (error) throw error;
      return data as SSDeclaration | null;
    },
    enabled: !!effectiveClientId,
  });

  // Fetch all declarations history
  const { data: declarationsHistory = [] } = useQuery({
    queryKey: ['ss-declarations-history', effectiveClientId],
    queryFn: async () => {
      if (!effectiveClientId) return [];

      const { data, error } = await supabase
        .from('ss_declarations')
        .select('*')
        .eq('client_id', effectiveClientId)
        .order('period_quarter', { ascending: false });

      if (error) throw error;
      return data as SSDeclaration[];
    },
    enabled: !!effectiveClientId,
  });

  // Calculate totals with proper coefficients (including sales invoices)
  const totals = useMemo(() => {
    // Calculate totals from manual revenue entries
    const byCategory = REVENUE_CATEGORIES.reduce((acc, cat) => {
      acc[cat.value] = revenueEntries
        .filter(e => e.category === cat.value)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      return acc;
    }, {} as Record<string, number>);

    // Add validated sales invoices to "vendas" category
    const salesTotal = salesInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    byCategory['vendas'] = (byCategory['vendas'] || 0) + salesTotal;

    const total = Object.values(byCategory).reduce((sum, val) => sum + val, 0);
    
    // Calculate relevant income including sales invoices
    const manualRelevantIncome = calculateRelevantIncome(revenueEntries);
    const salesRelevantIncome = salesTotal * REVENUE_COEFFICIENTS['vendas']; // 20%
    const relevantIncome = manualRelevantIncome + salesRelevantIncome;
    
    return { 
      byCategory, 
      total, 
      relevantIncome,
      salesInvoicesTotal: salesTotal,
      salesInvoicesCount: salesInvoices.length,
    };
  }, [revenueEntries, salesInvoices]);

  // Calculate contribution base and amount based on profile settings
  const calculatedContribution = useMemo(() => {
    if (!profile) {
      return { base: 0, amount: 0, isExempt: false, exemptReason: '' };
    }

    const accountingRegime = (profile as any).accounting_regime || 'simplified';
    const hasOtherEmployment = (profile as any).has_other_employment || false;
    const otherEmploymentSalary = Number((profile as any).other_employment_salary) || 0;
    const taxableProfit = Number((profile as any).taxable_profit) || 0;
    const contributionRate = Number(profile.ss_contribution_rate) || 21.4;
    const isFirstYear = profile.is_first_year || false;

    // Check first year exemption
    if (isFirstYear) {
      return { base: 0, amount: 0, isExempt: true, exemptReason: 'Isento - 1º ano de actividade' };
    }

    let contributionBase = 0;

    if (accountingRegime === 'organized') {
      // Organized accounting: base = taxable profit / 12 (minimum 1.5 IAS)
      const monthlyBase = taxableProfit / 12;
      contributionBase = Math.max(monthlyBase, SS_LIMITS.MIN_BASE_ORGANIZED);
      contributionBase = Math.min(contributionBase, SS_LIMITS.MAX_BASE);
    } else {
      // Simplified regime: base = 1/3 of relevant quarterly income
      const monthlyRelevantIncome = totals.relevantIncome / 3;
      
      // Check TCO exemption
      if (checkTCOExemption(hasOtherEmployment, otherEmploymentSalary, monthlyRelevantIncome)) {
        return { 
          base: 0, 
          amount: 0, 
          isExempt: true, 
          exemptReason: 'Isento - Acumulação TCO (rendimento < 4×IAS)' 
        };
      }
      
      contributionBase = Math.min(monthlyRelevantIncome, SS_LIMITS.MAX_BASE);
    }

    // Calculate contribution amount
    let contributionAmount = contributionBase * (contributionRate / 100);

    // Apply minimum contribution rule (20€ if positive but less than 20€)
    if (contributionAmount > 0 && contributionAmount < SS_LIMITS.MIN_CONTRIBUTION) {
      contributionAmount = SS_LIMITS.MIN_CONTRIBUTION;
    }

    return { base: contributionBase, amount: contributionAmount, isExempt: false, exemptReason: '' };
  }, [profile, totals.relevantIncome]);

  // Add revenue entry
  const addRevenueMutation = useMutation({
    mutationFn: async (data: { category: string; amount: number; notes?: string; source?: string }) => {
      if (!effectiveClientId) throw new Error('No client selected');

      const { error } = await supabase
        .from('revenue_entries')
        .insert({
          client_id: effectiveClientId,
          period_quarter: quarter,
          category: data.category,
          amount: data.amount,
          notes: data.notes || null,
          source: data.source || 'manual',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-entries', effectiveClientId, quarter] });
      toast.success('Receita adicionada');
    },
    onError: (error) => {
      console.error('Add revenue error:', error);
      toast.error('Erro ao adicionar receita');
    },
  });

  // Bulk import revenue entries
  const bulkImportMutation = useMutation({
    mutationFn: async (entries: { quarter: string; amount: number; category: string }[]) => {
      if (!effectiveClientId) throw new Error('No client selected');

      const insertData = entries.map(entry => ({
        client_id: effectiveClientId,
        period_quarter: entry.quarter,
        category: entry.category,
        amount: entry.amount,
        source: 'import',
        notes: 'Importado do Portal das Finanças',
      }));

      const { error } = await supabase
        .from('revenue_entries')
        .insert(insertData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-entries', effectiveClientId] });
      toast.success('Importação concluída');
    },
    onError: (error) => {
      console.error('Bulk import error:', error);
      toast.error('Erro na importação');
    },
  });

  // Update revenue entry
  const updateRevenueMutation = useMutation({
    mutationFn: async (data: { id: string; amount: number; notes?: string }) => {
      const { error } = await supabase
        .from('revenue_entries')
        .update({ amount: data.amount, notes: data.notes || null })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-entries', effectiveClientId, quarter] });
      toast.success('Receita actualizada');
    },
    onError: (error) => {
      console.error('Update revenue error:', error);
      toast.error('Erro ao actualizar receita');
    },
  });

  // Delete revenue entry
  const deleteRevenueMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('revenue_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-entries', effectiveClientId, quarter] });
      toast.success('Receita removida');
    },
    onError: (error) => {
      console.error('Delete revenue error:', error);
      toast.error('Erro ao remover receita');
    },
  });

  // Create sales invoices from SAF-T import (with duplicate check)
  const createSalesInvoicesMutation = useMutation({
    mutationFn: async (invoices: Array<{
      date: Date;
      documentNumber: string;
      customerNif: string;
      baseValue: number;
      vatValue: number;
      totalValue: number;
      documentType: string;
      quarter: string;
      selectedCategory?: string;
    }>) => {
      if (!effectiveClientId || !profile?.nif) throw new Error('No client selected');

      // First, fetch existing sales invoices to check for duplicates
      const { data: existingSales, error: fetchError } = await supabase
        .from('sales_invoices')
        .select('document_number, document_date, supplier_nif')
        .eq('client_id', effectiveClientId);

      if (fetchError) {
        console.error('Error fetching existing sales:', fetchError);
        throw fetchError;
      }

      // Create set of existing keys (NIF|document_number|date)
      const existingKeys = new Set<string>();
      existingSales?.forEach((inv) => {
        if (inv.document_number) {
          const key = `${inv.supplier_nif}|${inv.document_number}|${inv.document_date}`;
          existingKeys.add(key);
        }
      });

      // Filter out duplicates
      const uniqueInvoices = invoices.filter(invoice => {
        const dateStr = invoice.date.toISOString().split('T')[0];
        const key = `${profile.nif}|${invoice.documentNumber}|${dateStr}`;
        return !existingKeys.has(key);
      });

      const duplicatesCount = invoices.length - uniqueInvoices.length;

      if (uniqueInvoices.length === 0) {
        return { inserted: 0, duplicates: duplicatesCount };
      }

      const insertData = uniqueInvoices.map(invoice => ({
        client_id: effectiveClientId,
        supplier_nif: profile.nif, // User is the supplier (issuer) of sales invoices
        document_date: invoice.date.toISOString().split('T')[0],
        document_number: invoice.documentNumber,
        customer_nif: invoice.customerNif || null,
        total_amount: invoice.totalValue,
        total_vat: invoice.vatValue,
        base_standard: invoice.baseValue,
        document_type: invoice.documentType || 'FT',
        fiscal_period: invoice.quarter,
        status: 'validated', // Auto-validate imported invoices
        validated_at: new Date().toISOString(),
        image_path: `imported/saft_${Date.now()}.json`, // Placeholder path
        notes: 'Importado do SAF-T',
      }));

      const { error } = await supabase
        .from('sales_invoices')
        .insert(insertData);

      if (error) throw error;
      
      return { inserted: insertData.length, duplicates: duplicatesCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-ss', effectiveClientId] });
      if (result.duplicates > 0) {
        toast.success(`${result.inserted} facturas criadas (${result.duplicates} duplicadas ignoradas)`);
      } else {
        toast.success(`${result.inserted} facturas de venda criadas`);
      }
    },
    onError: (error) => {
      console.error('Create sales invoices error:', error);
      toast.error('Erro ao criar facturas de venda');
    },
  });

  // Save/Update declaration
  const saveDeclarationMutation = useMutation({
    mutationFn: async (data: { 
      contributionRate: number; 
      status?: string;
      notes?: string;
    }) => {
      if (!effectiveClientId) throw new Error('No client selected');

      const declarationData = {
        client_id: effectiveClientId,
        period_quarter: quarter,
        total_revenue: totals.total,
        contribution_base: calculatedContribution.base,
        contribution_amount: calculatedContribution.amount,
        contribution_rate: data.contributionRate,
        status: data.status || 'draft',
        notes: data.notes || null,
        submitted_at: data.status === 'submitted' ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('ss_declarations')
        .upsert(declarationData, { onConflict: 'client_id,period_quarter' });

      if (error) throw error;

      // Update profile last declaration (only for user's own profile)
      if (data.status === 'submitted' && effectiveClientId === user?.id) {
        await supabase
          .from('profiles')
          .update({ last_ss_declaration: quarter })
          .eq('id', user.id);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ss-declaration', effectiveClientId, quarter] });
      queryClient.invalidateQueries({ queryKey: ['ss-declarations-history', effectiveClientId] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      
      if (variables.status === 'submitted') {
        toast.success('Declaração marcada como submetida!');
      } else {
        toast.success('Declaração guardada');
      }
    },
    onError: (error) => {
      console.error('Save declaration error:', error);
      toast.error('Erro ao guardar declaração');
    },
  });

  // Available quarters (last 8 quarters)
  const availableQuarters = useMemo(() => {
    const quarters: string[] = [];
    const now = new Date();
    let year = now.getFullYear();
    let q = Math.ceil((now.getMonth() + 1) / 3);

    for (let i = 0; i < 8; i++) {
      quarters.push(`${year}-Q${q}`);
      q--;
      if (q === 0) {
        q = 4;
        year--;
      }
    }
    return quarters;
  }, []);

  return {
    quarter,
    setQuarter,
    revenueEntries,
    salesInvoices,
    declaration,
    declarationsHistory,
    totals,
    calculatedContribution,
    availableQuarters,
    isLoading: isLoadingRevenue || isLoadingDeclaration || isLoadingSales,
    addRevenue: addRevenueMutation.mutate,
    isAddingRevenue: addRevenueMutation.isPending,
    updateRevenue: updateRevenueMutation.mutate,
    isUpdatingRevenue: updateRevenueMutation.isPending,
    deleteRevenue: deleteRevenueMutation.mutate,
    isDeletingRevenue: deleteRevenueMutation.isPending,
    saveDeclaration: saveDeclarationMutation.mutate,
    isSavingDeclaration: saveDeclarationMutation.isPending,
    bulkImport: bulkImportMutation.mutateAsync,
    isBulkImporting: bulkImportMutation.isPending,
    createSalesInvoices: createSalesInvoicesMutation.mutateAsync,
    isCreatingSalesInvoices: createSalesInvoicesMutation.isPending,
    isDeadlineMonth: isDeadlineMonth(),
    getQuarterLabel,
    // Export constants for use in components
    IAS_2025,
    SS_LIMITS,
    REVENUE_COEFFICIENTS,
  };
}
