import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Users, UserPlus, ChevronDown, Check, Pin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface Client {
  id: string;
  full_name: string;
  company_name: string | null;
  nif: string | null;
}

interface ClientSelectorProps {
  clients: Client[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string | null) => void;
  isLoading?: boolean;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Highlight matching text in a string
function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }

  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => (
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      ))}
    </span>
  );
}

export function ClientSelector({
  clients,
  selectedClientId,
  onSelectClient,
  isLoading = false
}: ClientSelectorProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(searchValue, 300);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return clients;
    }

    const searchLower = debouncedSearch.toLowerCase();
    return clients.filter(client => {
      const fullName = client.full_name.toLowerCase();
      const companyName = client.company_name?.toLowerCase() || '';
      const nif = client.nif?.toLowerCase() || '';

      return fullName.includes(searchLower) ||
             companyName.includes(searchLower) ||
             nif.includes(searchLower);
    });
  }, [clients, debouncedSearch]);

  // Check if selected client is in filtered results
  const selectedInFiltered = useMemo(() => {
    return filteredClients.some(c => c.id === selectedClientId);
  }, [filteredClients, selectedClientId]);

  // Clear search when popover closes
  useEffect(() => {
    if (!open) {
      setSearchValue('');
    }
  }, [open]);

  // localStorage persistence is now handled by SelectedClientContext

  const handleSelect = useCallback((clientId: string) => {
    onSelectClient(clientId);
    setOpen(false);
  }, [onSelectClient]);

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    inputRef.current?.focus();
  }, []);

  // No clients available
  if (clients.length === 0 && !isLoading) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <Users className="h-5 w-5 text-blue-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
            Nenhum cliente associado
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
            Crie ou associe clientes antes de carregar facturas.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/settings')}
          className="shrink-0 border-blue-500/30 text-blue-700 hover:bg-blue-500/10"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Gerir Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
      <Users className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-xs text-muted-foreground">Carregar factura para:</p>
          {selectedClient && (
            <Pin className="h-3 w-3 text-primary" aria-label="Cliente fixado (sera restaurado na proxima sessao)" />
          )}
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              className="h-auto p-0 hover:bg-transparent font-medium text-left justify-start"
              disabled={isLoading}
            >
              <span className="truncate max-w-[200px]">
                {isLoading
                  ? 'A carregar...'
                  : selectedClient
                    ? selectedClient.company_name || selectedClient.full_name
                    : 'Seleccionar cliente'
                }
              </span>
              <ChevronDown className="h-4 w-4 ml-1 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command shouldFilter={false}>
              <div className="relative">
                <CommandInput
                  ref={inputRef}
                  placeholder="Pesquisar por nome, empresa ou NIF..."
                  value={searchValue}
                  onValueChange={setSearchValue}
                  className="pr-8"
                />
                {searchValue && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Limpar pesquisa"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <CommandList>
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 opacity-50" />
                    <span>Nenhum cliente encontrado</span>
                    {searchValue && (
                      <span className="text-xs">
                        Tente uma pesquisa diferente
                      </span>
                    )}
                  </div>
                </CommandEmpty>

                {/* Show selected client separately if not in filtered results */}
                {selectedClient && !selectedInFiltered && debouncedSearch.trim() && (
                  <>
                    <CommandGroup heading="Cliente selecionado">
                      <CommandItem
                        value={selectedClient.id}
                        onSelect={() => handleSelect(selectedClient.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Check className="h-4 w-4 opacity-100" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {selectedClient.company_name || selectedClient.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            NIF: {selectedClient.nif || 'N/A'}
                          </p>
                        </div>
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

                {/* Filtered clients */}
                {filteredClients.length > 0 && (
                  <CommandGroup heading={debouncedSearch.trim() ? `Resultados (${filteredClients.length})` : 'Clientes'}>
                    {filteredClients.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={client.id}
                        onSelect={() => handleSelect(client.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Check className={cn(
                          "h-4 w-4",
                          selectedClientId === client.id ? "opacity-100" : "opacity-0"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            <HighlightText
                              text={client.company_name || client.full_name}
                              highlight={debouncedSearch}
                            />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            NIF: {client.nif ? (
                              <HighlightText text={client.nif} highlight={debouncedSearch} />
                            ) : (
                              'N/A'
                            )}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      navigate('/settings');
                      setOpen(false);
                    }}
                    className="text-muted-foreground cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Gerir clientes
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {selectedClient?.nif && (
        <span className="text-xs font-mono text-muted-foreground">
          NIF: {selectedClient.nif}
        </span>
      )}
    </div>
  );
}
