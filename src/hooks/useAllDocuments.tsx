import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type SalesInvoice = Tables<'sales_invoices'>;
type TaxWithholding = Tables<'tax_withholdings'>;

export type DocumentType = 'purchase' | 'sale' | 'withholding';

export interface UnifiedDocument {
  id: string;
  type: DocumentType;
  date: string;
  entityName: string | null;
  entityNif: string | null;
  amount: number;
  status: string;
  classification: string | null;
  confidence: number | null;
  fiscalPeriod: string | null;
  documentNumber: string | null;
  createdAt: string;
  originalData: Invoice | SalesInvoice | TaxWithholding;
}

export interface DocumentFilters {
  type: 'all' | DocumentType;
  status: string;
  fiscalPeriod: string;
  search: string;
  clientId: string;
  dateFrom: string;
  dateTo: string;
}

export function useAllDocuments() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [withholdings, setWithholdings] = useState<TaxWithholding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DocumentFilters>({
    type: 'all',
    status: 'all',
    fiscalPeriod: 'all',
    search: '',
    clientId: 'all',
    dateFrom: '',
    dateTo: '',
  });

  const fetchAllDocuments = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch all three document types in parallel
      const [invoicesResult, salesResult, withholdingsResult] = await Promise.all([
        supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('sales_invoices')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('tax_withholdings')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (invoicesResult.error) {
        console.error('Error fetching invoices:', invoicesResult.error);
      }
      if (salesResult.error) {
        console.error('Error fetching sales invoices:', salesResult.error);
      }
      if (withholdingsResult.error) {
        console.error('Error fetching withholdings:', withholdingsResult.error);
      }

      setInvoices(invoicesResult.data || []);
      setSalesInvoices(salesResult.data || []);
      setWithholdings(withholdingsResult.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  // Convert invoices to unified format
  const unifiedInvoices: UnifiedDocument[] = useMemo(() => {
    return invoices.map((inv) => ({
      id: inv.id,
      type: 'purchase' as DocumentType,
      date: inv.document_date,
      entityName: inv.supplier_name,
      entityNif: inv.supplier_nif,
      amount: Number(inv.total_amount) || 0,
      status: inv.status || 'pending',
      classification: inv.final_classification || inv.ai_classification || null,
      confidence: inv.ai_confidence,
      fiscalPeriod: inv.fiscal_period,
      documentNumber: inv.document_number,
      createdAt: inv.created_at || '',
      originalData: inv,
    }));
  }, [invoices]);

  // Convert sales invoices to unified format
  const unifiedSalesInvoices: UnifiedDocument[] = useMemo(() => {
    return salesInvoices.map((inv) => ({
      id: inv.id,
      type: 'sale' as DocumentType,
      date: inv.document_date,
      entityName: inv.customer_name,
      entityNif: inv.customer_nif,
      amount: Number(inv.total_amount) || 0,
      status: inv.status || 'pending',
      classification: inv.revenue_category || null,
      confidence: inv.ai_category_confidence,
      fiscalPeriod: inv.fiscal_period,
      documentNumber: inv.document_number,
      createdAt: inv.created_at || '',
      originalData: inv,
    }));
  }, [salesInvoices]);

  // Convert withholdings to unified format
  const unifiedWithholdings: UnifiedDocument[] = useMemo(() => {
    return withholdings.map((wh) => ({
      id: wh.id,
      type: 'withholding' as DocumentType,
      date: wh.payment_date || wh.created_at || '',
      entityName: wh.beneficiary_name,
      entityNif: wh.beneficiary_nif,
      amount: Number(wh.gross_amount) || 0,
      status: wh.status || 'draft',
      classification: wh.income_category || null,
      confidence: null,
      fiscalPeriod: wh.fiscal_year ? `${wh.fiscal_year}` : null,
      documentNumber: wh.document_reference,
      createdAt: wh.created_at || '',
      originalData: wh,
    }));
  }, [withholdings]);

  // Combine and filter all documents
  const documents: UnifiedDocument[] = useMemo(() => {
    let combined: UnifiedDocument[] = [];

    // Filter by document type
    if (filters.type === 'all' || filters.type === 'purchase') {
      combined = [...combined, ...unifiedInvoices];
    }
    if (filters.type === 'all' || filters.type === 'sale') {
      combined = [...combined, ...unifiedSalesInvoices];
    }
    if (filters.type === 'all' || filters.type === 'withholding') {
      combined = [...combined, ...unifiedWithholdings];
    }

    // Filter by status
    if (filters.status !== 'all') {
      combined = combined.filter((doc) => doc.status === filters.status);
    }

    // Filter by fiscal period
    if (filters.fiscalPeriod !== 'all') {
      combined = combined.filter((doc) => doc.fiscalPeriod === filters.fiscalPeriod);
    }

    // Filter by client ID (for accountants)
    if (filters.clientId !== 'all') {
      combined = combined.filter((doc) => {
        const original = doc.originalData;
        if ('client_id' in original) {
          return original.client_id === filters.clientId;
        }
        return true;
      });
    }

    // Filter by date range
    if (filters.dateFrom) {
      combined = combined.filter((doc) => doc.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      combined = combined.filter((doc) => doc.date <= filters.dateTo);
    }

    // Filter by search (entity name or NIF)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      combined = combined.filter((doc) => {
        const nameMatch = doc.entityName?.toLowerCase().includes(searchLower);
        const nifMatch = doc.entityNif?.toLowerCase().includes(searchLower);
        const docNumMatch = doc.documentNumber?.toLowerCase().includes(searchLower);
        return nameMatch || nifMatch || docNumMatch;
      });
    }

    // Sort by date (most recent first)
    combined.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt).getTime();
      const dateB = new Date(b.date || b.createdAt).getTime();
      return dateB - dateA;
    });

    return combined;
  }, [
    unifiedInvoices,
    unifiedSalesInvoices,
    unifiedWithholdings,
    filters,
  ]);

  // Get unique fiscal periods from all documents
  const fiscalPeriods = useMemo(() => {
    const periods = new Set<string>();
    [...invoices, ...salesInvoices].forEach((doc) => {
      if (doc.fiscal_period) {
        periods.add(doc.fiscal_period);
      }
    });
    withholdings.forEach((wh) => {
      if (wh.fiscal_year) {
        periods.add(`${wh.fiscal_year}`);
      }
    });
    return Array.from(periods).sort().reverse();
  }, [invoices, salesInvoices, withholdings]);

  // Get all unique statuses
  const allStatuses = useMemo(() => {
    const statuses = new Set<string>();
    documents.forEach((doc) => {
      if (doc.status) {
        statuses.add(doc.status);
      }
    });
    return Array.from(statuses).sort();
  }, [documents]);

  // Statistics
  const stats = useMemo(() => {
    const totalPurchases = unifiedInvoices.length;
    const totalSales = unifiedSalesInvoices.length;
    const totalWithholdings = unifiedWithholdings.length;
    const totalDocuments = totalPurchases + totalSales + totalWithholdings;

    const pendingPurchases = unifiedInvoices.filter((d) => d.status === 'pending').length;
    const pendingSales = unifiedSalesInvoices.filter((d) => d.status === 'pending').length;
    const draftWithholdings = unifiedWithholdings.filter((d) => d.status === 'draft').length;

    const validatedPurchases = unifiedInvoices.filter((d) => d.status === 'validated').length;
    const validatedSales = unifiedSalesInvoices.filter((d) => d.status === 'validated').length;
    const submittedWithholdings = unifiedWithholdings.filter((d) => d.status === 'submitted').length;

    return {
      totalDocuments,
      totalPurchases,
      totalSales,
      totalWithholdings,
      pendingReview: pendingPurchases + pendingSales + draftWithholdings,
      validated: validatedPurchases + validatedSales + submittedWithholdings,
    };
  }, [unifiedInvoices, unifiedSalesInvoices, unifiedWithholdings]);

  // Get signed URL for document image
  const getSignedUrl = async (imagePath: string): Promise<string | null> => {
    try {
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

  useEffect(() => {
    fetchAllDocuments();
  }, [user]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      // The filtering happens in useMemo, no need to refetch
    }, 300);
    return () => clearTimeout(timeout);
  }, [filters.search]);

  return {
    documents,
    loading,
    filters,
    setFilters,
    fiscalPeriods,
    allStatuses,
    stats,
    getSignedUrl,
    refetch: fetchAllDocuments,
  };
}
