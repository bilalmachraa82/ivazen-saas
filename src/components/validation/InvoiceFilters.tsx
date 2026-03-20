import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatFiscalPeriod } from '@/lib/formatFiscalPeriod';
import { Search } from 'lucide-react';

interface InvoiceFiltersProps {
  filters: {
    status: string;
    fiscalPeriod: string;
    search: string;
    clientId: string;
    reviewFilter?: string;
  };
  onFiltersChange: (filters: { status: string; fiscalPeriod: string; search: string; clientId: string; reviewFilter?: string }) => void;
  fiscalPeriods: string[];
}

export function InvoiceFilters({ 
  filters, 
  onFiltersChange, 
  fiscalPeriods, 
}: InvoiceFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por fornecedor ou NIF..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-10"
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os estados</SelectItem>
          <SelectItem value="pending">Pendente</SelectItem>
          <SelectItem value="classified">Classificada</SelectItem>
          <SelectItem value="validated">Validada</SelectItem>
          <SelectItem value="accounting_excluded">Não contabilizada</SelectItem>
          <SelectItem value="rejected">Excluída</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.fiscalPeriod}
        onValueChange={(value) => onFiltersChange({ ...filters, fiscalPeriod: value })}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os períodos</SelectItem>
          {fiscalPeriods.map((period) => (
            <SelectItem key={period} value={period}>
              {formatFiscalPeriod(period)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.reviewFilter || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, reviewFilter: value })}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Revisão" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="needs_review">Pendentes revisão</SelectItem>
          <SelectItem value="auto_approved">Auto-aprovadas</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
