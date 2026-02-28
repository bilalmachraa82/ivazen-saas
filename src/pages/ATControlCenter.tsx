import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ZenCard } from '@/components/zen';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, RefreshCw, Search, Download, ShieldAlert, ShieldCheck, Clock3, Wrench } from 'lucide-react';
import { useATControlCenter } from '@/hooks/useATControlCenter';
import { useBulkSync } from '@/hooks/useBulkSync';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os estados' },
  { value: 'auth_failed', label: 'Credenciais inválidas' },
  { value: 'error', label: 'Erro técnico' },
  { value: 'no_credentials', label: 'Sem credenciais' },
  { value: 'processing', label: 'Em processamento' },
  { value: 'queued', label: 'Em fila' },
  { value: 'partial', label: 'Parcial' },
  { value: 'success', label: 'Sucesso' },
  { value: 'never', label: 'Nunca sincronizado' },
] as const;

function toCsvValue(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function ATControlCenter() {
  const navigate = useNavigate();
  const bulkSync = useBulkSync();
  const currentYear = new Date().getFullYear();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [reason, setReason] = useState('all');

  const { rows, stats, reasonOptions, isLoading, isRefetching, refetch, promoteCandidates, isPromoting } =
    useATControlCenter({
      search,
      status: status === 'all' ? '' : status,
      reason: reason === 'all' ? '' : reason,
      page: 1,
      pageSize: 200,
    });

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aAttention = ['auth_failed', 'error', 'no_credentials'].includes(a.operational_status) ? 0 : 1;
      const bAttention = ['auth_failed', 'error', 'no_credentials'].includes(b.operational_status) ? 0 : 1;
      if (aAttention !== bAttention) return aAttention - bAttention;
      return (b.last_sync_at || '').localeCompare(a.last_sync_at || '');
    });
  }, [rows]);

  const exportCsv = () => {
    if (sortedRows.length === 0) {
      toast.info('Sem linhas para exportar');
      return;
    }

    const header = [
      'client_name',
      'client_nif',
      'operational_status',
      'last_reason_code',
      'last_sync_status',
      'compras_total',
      'vendas_total',
      'withholdings_total',
      'withholding_candidates_pending',
      'jobs_pending',
      'jobs_processing',
      'jobs_error',
      'last_sync_at',
    ];

    const lines = [header.join(',')];
    for (const row of sortedRows) {
      lines.push([
        row.client_name,
        row.client_nif,
        row.operational_status,
        row.last_reason_code,
        row.last_sync_status,
        row.compras_total,
        row.vendas_total,
        row.withholdings_total,
        row.withholding_candidates_pending,
        row.jobs_pending,
        row.jobs_processing,
        row.jobs_error,
        row.last_sync_at,
      ].map(toCsvValue).join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `at-control-center-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const startSingleSync = async (clientId: string, fiscalYear: number) => {
    try {
      await bulkSync.startSyncAsync({ clientIds: [clientId], fiscalYear });
    } catch {
      // toast handled in hook
    }
  };

  const promoteClientCandidates = async (clientId: string) => {
    await promoteCandidates({ clientId, mode: 'manual_approve' });
    await refetch();
  };

  const getStatusBadge = (value: string) => {
    switch (value) {
      case 'success':
        return <Badge className="bg-green-600">Sucesso</Badge>;
      case 'partial':
        return <Badge variant="outline">Parcial</Badge>;
      case 'processing':
        return <Badge variant="outline" className="border-primary text-primary">Processando</Badge>;
      case 'queued':
        return <Badge variant="secondary">Em fila</Badge>;
      case 'auth_failed':
        return <Badge variant="destructive">Credenciais</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'no_credentials':
        return <Badge variant="secondary">Sem credenciais</Badge>;
      default:
        return <Badge variant="outline">{value}</Badge>;
    }
  };

  const needsAttention = stats.requires_attention > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">AT Control Center</h1>
            <p className="text-sm text-muted-foreground">
              Painel operacional único para sincronização AT, retenções e reconciliação fiscal.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              {isRefetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {needsAttention && (
          <Alert className="border-destructive/40 bg-destructive/5">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Clientes que requerem ação</AlertTitle>
            <AlertDescription>
              {stats.requires_attention} cliente(s) com bloqueio operacional. Priorize credenciais AT e erros técnicos.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <ZenCard gradient="muted">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total_clients}</div>
              <p className="text-xs text-muted-foreground">Clientes monitorizados</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.with_credentials}</div>
              <p className="text-xs text-muted-foreground">Com credenciais</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.requires_attention}</div>
              <p className="text-xs text-muted-foreground">Requerem atenção</p>
            </CardContent>
          </ZenCard>
          <ZenCard gradient="muted">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.status_counts.success || 0}</div>
              <p className="text-xs text-muted-foreground">Sucesso recente</p>
            </CardContent>
          </ZenCard>
        </div>

        <ZenCard>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>
              Filtre por cliente, estado operacional ou reason code.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, NIF ou email"
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Estado operacional" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Reason code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os reason codes</SelectItem>
                {reasonOptions.map((reasonCode) => (
                  <SelectItem key={reasonCode} value={reasonCode}>{reasonCode}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </ZenCard>

        <ZenCard>
          <CardHeader>
            <CardTitle className="text-base">Operação por Cliente</CardTitle>
            <CardDescription>
              Re-sync, promoção de candidatos de retenção e ações corretivas num único painel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Sem dados para os filtros selecionados.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cobertura</TableHead>
                    <TableHead>Retenções</TableHead>
                    <TableHead>Fila</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row) => (
                    <TableRow key={row.client_id}>
                      <TableCell>
                        <div className="font-medium">{row.client_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.client_nif || 'NIF n/d'} {row.client_email ? `• ${row.client_email}` : ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Último sync: {row.last_sync_at ? formatDistanceToNow(new Date(row.last_sync_at), { addSuffix: true, locale: pt }) : 'Nunca'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(row.operational_status)}
                          {row.last_reason_code ? (
                            <Badge variant="outline" className="font-mono text-xs">{row.last_reason_code}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div>Compras: <strong>{row.compras_total}</strong></div>
                          <div>Vendas: <strong>{row.vendas_total}</strong></div>
                          <div>M10/SS: <strong>{row.withholdings_total}</strong></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div>Pendentes revisão: <strong>{row.withholding_candidates_pending}</strong></div>
                          <div>Alta confiança: <strong>{row.withholding_candidates_high_confidence}</strong></div>
                          <div>Rejeitadas: <strong>{row.withholding_candidates_rejected}</strong></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div>Pending: <strong>{row.jobs_pending}</strong></div>
                          <div>Processing: <strong>{row.jobs_processing}</strong></div>
                          <div>Erros: <strong>{row.jobs_error}</strong></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startSingleSync(row.client_id, currentYear)}
                            disabled={bulkSync.isStarting}
                          >
                            <Clock3 className="h-4 w-4 mr-1" />
                            {currentYear}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startSingleSync(row.client_id, currentYear - 1)}
                            disabled={bulkSync.isStarting}
                          >
                            <Clock3 className="h-4 w-4 mr-1" />
                            {currentYear - 1}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => promoteClientCandidates(row.client_id)}
                            disabled={isPromoting || row.withholding_candidates_pending === 0}
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            Promover
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate('/settings')}
                          >
                            <Wrench className="h-4 w-4 mr-1" />
                            Corrigir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </ZenCard>
      </div>
    </DashboardLayout>
  );
}

