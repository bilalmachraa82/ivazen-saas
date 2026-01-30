import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users } from 'lucide-react';

interface Client {
  id: string;
  full_name: string;
  company_name: string | null;
}

interface SalesInvoiceFiltersProps {
  filters: {
    status: string;
    fiscalPeriod: string;
    search: string;
    clientId: string;
  };
  onFiltersChange: (filters: { status: string; fiscalPeriod: string; search: string; clientId: string }) => void;
  fiscalPeriods: string[];
  clients?: Client[];
  showClientFilter?: boolean;
}

export function SalesInvoiceFilters({ 
  filters, 
  onFiltersChange, 
  fiscalPeriods,
  clients = [],
  showClientFilter = false
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

      {showClientFilter && clients.length > 0 && (
        <Select
          value={filters.clientId}
          onValueChange={(value) => onFiltersChange({ ...filters, clientId: value })}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <Users className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.company_name || client.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
              {period}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
