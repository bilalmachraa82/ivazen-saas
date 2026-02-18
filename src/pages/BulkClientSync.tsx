/**
 * Bulk Client Sync Dashboard
 * Mass synchronization of e-Fatura data for all accountant's clients
 */

import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ZenCard } from '@/components/zen';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  RefreshCw,
  Search,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Upload,
  FileKey,
  Settings,
  Play,
  Pause,
  Zap,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSyncEFatura, useSyncHistory } from '@/hooks/useATCredentials';
import { useBulkSync } from '@/hooks/useBulkSync';
import { ImportCredentialsDialog } from '@/components/settings/ImportCredentialsDialog';
import { ClientSyncStatus, deriveSyncStatus } from '@/components/efatura/ClientSyncStatus';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface ClientWithCredentials {
  id: string;
  full_name: string | null;
  company_name: string | null;
  nif: string | null;
  email: string | null;
  hasCredentials: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  environment?: string;
}

type FilterStatus = 'all' | 'configured' | 'pending' | 'error' | 'never';

export default function BulkClientSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const syncMutation = useSyncEFatura();
  const bulkSync = useBulkSync();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentSyncClient, setCurrentSyncClient] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());

  // Check if user is accountant
  const { data: isAccountant, isLoading: isLoadingRole } = useQuery({
    queryKey: ['is-accountant', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'accountant',
      });
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Check if PFX certificate is configured (1x setup)
  const { data: accountantConfig } = useQuery({
    queryKey: ['accountant-at-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('accountant_at_config')
        .select('id, certificate_cn, subuser_id, is_active, at_public_key_base64, certificate_pfx_base64')
        .eq('accountant_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && isAccountant === true,
  });

  // Get accountant's clients with credential status
  const { data: clients, isLoading: isLoadingClients, refetch: refetchClients } = useQuery({
    queryKey: ['bulk-sync-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get clients from association table
      const { data: clientsData, error: clientsError } = await supabase.rpc('get_accountant_clients', {
        accountant_uuid: user.id,
      });
      
      if (clientsError) throw clientsError;
      if (!clientsData || clientsData.length === 0) return [];

      // Get AT credentials for all clients
      const clientIds = clientsData.map((c: any) => c.id);
      const { data: credentials } = await supabase
        .from('at_credentials')
        .select('client_id, last_sync_at, last_sync_status, last_sync_error, environment')
        .in('client_id', clientIds);

      const credentialsMap = new Map(
        (credentials || []).map(c => [c.client_id, c])
      );

      return clientsData.map((client: any): ClientWithCredentials => {
        const cred = credentialsMap.get(client.id);
        return {
          id: client.id,
          full_name: client.full_name,
          company_name: client.company_name,
          nif: client.nif,
          email: client.email,
          hasCredentials: !!cred,
          lastSyncAt: cred?.last_sync_at || null,
          lastSyncStatus: cred?.last_sync_status || 'never',
          lastSyncError: cred?.last_sync_error || null,
          environment: cred?.environment,
        };
      });
    },
    enabled: !!user?.id && isAccountant === true,
  });

  // Get sync history
  const { data: recentHistory } = useSyncHistory(undefined, 20);

  // Stats
  const stats = useMemo(() => {
    if (!clients) return { total: 0, configured: 0, pending: 0, error: 0, never: 0 };
    
    return {
      total: clients.length,
      configured: clients.filter(c => c.hasCredentials && c.lastSyncStatus === 'success').length,
      pending: clients.filter(c => c.hasCredentials && c.lastSyncStatus === 'partial').length,
      error: clients.filter(c => c.hasCredentials && c.lastSyncStatus === 'error').length,
      never: clients.filter(c => !c.hasCredentials || c.lastSyncStatus === 'never').length,
    };
  }, [clients]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    
    return clients.filter(client => {
      // Search filter
      const matchesSearch = !searchTerm || 
        client.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.nif?.includes(searchTerm);

      // Status filter
      let matchesStatus = true;
      if (filterStatus !== 'all') {
        const status = deriveSyncStatus(client.lastSyncStatus, client.hasCredentials);
        switch (filterStatus) {
          case 'configured':
            matchesStatus = status === 'synced';
            break;
          case 'pending':
            matchesStatus = status === 'pending';
            break;
          case 'error':
            matchesStatus = status === 'error';
            break;
          case 'never':
            matchesStatus = status === 'never';
            break;
        }
      }

      return matchesSearch && matchesStatus;
    });
  }, [clients, searchTerm, filterStatus]);

  // Toggle client selection
  const toggleClient = (clientId: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  // Select all filtered clients with credentials
  const selectAllConfigured = () => {
    const configuredIds = filteredClients
      .filter(c => c.hasCredentials)
      .map(c => c.id);
    setSelectedClients(new Set(configuredIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedClients(new Set());
  };

  // Sync selected clients
  const handleSyncSelected = async () => {
    const clientsToSync = Array.from(selectedClients)
      .map(id => clients?.find(c => c.id === id))
      .filter(c => c && c.hasCredentials) as ClientWithCredentials[];

    if (clientsToSync.length === 0) {
      toast.error('Seleccione clientes com credenciais configuradas');
      return;
    }

    setSyncing(true);
    setSyncProgress(0);

    try {
      for (let i = 0; i < clientsToSync.length; i++) {
        const client = clientsToSync[i];
        setCurrentSyncClient(client.id);
        setSyncProgress(Math.round((i / clientsToSync.length) * 100));

        try {
          await syncMutation.mutateAsync({
            clientId: client.id,
            environment: (client.environment as 'test' | 'production') || 'test',
            type: 'ambos',
          });
        } catch (err: any) {
          console.error(`Sync error for ${client.nif}:`, err.message);
          // Continue with next client
        }
      }

      setSyncProgress(100);
      toast.success(`Sincronização concluída para ${clientsToSync.length} clientes`);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['bulk-sync-clients'] });
      queryClient.invalidateQueries({ queryKey: ['sync-history'] });
    } catch (error: any) {
      toast.error('Erro na sincronização', {
        description: error.message,
      });
    } finally {
      setSyncing(false);
      setCurrentSyncClient(null);
      setSyncProgress(0);
    }
  };

  // Loading state
  if (isLoadingRole || isLoadingClients) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Not an accountant
  if (!isAccountant) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Acesso Restrito</AlertTitle>
          <AlertDescription>
            Esta página é apenas para contabilistas. 
            <Link to="/become-accountant" className="ml-1 underline">
              Tornar-se Contabilista
            </Link>
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6" />
              Sincronização em Massa
            </h1>
            <p className="text-muted-foreground">
              Sincronize dados do e-Fatura para todos os seus clientes
            </p>
          </div>

          <div className="flex gap-2">
            <ImportCredentialsDialog
              trigger={
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Credenciais
                </Button>
              }
              onSuccess={() => refetchClients()}
            />
            <Button variant="outline" asChild>
              <Link to="/admin/certificates">
                <FileKey className="h-4 w-4 mr-2" />
                Configurar PFX
              </Link>
            </Button>
          </div>
        </div>

        {/* Configuration Checklist */}
        <ZenCard className={cn(
          "border-l-4",
          accountantConfig?.certificate_pfx_base64 && accountantConfig?.at_public_key_base64 && accountantConfig?.subuser_id
            ? "border-l-green-500"
            : "border-l-amber-500"
        )}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Configuração para Sincronização</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    {accountantConfig?.certificate_pfx_base64 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span>Certificado PFX</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {accountantConfig?.at_public_key_base64 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span>Chave Pública AT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {accountantConfig?.subuser_id ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span>Sub-utilizador WFA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{clients?.filter(c => c.hasCredentials).length || 0}</Badge>
                    <span>Clientes com credenciais</span>
                  </div>
                </div>
              </div>
              
              {/* 1-Click Sync All Button */}
              <div className="flex items-center gap-2">
                <Select 
                  value={String(fiscalYear)} 
                  onValueChange={(v) => setFiscalYear(Number(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <Calendar className="h-4 w-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2026, 2025, 2024, 2023].map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button 
                  size="lg"
                  disabled={
                    !accountantConfig?.certificate_pfx_base64 || 
                    bulkSync.isStarting || 
                    bulkSync.isActive ||
                    !clients?.some(c => c.hasCredentials)
                  }
                  onClick={() => {
                    const configuredClientIds = clients
                      ?.filter(c => c.hasCredentials)
                      .map(c => c.id) || [];
                    
                    if (configuredClientIds.length === 0) {
                      toast.error('Nenhum cliente com credenciais configuradas');
                      return;
                    }
                    
                    bulkSync.startSync({ 
                      clientIds: configuredClientIds, 
                      fiscalYear 
                    });
                  }}
                >
                  {bulkSync.isStarting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Sincronizar Todos ({clients?.filter(c => c.hasCredentials).length || 0})
                </Button>
              </div>
            </div>
            
            {!accountantConfig?.certificate_pfx_base64 && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Configure o certificado PFX antes de sincronizar.{' '}
                  <Link to="/admin/certificates" className="underline font-medium">
                    Ir para Configuração
                  </Link>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </ZenCard>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <ZenCard gradient="muted" className="cursor-pointer" onClick={() => setFilterStatus('all')}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Clientes</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted" className={cn("cursor-pointer", filterStatus === 'configured' && "ring-2 ring-primary")} onClick={() => setFilterStatus('configured')}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{stats.configured}</div>
              <p className="text-xs text-muted-foreground">Sincronizados</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted" className={cn("cursor-pointer", filterStatus === 'pending' && "ring-2 ring-primary")} onClick={() => setFilterStatus('pending')}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted" className={cn("cursor-pointer", filterStatus === 'error' && "ring-2 ring-primary")} onClick={() => setFilterStatus('error')}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{stats.error}</div>
              <p className="text-xs text-muted-foreground">Com Erro</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted" className={cn("cursor-pointer", filterStatus === 'never' && "ring-2 ring-primary")} onClick={() => setFilterStatus('never')}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{stats.never}</div>
              <p className="text-xs text-muted-foreground">Não Configurados</p>
            </CardContent>
          </ZenCard>
        </div>

        {/* Background Sync Progress */}
        {bulkSync.isActive && bulkSync.progress && (
          <Alert className="border-primary/50 bg-primary/5">
            <Zap className="h-4 w-4 text-primary" />
            <AlertTitle className="flex items-center gap-2">
              Sincronização em Background
              <Badge variant="outline" className="text-xs">
                {bulkSync.progress.completed + bulkSync.progress.errors}/{bulkSync.progress.total}
              </Badge>
            </AlertTitle>
            <AlertDescription>
              <Progress value={bulkSync.progressPercent} className="mt-2 mb-2" />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="text-green-600">{bulkSync.progress.completed} concluídos</span>
                <span className="text-amber-600">{bulkSync.progress.processing} a processar</span>
                <span className="text-muted-foreground">{bulkSync.progress.pending} pendentes</span>
                {bulkSync.progress.errors > 0 && (
                  <span className="text-red-600">{bulkSync.progress.errors} erros</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pode fechar esta página - a sincronização continua em background
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Legacy Sync Progress */}
        {syncing && !bulkSync.isActive && (
          <Alert className="border-primary/50 bg-primary/5">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>A sincronizar...</AlertTitle>
            <AlertDescription>
              <Progress value={syncProgress} className="mt-2 mb-2" />
              <p className="text-sm text-muted-foreground">
                {syncProgress}% concluído
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions Bar */}
        <ZenCard>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 gap-3 items-center">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por nome ou NIF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Filter */}
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="configured">Sincronizados</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="error">Com Erro</SelectItem>
                    <SelectItem value="never">Não Configurados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {/* Fiscal Year Selector */}
                <Select 
                  value={String(fiscalYear)} 
                  onValueChange={(v) => setFiscalYear(Number(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <Calendar className="h-4 w-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2025, 2024, 2023, 2022].map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={selectAllConfigured}>
                  Seleccionar Configurados
                </Button>
                
                {selectedClients.size > 0 && (
                  <>
                    <Button variant="ghost" onClick={clearSelection}>
                      Limpar ({selectedClients.size})
                    </Button>
                    
                    {/* Background Sync Button - NEW! */}
                    <Button 
                      onClick={() => {
                        bulkSync.startSync({
                          clientIds: Array.from(selectedClients),
                          fiscalYear,
                        });
                      }}
                      disabled={bulkSync.isStarting || bulkSync.isActive}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      {bulkSync.isStarting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Sincronizar Todos ({selectedClients.size})
                    </Button>

                    {/* Legacy individual sync */}
                    <Button 
                      variant="outline"
                      onClick={handleSyncSelected}
                      disabled={syncing || bulkSync.isActive}
                    >
                      {syncing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sequencial
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </ZenCard>

        {/* Clients Table */}
        <ZenCard>
          <CardHeader>
            <CardTitle>Clientes ({filteredClients.length})</CardTitle>
            <CardDescription>
              Seleccione os clientes para sincronizar dados do e-Fatura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedClients.size === filteredClients.filter(c => c.hasCredentials).length && selectedClients.size > 0}
                        onCheckedChange={(checked) => {
                          if (checked) selectAllConfigured();
                          else clearSelection();
                        }}
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchTerm || filterStatus !== 'all' 
                          ? 'Nenhum cliente encontrado com os filtros aplicados'
                          : 'Nenhum cliente associado'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => {
                      const status = deriveSyncStatus(client.lastSyncStatus, client.hasCredentials);
                      const isSyncing = currentSyncClient === client.id;

                      return (
                        <TableRow 
                          key={client.id} 
                          className={cn(
                            isSyncing && 'bg-primary/5',
                            !client.hasCredentials && 'opacity-60'
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedClients.has(client.id)}
                              onCheckedChange={() => toggleClient(client.id)}
                              disabled={!client.hasCredentials}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {client.full_name || client.company_name || '—'}
                              </div>
                              {client.email && (
                                <div className="text-xs text-muted-foreground">{client.email}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {client.nif || '—'}
                          </TableCell>
                          <TableCell>
                            <ClientSyncStatus
                              status={status}
                              lastSyncAt={client.lastSyncAt}
                              lastSyncError={client.lastSyncError}
                              isSyncing={isSyncing}
                              compact
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {client.lastSyncAt ? (
                              formatDistanceToNow(new Date(client.lastSyncAt), {
                                addSuffix: true,
                                locale: pt,
                              })
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {client.hasCredentials ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  syncMutation.mutate({
                                    clientId: client.id,
                                    environment: (client.environment as 'test' | 'production') || 'test',
                                    type: 'ambos',
                                  });
                                }}
                                disabled={syncing || syncMutation.isPending}
                              >
                                <RefreshCw className={cn(
                                  "h-4 w-4",
                                  syncMutation.isPending && "animate-spin"
                                )} />
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Sem credenciais
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </ZenCard>

        {/* Recent History */}
        {recentHistory && recentHistory.length > 0 && (
          <ZenCard>
            <CardHeader>
              <CardTitle>Histórico Recente</CardTitle>
              <CardDescription>Últimas sincronizações realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Registos</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">
                          {formatDistanceToNow(new Date(entry.created_at), {
                            addSuffix: true,
                            locale: pt,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {entry.sync_type === 'compras' ? 'Compras' : 
                             entry.sync_type === 'vendas' ? 'Vendas' : 'Ambos'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600">+{entry.records_imported}</span>
                          {entry.records_errors > 0 && (
                            <span className="text-red-600 ml-2">-{entry.records_errors}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.status === 'success' && (
                            <Badge className="bg-green-600">Sucesso</Badge>
                          )}
                          {entry.status === 'partial' && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">Parcial</Badge>
                          )}
                          {entry.status === 'error' && (
                            <Badge variant="destructive">Erro</Badge>
                          )}
                          {entry.status === 'running' && (
                            <Badge variant="secondary">A correr</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </ZenCard>
        )}
      </div>
    </DashboardLayout>
  );
}
