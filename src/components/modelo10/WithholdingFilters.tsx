import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';

export interface WithholdingFiltersState {
  search: string;
  category: string;
  month: string;
  status: string;
}

interface WithholdingFiltersProps {
  filters: WithholdingFiltersState;
  onFiltersChange: (filters: WithholdingFiltersState) => void;
}

const MONTHS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export function WithholdingFilters({ filters, onFiltersChange }: WithholdingFiltersProps) {
  const handleChange = (key: keyof WithholdingFiltersState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({ search: '', category: 'all', month: 'all', status: 'all' });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.category !== 'all' || 
    filters.month !== 'all' || 
    filters.status !== 'all';

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      {/* Search by NIF or Name */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar NIF ou nome..."
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category Filter */}
      <Select value={filters.category} onValueChange={(v) => handleChange('category', v)}>
        <SelectTrigger className="w-full sm:w-36">
          <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Cat.</SelectItem>
          <SelectItem value="B">Cat. B</SelectItem>
          <SelectItem value="E">Cat. E</SelectItem>
          <SelectItem value="F">Cat. F</SelectItem>
        </SelectContent>
      </Select>

      {/* Month Filter */}
      <Select value={filters.month} onValueChange={(v) => handleChange('month', v)}>
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Meses</SelectItem>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={filters.status} onValueChange={(v) => handleChange('status', v)}>
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Estados</SelectItem>
          <SelectItem value="draft">Rascunho</SelectItem>
          <SelectItem value="included">Incluído</SelectItem>
          <SelectItem value="submitted">Submetido</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
