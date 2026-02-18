/**
 * ClientSearchSelector - Advanced client combobox with search, sorting and filters
 * Replaces standard Select with a searchable, sortable command interface
 */

import { useState, useMemo, useCallback } from 'react';
import { Check, ChevronsUpDown, Search, SortAsc, SortDesc, Hash, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
// Minimal client interface for the selector
interface ClientItem {
  id: string;
  full_name: string | null;
  company_name: string | null;
  nif: string | null;
}
type SortOption = 'name-asc' | 'name-desc' | 'nif';

interface ClientSearchSelectorProps {
  clients: ClientItem[];
  selectedClientId: string | null;
  onSelect: (clientId: string) => void;
  isLoading?: boolean;
  showOwnAccount?: boolean;
  ownAccountId?: string;
  ownAccountLabel?: string;
  placeholder?: string;
  className?: string;
}

export function ClientSearchSelector({
  clients,
  selectedClientId,
  onSelect,
  isLoading = false,
  showOwnAccount = false,
  ownAccountId,
  ownAccountLabel = 'Minha conta',
  placeholder = 'Selecionar cliente...',
  className,
}: ClientSearchSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');

  // Sort and filter clients
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(client => {
        const name = (client.full_name || client.company_name || '').toLowerCase();
        const nif = (client.nif || '').toLowerCase();
        return name.includes(query) || nif.includes(query);
      });
    }

    // Sort
    result.sort((a, b) => {
      const nameA = (a.full_name || a.company_name || '').toLowerCase();
      const nameB = (b.full_name || b.company_name || '').toLowerCase();
      const nifA = a.nif || '';
      const nifB = b.nif || '';

      switch (sortOption) {
        case 'name-asc':
          return nameA.localeCompare(nameB, 'pt');
        case 'name-desc':
          return nameB.localeCompare(nameA, 'pt');
        case 'nif':
          return nifA.localeCompare(nifB);
        default:
          return 0;
      }
    });

    return result;
  }, [clients, searchQuery, sortOption]);

  // Get selected client display
  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    if (showOwnAccount && selectedClientId === ownAccountId) {
      return { id: ownAccountId, label: ownAccountLabel, isOwn: true };
    }
    const client = clients.find(c => c.id === selectedClientId);
    if (client) {
      return {
        id: client.id,
        label: client.full_name || client.company_name || 'Cliente',
        nif: client.nif,
        isOwn: false,
      };
    }
    return null;
  }, [selectedClientId, clients, showOwnAccount, ownAccountId, ownAccountLabel]);

  const handleSelect = useCallback((clientId: string) => {
    onSelect(clientId);
    setOpen(false);
    setSearchQuery('');
  }, [onSelect]);

  const cycleSortOption = () => {
    setSortOption(prev => {
      switch (prev) {
        case 'name-asc': return 'name-desc';
        case 'name-desc': return 'nif';
        case 'nif': return 'name-asc';
      }
    });
  };

  const getSortIcon = () => {
    switch (sortOption) {
      case 'name-asc': return <SortAsc className="h-3 w-3" />;
      case 'name-desc': return <SortDesc className="h-3 w-3" />;
      case 'nif': return <Hash className="h-3 w-3" />;
    }
  };

  const getSortLabel = () => {
    switch (sortOption) {
      case 'name-asc': return 'A→Z';
      case 'name-desc': return 'Z→A';
      case 'nif': return 'NIF';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Selecionar cliente"
          className={cn('w-[280px] justify-between', className)}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>A carregar...</span>
            </div>
          ) : selectedClient ? (
            <div className="flex items-center gap-2 truncate">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{selectedClient.label}</span>
              {selectedClient.nif && !selectedClient.isOwn && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                  {selectedClient.nif}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 bg-popover z-50" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Pesquisar por nome ou NIF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={cycleSortOption}
              title={`Ordenar: ${getSortLabel()}`}
            >
              {getSortIcon()}
              {getSortLabel()}
            </Button>
          </div>

          <CommandList className="max-h-[300px]">
            {/* Own account option */}
            {showOwnAccount && ownAccountId && (
              <>
                <CommandGroup heading="Conta Própria">
                  <CommandItem
                    value={ownAccountId}
                    onSelect={() => handleSelect(ownAccountId)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedClientId === ownAccountId ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{ownAccountLabel}</span>
                      <span className="text-xs text-muted-foreground">Ver os meus próprios dados</span>
                    </div>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Client list */}
            <CommandGroup heading={`Clientes (${filteredClients.length})`}>
              {filteredClients.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {searchQuery ? 'Nenhum cliente encontrado' : 'Sem clientes associados'}
                </div>
              ) : (
                filteredClients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.id}
                    onSelect={() => handleSelect(client.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        selectedClientId === client.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate font-medium">
                        {client.full_name || client.company_name || 'Cliente'}
                      </span>
                      {client.nif && (
                        <span className="text-xs text-muted-foreground">
                          NIF: {client.nif}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>

          {/* Footer with count */}
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            {searchQuery ? (
              `${filteredClients.length} de ${clients.length} clientes`
            ) : (
              `${clients.length} cliente${clients.length !== 1 ? 's' : ''}`
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
