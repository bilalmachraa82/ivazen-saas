import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, Calendar } from 'lucide-react';
import type { DocumentFilters, DocumentType } from '@/hooks/useAllDocuments';

interface DocumentsFiltersProps {
  filters: DocumentFilters;
  onFiltersChange: (filters: DocumentFilters) => void;
  fiscalPeriods: string[];
  allStatuses: string[];
  showClientFilter?: boolean;
  clients?: Array<{ id: string; name: string }>;
}

const documentTypeLabels: Record<DocumentType | 'all', string> = {
  all: 'Todos',
  purchase: 'Compras',
  sale: 'Vendas',
  withholding: 'Retenções',
};

const statusLabels: Record<string, string> = {
  all: 'Todos',
  pending: 'Pendente',
  classified: 'Classificado',
  validated: 'Validado',
  draft: 'Rascunho',
  included: 'Incluído',
  submitted: 'Submetido',
};

export function DocumentsFilters({
  filters,
  onFiltersChange,
  fiscalPeriods,
  allStatuses,
  showClientFilter = false,
  clients = [],
}: DocumentsFiltersProps) {
  const handleClearFilters = () => {
    onFiltersChange({
      type: 'all',
      status: 'all',
      fiscalPeriod: 'all',
      search: '',
      clientId: 'all',
      dateFrom: '',
      dateTo: '',
    });
  };

  const hasActiveFilters =
    filters.type !== 'all' ||
    filters.status !== 'all' ||
    filters.fiscalPeriod !== 'all' ||
    filters.search !== '' ||
    filters.clientId !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  return (
    <div className="space-y-4">
      {/* Primary filters row */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, NIF ou n.º documento..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Document Type */}
        <Select
          value={filters.type}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, type: value as DocumentFilters['type'] })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{documentTypeLabels.all}</SelectItem>
            <SelectItem value="purchase">{documentTypeLabels.purchase}</SelectItem>
            <SelectItem value="sale">{documentTypeLabels.sale}</SelectItem>
            <SelectItem value="withholding">{documentTypeLabels.withholding}</SelectItem>
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Estados</SelectItem>
            {allStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status] || status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Fiscal Period */}
        <Select
          value={filters.fiscalPeriod}
          onValueChange={(value) => onFiltersChange({ ...filters, fiscalPeriod: value })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Períodos</SelectItem>
            {fiscalPeriods.map((period) => (
              <SelectItem key={period} value={period}>
                {period}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Client filter (for accountants) */}
        {showClientFilter && clients.length > 0 && (
          <Select
            value={filters.clientId}
            onValueChange={(value) => onFiltersChange({ ...filters, clientId: value })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Clientes</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Secondary filters row - Date range */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Data:</span>
        </div>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
          className="w-[150px]"
          placeholder="De"
        />
        <span className="text-muted-foreground">até</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
          className="w-[150px]"
          placeholder="Até"
        />

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
