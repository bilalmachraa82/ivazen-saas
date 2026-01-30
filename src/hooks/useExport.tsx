import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  document_date: string;
  supplier_nif: string;
  supplier_name: string | null;
  document_number: string | null;
  base_standard: number | null;
  base_intermediate: number | null;
  base_reduced: number | null;
  base_exempt: number | null;
  vat_standard: number | null;
  vat_intermediate: number | null;
  vat_reduced: number | null;
  total_vat: number | null;
  total_amount: number;
  final_dp_field: number | null;
  final_classification: string | null;
  final_deductibility: number | null;
  validated_by: string | null;
  fiscal_period: string | null;
}

interface DPFieldSummary {
  field: number;
  label: string;
  baseTotal: number;
  vatTotal: number;
  vatDeductible: number;
  invoiceCount: number;
}

interface ExportData {
  date: string;
  supplierNif: string;
  supplierName: string;
  documentNumber: string;
  baseTaxable: number;
  vat: number;
  total: number;
  dpField: string;
  classification: string;
  deductibility: number;
  vatDeductible: number;
  validatedBy: string;
}

const DP_FIELD_LABELS: Record<number, string> = {
  20: 'Imobilizado',
  21: 'Existências 6%',
  22: 'Existências 13%',
  23: 'Existências 23%',
  24: 'Outros bens e serviços',
};

export function useExport() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch validated invoices for the selected period
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['export-invoices', selectedPeriod],
    queryFn: async () => {
      if (!selectedPeriod) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('status', 'validated')
        .eq('fiscal_period', selectedPeriod)
        .order('document_date', { ascending: true });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!selectedPeriod,
  });

  // Calculate DP field summaries
  const dpFieldSummaries = useMemo((): DPFieldSummary[] => {
    if (!invoices) return [];

    const summaries: Record<number, DPFieldSummary> = {};

    // Initialize all DP fields
    [20, 21, 22, 23, 24].forEach(field => {
      summaries[field] = {
        field,
        label: DP_FIELD_LABELS[field],
        baseTotal: 0,
        vatTotal: 0,
        vatDeductible: 0,
        invoiceCount: 0,
      };
    });

    invoices.forEach(invoice => {
      const dpField = invoice.final_dp_field || 24;
      const deductibility = (invoice.final_deductibility || 0) / 100;
      
      // Calculate base and VAT based on DP field rates
      let base = 0;
      let vat = 0;

      if (dpField === 20) {
        // Imobilizado - can be any rate
        base = (invoice.base_standard || 0) + (invoice.base_intermediate || 0) + (invoice.base_reduced || 0);
        vat = (invoice.vat_standard || 0) + (invoice.vat_intermediate || 0) + (invoice.vat_reduced || 0);
      } else if (dpField === 21) {
        // Existências 6%
        base = invoice.base_reduced || 0;
        vat = invoice.vat_reduced || 0;
      } else if (dpField === 22) {
        // Existências 13%
        base = invoice.base_intermediate || 0;
        vat = invoice.vat_intermediate || 0;
      } else if (dpField === 23) {
        // Existências 23%
        base = invoice.base_standard || 0;
        vat = invoice.vat_standard || 0;
      } else {
        // Campo 24 - Outros
        base = (invoice.base_standard || 0) + (invoice.base_intermediate || 0) + (invoice.base_reduced || 0);
        vat = invoice.total_vat || 0;
      }

      summaries[dpField].baseTotal += base;
      summaries[dpField].vatTotal += vat;
      summaries[dpField].vatDeductible += vat * deductibility;
      summaries[dpField].invoiceCount += 1;
    });

    return Object.values(summaries);
  }, [invoices]);

  // Calculate totals
  const totals = useMemo(() => {
    return dpFieldSummaries.reduce(
      (acc, summary) => ({
        baseTotal: acc.baseTotal + summary.baseTotal,
        vatTotal: acc.vatTotal + summary.vatTotal,
        vatDeductible: acc.vatDeductible + summary.vatDeductible,
        invoiceCount: acc.invoiceCount + summary.invoiceCount,
      }),
      { baseTotal: 0, vatTotal: 0, vatDeductible: 0, invoiceCount: 0 }
    );
  }, [dpFieldSummaries]);

  // Prepare export data
  const prepareExportData = (): ExportData[] => {
    if (!invoices) return [];

    return invoices.map(invoice => {
      const deductibility = invoice.final_deductibility || 0;
      const vat = invoice.total_vat || 0;
      const vatDeductible = vat * (deductibility / 100);

      return {
        date: new Date(invoice.document_date).toLocaleDateString('pt-PT'),
        supplierNif: invoice.supplier_nif,
        supplierName: invoice.supplier_name || '',
        documentNumber: invoice.document_number || '',
        baseTaxable: (invoice.base_standard || 0) + (invoice.base_intermediate || 0) + (invoice.base_reduced || 0),
        vat,
        total: invoice.total_amount,
        dpField: `Campo ${invoice.final_dp_field || 24}`,
        classification: invoice.final_classification || '',
        deductibility,
        vatDeductible,
        validatedBy: invoice.validated_by ? 'Validado' : '',
      };
    });
  };

  // Export to file
  const exportData = async () => {
    if (!invoices || invoices.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }

    setIsExporting(true);

    try {
      const data = prepareExportData();
      
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Main data sheet
      const headers = [
        'Data',
        'NIF Fornecedor',
        'Fornecedor',
        'Nº Documento',
        'Base Tributável',
        'IVA',
        'Total',
        'Campo DP',
        'Classificação',
        'Dedutibilidade %',
        'IVA Dedutível',
        'Validado',
      ];

      const wsData = [
        headers,
        ...data.map(row => [
          row.date,
          row.supplierNif,
          row.supplierName,
          row.documentNumber,
          row.baseTaxable,
          row.vat,
          row.total,
          row.dpField,
          row.classification,
          row.deductibility,
          row.vatDeductible,
          row.validatedBy,
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      ws['!cols'] = [
        { wch: 12 }, // Data
        { wch: 12 }, // NIF
        { wch: 30 }, // Fornecedor
        { wch: 15 }, // Nº Doc
        { wch: 14 }, // Base
        { wch: 10 }, // IVA
        { wch: 12 }, // Total
        { wch: 12 }, // Campo DP
        { wch: 20 }, // Classificação
        { wch: 14 }, // Dedutibilidade
        { wch: 14 }, // IVA Dedutível
        { wch: 10 }, // Validado
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Facturas');

      // Summary sheet
      const summaryHeaders = ['Campo DP', 'Descrição', 'Base Tributável', 'IVA Total', 'IVA Dedutível', 'Nº Facturas'];
      const summaryData = [
        summaryHeaders,
        ...dpFieldSummaries.map(s => [
          `Campo ${s.field}`,
          s.label,
          s.baseTotal,
          s.vatTotal,
          s.vatDeductible,
          s.invoiceCount,
        ]),
        [], // Empty row
        ['TOTAL', '', totals.baseTotal, totals.vatTotal, totals.vatDeductible, totals.invoiceCount],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [
        { wch: 12 },
        { wch: 25 },
        { wch: 15 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
      ];

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo DP');

      // Generate file
      const fileName = `facturas_${selectedPeriod}.${exportFormat}`;
      
      if (exportFormat === 'xlsx') {
        XLSX.writeFile(wb, fileName);
      } else {
        XLSX.writeFile(wb, fileName, { bookType: 'csv' });
      }

      toast.success(`Exportação concluída: ${fileName}`);
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
    invoices,
    isLoading,
    dpFieldSummaries,
    totals,
    exportData,
    isExporting,
  };
}
