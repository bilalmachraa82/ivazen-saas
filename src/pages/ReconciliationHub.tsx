import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { ReconciliationHealthBanner } from '@/components/reconciliation/ReconciliationHealthBanner';
import { ReconciliationTab } from '@/components/validation/ReconciliationTab';
import { Modelo10ReconciliationPanel } from '@/components/reconciliation/Modelo10ReconciliationPanel';
import { SSReconciliationPanel } from '@/components/reconciliation/SSReconciliationPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ZenEmptyState, ZenSkeleton } from '@/components/zen';
import { ShieldAlert, ArrowLeftRight, FileCheck, Receipt, Users } from 'lucide-react';
import { getQuarterDateRange } from '@/lib/fiscalQuarter';

export default function ReconciliationHub() {
  const { user, roles } = useAuth();
  const { selectedClientId } = useSelectedClient();
  const isAccountant = roles?.includes('accountant');
  const effectiveClientId = isAccountant ? selectedClientId : user?.id;

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);

  const range = getQuarterDateRange(fiscalYear, quarter);

  const { data: reconciliation, isLoading } = useReconciliationData({
    clientId: effectiveClientId,
    fiscalYear,
    quarter,
    rangeStart: range.start,
    rangeEnd: range.end,
  });

  if (isAccountant && !selectedClientId) {
    return (
      <ZenEmptyState
        icon={Users}
        title="Selecione um cliente"
        description="Escolha um cliente para ver a reconciliação fiscal."
      />
    );
  }

  if (!effectiveClientId) {
    return (
      <ZenEmptyState
        icon={ShieldAlert}
        title="Sem contexto"
        description="Não foi possível determinar o cliente."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reconciliação Fiscal</h1>
          <p className="text-sm text-muted-foreground">
            Compare fontes de dados e identifique divergências por obrigação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(fiscalYear)} onValueChange={v => setFiscalYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map(q => (
                <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Health Banner */}
      {isLoading ? (
        <ZenSkeleton className="h-20 w-full" />
      ) : reconciliation ? (
        <ReconciliationHealthBanner data={reconciliation} />
      ) : null}

      {/* Tabs */}
      <Tabs defaultValue="purchases" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="purchases" className="gap-1.5">
            <FileCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">IVA</span> Compras
            {reconciliation && reconciliation.purchases.status !== 'ok' && reconciliation.purchases.status !== 'no_data' && (
              <Badge variant="warning" className="ml-1 h-4 px-1 text-[10px]">!</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="modelo10" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Modelo 10
            {reconciliation && reconciliation.modelo10.nifMismatchCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                {reconciliation.modelo10.nifMismatchCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ss" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Seg. Social
            {reconciliation && reconciliation.ss.status === 'error' && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">!</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AT vs App — Compras</CardTitle>
              <CardDescription>
                Compara facturas importadas da AT com facturas carregadas manualmente.
                Identifica duplicados, divergências de valor e documentos em falta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReconciliationTab clientId={effectiveClientId} rangeStart={range.start} rangeEnd={range.end} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modelo10" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Modelo 10 — AT vs OCR/Manual</CardTitle>
              <CardDescription>
                Compara retenções por beneficiário entre fontes AT (CSV/SIRE) e OCR/manual.
                Delta &gt;€1 por NIF é sinalizado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Modelo10ReconciliationPanel clientId={effectiveClientId} fiscalYear={fiscalYear} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ss" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Segurança Social — Vendas vs Declaração</CardTitle>
              <CardDescription>
                Compara o total de receita de vendas com o valor declarado à Segurança Social
                para o trimestre selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SSReconciliationPanel
                clientId={effectiveClientId}
                fiscalYear={fiscalYear}
                quarter={quarter}
                rangeStart={range.start}
                rangeEnd={range.end}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Auditoria Documental</CardTitle>
              <CardDescription>
                Workflow de reconciliação avançada: carregue um Excel de referência e PDFs
                para comparação detalhada com extracção AI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Para a auditoria documental completa, utilize a{' '}
                <a href="/reconciliation-audit" className="text-primary hover:underline">
                  página de auditoria dedicada
                </a>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
