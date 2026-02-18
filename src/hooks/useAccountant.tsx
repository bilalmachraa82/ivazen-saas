import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface ClientProfile {
  id: string;
  full_name: string;
  company_name: string | null;
  nif: string | null;
  cae: string | null;
  activity_description: string | null;
  created_at: string | null;
}

interface ClientInvoice {
  id: string;
  client_id: string;
  document_date: string;
  supplier_nif: string;
  supplier_name: string | null;
  total_amount: number;
  total_vat: number | null;
  status: string | null;
  ai_classification: string | null;
  ai_dp_field: number | null;
  ai_deductibility: number | null;
  ai_confidence: number | null;
  final_classification: string | null;
  final_dp_field: number | null;
  final_deductibility: number | null;
  fiscal_period: string | null;
}

interface SSDeclaration {
  id: string;
  client_id: string;
  period_quarter: string;
  total_revenue: number;
  contribution_amount: number;
  status: string | null;
  submitted_at: string | null;
}

interface ClientWithStats extends ClientProfile {
  invoiceCount: number;
  pendingCount: number;
  classifiedCount: number;
  validatedCount: number;
  totalVat: number;
  totalDeductible: number;
  ssStatus?: 'pending' | 'submitted' | 'none';
  ssContribution?: number;
}

interface AccountantMetrics {
  totalClients: number;
  totalInvoices: number;
  pendingValidation: number;
  validatedThisMonth: number;
  totalVatDeductible: number;
  ssDeclarationsPending: number;
  ssTotalContributions: number;
}

