/**
 * PortfolioReadinessCard — shows per-client readiness in a filterable table.
 * Clicking a readiness badge filters the list. Clicking a client selects them.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZenCard } from '@/components/zen';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import {
  readinessConfig,
  readinessOrder,
  type ClientReadiness,
} from '@/lib/clientReadiness';

interface ClientSummary {
  id: string;
  full_name: string | null;
  company_name: string | null;
  nif: string | null;
}

interface PortfolioReadinessCardProps {
  clients: ClientSummary[];
  readinessMap: Map<string, ClientReadiness>;
  summary: Record<ClientReadiness, number>;
  totalClients: number;
  isLoading?: boolean;
}

export function PortfolioReadinessCard({
  clients,
  readinessMap,
  summary,
  totalClients,
  isLoading = false,
}: PortfolioReadinessCardProps) {
  const [activeFilter, setActiveFilter] = useState<ClientReadiness | null>(null);
  const { setSelectedClientId } = useSelectedClient();
  const navigate = useNavigate();

  const filteredClients = useMemo(() => {
    if (!activeFilter) return [];
    return clients.filter((c) => readinessMap.get(c.id) === activeFilter);
  }, [clients, readinessMap, activeFilter]);

  const handleBadgeClick = (status: ClientReadiness) => {
    setActiveFilter((prev) => (prev === status ? null : status));
  };

  const handleClientClick = (clientId: string) => {
    setSelectedClientId(clientId);
    navigate('/centro-fiscal');
  };

  return (
    <ZenCard withLine animationDelay="100ms" className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Estado da Carteira
          <Badge variant="secondary" className="ml-auto text-xs">
            {totalClients} clientes
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">A carregar carteira...</span>
          </div>
        ) : (
          <>
            {/* Clickable readiness badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {readinessOrder.map((status) => {
                const config = readinessConfig[status];
                const count = summary[status];
                if (count === 0) return null;
                const isActive = activeFilter === status;
                return (
                  <button
                    key={status}
                    onClick={() => handleBadgeClick(status)}
                    aria-pressed={isActive}
                    aria-label={`${config.label}: ${count} clientes`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all cursor-pointer ${config.badge} ${
                      isActive
                        ? 'ring-2 ring-primary ring-offset-1 shadow-md'
                        : 'hover:shadow-sm hover:border-current/40'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${config.dot}`} />
                    <span className="font-bold text-base leading-none">{count}</span>
                    <span className="text-xs truncate min-w-0" title={config.label}>{config.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Filtered client list */}
            {activeFilter && (
              <div
                role="region"
                aria-live="polite"
                aria-label="Clientes filtrados"
                className="space-y-2 animate-fade-in"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    {readinessConfig[activeFilter].label} — {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setActiveFilter(null)}
                    aria-label="Fechar filtro"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="relative">
                  <div className="max-h-[280px] overflow-y-auto rounded-lg border shadow-sm divide-y">
                    {filteredClients.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                    ) : filteredClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleClientClick(client.id)}
                        aria-label={`Abrir Centro Fiscal para ${client.company_name || client.full_name || 'Cliente'}`}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {client.company_name || client.full_name || 'Cliente'}
                          </p>
                          {client.nif && (
                            <p className="text-xs text-muted-foreground">NIF: {client.nif}</p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                  {/* Scroll fade indicator */}
                  {filteredClients.length > 5 && (
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none rounded-b-lg" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {readinessConfig[activeFilter].description}. Clique num cliente para abrir o Centro Fiscal.
                </p>
              </div>
            )}

            {!activeFilter && (
              <p className="text-xs text-muted-foreground">
                Clique num estado para ver os clientes. Selecione um cliente no menu lateral para abrir o Centro Fiscal.
              </p>
            )}
          </>
        )}
      </CardContent>
    </ZenCard>
  );
}
