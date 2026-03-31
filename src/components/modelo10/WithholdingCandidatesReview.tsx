import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ZenEmptyState, ZenLoader, ZenStatsCard } from '@/components/zen';
import { useWithholdingCandidates, type WithholdingCandidate } from '@/hooks/useWithholdingCandidates';
import { EditWithholdingCandidateDialog } from '@/components/modelo10/EditWithholdingCandidateDialog';
import { cn } from '@/lib/utils';

interface WithholdingCandidatesReviewProps {
  clientId?: string | null;
  fiscalYear: number;
}

type CandidateStatusFilter = 'pending' | 'all' | 'promoted' | 'rejected' | 'skipped';
type CandidateSource = 'explicit' | 'heuristic';

interface CandidateGroup {
  beneficiaryNif: string;
  beneficiaryName: string;
  statusCounts: Record<string, number>;
  totalGross: number;
  totalWithholding: number;
  docs: WithholdingCandidate[];
  highestConfidence: number;
  sources: Set<CandidateSource>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
}

function getCandidateConfidence(candidate: WithholdingCandidate) {
  return Number(candidate.confidence_score ?? candidate.confidence ?? 0);
}

function getCandidateSource(candidate: WithholdingCandidate): CandidateSource {
  return candidate.detected_keys?.includes('withholding:explicit') ? 'explicit' : 'heuristic';
}

function getSourceBadge(candidate: WithholdingCandidate) {
  const source = getCandidateSource(candidate);
  if (source === 'explicit') {
    return <Badge className="bg-emerald-600">AT explícito</Badge>;
  }
  return <Badge variant="outline" className="border-amber-500 text-amber-700">Heurística</Badge>;
}

