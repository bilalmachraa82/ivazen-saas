import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Tables, Database } from '@/integrations/supabase/types';
import { detectMimeType } from '@/lib/mime';
import { deriveFiscalPeriodFromDocumentDate, normalizeDocumentDate } from '@/lib/fiscalPeriod';
import { isTemporarySupplierTaxId, normalizeSupplierTaxId, normalizeSupplierVatId } from '@/lib/taxId';

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

interface ExtractInvoiceResponseData {
  supplier_nif?: string | null;
  supplier_vat_id?: string | null;
  supplier_name?: string | null;
  customer_nif?: string | null;
  document_date?: string | null;
  document_number?: string | null;
  document_type?: string | null;
  atcud?: string | null;
  base_reduced?: number | string | null;
  vat_reduced?: number | string | null;
  base_intermediate?: number | string | null;
  vat_intermediate?: number | string | null;
  base_standard?: number | string | null;
  vat_standard?: number | string | null;
  base_exempt?: number | string | null;
  total_vat?: number | string | null;
  total_amount?: number | string | null;
  fiscal_region?: string | null;
  confidence?: number | string | null;
}

interface ExtractInvoiceResponse {
  success?: boolean;
  error?: string;
  data?: ExtractInvoiceResponseData;
  warnings?: string[];
}

export interface ReExtractInvoiceResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  changes?: Array<{ field: string; old_value: unknown; new_value: unknown }>;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function areEqual(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  return a === b;
}

function blobToDataUrl(blob: Blob, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.replace(/^data:[^;]+;base64,/, '');
      if (!base64) {
        reject(new Error('Ficheiro vazio após leitura'));
        return;
      }
      resolve(`data:${mimeType};base64,${base64}`);
    };
    reader.onerror = () => reject(reader.error || new Error('Erro ao ler ficheiro'));
    reader.readAsDataURL(blob);
  });
}

