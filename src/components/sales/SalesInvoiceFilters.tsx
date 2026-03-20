import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatFiscalPeriod } from '@/lib/formatFiscalPeriod';
import { Search } from 'lucide-react';

interface SalesInvoiceFiltersProps {
  filters: {
    status: string;
    fiscalPeriod: string;
    search: string;
    clientId: string;
    recentWindow?: string;
  };
  onFiltersChange: (filters: { status: string; fiscalPeriod: string; search: string; clientId: string; recentWindow?: string }) => void;
  fiscalPeriods: string[];
}

export function SalesInvoiceFilters({ 
  filters, 
  onFiltersChange, 
  fiscalPeriods,
}: SalesInvoiceFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por cliente ou NIF..."
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
          <SelectItem value="validated">Validada</SelectItem>
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
        value={filters.recentWindow || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, recentWindow: value })}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Importação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as importações</SelectItem>
          <SelectItem value="24h">Últimas 24 horas</SelectItem>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