function getConfidenceBadge(candidate: WithholdingCandidate) {
  const confidence = getCandidateConfidence(candidate);
  const className =
    confidence >= 90
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : confidence >= 70
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';

  return (
    <Badge variant="outline" className={className}>
      {Math.round(confidence)}%
    </Badge>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="border-amber-500 text-amber-700">Pendente</Badge>;
    case 'promoted':
      return <Badge className="bg-emerald-600">Promovido</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rejeitado</Badge>;
    case 'skipped':
      return <Badge variant="secondary">Ignorado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function WithholdingCandidatesReview({
  clientId,
  fiscalYear,
}: WithholdingCandidatesReviewProps) {
  const [statusFilter, setStatusFilter] = useState<CandidateStatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCandidate, setEditingCandidate] = useState<WithholdingCandidate | null>(null);

  const {
    candidates,
    stats,
    isLoading,
    promoteCandidates,
    rejectCandidates,
    updateCandidate,
    isPromoting,
    isRejecting,
    isUpdating,
  } = useWithholdingCandidates({ clientId, fiscalYear });

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (statusFilter !== 'all' && candidate.status !== statusFilter) return false;

      if (!search.trim()) return true;
      const normalize = (s: string) =>
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const query = normalize(search.trim());
      return (
        candidate.beneficiary_nif.toLowerCase().includes(query) ||
        normalize(candidate.beneficiary_name || '').includes(query) ||
        (candidate.document_reference || '').toLowerCase().includes(query)
      );
    });
  }, [candidates, search, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, CandidateGroup>();

    for (const candidate of filteredCandidates) {
      const key = candidate.beneficiary_nif;
      const existing = map.get(key);
      const source = getCandidateSource(candidate);

      if (existing) {
        existing.docs.push(candidate);
        existing.totalGross += Number(candidate.gross_amount || 0);
        existing.totalWithholding += Number(candidate.withholding_amount || 0);
        existing.statusCounts[candidate.status] = (existing.statusCounts[candidate.status] || 0) + 1;
        existing.highestConfidence = Math.max(existing.highestConfidence, getCandidateConfidence(candidate));
        existing.sources.add(source);
      } else {
        map.set(key, {
          beneficiaryNif: candidate.beneficiary_nif,
          beneficiaryName: candidate.beneficiary_name || 'Beneficiário sem nome',
          statusCounts: { [candidate.status]: 1 },
          totalGross: Number(candidate.gross_amount || 0),
          totalWithholding: Number(candidate.withholding_amount || 0),
          docs: [candidate],
          highestConfidence: getCandidateConfidence(candidate),
          sources: new Set([source]),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.totalWithholding !== a.totalWithholding) {
        return b.totalWithholding - a.totalWithholding;
      }
      return a.beneficiaryName.localeCompare(b.beneficiaryName, 'pt');
    });
  }, [filteredCandidates]);

  const selectedCandidates = useMemo(
    () => filteredCandidates.filter((candidate) => selectedIds.has(candidate.id)),
    [filteredCandidates, selectedIds],
  );

  const selectionTotals = useMemo(() => {
    return selectedCandidates.reduce(
      (acc, candidate) => ({
        gross: acc.gross + Number(candidate.gross_amount || 0),
        withholding: acc.withholding + Number(candidate.withholding_amount || 0),
      }),
      { gross: 0, withholding: 0 },
    );
  }, [selectedCandidates]);

  const toggleCandidate = (candidateId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredCandidates.map((candidate) => candidate.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectExplicit = () => {
    setSelectedIds(new Set(
      filteredCandidates
        .filter((candidate) => getCandidateSource(candidate) === 'explicit')
        .map((candidate) => candidate.id),
    ));
  };

  const handlePromote = async (candidateIds: string[]) => {
    await promoteCandidates(candidateIds);
    setSelectedIds(new Set());
  };

  const handleReject = async (candidateIds: string[]) => {
    await rejectCandidates(candidateIds);
    setSelectedIds(new Set());
  };

  if (!clientId) {
    return (
      <ZenEmptyState
        icon={ShieldAlert}
        title="Selecione um cliente"
        description="Escolha explicitamente o cliente antes de rever candidatos de retenção."
      />
    );
  }

  if (isLoading) {
    return <ZenLoader text="A carregar candidatos de retenção..." />;
  }

  return (
    <div className="space-y-6">
      <EditWithholdingCandidateDialog
        candidate={editingCandidate}
        open={!!editingCandidate}
        onOpenChange={(open) => {
          if (!open) setEditingCandidate(null);
        }}
        onSave={updateCandidate}
        isSaving={isUpdating}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <ZenStatsCard label="Pendentes" value={stats.pending} icon={ShieldAlert} variant="warning" />
        <ZenStatsCard label="Beneficiários" value={groups.length} icon={FileSearch} />
        <ZenStatsCard label="Retenção em revisão" value={formatCurrency(filteredCandidates.reduce((sum, row) => sum + Number(row.withholding_amount || 0), 0))} icon={ShieldCheck} variant="success" />
        <ZenStatsCard label="Selecionados" value={formatCurrency(selectionTotals.withholding)} icon={Sparkles} />
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Review operacional de candidatos</CardTitle>
              <CardDescription>
                Reveja, rejeite ou promova retenções antes de fecharem no Modelo 10.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={selectExplicit}>
                Selecionar AT explícitos
              </Button>
              <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                Selecionar filtrados
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Limpar seleção
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr,220px]">
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Pesquisar por NIF, nome ou referência..."
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CandidateStatusFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="promoted">Promovidos</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
                <SelectItem value="skipped">Ignorados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-background/80 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {selectedIds.size} candidato(s) selecionado(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  Bruto {formatCurrency(selectionTotals.gross)} • Retenção {formatCurrency(selectionTotals.withholding)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                  disabled={isRejecting || isPromoting}
                  onClick={() => handleReject(Array.from(selectedIds))}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeitar selecionados
                </Button>
                <Button
                  size="sm"
                  disabled={isRejecting || isPromoting}
                  onClick={() => handlePromote(Array.from(selectedIds))}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Promover selecionados
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {groups.length === 0 ? (
        <ZenEmptyState
          icon={ShieldCheck}
          title="Sem candidatos nesta vista"
          description="Ajuste os filtros ou importe novos candidatos para continuar."
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Beneficiários em revisão</CardTitle>
            <CardDescription>
              Vista principal agrupada por beneficiário para reduzir ruído operacional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {groups.map((group) => (
                <AccordionItem key={group.beneficiaryNif} value={group.beneficiaryNif}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full flex-col gap-3 text-left lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{group.beneficiaryName}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{group.beneficiaryNif}</span>
                          <span>{group.docs.length} doc.</span>
                          <span>{formatCurrency(group.totalWithholding)} retido</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {group.sources.has('explicit') && (
                          <Badge className="bg-emerald-600">AT explícito</Badge>
                        )}
                        {group.sources.has('heuristic') && (
                          <Badge variant="outline" className="border-amber-500 text-amber-700">
                            Heurística
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn(
                          group.highestConfidence >= 90
                            ? 'border-emerald-200 text-emerald-700'
                            : group.highestConfidence >= 70
                              ? 'border-amber-200 text-amber-700'
                              : 'border-rose-200 text-rose-700',
                        )}>
                          até {Math.round(group.highestConfidence)}%
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="w-full">
                      <div className="space-y-3">
                        {group.docs.map((candidate) => {
                          const checked = selectedIds.has(candidate.id);
                          const rawPayload = candidate.raw_payload ? JSON.stringify(candidate.raw_payload, null, 2) : null;

                          return (
                            <div
                              key={candidate.id}
                              className={cn(
                                'rounded-xl border p-4 transition-colors',
                                checked ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-background',
                              )}
                            >
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => toggleCandidate(candidate.id, value === true)}
                                    aria-label={`Selecionar ${candidate.document_reference}`}
                                  />
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium">{candidate.document_reference}</span>
                                      {getStatusBadge(candidate.status)}
                                      {getSourceBadge(candidate)}
                                      {getConfidenceBadge(candidate)}
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                      <span>{format(new Date(candidate.payment_date), 'dd MMM yyyy', { locale: pt })}</span>
                                      <span>Bruto {formatCurrency(Number(candidate.gross_amount || 0))}</span>
                                      <span>Retido {formatCurrency(Number(candidate.withholding_amount || 0))}</span>
                                      <span>Taxa {candidate.withholding_rate ? `${candidate.withholding_rate}%` : 'n/d'}</span>
                                    </div>
                                    {(candidate.detection_reason || candidate.notes) && (
                                      <p className="text-xs text-muted-foreground">
                                        {candidate.detection_reason || candidate.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {candidate.status !== 'promoted' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isPromoting || isRejecting || isUpdating}
                                      onClick={() => setEditingCandidate(candidate)}
                                    >
                                      Editar
                                    </Button>
                                  )}
                                  {candidate.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-rose-200 text-rose-700 hover:bg-rose-50"
                                        disabled={isPromoting || isRejecting || isUpdating}
                                        onClick={() => handleReject([candidate.id])}
                                      >
                                        Rejeitar
                                      </Button>
                                      <Button
                                        size="sm"
                                        disabled={isPromoting || isRejecting || isUpdating}
                                        onClick={() => handlePromote([candidate.id])}
                                      >
                                        Promover
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {rawPayload && (
                                <>
                                  <Separator className="my-3" />
                                  <details className="group">
                                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                      Ver payload técnico
                                    </summary>
                                    <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
                                      {rawPayload}
                                    </pre>
                                  </details>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
