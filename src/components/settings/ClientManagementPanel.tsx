import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Users, Search, Loader2, User, UserPlus, UserMinus, 
  FileCheck, Clock, ExternalLink, HelpCircle, Plus, Pencil
} from 'lucide-react';
import { ZenCard, ZenStatsCard } from '@/components/zen';
import { useClientManagement, AccountantClient } from '@/hooks/useClientManagement';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateClientDialog } from './CreateClientDialog';
import { EditClientDialog } from './EditClientDialog';

export function ClientManagementPanel() {
  const {
    clients,
    isLoadingClients,
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    searchClients,
    associateClient,
    isAssociating,
    removeClient,
    isRemoving,
  } = useClientManagement();

  const [clientToRemove, setClientToRemove] = useState<AccountantClient | null>(null);
  const [clientToEdit, setClientToEdit] = useState<AccountantClient | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const handleSearch = () => {
    searchClients(searchTerm);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Calculate stats
  const totalClients = clients.length;
  const totalPending = clients.reduce((sum, c) => sum + (c.pending_invoices || 0), 0);
  const totalValidated = clients.reduce((sum, c) => sum + (c.validated_invoices || 0), 0);

  return (
    <>
      <ZenCard gradient="primary" withLine className="shadow-xl" animationDelay="100ms">
        <CardHeader>
        <CardTitle className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowCreateDialog(true)}
                  className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 
                             hover:from-primary/30 hover:to-primary/20 
                             transition-all cursor-pointer group"
                >
                  <div className="relative">
                    <Users className="h-5 w-5 text-primary" />
                    <Plus className="h-3 w-3 text-primary absolute -bottom-1 -right-1 
                                    opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent>Criar novo cliente</TooltipContent>
            </Tooltip>
            Gestão de Clientes
            <Badge className="bg-primary/20 text-primary border-0">
              {totalClients} clientes
            </Badge>
          </CardTitle>
          <CardDescription>
            Pesquise e adicione clientes à sua carteira
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <ZenStatsCard
              icon={Users}
              label="Clientes"
              value={totalClients}
              variant="primary"
            />
            <ZenStatsCard
              icon={Clock}
              label="Pendentes"
              value={totalPending}
              variant="warning"
            />
            <ZenStatsCard
              icon={FileCheck}
              label="Validadas"
              value={totalValidated}
              variant="success"
            />
          </div>

          {/* Create Client Button - Prominent */}
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="w-full h-14 bg-gradient-to-r from-primary to-primary/80 
                       hover:from-primary/90 hover:to-primary/70
                       shadow-lg hover:shadow-xl hover:shadow-primary/20
                       transition-all duration-300 group"
            size="lg"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="font-semibold block">Criar Novo Cliente</span>
                <span className="text-xs opacity-80">Adicione à sua carteira</span>
              </div>
            </div>
          </Button>

          {/* Search Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Ou pesquise clientes existentes</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Pesquisar por NIF, email ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                />
              </div>
              <Button 
                type="button" 
                variant="secondary"
                onClick={handleSearch}
                disabled={isSearching || searchTerm.length < 2}
                className="shadow-md hover:shadow-lg transition-all"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Resultados da pesquisa ({searchResults.length})
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((client) => (
                  <div 
                    key={client.id}
                    className="flex items-center justify-between p-3 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{client.full_name}</p>
                        {client.company_name && (
                          <p className="text-xs text-muted-foreground">{client.company_name}</p>
                        )}
                        <div className="flex gap-2 mt-1">
                          {client.nif && (
                            <Badge variant="outline" className="text-xs border-primary/30">
                              NIF: {client.nif}
                            </Badge>
                          )}
                          {client.email && (
                            <Badge variant="outline" className="text-xs">
                              {client.email}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => associateClient(client.id)}
                      disabled={isAssociating}
                      className="zen-button shadow-md"
                    >
                      {isAssociating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Adicionar</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground text-center">
              Nenhum cliente encontrado com "{searchTerm}"
            </div>
          )}

          {/* Clients List */}
          {clients.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Os Seus Clientes</label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {clients.map((client) => (
                  <div 
                    key={client.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{client.full_name}</p>
                        {client.company_name && (
                          <p className="text-xs text-muted-foreground">{client.company_name}</p>
                        )}
                        {client.nif && (
                          <p className="text-xs text-muted-foreground font-mono">NIF: {client.nif}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {client.pending_invoices > 0 && (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                          {client.pending_invoices} pendentes
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-muted">
                        {client.validated_invoices} validadas
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm"
                            variant="ghost"
                            onClick={() => setClientToEdit(client)}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar cliente</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm"
                            variant="ghost"
                            onClick={() => setClientToRemove(client)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remover cliente</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for accountants without clients */}
          {clients.length === 0 && !isLoadingClients && (
            <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 
                            rounded-xl border-2 border-dashed border-primary/30 text-center">
              <div className="p-4 rounded-full bg-primary/10 w-16 h-16 mx-auto mb-4 
                              flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <p className="font-semibold text-lg mb-2">Sem clientes na carteira</p>
              <p className="text-sm text-muted-foreground mb-4">
                Comece por criar o seu primeiro cliente ou pesquise existentes.
              </p>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="w-full h-12 bg-gradient-to-r from-primary to-primary/80
                           hover:from-primary/90 hover:to-primary/70 shadow-lg"
                size="lg"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Criar o Seu Primeiro Cliente
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                ou use a pesquisa acima para encontrar clientes existentes
              </p>
              <Link to="/accountant/onboarding" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                <HelpCircle className="h-3 w-3" />
                Ver guia completo
              </Link>
            </div>
          )}

          <div className="flex gap-2">
            <Link to="/accountant" className="flex-1">
              <Button className="w-full zen-button gap-2">
                <ExternalLink className="h-4 w-4" />
                Dashboard de Validação
              </Button>
            </Link>
            <Link to="/accountant/onboarding">
              <Button variant="outline" size="icon" className="aspect-square">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </ZenCard>

      {/* Remove Client Confirmation Dialog */}
      <AlertDialog open={!!clientToRemove} onOpenChange={() => setClientToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja remover <strong>{clientToRemove?.full_name}</strong> da sua carteira?
              <br /><br />
              Esta acção não apaga os dados do cliente, apenas remove a associação. 
              O cliente ficará disponível para ser adicionado por outro contabilista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (clientToRemove) {
                  removeClient(clientToRemove.id);
                  setClientToRemove(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Client Dialog */}
      <CreateClientDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          // Invalidate clients query to refresh the list
        }}
      />

      {/* Edit Client Dialog */}
      <EditClientDialog
        open={!!clientToEdit}
        onOpenChange={(open) => !open && setClientToEdit(null)}
        client={clientToEdit}
        onSuccess={() => setClientToEdit(null)}
      />
    </>
  );
}
