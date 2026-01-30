import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { ZenEmptyState } from '@/components/zen';
import { usePagination } from '@/hooks/usePagination';
import { Eye, CheckCircle, Clock, FileText, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, XCircle, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;

type SortField = 'date' | 'confidence' | 'amount';
type SortOrder = 'asc' | 'desc';

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
  onSelectInvoice: (invoice: Invoice) => void;
}

const statusConfig = {
  pending: { label: 'Por Classificar', variant: 'secondary' as const, icon: Clock },
  classified: { label: 'Por Confirmar', variant: 'warning' as const, icon: AlertCircle },
  validated: { label: 'Confirmada', variant: 'success' as const, icon: CheckCircle },
};

const getConfidenceConfig = (confidence: number) => {
  if (confidence >= 80) {
    return { 
      variant: 'success' as const, 
      icon: CheckCircle, 
      tooltip: 'Classificação confiável - verificação rápida recomendada' 
    };
  }
  if (confidence >= 60) {
    return { 
      variant: 'warning' as const, 
      icon: AlertTriangle, 
      tooltip: 'Classificação provável - requer atenção' 
    };
  }
  return { 
    variant: 'destructive' as const, 
    icon: XCircle, 
    tooltip: 'Classificação incerta - verificação manual necessária' 
  };
};

export function InvoiceTable({ invoices, loading, onSelectInvoice }: InvoiceTableProps) {
  const navigate = useNavigate();
  // Default: sort by confidence ascending (lowest first - needs more attention)
  const [sortField, setSortField] = useState<SortField>('confidence');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'confidence':
          const confA = a.ai_confidence ?? 100;
          const confB = b.ai_confidence ?? 100;
          comparison = confA - confB;
          break;
        case 'date':
          comparison = new Date(a.document_date).getTime() - new Date(b.document_date).getTime();
          break;
        case 'amount':
          comparison = Number(a.total_amount) - Number(b.total_amount);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [invoices, sortField, sortOrder]);

  // Pagination
  const pagination = usePagination({
    totalItems: sortedInvoices.length,
    itemsPerPage: 10,
    initialPage: 1,
  });

  const paginatedInvoices = pagination.paginatedItems(sortedInvoices);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'confidence' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <ZenEmptyState
        icon={FileText}
        title="Nenhuma factura encontrada"
        description="Comece por carregar facturas para poder validar as classificações de IA"
        variant="primary"
        action={{
          label: 'Carregar Factura',
          onClick: () => navigate('/upload'),
          icon: Upload,
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordenar por:</span>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confidence">Confiança</SelectItem>
            <SelectItem value="date">Data</SelectItem>
            <SelectItem value="amount">Valor</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 px-2"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          {sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
        </Button>
      </div>
      
      {/* Low confidence indicator */}
      {sortField === 'confidence' && sortOrder === 'asc' && (
        <p className="text-xs text-warning flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Facturas com menor confiança aparecem primeiro
        </p>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center">
                  Data
                  <SortIcon field="date" />
                </div>
              </TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort('amount')}
              >
                <div className="flex items-center justify-end">
                  Valor
                  <SortIcon field="amount" />
                </div>
              </TableHead>
              <TableHead>Classificação IA</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort('confidence')}
              >
                <div className="flex items-center">
                  Confiança
                  <SortIcon field="confidence" />
                </div>
              </TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedInvoices.map((invoice) => {
            const status = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.pending;
            const StatusIcon = status.icon;
            
            return (
              <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  {format(new Date(invoice.document_date), 'dd/MM/yyyy', { locale: pt })}
                </TableCell>
                <TableCell className="font-medium">
                  {invoice.supplier_name || 'N/A'}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {invoice.supplier_nif}
                </TableCell>
                <TableCell className="text-right font-medium">
                  €{Number(invoice.total_amount).toFixed(2)}
                </TableCell>
                <TableCell>
                  {invoice.ai_classification ? (
                    <span className="text-sm">{invoice.ai_classification}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {invoice.ai_confidence ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex">
                            {(() => {
                              const config = getConfidenceConfig(invoice.ai_confidence);
                              const ConfidenceIcon = config.icon;
                              return (
                                <Badge variant={config.variant} className="gap-1 cursor-help">
                                  <ConfidenceIcon className="h-3 w-3" />
                                  {invoice.ai_confidence}%
                                </Badge>
                              );
                            })()}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-48">
                            {getConfidenceConfig(invoice.ai_confidence).tooltip}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectInvoice(invoice)}
                    aria-label="Ver detalhes da factura"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <PaginationControls
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        itemsPerPage={pagination.itemsPerPage}
        totalItems={sortedInvoices.length}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        canGoNext={pagination.canGoNext}
        canGoPrev={pagination.canGoPrev}
        onPageChange={pagination.goToPage}
        onItemsPerPageChange={pagination.setItemsPerPage}
      />
    </div>
  );
}
