/**
 * e-Fatura Sync Page
 * Hybrid import system: CSV + API Test + API Production
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ZenCard } from '@/components/zen';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileSpreadsheet,
  TestTube,
  Lock,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  ExternalLink,
} from 'lucide-react';
import { EFaturaCSVImporter } from '@/components/efatura/EFaturaCSVImporter';
import { EFaturaAPIConfig } from '@/components/efatura/EFaturaAPIConfig';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { useAuth } from '@/hooks/useAuth';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useATConfig, useSyncHistory } from '@/hooks/useATCredentials';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

type DataSource = 'csv' | 'api_test' | 'api_prod';

export default function EFaturaSync() {
  const { user, roles } = useAuth();
  const isAccountant = roles?.includes('accountant');
  const [selectedSource, setSelectedSource] = useState<DataSource>('csv');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);

  // Client management (same pattern as Modelo10)
  const { clients, isLoadingClients } = useClientManagement();

  // Default selection for accountants
  useEffect(() => {
    if (!isAccountant || !user?.id || selectedClientId) return;
    if (isLoadingClients) return;

    if (clients.length > 0) {
      setSelectedClientId(clients[0].id);
    } else {
      setSelectedClientId(user.id);
    }
  }, [isAccountant, user?.id, selectedClientId, isLoadingClients, clients]);

  // Check AT credentials status
  const effectiveClientId = selectedClientId || user?.id;

  const { data: atCredentials } = useQuery({
    queryKey: ['at-credentials', effectiveClientId],
    queryFn: async () => {
      if (!effectiveClientId) return null;
      
      const { data, error } = await supabase
        .from('at_credentials')
        .select('*')
        .eq('client_id', effectiveClientId)
        .limit(1);

      if (error) throw error;
      return (data && data.length > 0) ? data[0] : null;
    },
    enabled: !!effectiveClientId,
  });

  // Check accountant_at_config for certificate status
  const { data: atConfig } = useATConfig();

  const hasTestCredentials = atCredentials?.environment === 'test';
  const hasProdCredentials = atCredentials?.environment === 'production';
  const hasProdCertificate = !!atConfig?.is_active && !!atConfig?.certificate_pfx_base64;

  // Quick stats for current client
  const { data: quickStats } = useQuery({
    queryKey: ['efatura-quick-stats', effectiveClientId],
    queryFn: async () => {
      if (!effectiveClientId) return { imported: 0, classified: 0, pending: 0, vatDeductible: 0 };
      const { data, error } = await supabase
        .from('invoices')
        .select('status, ai_confidence, total_vat, ai_deductibility')
        .eq('client_id', effectiveClientId);
      if (error || !data) return { imported: 0, classified: 0, pending: 0, vatDeductible: 0 };
      const imported = data.length;
      const classified = data.filter(i => i.ai_confidence && i.ai_confidence >= 80).length;
      const pending = data.filter(i => i.status === 'pending' || i.status === 'classified').length;
      const vatDeductible = data
        .filter(i => i.status === 'validated')
        .reduce((sum, i) => sum + (i.total_vat || 0) * ((i.ai_deductibility || 0) / 100), 0);
      return { imported, classified, pending, vatDeductible };
    },
    enabled: !!effectiveClientId,
  });

  // Sync history
  const { data: syncHistory } = useSyncHistory(effectiveClientId || undefined, 5);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">e-Fatura</h1>
            <p className="text-muted-foreground">
              Importe dados do Portal das Finanças para classificação automática
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Client selector (for accountants) - using ClientSearchSelector */}
            {isAccountant && (
              <ClientSearchSelector
                clients={clients}
                selectedClientId={selectedClientId}
                onSelect={setSelectedClientId}
                isLoading={isLoadingClients}
                showOwnAccount={true}
                ownAccountId={user?.id}
                ownAccountLabel="Minha conta"
                placeholder="Selecionar cliente..."
              />
            )}

            {/* Period selector */}
            <Select
              value={`${selectedYear}-Q${selectedQuarter}`}
              onValueChange={(v) => {
                const [year, q] = v.split('-Q');
                setSelectedYear(parseInt(year));
                setSelectedQuarter(parseInt(q));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1].map((year) =>
                  [1, 2, 3, 4].map((q) => (
                    <SelectItem key={`${year}-Q${q}`} value={`${year}-Q${q}`}>
                      {q}º Trimestre {year}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Source Tabs */}
        <Tabs value={selectedSource} onValueChange={(v) => setSelectedSource(v as DataSource)}>
          <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
            <TabsTrigger value="csv" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">CSV Import</span>
              <span className="sm:hidden">CSV</span>
            </TabsTrigger>
            <TabsTrigger value="api_test" className="gap-2">
              <TestTube className="h-4 w-4" />
              <span className="hidden sm:inline">API Testes</span>
              <span className="sm:hidden">Testes</span>
            </TabsTrigger>
            <TabsTrigger value="api_prod" className="gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">API Produção</span>
              <span className="sm:hidden">Prod</span>
            </TabsTrigger>
          </TabsList>

          {/* CSV Import */}
          <TabsContent value="csv" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Import Manual via CSV</AlertTitle>
              <AlertDescription>
                Exporte os dados do{' '}
                <a
                  href="https://faturas.portaldasfinancas.gov.pt/consultarDespesasAdquirente.action"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Portal das Finanças
                  <ExternalLink className="h-3 w-3" />
                </a>{' '}
                e carregue aqui para classificação automática.
              </AlertDescription>
            </Alert>

            <EFaturaCSVImporter
              clientId={effectiveClientId}
              year={selectedYear}
              quarter={selectedQuarter}
            />
          </TabsContent>

          {/* API Test Environment */}
          <TabsContent value="api_test" className="space-y-4">
            <Alert variant="default" className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
              <TestTube className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-700 dark:text-yellow-500">Ambiente de Testes</AlertTitle>
              <AlertDescription className="text-yellow-600 dark:text-yellow-400">
                O ambiente de testes usa um certificado pré-configurado e retorna dados fictícios.
                Ideal para testar a integração antes de activar a produção.
              </AlertDescription>
            </Alert>

            <EFaturaAPIConfig
              clientId={effectiveClientId}
              environment="test"
              isConfigured={hasTestCredentials}
              lastSync={atCredentials?.last_sync_at}
              lastSyncStatus={atCredentials?.last_sync_status}
            />
          </TabsContent>

          {/* API Production */}
          <TabsContent value="api_prod" className="space-y-4">
            {hasProdCertificate ? (
              <Alert className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700 dark:text-green-500">Certificado Configurado</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-400">
                  O ambiente de produção está activo. Os dados sincronizados são reais.
                </AlertDescription>
              </Alert>
            ) : hasProdCredentials ? (
              <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-500">Credenciais Configuradas - Certificado em Falta</AlertTitle>
                <AlertDescription className="text-amber-600 dark:text-amber-400">
                  As credenciais do sub-utilizador estão configuradas, mas o certificado digital (PFX) e a chave pública AT ainda não foram carregados.
                  Configure-os em Administração &gt; Certificados.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Certificado de Produção Necessário</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Para aceder a dados reais, precisa de um certificado digital da AT.</p>
                  <div className="mt-3 p-3 bg-muted/50 rounded-md text-sm space-y-2">
                    <p className="font-medium">Como obter:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Gere um ficheiro CSR (Certificate Signing Request)</li>
                      <li>Envie email para <span className="font-mono">asi-cd@at.gov.pt</span></li>
                      <li>Aguarde resposta (1-3 dias úteis)</li>
                      <li>Configure o certificado recebido</li>
                    </ol>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <EFaturaAPIConfig
              clientId={effectiveClientId}
              environment="production"
              isConfigured={hasProdCertificate || hasProdCredentials}
              hasCertificate={hasProdCertificate}
              lastSync={atCredentials?.last_sync_at}
              lastSyncStatus={atCredentials?.last_sync_status}
            />
          </TabsContent>
        </Tabs>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <ZenCard gradient="muted">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{quickStats?.imported ?? 0}</div>
              <p className="text-xs text-muted-foreground">Facturas Importadas</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{quickStats?.classified ?? 0}</div>
              <p className="text-xs text-muted-foreground">Auto-classificadas</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-warning">{quickStats?.pending ?? 0}</div>
              <p className="text-xs text-muted-foreground">Pendentes Validação</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">
                {(quickStats?.vatDeductible ?? 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
              </div>
              <p className="text-xs text-muted-foreground">IVA Dedutível</p>
            </CardContent>
          </ZenCard>
        </div>

        {/* Sync History */}
        {syncHistory && syncHistory.length > 0 && (
          <ZenCard>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Sincronizações</CardTitle>
              <CardDescription>Últimas sincronizações realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {syncHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        entry.status === 'success' ? 'default' :
                        entry.status === 'error' ? 'destructive' :
                        entry.status === 'running' ? 'secondary' : 'outline'
                      } className={entry.status === 'success' ? 'bg-green-600' : ''}>
                        {entry.status === 'success' ? 'Sucesso' :
                         entry.status === 'error' ? 'Erro' :
                         entry.status === 'running' ? 'A correr' :
                         entry.status === 'partial' ? 'Parcial' : entry.status}
                      </Badge>
                      <div className="text-sm">
                        <span className="font-medium capitalize">{entry.sync_type}</span>
                        <span className="text-muted-foreground ml-2">
                          via {
                            entry.sync_method === 'api'
                              ? 'API'
                              : entry.sync_method === 'csv'
                                ? 'CSV'
                                : entry.sync_method === 'portal'
                                  ? 'Portal'
                                  : 'Manual'
                          }
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {entry.records_imported > 0 && (
                        <span className="text-green-600 font-medium">+{entry.records_imported}</span>
                      )}
                      {entry.records_errors > 0 && (
                        <span className="text-red-600">{entry.records_errors} erros</span>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: pt })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </ZenCard>
        )}
      </div>
    </DashboardLayout>
  );
}
