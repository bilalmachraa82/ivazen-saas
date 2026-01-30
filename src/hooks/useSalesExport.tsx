import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface SalesInvoice {
  id: string;
  document_date: string;
  supplier_nif: string;
  customer_name: string | null;
  customer_nif: string | null;
  document_number: string | null;
  document_type: string | null;
  base_standard: number | null;
  base_intermediate: number | null;
  base_reduced: number | null;
  base_exempt: number | null;
  vat_standard: number | null;
  vat_intermediate: number | null;
  vat_reduced: number | null;
  total_vat: number | null;
  total_amount: number;
  fiscal_period: string | null;
  status: string | null;
  notes: string | null;
}

interface PeriodSummary {
  period: string;
  periodLabel: string;
  total: number;
  vatTotal: number;
  invoiceCount: number;
}

interface SalesExportData {
  date: string;
  customerNif: string;
  customerName: string;
  documentNumber: string;
  documentType: string;
  baseStandard: number;
  baseIntermediate: number;
  baseReduced: number;
  baseExempt: number;
  vatStandard: number;
  vatIntermediate: number;
  vatReduced: number;
  vatTotal: number;
  total: number;
  notes: string;
}

export function useSalesExport() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch validated sales invoices for the selected period
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['export-sales-invoices', user?.id, selectedPeriod],
    queryFn: async () => {
      if (!selectedPeriod || !user?.id) return [];

      const { data, error } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('client_id', user.id)
        .eq('status', 'validated')
        .eq('fiscal_period', selectedPeriod)
        .order('document_date', { ascending: true });

      if (error) throw error;
      return data as SalesInvoice[];
    },
    enabled: !!selectedPeriod && !!user?.id,
  });

  // Fetch all validated sales invoices for period summary
  const { data: allInvoices } = useQuery({
    queryKey: ['all-sales-invoices', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('client_id', user.id)
        .eq('status', 'validated')
        .order('document_date', { ascending: false });

      if (error) throw error;
      return data as SalesInvoice[];
    },
    enabled: !!user?.id,
  });

  // Calculate period summaries
  const periodSummaries = useMemo((): PeriodSummary[] => {
    if (!allInvoices) return [];

    const summaryMap: Record<string, PeriodSummary> = {};

    allInvoices.forEach(invoice => {
      const period = invoice.fiscal_period || 'unknown';
      
      if (!summaryMap[period]) {
        // Format period label
        let periodLabel = period;
        if (period.match(/^\d{4}-\d{2}$/)) {
          const [year, month] = period.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1);
          periodLabel = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
        }

        summaryMap[period] = {
          period,
          periodLabel,
          total: 0,
          vatTotal: 0,
          invoiceCount: 0,
        };
      }

      summaryMap[period].total += Number(invoice.total_amount);
      summaryMap[period].vatTotal += Number(invoice.total_vat || 0);
      summaryMap[period].invoiceCount += 1;
    });

    return Object.values(summaryMap).sort((a, b) => b.period.localeCompare(a.period));
  }, [allInvoices]);

  // Calculate totals for selected period
  const totals = useMemo(() => {
    if (!invoices) return { total: 0, vatTotal: 0, invoiceCount: 0 };

    return invoices.reduce(
      (acc, inv) => ({
        total: acc.total + Number(inv.total_amount),
        vatTotal: acc.vatTotal + Number(inv.total_vat || 0),
        invoiceCount: acc.invoiceCount + 1,
      }),
      { total: 0, vatTotal: 0, invoiceCount: 0 }
    );
  }, [invoices]);

  // Prepare export data
  const prepareExportData = (): SalesExportData[] => {
    if (!invoices) return [];

    return invoices.map(invoice => ({
      date: new Date(invoice.document_date).toLocaleDateString('pt-PT'),
      customerNif: invoice.customer_nif || '',
      customerName: invoice.customer_name || '',
      documentNumber: invoice.document_number || '',
      documentType: invoice.document_type || 'FT',
      baseStandard: Number(invoice.base_standard || 0),
      baseIntermediate: Number(invoice.base_intermediate || 0),
      baseReduced: Number(invoice.base_reduced || 0),
      baseExempt: Number(invoice.base_exempt || 0),
      vatStandard: Number(invoice.vat_standard || 0),
      vatIntermediate: Number(invoice.vat_intermediate || 0),
      vatReduced: Number(invoice.vat_reduced || 0),
      vatTotal: Number(invoice.total_vat || 0),
      total: Number(invoice.total_amount),
      notes: invoice.notes || '',
    }));
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
        'NIF Cliente',
        'Cliente',
        'Nº Documento',
        'Tipo',
        'Base 23%',
        'Base 13%',
        'Base 6%',
        'Base Isenta',
        'IVA 23%',
        'IVA 13%',
        'IVA 6%',
        'IVA Total',
        'Total',
        'Notas',
      ];

      const wsData = [
        headers,
        ...data.map(row => [
          row.date,
          row.customerNif,
          row.customerName,
          row.documentNumber,
          row.documentType,
          row.baseStandard,
          row.baseIntermediate,
          row.baseReduced,
          row.baseExempt,
          row.vatStandard,
          row.vatIntermediate,
          row.vatReduced,
          row.vatTotal,
          row.total,
          row.notes,
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      ws['!cols'] = [
        { wch: 12 }, // Data
        { wch: 12 }, // NIF
        { wch: 30 }, // Cliente
        { wch: 15 }, // Nº Doc
        { wch: 8 },  // Tipo
        { wch: 12 }, // Base 23%
        { wch: 12 }, // Base 13%
        { wch: 12 }, // Base 6%
        { wch: 12 }, // Base Isenta
        { wch: 10 }, // IVA 23%
        { wch: 10 }, // IVA 13%
        { wch: 10 }, // IVA 6%
        { wch: 10 }, // IVA Total
        { wch: 12 }, // Total
        { wch: 25 }, // Notas
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Facturas Vendas');

      // Summary sheet
      const summaryHeaders = ['Período', 'Total Vendas', 'IVA Liquidado', 'Nº Facturas'];
      const summaryData = [
        summaryHeaders,
        ...periodSummaries.map(s => [
          s.periodLabel,
          s.total,
          s.vatTotal,
          s.invoiceCount,
        ]),
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
      ];

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo Períodos');

      // Generate file
      const fileName = `vendas_${selectedPeriod}.${exportFormat}`;
      
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

  // Get available periods from data
  const availablePeriods = useMemo(() => {
    return periodSummaries.map(s => s.period);
  }, [periodSummaries]);

  return {
    selectedPeriod,
    setSelectedPeriod,
    exportFormat,
    setExportFormat,
    invoices,
    isLoading,
    periodSummaries,
    totals,
    exportData,
    isExporting,
    availablePeriods,
  };
}
