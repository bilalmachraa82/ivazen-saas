import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  buildDPExportData,
  downloadDPExcel,
  getQuarterPeriod,
  getQuarterMonths,
  type InvoiceRecord,
  type SalesInvoiceRecord,
} from '@/lib/dpExcelGenerator';

interface DPFieldSummary {
  field: number;
  label: string;
  baseTotal: number;
  vatTotal: number;
  vatDeductible: number;
  invoiceCount: number;
}

const DP_FIELD_LABELS: Record<number, string> = {
  10: 'Aquis. Intracomunitárias',
  20: 'Imobilizado',
  21: 'Existências 6%',
  22: 'Existências 23%',
  23: 'Existências 13%',
  24: 'Outros bens e serviços',
};

export function useExport(clientId?: string) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('quarterly');
  const [recuperarAnterior, setRecuperarAnterior] = useState(0);
  const [regFavorEstado, setRegFavorEstado] = useState(0);
  const [regSujeitoPassivo, setRegSujeitoPassivo] = useState(0);

  // Convert period to array of fiscal_period strings (both DB formats)
  const fiscalPeriods = useMemo((): string[] => {
    if (!selectedPeriod) return [];
    const quarterMatch = selectedPeriod.match(/^(\d{4})-Q(\d)$/);
    if (quarterMatch) {
      const year = quarterMatch[1];
      const q = parseInt(quarterMatch[2]);
      const startMonth = (q - 1) * 3 + 1;
      // Support both legacy quarter storage (YYYY-Qn) and monthly storage (YYYYMM / YYYY-MM).
      // Some ingestion paths (e.g. AT sync) store `fiscal_period` as quarter.
      const months: string[] = [selectedPeriod];
      for (let i = 0; i < 3; i++) {
        const m = String(startMonth + i).padStart(2, '0');
        months.push(`${year}-${m}`, `${year}${m}`);
      }
      return months;
    }
    const monthMatch = selectedPeriod.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) return [selectedPeriod, `${monthMatch[1]}${monthMatch[2]}`];
    return [selectedPeriod];
  }, [selectedPeriod]);

  // Fetch validated/classified purchase invoices — deduplicate by keeping validated over classified
  const { data: rawInvoices, isLoading } = useQuery({
    queryKey: ['export-invoices', fiscalPeriods, clientId],
    queryFn: async () => {
      if (fiscalPeriods.length === 0 || !clientId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', clientId)
        .in('status', ['validated', 'classified'])
        .in('fiscal_period', fiscalPeriods)
        .order('document_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: fiscalPeriods.length > 0 && !!clientId,
  });

  // Fetch sales invoices for the same period
  const { data: salesInvoices } = useQuery({
    queryKey: ['export-sales-invoices', fiscalPeriods, clientId],
    queryFn: async () => {
      if (fiscalPeriods.length === 0 || !clientId) return [];
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('client_id', clientId)
        .in('status', ['validated', 'classified'])
        .in('fiscal_period', fiscalPeriods)
        .order('document_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: fiscalPeriods.length > 0 && !!clientId,
  });

  // Deduplicate and count removed duplicates
  const { invoices, duplicatesRemoved } = useMemo(() => {
    if (!rawInvoices) return { invoices: [], duplicatesRemoved: 0 };
    const seen = new Map<string, typeof rawInvoices[0]>();
    let removed = 0;
    rawInvoices.forEach(inv => {
      const atcud = (inv.atcud || '').trim();
      const docNum = (inv.document_number || '').trim();
      const key = atcud
        ? `ATCUD|${atcud}`
        : docNum
          ? `DOC|${inv.supplier_nif}|${docNum}|${inv.document_date}`
          : `FALLBACK|${inv.supplier_nif}|${inv.document_date}|${inv.total_amount}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, inv);
      } else {
        removed++;
        if (inv.status === 'validated' && existing.status !== 'validated') {
          seen.set(key, inv);
        }
      }
    });
    return { invoices: Array.from(seen.values()), duplicatesRemoved: removed };
  }, [rawInvoices]);

  // Calculate DP field summaries (for UI display)
  const dpFieldSummaries = useMemo((): DPFieldSummary[] => {
    if (!invoices) return [];
    const summaries: Record<number, DPFieldSummary> = {};
    [10, 20, 21, 22, 23, 24].forEach(field => {
      summaries[field] = { field, label: DP_FIELD_LABELS[field], baseTotal: 0, vatTotal: 0, vatDeductible: 0, invoiceCount: 0 };
    });

    invoices.forEach(invoice => {
      if ((invoice.exclusion_reason || '').trim()) return;

      const dpField = invoice.final_dp_field ?? invoice.ai_dp_field ?? 24;
      const deductibility = (invoice.final_deductibility ?? invoice.ai_deductibility ?? 0) / 100;
      let base = 0, vat = 0;

      if (dpField === 10) {
        // Intra-community: base = all bases, vat = total_vat (reverse charge)
        base = (invoice.base_standard || 0) + (invoice.base_intermediate || 0) + (invoice.base_reduced || 0) + (invoice.base_exempt || 0);
        vat = invoice.total_vat || 0;
      } else if (dpField === 20) {
        base = (invoice.base_standard || 0) + (invoice.base_intermediate || 0) + (invoice.base_reduced || 0);
        vat = (invoice.vat_standard || 0) + (invoice.vat_intermediate || 0) + (invoice.vat_reduced || 0);
      } else if (dpField === 21) {
        base = invoice.base_reduced || 0;
        vat = invoice.vat_reduced || 0;
      } else if (dpField === 22) {
        base = invoice.base_standard || 0;
        vat = invoice.vat_standard || 0;
      } else if (dpField === 23) {
        base = invoice.base_intermediate || 0;
        vat = invoice.vat_intermediate || 0;
      } else {
        base = (invoice.base_standard || 0) + (invoice.base_intermediate || 0) + (invoice.base_reduced || 0);
        vat = invoice.total_vat || 0;
      }

      const effectiveField = dpField === 10 ? 10 : dpField;
      if (!summaries[effectiveField]) {
        summaries[effectiveField] = { field: effectiveField, label: DP_FIELD_LABELS[effectiveField] || `Campo ${effectiveField}`, baseTotal: 0, vatTotal: 0, vatDeductible: 0, invoiceCount: 0 };
      }
      summaries[effectiveField].baseTotal += base;
      summaries[effectiveField].vatTotal += vat;
      summaries[effectiveField].vatDeductible += dpField === 10 ? vat * deductibility : vat * deductibility;
      summaries[effectiveField].invoiceCount += 1;
    });

    return Object.values(summaries);
  }, [invoices]);

  const totals = useMemo(() => {
    return dpFieldSummaries.reduce(
      (acc, s) => ({
        baseTotal: acc.baseTotal + s.baseTotal,
        vatTotal: acc.vatTotal + s.vatTotal,
        vatDeductible: acc.vatDeductible + s.vatDeductible,
        invoiceCount: acc.invoiceCount + s.invoiceCount,
      }),
      { baseTotal: 0, vatTotal: 0, vatDeductible: 0, invoiceCount: 0 }
    );
  }, [dpFieldSummaries]);

  // Export using dpExcelGenerator
  const exportData = async () => {
    if (!invoices || invoices.length === 0 || !clientId) {
      toast.error('Não há dados para exportar');
      return;
    }

    setIsExporting(true);
    try {
      const quarterMatch = selectedPeriod.match(/^(\d{4})-Q(\d)$/);
      let periodo: string;
      let meses: string[];

      if (quarterMatch) {
        const year = parseInt(quarterMatch[1]);
        const q = parseInt(quarterMatch[2]);
        periodo = getQuarterPeriod(year, q);
        meses = getQuarterMonths(year, q);
      } else {
        periodo = selectedPeriod;
        meses = [selectedPeriod];
      }

      const compras: InvoiceRecord[] = invoices.map(inv => ({
        supplier_nif: inv.supplier_nif,
        supplier_name: inv.supplier_name,
        document_date: inv.document_date,
        fiscal_period: inv.fiscal_period,
        base_standard: inv.base_standard,
        base_intermediate: inv.base_intermediate,
        base_reduced: inv.base_reduced,
        base_exempt: inv.base_exempt,
        vat_standard: inv.vat_standard,
        vat_intermediate: inv.vat_intermediate,
        vat_reduced: inv.vat_reduced,
        total_vat: inv.total_vat,
        total_amount: inv.total_amount,
        final_dp_field: inv.final_dp_field,
        final_deductibility: inv.final_deductibility,
        ai_dp_field: inv.ai_dp_field,
        ai_deductibility: inv.ai_deductibility,
        exclusion_reason: inv.exclusion_reason,
      }));

      const vendas: SalesInvoiceRecord[] = (salesInvoices || []).map(inv => ({
        document_date: inv.document_date,
        fiscal_period: inv.fiscal_period,
        document_number: inv.document_number,
        document_type: inv.document_type,
        customer_nif: inv.customer_nif,
        customer_name: inv.customer_name,
        base_standard: inv.base_standard,
        base_intermediate: inv.base_intermediate,
        base_reduced: inv.base_reduced,
        base_exempt: inv.base_exempt,
        vat_standard: inv.vat_standard,
        vat_intermediate: inv.vat_intermediate,
        vat_reduced: inv.vat_reduced,
        total_vat: inv.total_vat,
        total_amount: inv.total_amount,
      }));

      // Fetch selected client's name
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', clientId).single();
      const clientName = profile?.full_name || 'Cliente';

      const dpData = buildDPExportData(clientName, periodo, meses, compras, vendas, recuperarAnterior, regFavorEstado, regSujeitoPassivo);
      downloadDPExcel(dpData);
      toast.success('Excel DP exportado com sucesso');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setIsExporting(false);
    }
  };

  return {
    selectedPeriod,
    setSelectedPeriod,
    exportFormat,
    setExportFormat,
    periodType,
    setPeriodType,
    invoices,
    isLoading,
    dpFieldSummaries,
    totals,
    exportData,
    isExporting,
    recuperarAnterior,
    setRecuperarAnterior,
    regFavorEstado,
    setRegFavorEstado,
    regSujeitoPassivo,
    setRegSujeitoPassivo,
    duplicatesRemoved,
  };
}