export function useAccountant() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  

  // Check if user is an accountant
  const { data: isAccountant, isLoading: isCheckingRole } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'accountant')
        .maybeSingle();

      if (error) {
        console.error('Role check error:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Fetch all clients associated with this accountant
  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ['accountant-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('accountant_id', user.id)
        .order('full_name');

      if (error) throw error;
      return data as ClientProfile[];
    },
    enabled: !!user?.id && isAccountant === true,
  });

  // Fetch all invoices from clients
  const { data: allInvoices, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['accountant-invoices', user?.id],
    queryFn: async () => {
      if (!user?.id || !clients?.length) return [];

      const clientIds = clients.map(c => c.id);
      
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .in('client_id', clientIds)
        .order('document_date', { ascending: false });

      if (error) throw error;
      return data as ClientInvoice[];
    },
    enabled: !!user?.id && !!clients?.length,
  });

  // Fetch all sales invoices from clients (for revenue charts)
  const { data: allSalesInvoices } = useQuery({
    queryKey: ['accountant-sales-invoices', user?.id],
    queryFn: async () => {
      if (!user?.id || !clients?.length) return [];

      const clientIds = clients.map(c => c.id);
      
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('id, client_id, document_date, total_amount, total_vat')
        .in('client_id', clientIds)
        .order('document_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!clients?.length,
  });

  // Fetch SS declarations for all clients
  const { data: ssDeclarations } = useQuery({
    queryKey: ['accountant-ss-declarations', user?.id],
    queryFn: async () => {
      if (!user?.id || !clients?.length) return [];

      const clientIds = clients.map(c => c.id);
      
      const { data, error } = await supabase
        .from('ss_declarations')
        .select('*')
        .in('client_id', clientIds)
        .order('period_quarter', { ascending: false });

      if (error) throw error;
      return data as SSDeclaration[];
    },
    enabled: !!user?.id && !!clients?.length,
  });

  // Get current quarter for SS
  const getCurrentQuarter = () => {
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `${now.getFullYear()}-T${quarter}`;
  };

  // Calculate client stats
  const clientsWithStats = useMemo((): ClientWithStats[] => {
    if (!clients || !allInvoices) return [];

    const currentQuarter = getCurrentQuarter();

    return clients.map(client => {
      const clientInvoices = allInvoices.filter(inv => inv.client_id === client.id);
      const pending = clientInvoices.filter(inv => inv.status === 'pending').length;
      const classified = clientInvoices.filter(inv => inv.status === 'classified').length;
      const validated = clientInvoices.filter(inv => inv.status === 'validated').length;
      
      const totalVat = clientInvoices.reduce((sum, inv) => sum + (inv.total_vat || 0), 0);
      const totalDeductible = clientInvoices
        .filter(inv => inv.status === 'validated')
        .reduce((sum, inv) => {
          const vat = inv.total_vat || 0;
          const deductibility = (inv.final_deductibility || 0) / 100;
          return sum + (vat * deductibility);
        }, 0);

      // Get SS status for current quarter
      const clientSS = ssDeclarations?.filter(ss => ss.client_id === client.id) || [];
      const currentQuarterSS = clientSS.find(ss => ss.period_quarter === currentQuarter);
      
      let ssStatus: 'pending' | 'submitted' | 'none' = 'none';
      let ssContribution = 0;
      
      if (currentQuarterSS) {
        ssStatus = currentQuarterSS.status === 'submitted' ? 'submitted' : 'pending';
        ssContribution = currentQuarterSS.contribution_amount;
      }

      return {
        ...client,
        invoiceCount: clientInvoices.length,
        pendingCount: pending,
        classifiedCount: classified,
        validatedCount: validated,
        totalVat,
        totalDeductible,
        ssStatus,
        ssContribution,
      };
    });
  }, [clients, allInvoices, ssDeclarations]);

  // Calculate overall metrics
  const metrics = useMemo((): AccountantMetrics => {
    const currentQuarter = getCurrentQuarter();
    
    if (!clients || !allInvoices) {
      return {
        totalClients: 0,
        totalInvoices: 0,
        pendingValidation: 0,
        validatedThisMonth: 0,
        totalVatDeductible: 0,
        ssDeclarationsPending: 0,
        ssTotalContributions: 0,
      };
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const validatedThisMonth = allInvoices.filter(
      inv => inv.status === 'validated' && inv.fiscal_period === currentMonth
    ).length;

    const pendingValidation = allInvoices.filter(
      inv => inv.status === 'classified'
    ).length;

    const totalVatDeductible = allInvoices
      .filter(inv => inv.status === 'validated')
      .reduce((sum, inv) => {
        const vat = inv.total_vat || 0;
        const deductibility = (inv.final_deductibility || 0) / 100;
        return sum + (vat * deductibility);
      }, 0);

    // SS metrics
    const ssDeclarationsPending = clients.filter(client => {
      const clientSS = ssDeclarations?.find(
        ss => ss.client_id === client.id && ss.period_quarter === currentQuarter
      );
      return !clientSS || clientSS.status !== 'submitted';
    }).length;

    const ssTotalContributions = ssDeclarations?.reduce(
      (sum, ss) => sum + (ss.contribution_amount || 0), 0
    ) || 0;

    return {
      totalClients: clients.length,
      totalInvoices: allInvoices.length,
      pendingValidation,
      validatedThisMonth,
      totalVatDeductible,
      ssDeclarationsPending,
      ssTotalContributions,
    };
  }, [clients, allInvoices, ssDeclarations]);

  // Get invoices pending validation (classified but not validated)
  const pendingInvoices = useMemo(() => {
    if (!allInvoices) return [];
    return allInvoices.filter(inv => inv.status === 'classified');
  }, [allInvoices]);


  // Helper to save classification example and update AI metrics
  const saveClassificationExample = async (invoice: {
    supplier_nif: string;
    supplier_name?: string | null;
    client_id: string;
    ai_classification?: string | null;
    final_classification: string;
    final_dp_field: number;
    final_deductibility: number;
    wasCorrection?: boolean;
  }) => {
    try {
      // Get client activity
      const client = clients?.find(c => c.id === invoice.client_id);
      
      // Determine if this was a correction
      const wasCorrection = invoice.wasCorrection ?? 
        (invoice.ai_classification !== invoice.final_classification);
      
      // Generate contextualised reason
      const reason = wasCorrection
        ? `Corrigido por contabilista: ${invoice.ai_classification || 'N/A'} → ${invoice.final_classification}`
        : 'Confirmado IA por contabilista';
      
      // Save classification example for Few-Shot Learning
      const { error: exampleError } = await supabase
        .from('classification_examples')
        .upsert({
          supplier_nif: invoice.supplier_nif,
          supplier_name: invoice.supplier_name,
          expense_category: invoice.ai_classification,
          client_activity: client?.activity_description,
          final_classification: invoice.final_classification,
          final_dp_field: invoice.final_dp_field,
          final_deductibility: invoice.final_deductibility,
          reason: reason,
        }, {
          onConflict: 'supplier_nif',
        });
        
      if (exampleError) {
        console.error('Error saving classification example:', exampleError);
      }
      
      // Update AI metrics via RPC (only for PT NIFs: 9 digits)
      const supplierNifDigits = String(invoice.supplier_nif || '').replace(/\D/g, '');
      if (/^\d{9}$/.test(supplierNifDigits)) {
        const { error: metricsError } = await supabase.rpc('update_ai_metrics', {
          p_supplier_nif: supplierNifDigits,
          p_supplier_name: invoice.supplier_name || null,
          p_was_correction: wasCorrection,
        });

        if (metricsError) {
          console.error('Error updating AI metrics:', metricsError);
        }
      }
    } catch (error) {
      console.error('Error in saveClassificationExample:', error);
    }
  };

  // Batch validate invoices - validate each invoice individually to copy AI values
  const batchValidateMutation = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Validate each invoice one by one to properly copy AI values
      for (const invoiceId of invoiceIds) {
        const { data: invoice, error: fetchError } = await supabase
          .from('invoices')
          .select('supplier_nif, supplier_name, client_id, ai_classification, ai_dp_field, ai_deductibility')
          .eq('id', invoiceId)
          .single();

        if (fetchError) throw fetchError;

        const { error } = await supabase
          .from('invoices')
          .update({
            status: 'validated',
            validated_by: user.id,
            validated_at: new Date().toISOString(),
            final_classification: invoice.ai_classification,
            final_dp_field: invoice.ai_dp_field,
            final_deductibility: invoice.ai_deductibility,
          })
          .eq('id', invoiceId);

        if (error) throw error;

        // Save classification example for Few-Shot Learning - ALWAYS save
        await saveClassificationExample({
          supplier_nif: invoice.supplier_nif,
          supplier_name: invoice.supplier_name,
          client_id: invoice.client_id,
          ai_classification: invoice.ai_classification,
          final_classification: invoice.ai_classification || 'Desconhecido',
          final_dp_field: invoice.ai_dp_field || 24,
          final_deductibility: invoice.ai_deductibility || 100,
          wasCorrection: false, // Batch validation = confirming AI
        });
      }

      return invoiceIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['accountant-invoices'] });
      toast.success(`${count} facturas validadas com sucesso!`);
    },
    onError: (error) => {
      console.error('Batch validate error:', error);
      toast.error('Erro ao validar facturas');
    },
  });

  // Validate single invoice accepting AI suggestion
  const validateInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      // First get the invoice to copy AI values
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('supplier_nif, supplier_name, client_id, ai_classification, ai_dp_field, ai_deductibility')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'validated',
          validated_by: user.id,
          validated_at: new Date().toISOString(),
          final_classification: invoice.ai_classification,
          final_dp_field: invoice.ai_dp_field,
          final_deductibility: invoice.ai_deductibility,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      // Save classification example for Few-Shot Learning - ALWAYS save
      await saveClassificationExample({
        supplier_nif: invoice.supplier_nif,
        supplier_name: invoice.supplier_name,
        client_id: invoice.client_id,
        ai_classification: invoice.ai_classification,
        final_classification: invoice.ai_classification || 'Desconhecido',
        final_dp_field: invoice.ai_dp_field || 24,
        final_deductibility: invoice.ai_deductibility || 100,
        wasCorrection: false, // Single validation = confirming AI
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountant-invoices'] });
      toast.success('Factura validada!');
    },
    onError: (error) => {
      console.error('Validate error:', error);
      toast.error('Erro ao validar factura');
    },
  });

  return {
    isAccountant,
    isCheckingRole,
    clients: clientsWithStats,
    isLoadingClients,
    allInvoices,
    allSalesInvoices,
    pendingInvoices,
    isLoadingInvoices,
    metrics,
    batchValidate: batchValidateMutation.mutate,
    isBatchValidating: batchValidateMutation.isPending,
    validateInvoice: validateInvoiceMutation.mutate,
    isValidating: validateInvoiceMutation.isPending,
  };
}
