import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;

interface InvoiceFilters {
  status: string;
  fiscalPeriod: string;
  search: string;
  clientId: string; // For accountants to filter by client
}

interface ClassificationUpdate {
  final_classification: string;
  final_dp_field: number;
  final_deductibility: number;
}

export function useInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<InvoiceFilters>({
    status: 'all',
    fiscalPeriod: 'all',
    search: '',
    clientId: 'all',
  });

  const fetchInvoices = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.fiscalPeriod !== 'all') {
        query = query.eq('fiscal_period', filters.fiscalPeriod);
      }

      if (filters.search) {
        query = query.or(`supplier_name.ilike.%${filters.search}%,supplier_nif.ilike.%${filters.search}%`);
      }

      // Filter by specific client (for accountants)
      if (filters.clientId !== 'all') {
        query = query.eq('client_id', filters.clientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Erro ao carregar facturas');
    } finally {
      setLoading(false);
    }
  };

  const validateInvoice = async (invoiceId: string, classification: ClassificationUpdate) => {
    try {
      // First get the invoice data to save as classification example
      const { data: invoiceData, error: fetchError } = await supabase
        .from('invoices')
        .select('supplier_nif, supplier_name, ai_classification, ai_dp_field, ai_deductibility, ai_confidence, profiles!invoices_client_id_fkey(activity_description)')
        .eq('id', invoiceId)
        .single();

      if (fetchError) {
        console.error('Error fetching invoice for validation:', fetchError);
        throw fetchError;
      }

      // Detect if this is a correction or confirmation
      const wasCorrection = invoiceData && (
        invoiceData.ai_classification !== classification.final_classification ||
        invoiceData.ai_dp_field !== classification.final_dp_field ||
        invoiceData.ai_deductibility !== classification.final_deductibility
      );

      // Generate contextualised reason
      const reason = wasCorrection
        ? `Corrigido: ${invoiceData?.ai_classification || 'N/A'} → ${classification.final_classification}`
        : `Confirmado IA (${invoiceData?.ai_confidence || 0}% confiança)`;

      // Update the invoice
      const { error } = await supabase
        .from('invoices')
        .update({
          ...classification,
          status: 'validated',
          validated_at: new Date().toISOString(),
          validated_by: user?.id,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      // Update AI metrics via RPC - CRITICAL: Always call this
      if (invoiceData?.supplier_nif) {
        const { error: metricsError } = await supabase.rpc('update_ai_metrics', {
          p_supplier_nif: invoiceData.supplier_nif,
          p_supplier_name: invoiceData.supplier_name || null,
          p_was_correction: wasCorrection || false,
        });
        
        if (metricsError) {
          console.error('Error updating AI metrics:', metricsError);
          // Don't throw - metrics are non-blocking
        }
      }

      // Save classification example for Few-Shot Learning - CRITICAL: Always save
      if (invoiceData?.supplier_nif) {
        const profile = invoiceData.profiles as { activity_description?: string } | null;
        const { error: exampleError } = await supabase
          .from('classification_examples')
          .upsert({
            supplier_nif: invoiceData.supplier_nif,
            supplier_name: invoiceData.supplier_name,
            expense_category: invoiceData.ai_classification,
            client_activity: profile?.activity_description,
            final_classification: classification.final_classification,
            final_dp_field: classification.final_dp_field,
            final_deductibility: classification.final_deductibility,
            reason: reason,
          }, {
            onConflict: 'supplier_nif',
          });
          
        if (exampleError) {
          console.error('Error saving classification example:', exampleError);
          // Don't throw - examples are non-blocking but log for debug
        }
      }
      
      toast.success(wasCorrection ? 'Factura corrigida e guardada' : 'Factura confirmada');
      await fetchInvoices();
      return true;
    } catch (error) {
      console.error('Error validating invoice:', error);
      toast.error('Erro ao validar factura');
      return false;
    }
  };

  const getImageUrl = (imagePath: string) => {
    const { data } = supabase.storage.from('invoices').getPublicUrl(imagePath);
    return data.publicUrl;
  };

  const getSignedUrl = async (imagePath: string) => {
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(imagePath, 3600);

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }

    const rawSignedUrl = (data as any)?.signedUrl ?? (data as any)?.signedURL;
    if (!rawSignedUrl) return null;

    // Storage API may return a relative path (e.g. /object/sign/...). Make it absolute.
    if (typeof rawSignedUrl === 'string' && rawSignedUrl.startsWith('http')) {
      return rawSignedUrl;
    }

    const base = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
    if (!base) return rawSignedUrl ?? null;

    return `${base.replace(/\/$/, '')}/storage/v1${String(rawSignedUrl).startsWith('/') ? '' : '/'}${rawSignedUrl}`;
  };

  const getFiscalPeriods = () => {
    const periods = new Set(invoices.map(inv => inv.fiscal_period).filter(Boolean));
    return Array.from(periods).sort().reverse();
  };

  useEffect(() => {
    fetchInvoices();
  }, [user, filters.status, filters.fiscalPeriod, filters.clientId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters.search !== '') {
        fetchInvoices();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters.search]);

  return {
    invoices,
    loading,
    filters,
    setFilters,
    validateInvoice,
    getSignedUrl,
    getFiscalPeriods,
    refetch: fetchInvoices,
  };
}
