import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ZenEmptyState } from '@/components/zen';
import { Eye, CheckCircle, Clock, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type SalesInvoice = Tables<'sales_invoices'>;

type SortField = 'date' | 'amount';
type SortOrder = 'asc' | 'desc';

interface SalesInvoiceTableProps {
  invoices: SalesInvoice[];
  loading: boolean;
  onSelectInvoice: (invoice: SalesInvoice) => void;
}

const statusConfig = {
  pending: { label: 'Pendente', variant: 'secondary' as const, icon: Clock },
  validated: { label: 'Validada', variant: 'success' as const, icon: CheckCircle },
};

// Revenue category configuration with colors
const categoryConfig: Record<string, { label: string; color: string }> = {
  prestacao_servicos: { label: 'Serviços', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  vendas: { label: 'Vendas', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  hotelaria: { label: 'Hotelaria', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  restauracao: { label: 'Restauração', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  alojamento_local: { label: 'Alojamento', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  producao_venda: { label: 'Produção', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  propriedade_intelectual: { label: 'Prop. Intelectual', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' },
  comercio: { label: 'Comércio', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  outros: { label: 'Outros', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' },
};

export function SalesInvoiceTable({ invoices, loading, onSelectInvoice }: SalesInvoiceTableProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
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
        icon={TrendingUp}
        title="Nenhuma factura de venda"
        description="Comece por carregar facturas de vendas para registar as suas receitas"
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
              <TableHead>Cliente</TableHead>
              <TableHead>NIF Cliente</TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort('amount')}
              >
                <div className="flex items-center justify-end">
                  Valor
                  <SortIcon field="amount" />
                </div>
              </TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedInvoices.map((invoice) => {
              const status = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = status.icon;
              const category = categoryConfig[(invoice as any).revenue_category] || categoryConfig.prestacao_servicos;
              
              return (
                <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    {format(new Date(invoice.document_date), 'dd/MM/yyyy', { locale: pt })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {invoice.customer_name || 'N/A'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {invoice.customer_nif || 'N/A'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    €{Number(invoice.total_amount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${category.color}`}>
                      {category.label}
                    </span>
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
    </div>
  );
}
