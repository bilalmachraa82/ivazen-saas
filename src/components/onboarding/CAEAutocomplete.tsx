import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { searchCAE, getCAEByCode, CAECode, CAE_SECTIONS } from '@/lib/caeData';

interface CAEAutocompleteProps {
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
  isValid?: boolean;
  disabled?: boolean;
}

export function CAEAutocomplete({ 
  value, 
  onChange, 
  error, 
  isValid,
  disabled = false 
}: CAEAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get current CAE info if selected
  const selectedCAE = useMemo(() => getCAEByCode(value), [value]);
  
  // Search results based on query
  const searchResults = useMemo(() => searchCAE(searchQuery), [searchQuery]);
  
  // Group results by section
  const groupedResults = useMemo(() => {
    const groups: Record<string, CAECode[]> = {};
    searchResults.forEach(cae => {
      const key = cae.sectionName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(cae);
    });
    return groups;
  }, [searchResults]);

  const handleSelect = (caeCode: string) => {
    onChange(caeCode);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-auto min-h-[44px] py-2 px-3 bg-background/50 text-left font-normal",
              error && "border-destructive",
              isValid && "border-green-500",
              !value && "text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              {selectedCAE ? (
                <div className="flex flex-col items-start gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-primary">{selectedCAE.code}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {selectedCAE.section}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground truncate max-w-full">
                    {selectedCAE.description}
                  </span>
                </div>
              ) : value ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono">{value}</span>
                  <span className="text-sm text-muted-foreground">(CAE manual)</span>
                </div>
              ) : (
                <span>Pesquisar CAE...</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] p-0 z-50" 
          align="start"
          sideOffset={4}
        >
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Pesquisar por código ou descrição..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0"
              />
            </div>
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty className="py-6 text-center text-sm">
                <div className="space-y-2">
                  <p>Nenhum CAE encontrado.</p>
                  {searchQuery && /^\d{5}$/.test(searchQuery) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelect(searchQuery)}
                      className="mt-2"
                    >
                      Usar código {searchQuery}
                    </Button>
                  )}
                </div>
              </CommandEmpty>
              
              {Object.entries(groupedResults).map(([sectionName, codes]) => (
                <CommandGroup key={sectionName} heading={sectionName}>
                  {codes.map((cae) => (
                    <CommandItem
                      key={cae.code}
                      value={cae.code}
                      onSelect={() => handleSelect(cae.code)}
                      className="flex items-start gap-2 py-2 cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 mt-0.5 flex-shrink-0",
                          value === cae.code ? "opacity-100 text-primary" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{cae.code}</span>
                          {cae.popular && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {cae.description}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Manual input hint */}
      {!open && !value && (
        <p className="text-xs text-muted-foreground">
          Pesquise pelo código ou descrição da actividade
        </p>
      )}
    </div>
  );
}
