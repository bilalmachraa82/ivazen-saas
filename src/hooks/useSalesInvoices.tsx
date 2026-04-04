import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { getRecentImportCutoff, type RecentImportWindow } from '@/lib/recentImports';
import { expandQuarterToPeriods } from '@/lib/formatFiscalPeriod';
import { escapeInvoiceSearchTerm } from '@/lib/invoiceSearch';


type SalesInvoice = Tables<'sales_invoices'>;

export interface SalesInvoiceFilters {
  status: string;
  fiscalPeriod: string;
  year: string;
  search: string;
  clientId: string; // For accountants to filter by client
  recentWindow?: RecentImportWindow;
}

const PAGE_SIZE = 50;

/**
 * Enriches sales invoices that have a customer_nif but no customer_name by
 * looking up the name from the profiles table (clients known to the system).
 */
async function enrichCustomerNames(invoices: SalesInvoice[]): Promise<SalesInvoice[]> {
  const missingNameNifs = [
    ...new Set(
      invoices
        .filter(inv => !inv.customer_name && inv.customer_nif)
        .map(inv => inv.customer_nif as string),
    ),
  ];

  if (missingNameNifs.length === 0) return invoices;

  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('nif, full_name, company_name')
      .in('nif', missingNameNifs);

    if (!profiles || profiles.length === 0) return invoices;

    const nifToName: Record<string, string> = {};
    for (const p of profiles) {
      if (p.nif) nifToName[p.nif] = p.company_name || p.full_name || '';
    }

    return invoices.map(inv =>
      !inv.customer_name && inv.customer_nif && nifToName[inv.customer_nif]
        ? { ...inv, customer_name: nifToName[inv.customer_nif] }
        : inv,
    );
  } catch {
    // Non-blocking — return original list if lookup fails
    return invoices;
  }
}

export function useSalesInvoices(externalClientId?: string | null) {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [allFiscalPeriods, setAllFiscalPeriods] = useState<string[]>([]);
  const [filters, setFilters] = useState<SalesInvoiceFilters>({
    status: 'all',
    fiscalPeriod: 'all',
    year: 'all',
    search: '',
    clientId: 'all',
    recentWindow: 'all',
  });

  const effectiveClientId = externalClientId !== undefined ? externalClientId : filters.clientId;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchInvoices = useCallback(async () => {
    if (!user) return;

    // If externalClientId is explicitly null, don't fetch
    if (externalClientId === null) {
      setInvoices([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('sales_invoices')
        .select('*', { count: 'exact' })
        .order('document_date', { ascending: false });

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.fiscalPeriod !== 'all') {
        const periodValues = expandQuarterToPeriods(filters.fiscalPeriod);
        query = periodValues.length === 1
          ? query.eq('fiscal_period', periodValues[0])
          : query.in('fiscal_period', periodValues);
      }

      if (filters.year && filters.year !== 'all') {
        query = query
          .gte('document_date', `${filters.year}-01-01`)
          .lte('document_date', `${filters.year}-12-31`);
      }

      // Server-side search: ilike on customer_name, customer_nif
      // Only apply when search has 2+ chars to avoid overly broad queries
      const rawSearch = (filters.search || '').trim();
      if (rawSearch.length >= 2) {
        const escaped = escapeInvoiceSearchTerm(rawSearch);
        query = query.or(
          `customer_name.ilike.%${escaped}%,customer_nif.ilike.%${escaped}%`,
        );
      }

      const recentCutoff = getRecentImportCutoff(filters.recentWindow || 'all');
      if (recentCutoff) {
        query = query.gte('created_at', recentCutoff);
      }

      if (effectiveClientId && effectiveClientId !== 'all') {
        query = query.eq('client_id', effectiveClientId);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      const rows = (data ?? []) as SalesInvoice[];

      // Enrich customer_name for records that only have a NIF (AT sync doesn't always populate the name)
      const enriched = await enrichCustomerNames(rows);

      // Client-side search fallback for 1-char searches (too broad for server-side ilike)
      const normalize = (s: string) =>
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const normalizedSearch = normalize(rawSearch);
      const filtered = normalizedSearch.length === 1
        ? enriched.filter(inv =>
            normalize(inv.customer_name || '').includes(normalizedSearch) ||
            (inv.customer_nif || '').toLowerCase().includes(normalizedSearch)
          )
        : enriched;

      setInvoices(filtered);
      setTotalCount(count ?? 0);
    } catch (error) {
      console.error('Error fetching sales invoices:', error);
      toast.error('Erro ao carregar facturas de vendas');
    } finally {
      setLoading(false);
    }
  }, [user, page, filters.status, filters.fiscalPeriod, filters.year, filters.search, filters.recentWindow, effectiveClientId, externalClientId]);

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

  // Fetch distinct fiscal periods via RPC (efficient: returns ~20 rows instead of all)
  const fetchFiscalPeriods = useCallback(async () => {
    if (!user) return;
    if (externalClientId === null) {
      setAllFiscalPeriods([]);
      return;
    }
    try {
      const clientId = (effectiveClientId && effectiveClientId !== 'all') ? effectiveClientId : null;
      const { data, error } = await supabase.rpc('get_distinct_fiscal_periods', {
        p_client_id: clientId,
        p_table_name: 'sales_invoices',
      });
      if (error) {
        console.error('Error fetching sales fiscal periods:', error);
        return;
      }
      setAllFiscalPeriods(((data as string[]) || []).filter(Boolean));
    } catch (err) {
      console.error('Error fetching sales fiscal periods:', err);
    }
  }, [user, externalClientId, effectiveClientId]);

  useEffect(() => {
    void fetchFiscalPeriods();
  }, [fetchFiscalPeriods]);

  const getFiscalPeriods = (): string[] => allFiscalPeriods;

  // Reset page to 0 when filters change (not when page itself changes)
  // useCallback prevents a new reference on every render — critical because SalesValidation.tsx
  // has a useEffect with setFilters as a dep; without this, the effect re-ran on every render
  // and overwrote the dropdown selection with the stale URL value.
  const setFiltersAndResetPage = useCallback(
    (value: SalesInvoiceFilters | ((prev: SalesInvoiceFilters) => SalesInvoiceFilters)) => {
      setPage(0);
      setFilters(value);
    },
    [setPage, setFilters],
  );

  // Single fetch effect — use memoized callback as dep to capture all changes
  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  // Reset page when any filter changes
  useEffect(() => {
    setPage(0);
  }, [filters.status, filters.fiscalPeriod, filters.year, filters.search, filters.recentWindow, effectiveClientId]);

  return {
    invoices,
    loading,
    filters,
    setFilters: setFiltersAndResetPage,
    validateInvoice,
    getSignedUrl,
    getFiscalPeriods,
    refetch: fetchInvoices,
    // Pagination
    page,
    setPage,
    totalCount,
    totalPages,
    pageSize: PAGE_SIZE,
  };
}
