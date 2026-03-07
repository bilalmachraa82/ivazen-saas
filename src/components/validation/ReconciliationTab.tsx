import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZenEmptyState, ZenSkeleton } from '@/components/zen';
import { AlertTriangle, CheckCircle, ArrowLeftRight, Trash2, Upload, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface ReconciliationTabProps {
  clientId: string;
  onCleanupComplete?: () => void;
}

interface InvoiceMatch {
  id: string;
  supplier_nif: string;
  supplier_name: string | null;
  document_date: string;
  document_number: string | null;
  total_amount: number;
  source: string | null;
  status: string;
  atcud: string | null;
}

type ReconciliationCategory = 'duplicates' | 'at_only' | 'upload_only' | 'divergent';

const fmt = (n: number) => `€${Number(n).toFixed(2)}`;

export function ReconciliationTab({ clientId, onCleanupComplete }: ReconciliationTabProps) {
  const [activeCategory, setActiveCategory] = useState<ReconciliationCategory>('duplicates');
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  // Fetch all invoices for the client
  const { data: allInvoices = [], isLoading } = useQuery({
    queryKey: ['reconciliation-invoices', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, supplier_nif, supplier_name, document_date, document_number, total_amount, source, status, atcud')
        .eq('client_id', clientId)
        .in('status', ['pending', 'classified', 'validated'])
        .order('document_date', { ascending: false });
      if (error) throw error;
      return (data || []) as InvoiceMatch[];
    },
    enabled: !!clientId,
  });

  // Reconciliation analysis
  const { duplicates, atOnly, uploadOnly, divergent } = useMemo(() => {
    const duplicates: Array<{ original: InvoiceMatch; duplicate: InvoiceMatch }> = [];
    const atInvoices: InvoiceMatch[] = [];
    const uploadInvoices: InvoiceMatch[] = [];

    // Separate by source
    allInvoices.forEach(inv => {
      const src = (inv.source || '').toLowerCase();
      if (src === 'at' || src === 'efatura' || src === 'at_sync') {
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

    // Cross-reference: AT vs Upload
    // Build lookup by NIF+date
    const buildLookup = (list: InvoiceMatch[]) => {
      const map = new Map<string, InvoiceMatch[]>();
      list.forEach(inv => {
        const key = `${(inv.supplier_nif || '').trim()}|${inv.document_date || ''}`;
        const arr = map.get(key) || [];
        arr.push(inv);
        map.set(key, arr);
      });
      return map;
    };

    const atLookup = buildLookup(atInvoices);
    const uploadLookup = buildLookup(uploadInvoices);

    // AT invoices without upload match
    const atOnly: InvoiceMatch[] = [];
    atLookup.forEach((invs, key) => {
      if (!uploadLookup.has(key)) {
        atOnly.push(...invs);
      }
    });

    // Upload invoices without AT match
    const uploadOnly: InvoiceMatch[] = [];
    uploadLookup.forEach((invs, key) => {
      if (!atLookup.has(key)) {
        uploadOnly.push(...invs);
      }
    });

    // Value divergences: same NIF+date but amount differs > 5%
    const divergent: Array<{ upload: InvoiceMatch; at: InvoiceMatch; diff: number }> = [];
    uploadLookup.forEach((uploadInvs, key) => {
      const atInvs = atLookup.get(key);
      if (!atInvs) return;
      for (const u of uploadInvs) {
        for (const a of atInvs) {
          const uAmount = Number(u.total_amount);
          const aAmount = Number(a.total_amount);
          if (uAmount === 0 && aAmount === 0) continue;
          const maxAmount = Math.max(Math.abs(uAmount), Math.abs(aAmount));
          const diff = Math.abs(uAmount - aAmount);
          if (diff / maxAmount > 0.05) {
            divergent.push({ upload: u, at: a, diff });
          }
        }
      }
    });

    return { duplicates, atOnly, uploadOnly, divergent };
  }, [allInvoices]);

  const handleRemoveDuplicate = async (id: string) => {
    setRemovingIds(prev => new Set(prev).add(id));
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover duplicado');
    } else {
      toast.success('Duplicado removido');
      onCleanupComplete?.();
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
                  <TableHead className="text-right">Acção</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map(({ original, duplicate }) => (
                  <TableRow key={duplicate.id}>
                    <TableCell>
                      {duplicate.document_date ? format(new Date(duplicate.document_date), 'dd/MM/yyyy', { locale: pt }) : '—'}
                    </TableCell>
                    <TableCell>{duplicate.supplier_name || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-sm">{duplicate.supplier_nif}</TableCell>
                    <TableCell className="text-right">{fmt(duplicate.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{duplicate.source || 'upload'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveDuplicate(duplicate.id)}
                        disabled={removingIds.has(duplicate.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remover
                      </Button>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadOnly.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        {inv.document_date ? format(new Date(inv.document_date), 'dd/MM/yyyy', { locale: pt }) : '—'}
                      </TableCell>
                      <TableCell>{inv.supplier_name || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-sm">{inv.supplier_nif}</TableCell>
                      <TableCell className="text-right">{fmt(inv.total_amount)}</TableCell>
                      <TableCell><Badge variant="outline">{inv.status}</Badge></TableCell>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atOnly.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        {inv.document_date ? format(new Date(inv.document_date), 'dd/MM/yyyy', { locale: pt }) : '—'}
                      </TableCell>
                      <TableCell>{inv.supplier_name || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-sm">{inv.supplier_nif}</TableCell>
                      <TableCell className="text-right">{fmt(inv.total_amount)}</TableCell>
                      <TableCell><Badge variant="outline">{inv.status}</Badge></TableCell>
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
              Facturas com mesmo NIF e data mas valores divergentes (&gt;5%).
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {divergent.map(({ upload, at, diff }) => (
                    <TableRow key={`${upload.id}-${at.id}`}>
                      <TableCell>
                        {upload.document_date ? format(new Date(upload.document_date), 'dd/MM/yyyy', { locale: pt }) : '—'}
                      </TableCell>
                      <TableCell>{upload.supplier_name || at.supplier_name || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-sm">{upload.supplier_nif}</TableCell>
                      <TableCell className="text-right">{fmt(upload.total_amount)}</TableCell>
                      <TableCell className="text-right">{fmt(at.total_amount)}</TableCell>
                      <TableCell className="text-right font-medium text-amber-600">
                        {fmt(diff)}
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
