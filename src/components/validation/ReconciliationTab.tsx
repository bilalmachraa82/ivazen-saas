import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZenEmptyState, ZenSkeleton } from '@/components/zen';
import { AlertTriangle, CheckCircle, ArrowLeftRight, Trash2, Upload, Globe, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { enrichSupplierNames, getSupplierDisplayName } from '@/lib/supplierNameResolver';

interface ReconciliationTabProps {
  clientId: string;
  rangeStart?: string;
  rangeEnd?: string;
  onCleanupComplete?: () => void | Promise<void>;
  onOpenInvoice?: (invoiceId: string) => void;
}

interface InvoiceMatch {
  id: string;
  supplier_nif: string;
  supplier_name: string | null;
  document_date: string;
  document_number: string | null;
  total_amount: number;
  efatura_source: string | null;
  status: string;
  atcud: string | null;
}

type ReconciliationCategory = 'duplicates' | 'at_only' | 'upload_only' | 'divergent';
type MatchedPair = { upload: InvoiceMatch; at: InvoiceMatch };

const fmt = (n: number) => `€${Number(n).toFixed(2)}`;
const normalizeMatchText = (value: string | null | undefined) =>
  (value || '').trim().toUpperCase();
const normalizeDocumentNumber = (value: string | null | undefined) =>
  normalizeMatchText(value).replace(/\s+/g, '');
const getWeakMatchIdentity = (invoice: InvoiceMatch) =>
  normalizeMatchText(invoice.supplier_nif) || normalizeMatchText(invoice.supplier_name);
const getSupplierSortKey = (invoice: InvoiceMatch) =>
  getSupplierDisplayName(invoice.supplier_name, invoice.supplier_nif).toLocaleLowerCase('pt-PT');
const getAmountValue = (invoice: InvoiceMatch) => Number(invoice.total_amount || 0);

function compareInvoices(a: InvoiceMatch, b: InvoiceMatch): number {
  return (
    getSupplierSortKey(a).localeCompare(getSupplierSortKey(b), 'pt-PT')
    || (a.document_date || '').localeCompare(b.document_date || '')
    || normalizeDocumentNumber(a.document_number).localeCompare(normalizeDocumentNumber(b.document_number), 'pt-PT')
    || getAmountValue(a) - getAmountValue(b)
  );
}

function getStrongMatchKey(invoice: InvoiceMatch, kind: 'atcud' | 'document'): string | null {
  if (kind === 'atcud') {
    const atcud = normalizeMatchText(invoice.atcud);
    return atcud ? `ATCUD|${atcud}` : null;
  }

  const identity = getWeakMatchIdentity(invoice);
  const documentNumber = normalizeDocumentNumber(invoice.document_number);
  if (!identity || !documentNumber) return null;

  return `DOC|${identity}|${documentNumber}`;
}

function pairByStrongKey(
  uploads: InvoiceMatch[],
  atInvoices: InvoiceMatch[],
  kind: 'atcud' | 'document',
): { pairs: MatchedPair[]; uploads: InvoiceMatch[]; atInvoices: InvoiceMatch[] } {
  const atBuckets = new Map<string, InvoiceMatch[]>();
  const atWithoutKey: InvoiceMatch[] = [];

  atInvoices.forEach((invoice) => {
    const key = getStrongMatchKey(invoice, kind);
    if (!key) {
      atWithoutKey.push(invoice);
      return;
    }

    const bucket = atBuckets.get(key) || [];
    bucket.push(invoice);
    atBuckets.set(key, bucket);
  });

  const pairs: MatchedPair[] = [];
  const unmatchedUploads: InvoiceMatch[] = [];

  uploads.forEach((invoice) => {
    const key = getStrongMatchKey(invoice, kind);
    if (!key) {
      unmatchedUploads.push(invoice);
      return;
    }

    const bucket = atBuckets.get(key);
    if (bucket && bucket.length > 0) {
      const [matchedAt, ...rest] = bucket.sort(compareInvoices);
      pairs.push({ upload: invoice, at: matchedAt });

      if (rest.length > 0) {
        atBuckets.set(key, rest);
      } else {
        atBuckets.delete(key);
      }
      return;
    }

    unmatchedUploads.push(invoice);
  });

  const unmatchedAt = [
    ...atWithoutKey,
    ...Array.from(atBuckets.values()).flat(),
  ];

  return {
    pairs,
    uploads: unmatchedUploads,
    atInvoices: unmatchedAt,
  };
}

function getWeakMatchGroupKey(invoice: InvoiceMatch): string | null {
  const identity = getWeakMatchIdentity(invoice);
  const documentDate = invoice.document_date || '';
  return identity && documentDate ? `${identity}|${documentDate}` : null;
}

function selectClosestAtMatch(upload: InvoiceMatch, candidates: InvoiceMatch[]): number {
  if (candidates.length === 0) return -1;

  const uploadAtcud = normalizeMatchText(upload.atcud);
  if (uploadAtcud) {
    const atcudIndex = candidates.findIndex(
      (candidate) => normalizeMatchText(candidate.atcud) === uploadAtcud,
    );
    if (atcudIndex >= 0) return atcudIndex;
  }

  const uploadDocumentNumber = normalizeDocumentNumber(upload.document_number);
  if (uploadDocumentNumber) {
    const documentIndex = candidates.findIndex(
      (candidate) => normalizeDocumentNumber(candidate.document_number) === uploadDocumentNumber,
    );
    if (documentIndex >= 0) return documentIndex;
  }

  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate, index) => {
    const amountDiff = Math.abs(getAmountValue(upload) - getAmountValue(candidate));
    const candidateDocumentNumber = normalizeDocumentNumber(candidate.document_number);
    const sameDocumentPenalty =
      uploadDocumentNumber && candidateDocumentNumber && uploadDocumentNumber !== candidateDocumentNumber
        ? 1000
        : 0;
    const score = sameDocumentPenalty + amountDiff;

    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function pairByWeakMatch(
  uploads: InvoiceMatch[],
  atInvoices: InvoiceMatch[],
): { pairs: MatchedPair[]; uploads: InvoiceMatch[]; atInvoices: InvoiceMatch[] } {
  const atBuckets = new Map<string, InvoiceMatch[]>();
  const atWithoutGroup: InvoiceMatch[] = [];

  atInvoices.forEach((invoice) => {
    const key = getWeakMatchGroupKey(invoice);
    if (!key) {
      atWithoutGroup.push(invoice);
      return;
    }

    const bucket = atBuckets.get(key) || [];
    bucket.push(invoice);
    atBuckets.set(key, bucket.sort(compareInvoices));
  });

  const pairs: MatchedPair[] = [];
  const unmatchedUploads: InvoiceMatch[] = [];

  uploads
    .slice()
    .sort(compareInvoices)
    .forEach((invoice) => {
      const key = getWeakMatchGroupKey(invoice);
      if (!key) {
        unmatchedUploads.push(invoice);
        return;
      }

      const bucket = atBuckets.get(key);
      if (!bucket || bucket.length === 0) {
        unmatchedUploads.push(invoice);
        return;
      }

      const matchIndex = selectClosestAtMatch(invoice, bucket);
      if (matchIndex < 0) {
        unmatchedUploads.push(invoice);
        return;
      }

      const [matchedAt] = bucket.splice(matchIndex, 1);
      pairs.push({ upload: invoice, at: matchedAt });

      if (bucket.length === 0) {
        atBuckets.delete(key);
      }
    });

  const unmatchedAt = [
    ...atWithoutGroup,
    ...Array.from(atBuckets.values()).flat(),
  ];

  return {
    pairs,
    uploads: unmatchedUploads,
    atInvoices: unmatchedAt,
  };
}

export function ReconciliationTab({
  clientId,
  rangeStart,
  rangeEnd,
  onCleanupComplete,
  onOpenInvoice,
}: ReconciliationTabProps) {
  const [activeCategory, setActiveCategory] = useState<ReconciliationCategory>('duplicates');
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  // Fetch invoices for the client (period-filtered when range provided)
  const { data: allInvoices = [], isLoading, refetch } = useQuery({
    queryKey: ['reconciliation-invoices', clientId, rangeStart, rangeEnd],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('id, supplier_nif, supplier_name, document_date, document_number, total_amount, efatura_source, status, atcud')
        .eq('client_id', clientId)
        .in('status', ['pending', 'classified', 'validated']);
      if (rangeStart) query = query.gte('document_date', rangeStart);
      if (rangeEnd) query = query.lte('document_date', rangeEnd);
      query = query.order('document_date', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return enrichSupplierNames((data || []) as InvoiceMatch[]);
    },
    enabled: !!clientId,
  });

  // Reconciliation analysis
  const { duplicates, atOnly, uploadOnly, divergent } = useMemo(() => {
    const duplicates: Array<{ original: InvoiceMatch; duplicate: InvoiceMatch }> = [];
    const atInvoices: InvoiceMatch[] = [];
    const uploadInvoices: InvoiceMatch[] = [];

    // Separate by efatura_source (AT origin vs manual upload)
    allInvoices.forEach(inv => {
      const src = (inv.efatura_source || 'manual').toLowerCase();
      if (src === 'webservice' || src === 'csv_portal') {
        atInvoices.push(inv);
      } else {
        uploadInvoices.push(inv);
      }
    });

    // Find duplicates (same NIF + date + amount within all invoices)
    const seen = new Map<string, InvoiceMatch>();
    allInvoices.forEach(inv => {
      const nif = (inv.supplier_nif || '').trim();
      const date = inv.document_date || '';
      const amount = Number(inv.total_amount).toFixed(2);
      const docNum = (inv.document_number || '').trim();
      const atcud = (inv.atcud || '').trim();

      // Key by ATCUD if available, otherwise by NIF+docNum+date, fallback NIF+date+amount
      const key = atcud
        ? `ATCUD|${atcud}`
        : docNum
          ? `DOC|${nif}|${docNum}|${date}`
          : `AMOUNT|${nif}|${date}|${amount}`;

      const existing = seen.get(key);
      if (existing) {
        duplicates.push({ original: existing, duplicate: inv });
      } else {
        seen.set(key, inv);
      }
    });

    const atSorted = atInvoices.slice().sort(compareInvoices);
    const uploadSorted = uploadInvoices.slice().sort(compareInvoices);
    const atcudPass = pairByStrongKey(uploadSorted, atSorted, 'atcud');
    const documentPass = pairByStrongKey(atcudPass.uploads, atcudPass.atInvoices, 'document');
    const weakPass = pairByWeakMatch(documentPass.uploads, documentPass.atInvoices);
    const matchedPairs = [
      ...atcudPass.pairs,
      ...documentPass.pairs,
      ...weakPass.pairs,
    ];

    const divergent = matchedPairs
      .map(({ upload, at }) => {
        const uploadAmount = getAmountValue(upload);
        const atAmount = getAmountValue(at);
        const diff = Math.abs(uploadAmount - atAmount);
        const maxAmount = Math.max(Math.abs(uploadAmount), Math.abs(atAmount));

        if (maxAmount === 0 || diff / maxAmount <= 0.05) {
          return null;
        }

        return { upload, at, diff };
      })
      .filter((entry): entry is { upload: InvoiceMatch; at: InvoiceMatch; diff: number } => entry !== null)
      .sort((a, b) => compareInvoices(a.upload, b.upload) || b.diff - a.diff);

    return {
      duplicates: duplicates.sort((a, b) => compareInvoices(a.duplicate, b.duplicate)),
      atOnly: weakPass.atInvoices.slice().sort(compareInvoices),
      uploadOnly: weakPass.uploads.slice().sort(compareInvoices),
      divergent,
    };
  }, [allInvoices]);

  const handleRemoveDuplicate = async (id: string) => {
    setRemovingIds(prev => new Set(prev).add(id));
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover duplicado');
    } else {
      toast.success('Duplicado removido');
      await refetch();
      await Promise.resolve(onCleanupComplete?.());
    }
    setRemovingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const categories = [
    { key: 'duplicates' as const, label: 'Duplicados', count: duplicates.length, icon: Trash2, variant: 'destructive' as const },
    { key: 'upload_only' as const, label: 'Só Upload', count: uploadOnly.length, icon: Upload, variant: 'warning' as const },
    { key: 'at_only' as const, label: 'Só AT', count: atOnly.length, icon: Globe, variant: 'secondary' as const },
    { key: 'divergent' as const, label: 'Divergência', count: divergent.length, icon: ArrowLeftRight, variant: 'warning' as const },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ZenSkeleton className="h-12 w-full" />
        <ZenSkeleton className="h-12 w-full" />
        <ZenSkeleton className="h-12 w-full" />
      </div>
    );
  }

  const totalIssues = duplicates.length + uploadOnly.length + divergent.length;
  const getSupplierLabel = (supplierName: string | null, supplierNif: string | null) =>
    getSupplierDisplayName(supplierName, supplierNif);
  const canOpenInvoice = typeof onOpenInvoice === 'function';
  const openInvoice = (invoiceId: string) => onOpenInvoice?.(invoiceId);

  if (totalIssues === 0 && atOnly.length === 0) {
    return (
      <ZenEmptyState
        icon={CheckCircle}
        title="Tudo reconciliado"
        description="Não foram encontradas divergências, duplicados ou facturas em falta."
        variant="success"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <Button
            key={cat.key}
            variant={activeCategory === cat.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(cat.key)}
            className="gap-1.5"
          >
            <cat.icon className="h-3.5 w-3.5" />
            {cat.label}
            {cat.count > 0 && (
              <Badge variant={cat.variant} className="ml-1 h-5 px-1.5 text-xs">
                {cat.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Duplicates */}
      {activeCategory === 'duplicates' && (
        duplicates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum duplicado encontrado.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map(({ duplicate }) => (
                  <TableRow key={duplicate.id}>
                    <TableCell>
                      {duplicate.document_date ? format(new Date(duplicate.document_date), 'dd/MM/yyyy', { locale: pt }) : '—'}
                    </TableCell>
                    <TableCell>{getSupplierLabel(duplicate.supplier_name, duplicate.supplier_nif)}</TableCell>
                    <TableCell className="font-mono text-sm">{duplicate.supplier_nif}</TableCell>
                    <TableCell className="text-right">{fmt(duplicate.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {duplicate.efatura_source === 'webservice' ? 'AT SOAP' : duplicate.efatura_source === 'csv_portal' ? 'AT CSV' : 'Upload'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openInvoice(duplicate.id)} disabled={!canOpenInvoice}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Abrir
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveDuplicate(duplicate.id)}
                          disabled={removingIds.has(duplicate.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* Upload only (not in AT) */}
      {activeCategory === 'upload_only' && (
        uploadOnly.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Todas as facturas enviadas têm correspondência na AT.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Facturas carregadas sem correspondência na AT — possível factura não comunicada.
            </p>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acção</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadOnly.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        {inv.document_date ? format(new Date(inv.document_date), 'dd/MM/yyyy', { locale: pt }) : '—'}
                      </TableCell>
                      <TableCell>{getSupplierLabel(inv.supplier_name, inv.supplier_nif)}</TableCell>
                      <TableCell className="font-mono text-sm">{inv.supplier_nif}</TableCell>
                      <TableCell className="text-right">{fmt(inv.total_amount)}</TableCell>
                      <TableCell><Badge variant="outline">{inv.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openInvoice(inv.id)} disabled={!canOpenInvoice}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      )}

      {/* AT only (not uploaded) */}
      {activeCategory === 'at_only' && (
        atOnly.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Todas as facturas AT têm correspondência local.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              Facturas da AT sem upload correspondente (normal se sincronizadas automaticamente).
            </p>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acção</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atOnly.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        {inv.document_date ? format(new Date(inv.document_date), 'dd/MM/yyyy', { locale: pt }) : '—'}
                      </TableCell>
                      <TableCell>{getSupplierLabel(inv.supplier_name, inv.supplier_nif)}</TableCell>
                      <TableCell className="font-mono text-sm">{inv.supplier_nif}</TableCell>
                      <TableCell className="text-right">{fmt(inv.total_amount)}</TableCell>
                      <TableCell><Badge variant="outline">{inv.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openInvoice(inv.id)} disabled={!canOpenInvoice}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      )}

      {/* Divergent values */}
      {activeCategory === 'divergent' && (
        divergent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma divergência de valores encontrada.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Facturas pareadas por ATCUD, documento ou fornecedor/data com valores divergentes (&gt;5%).
            </p>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead className="text-right">Valor Upload</TableHead>
                    <TableHead className="text-right">Valor AT</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {divergent.map(({ upload, at, diff }) => (
                    <TableRow key={`${upload.id}-${at.id}`}>
                      <TableCell>
                        {upload.document_date ? format(new Date(upload.document_date), 'dd/MM/yyyy', { locale: pt }) : '—'}
                      </TableCell>
                      <TableCell>{getSupplierLabel(upload.supplier_name || at.supplier_name, upload.supplier_nif)}</TableCell>
                      <TableCell className="font-mono text-sm">{upload.supplier_nif}</TableCell>
                      <TableCell className="text-right">{fmt(upload.total_amount)}</TableCell>
                      <TableCell className="text-right">{fmt(at.total_amount)}</TableCell>
                      <TableCell className="text-right font-medium text-amber-600">
                        {fmt(diff)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openInvoice(upload.id)} disabled={!canOpenInvoice}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openInvoice(at.id)} disabled={!canOpenInvoice}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            AT
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
