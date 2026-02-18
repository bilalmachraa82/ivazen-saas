import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type SalesInvoice = Tables<'sales_invoices'>;

export interface SalesInvoiceFilters {
  status: string;
  fiscalPeriod: string;
  search: string;
  clientId: string; // For accountants to filter by client
}

export function useSalesInvoices(externalClientId?: string | null) {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SalesInvoiceFilters>({
    status: 'all',
    fiscalPeriod: 'all',
    search: '',
    clientId: 'all',
  });

  const effectiveClientId = externalClientId !== undefined ? externalClientId : filters.clientId;

  const fetchInvoices = useCallback(async () => {
    if (!user) return;

    // If externalClientId is explicitly null, don't fetch
    if (externalClientId === null) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('sales_invoices')
        .select('*')
        .order('document_date', { ascending: false });

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.fiscalPeriod !== 'all') {
        query = query.eq('fiscal_period', filters.fiscalPeriod);
      }

      if (filters.search) {
        query = query.or(
          `customer_name.ilike.%${filters.search}%,customer_nif.ilike.%${filters.search}%`
        );
      }

      // Filter by effective client
      if (effectiveClientId && effectiveClientId !== 'all') {
        query = query.eq('client_id', effectiveClientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching sales invoices:', error);
      toast.error('Erro ao carregar facturas de vendas');
    } finally {
      setLoading(false);
    }
  }, [user, filters.status, filters.fiscalPeriod, filters.search, effectiveClientId, externalClientId]);

  const validateInvoice = async (invoiceId: string, category?: string, notes?: string) => {
    try {
      const updateData: Record<string, unknown> = {
        status: 'validated',
        validated_at: new Date().toISOString(),
        notes: notes || null,
      };
      
      // Save category if provided
      if (category) {
        updateData.revenue_category = category;
      }

      const { error } = await supabase
        .from('sales_invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success('Factura validada com sucesso');
      await fetchInvoices();
      return true;
    } catch (error) {
      console.error('Error validating sales invoice:', error);
      toast.error('Erro ao validar factura');
      return false;
    }
  };

  const getSignedUrl = async (imagePath: string): Promise<string | null> => {
    try {
      // Handle case where path might include bucket name
      const cleanPath = imagePath.replace(/^invoices\//, '');
      
      const { data, error } = await supabase.storage
        .from('invoices')
        .createSignedUrl(cleanPath, 3600);

      if (error) throw error;
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  };

  const getFiscalPeriods = (): string[] => {
    const periods = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.fiscal_period) {
        periods.add(inv.fiscal_period);
      }
    });
    return Array.from(periods).sort().reverse();
  };

  // Fetch when user or main filters change
  useEffect(() => {
    fetchInvoices();
  }, [user, filters.status, filters.fiscalPeriod, effectiveClientId]);

  // Debounced fetch for search
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchInvoices();
    }, 300);
    return () => clearTimeout(timeout);
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
