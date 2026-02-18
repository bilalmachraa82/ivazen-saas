/**
 * e-Fatura API Configuration Component
 * Manages AT API credentials for test and production environments
 */

import { useState } from 'react';
import { ZenCard } from '@/components/zen';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  TestTube,
  Lock,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileKey,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EFaturaAPIConfigProps {
  clientId?: string | null;
  environment: 'test' | 'production';
  isConfigured: boolean;
  hasCertificate?: boolean;
  lastSync?: string | null;
  lastSyncStatus?: string | null;
}

export function EFaturaAPIConfig({
  clientId,
  environment,
  isConfigured,
  hasCertificate,
  lastSync,
  lastSyncStatus,
}: EFaturaAPIConfigProps) {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isTest = environment === 'test';

  const handleSaveCredentials = async () => {
    if (!isTest) {
      toast.error('Para produção, configure no fluxo de Certificados + Importação de credenciais');
      return;
    }

    if (!username || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('at_credentials')
        .upsert({
          client_id: clientId || user?.id,
          accountant_id: user?.id,
          encrypted_username: username,
          encrypted_password: password,
          environment,
          last_sync_status: 'never',
        }, {
          onConflict: 'client_id'
        });

      if (error) throw error;

      toast.success('Credenciais guardadas');
      setIsDialogOpen(false);
      setUsername('');
      setPassword('');
    } catch (error: any) {
      toast.error('Erro ao guardar credenciais', {
        description: error.message
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    const effectiveClientId = clientId || user?.id;
    if (!effectiveClientId) {
      toast.error('Utilizador não autenticado');
      return;
    }

    setIsSyncing(true);
    try {
      // For production with certificate: ensure at_credentials row exists linking client to accountant
      // without writing placeholder secrets that can break decrypt on backend.
      if (!isTest && hasCertificate && user?.id) {
        await supabase
          .from('at_credentials')
          .upsert({
            client_id: effectiveClientId,
            accountant_id: user.id,
            encrypted_username: '',
            encrypted_password: '',
            environment: 'production',
            last_sync_status: 'running',
          } as any, {
            onConflict: 'client_id'
          });
      }

      // Always use sync-efatura (handles both test mock and production SOAP)
      const body = {
        clientId: effectiveClientId,
        accountantId: user.id,
        environment: isTest ? 'test' : 'production',
        type: 'ambos' as const,
      };

      const { data, error } = await supabase.functions.invoke('sync-efatura', { body });

      if (error) {
        const errorMsg = typeof error === 'object' && error.message
          ? error.message
          : 'Erro desconhecido';
        throw new Error(errorMsg);
      }

      // Check for errors returned as 200
      if (data?.success === false) {
        toast.error('Erro na sincronização', {
          description: data.error || data.message || 'Verifique as credenciais',
          duration: 8000,
        });
        return;
      }

      // Check for informational messages (e.g., missing config)
      if (data?.missingConfig) {
        toast.warning('Configuração incompleta', {
          description: data.message,
          duration: 8000,
        });
      } else if (data?.count > 0) {
        toast.success('Sincronização concluída', {
          description: `${data.count} facturas importadas${data.skipped ? ` (${data.skipped} duplicadas)` : ''}`,
        });
      } else if (data?.skipped > 0) {
        toast.info('Todas as facturas já existem', {
          description: `${data.skipped} facturas já estavam na base de dados`,
        });
      } else {
        toast.info('Nenhuma factura encontrada', {
          description: data?.message || 'Não foram encontradas facturas no período seleccionado',
        });
      }
    } catch (error: any) {
      toast.error('Erro na sincronização', {
        description: error.message || 'Verifique as credenciais AT'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-PT');
  };

  const getSyncStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      case 'never':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Nunca sincronizado</Badge>;
      default:
        return <Badge variant="outline">{status || 'Desconhecido'}</Badge>;
    }
  };

  return (
    <ZenCard>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isTest ? (
              <TestTube className="h-5 w-5 text-amber-500" />
            ) : (
              <Lock className="h-5 w-5 text-green-500" />
            )}
            <div>
              <CardTitle>
                {isTest ? 'Ambiente de Testes' : 'Ambiente de Produção'}
              </CardTitle>
              <CardDescription>
                {isTest
                  ? 'Certificado pré-configurado (TESTEwebservice)'
                  : hasCertificate
                    ? 'Certificado configurado - pronto para sincronizar'
                    : 'Requer certificado de produção da AT'}
              </CardDescription>
            </div>
          </div>
          {isConfigured && getSyncStatusBadge(lastSyncStatus)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Info */}
        {isConfigured && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <span className="text-muted-foreground">Última sincronização:</span>
              <span className="ml-2 font-medium">{formatLastSync(lastSync)}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {isConfigured ? (
            <>
              <Button onClick={handleSync} disabled={isSyncing}>
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar Agora
              </Button>
              {/* For production with certificate: link to Admin Certificates */}
              {/* For test: show credential config dialog */}
              {!isTest && hasCertificate ? (
                <Button variant="outline" asChild>
                  <a href="/admin/certificates">
                    <Settings className="h-4 w-4 mr-2" />
                    Gerir Certificado
                  </a>
                </Button>
              ) : (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Configurar Credenciais AT</DialogTitle>
                      <DialogDescription>
                        Configure as credenciais do sub-utilizador para o ambiente de testes.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username (Sub-utilizador AT)</Label>
                        <Input
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="NIF/Username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveCredentials} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Guardar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
          ) : !isTest && hasCertificate ? (
            /* Production with certificate but not yet configured for this client - just show sync button */
            <Button onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar Agora
            </Button>
          ) : (
            <>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar Acesso
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {isTest ? 'Configurar Ambiente de Testes' : 'Configurar Ambiente de Produção'}
                    </DialogTitle>
                    <DialogDescription>
                      {isTest
                        ? 'O certificado de testes já está pré-configurado. Apenas precisa das credenciais do sub-utilizador.'
                        : 'Para produção, configure o certificado em Administração > Certificados.'}
                    </DialogDescription>
                  </DialogHeader>

                  {!isTest ? (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FileKey className="h-4 w-4" />
                        Configurar Certificado de Produção
                      </div>
                      <p className="text-sm text-muted-foreground">
                        O certificado digital e as credenciais do sub-utilizador são geridos numa única página dedicada.
                      </p>
                      <Button asChild>
                        <a href="/admin/certificates">
                          <Settings className="h-4 w-4 mr-2" />
                          Ir para Certificados
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="setup-username">Username (Sub-utilizador AT)</Label>
                          <Input
                            id="setup-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="NIF/Username"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="setup-password">Password</Label>
                          <Input
                            id="setup-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveCredentials} disabled={isSaving}>
                          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Guardar e Activar
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>

        {/* Test Environment Note */}
        {isTest && !isConfigured && (
          <div className="text-sm text-muted-foreground p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
            <strong>Nota:</strong> O ambiente de testes usa o certificado público{' '}
            <code className="text-xs bg-muted p-1 rounded">TESTEwebservice</code> e retorna dados fictícios.
            Ideal para validar a integração antes de usar dados reais.
          </div>
        )}

        {/* Security Info for Production */}
        {!isTest && hasCertificate && (
          <div className="text-sm p-3 bg-green-50/50 dark:bg-green-950/20 border border-green-500/30 rounded-lg space-y-2">
            <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-500">
              <CheckCircle className="h-4 w-4" />
              Autenticação por Certificado Digital
            </div>
            <p className="text-muted-foreground">
              A sincronização usa o certificado PFX configurado em Administração &gt; Certificados.
              Não é necessário inserir credenciais adicionais.
            </p>
          </div>
        )}
        {!isTest && !hasCertificate && (
          <div className="text-sm p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-2">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <Lock className="h-4 w-4" />
              Certificado Necessário
            </div>
            <p className="text-muted-foreground">
              Para sincronizar com a AT em produção, configure o certificado digital (PFX) em{' '}
              <a href="/admin/certificates" className="text-primary hover:underline">Administração &gt; Certificados</a>.
            </p>
          </div>
        )}
      </CardContent>
    </ZenCard>
  );
}