export function useInvoices(externalClientId?: string | null) {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<InvoiceFilters>({
    status: 'all',
    fiscalPeriod: 'all',
    search: '',
    clientId: 'all',
  });

  // When externalClientId is provided, it takes precedence over filters.clientId
  const effectiveClientId = externalClientId !== undefined ? externalClientId : filters.clientId;

  const fetchInvoices = async () => {
    if (!user) return;

    // If externalClientId is explicitly null, don't fetch (accountant without client selected)
    if (externalClientId === null) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    
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

      // Filter by effective client
      if (effectiveClientId && effectiveClientId !== 'all') {
        query = query.eq('client_id', effectiveClientId);
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

      // Update AI metrics via RPC (only for PT NIFs: 9 digits)
      const supplierNifDigits = String(invoiceData?.supplier_nif || '').replace(/\D/g, '');
      if (/^\d{9}$/.test(supplierNifDigits)) {
        const { error: metricsError } = await supabase.rpc('update_ai_metrics', {
          p_supplier_nif: supplierNifDigits,
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

  const reExtractInvoice = async (invoiceId: string): Promise<ReExtractInvoiceResult> => {
    if (!user) {
      return { success: false, error: 'Utilizador não autenticado' };
    }

    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          id,
          image_path,
          supplier_nif,
          supplier_vat_id,
          supplier_name,
          customer_nif,
          document_date,
          document_number,
          document_type,
          atcud,
          base_reduced,
          vat_reduced,
          base_intermediate,
          vat_intermediate,
          base_standard,
          vat_standard,
          base_exempt,
          total_vat,
          total_amount,
          fiscal_region,
          fiscal_period,
          ai_confidence,
          status,
          validated_at,
          validated_by,
          requires_accountant_validation
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        console.error('Error fetching invoice for re-extraction:', invoiceError);
        return { success: false, error: 'Não foi possível carregar a factura' };
      }

      const { data: blob, error: downloadError } = await supabase.storage
        .from('invoices')
        .download(invoice.image_path);

      if (downloadError || !blob) {
        console.error('Error downloading invoice file:', downloadError);
        return { success: false, error: 'Não foi possível descarregar o ficheiro da factura' };
      }

      const mimeType = detectMimeType({ type: blob.type, name: invoice.image_path });
      const fileData = await blobToDataUrl(blob, mimeType);

      const { data: extractionData, error: extractionError } = await supabase.functions.invoke('extract-invoice-data', {
        body: {
          fileData,
          mimeType,
          userId: user.id,
        },
      });

      if (extractionError) {
        console.error('Re-extraction invoke error:', extractionError);
        return { success: false, error: 'Falha ao extrair dados da factura' };
      }

      const extraction = (extractionData || {}) as ExtractInvoiceResponse;
      const extracted = extraction.data;
      if (!extracted) {
        return { success: false, error: extraction.error || 'Não foi possível extrair dados' };
      }

      const normalizedDate = normalizeDocumentDate(extracted.document_date || null);
      if (!normalizedDate) {
        return { success: false, error: 'A extração não devolveu uma data válida' };
      }

      const normalizedTotalAmount = toNullableNumber(extracted.total_amount);
      if (normalizedTotalAmount === null || normalizedTotalAmount <= 0) {
        return { success: false, error: 'A extração não devolveu um total válido' };
      }

      const normalizedSupplierTaxId = normalizeSupplierTaxId({
        taxId: extracted.supplier_nif || extracted.supplier_vat_id,
        supplierName: extracted.supplier_name,
        documentNumber: extracted.document_number,
      });
      const normalizedSupplierVatId = normalizeSupplierVatId(extracted.supplier_vat_id || extracted.supplier_nif);
      const extractedHasReliableTaxId = !isTemporarySupplierTaxId(normalizedSupplierTaxId) || !!normalizedSupplierVatId;

      const updates: Database['public']['Tables']['invoices']['Update'] = {
        supplier_nif: extractedHasReliableTaxId ? (normalizedSupplierTaxId ?? invoice.supplier_nif) : invoice.supplier_nif,
        supplier_vat_id: extractedHasReliableTaxId ? normalizedSupplierVatId : invoice.supplier_vat_id,
        supplier_name: normalizeOptionalString(extracted.supplier_name) ?? invoice.supplier_name,
        customer_nif: normalizeOptionalString(extracted.customer_nif) ?? invoice.customer_nif,
        document_date: normalizedDate,
        document_number: normalizeOptionalString(extracted.document_number) ?? invoice.document_number,
        document_type: normalizeOptionalString(extracted.document_type) ?? invoice.document_type,
        atcud: normalizeOptionalString(extracted.atcud) ?? invoice.atcud,
        base_reduced: toNullableNumber(extracted.base_reduced) ?? invoice.base_reduced,
        vat_reduced: toNullableNumber(extracted.vat_reduced) ?? invoice.vat_reduced,
        base_intermediate: toNullableNumber(extracted.base_intermediate) ?? invoice.base_intermediate,
        vat_intermediate: toNullableNumber(extracted.vat_intermediate) ?? invoice.vat_intermediate,
        base_standard: toNullableNumber(extracted.base_standard) ?? invoice.base_standard,
        vat_standard: toNullableNumber(extracted.vat_standard) ?? invoice.vat_standard,
        base_exempt: toNullableNumber(extracted.base_exempt) ?? invoice.base_exempt,
        total_vat: toNullableNumber(extracted.total_vat) ?? invoice.total_vat,
        // total_amount is NOT overwritten during re-extraction (preserve original document value)
        fiscal_region: normalizeOptionalString(extracted.fiscal_region) ?? invoice.fiscal_region ?? 'PT',
        fiscal_period: deriveFiscalPeriodFromDocumentDate(normalizedDate) ?? invoice.fiscal_period,
        ai_confidence: toNullableNumber(extracted.confidence) ?? invoice.ai_confidence,
        status: 'classified',
        validated_at: null,
        validated_by: null,
        requires_accountant_validation: true,
      };

      const changes: Array<{ field: string; old_value: unknown; new_value: unknown }> = [];
      Object.entries(updates).forEach(([field, newValue]) => {
        const oldValue = invoice[field as keyof typeof invoice];
        if (!areEqual(oldValue, newValue)) {
          changes.push({ field, old_value: oldValue ?? null, new_value: newValue ?? null });
        }
      });

      const { error: updateError } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Error updating invoice after re-extraction:', updateError);
        return { success: false, error: 'Não foi possível guardar os novos dados extraídos' };
      }

      await fetchInvoices();
      return {
        success: true,
        warnings: extraction.warnings || [],
        changes,
      };
    } catch (error) {
      console.error('Unexpected re-extraction error:', error);
      return { success: false, error: 'Erro inesperado durante a reextração' };
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
  }, [user, filters.status, filters.fiscalPeriod, effectiveClientId]);

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
    reExtractInvoice,
    getSignedUrl,
    getFiscalPeriods,
    refetch: fetchInvoices,
  };
}
