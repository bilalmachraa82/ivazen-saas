import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClientManagement } from '@/hooks/useClientManagement';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { ZenCard, ZenCardHeader } from '@/components/zen';
import { CardContent } from '@/components/ui/card';
import { Copy, Trash2, Shield, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';

interface DuplicateGroup {
  atcud: string;
  document_number: string | null;
  supplier_nif: string;
  supplier_name: string | null;
  total_amount: number;
  document_date: string;
  invoices: {
    id: string;
    created_at: string;
    status: string;
    isKeep: boolean;
  }[];
}

interface DuplicateManagerProps {
  onCleanupComplete?: () => void;
}

export function DuplicateManager({ onCleanupComplete }: DuplicateManagerProps) {
  const { user } = useAuth();
  const { isAccountant, clients } = useClientManagement();

  const [localClientId, setLocalClientId] = useState<string | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());

  const effectiveClientId = isAccountant ? localClientId : user?.id;

  const fetchDuplicates = async () => {
    if (!effectiveClientId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, atcud, document_number, supplier_nif, supplier_name, total_amount, document_date, created_at, status')
        .eq('client_id', effectiveClientId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data) return;

      // Group by ATCUD or (NIF + doc_number + date)
      const groupMap = new Map<string, typeof data>();

      data.forEach((inv) => {
        const key = inv.atcud
          ? `atcud:${inv.atcud}`
          : inv.document_number
            ? `doc:${inv.supplier_nif}|${inv.document_number}|${inv.document_date}`
            : null;

        if (!key) return;

        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(inv);
      });

      const duplicateGroups: DuplicateGroup[] = [];

      groupMap.forEach((invoices) => {
        if (invoices.length <= 1) return;

        // Prefer keeping the validated one, else the oldest
        const validatedIdx = invoices.findIndex((i) => i.status === 'validated');
        const keepIdx = validatedIdx >= 0 ? validatedIdx : 0;

        duplicateGroups.push({
          atcud: invoices[0].atcud || '',
          document_number: invoices[0].document_number,
          supplier_nif: invoices[0].supplier_nif,
          supplier_name: invoices[0].supplier_name,
          total_amount: invoices[0].total_amount,
          document_date: invoices[0].document_date,
          invoices: invoices.map((inv, idx) => ({
            id: inv.id,
            created_at: inv.created_at || '',
            status: inv.status || 'pending',
            isKeep: idx === keepIdx,
          })),
        });
      });

      setGroups(duplicateGroups);

      // Auto-select all non-keep for deletion
      const autoSelect = new Set<string>();
      duplicateGroups.forEach((g) => {
        g.invoices.forEach((inv) => {
          if (!inv.isKeep) autoSelect.add(inv.id);
        });
      });
      setSelectedToDelete(autoSelect);
    } catch (err) {
      console.error('Error fetching duplicates:', err);
      toast.error('Erro ao verificar duplicados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, [effectiveClientId]);

  const totalDuplicates = useMemo(
    () => groups.reduce((sum, g) => sum + g.invoices.length - 1, 0),
    [groups]
  );

  const toggleSelect = (id: string) => {
    setSelectedToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedToDelete.size === 0) return;

    setDeleting(true);
    try {
      const ids = Array.from(selectedToDelete);

      // Also delete related storage files
      const { data: toDelete } = await supabase
        .from('invoices')
        .select('id, image_path')
        .in('id', ids);

      // Delete invoice records
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', ids);

      if (error) throw error;

      // Attempt to delete storage files (non-blocking)
      if (toDelete) {
        const paths = toDelete.map((i) => i.image_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('invoices').remove(paths);
        }
      }

      toast.success(`${ids.length} duplicado(s) removido(s)`);
      setSelectedToDelete(new Set());
      await fetchDuplicates();
      onCleanupComplete?.();
    } catch (err) {
      console.error('Error deleting duplicates:', err);
      toast.error('Erro ao eliminar duplicados');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Client selector for accountants */}
      {isAccountant && (
        <ClientSearchSelector
          clients={clients}
          selectedClientId={localClientId}
          onSelect={setLocalClientId}
        />
      )}

      {loading && (
        <div className="flex items-center gap-2 py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          A verificar duplicados...
        </div>
      )}

      {!loading && groups.length === 0 && (
        <Alert className="border-primary/20 bg-primary/5">
          <CheckCircle className="h-4 w-4 text-primary" />
          <AlertTitle>Sem duplicados</AlertTitle>
          <AlertDescription>
            {effectiveClientId
              ? 'Nenhum documento duplicado encontrado para este cliente.'
              : 'Seleccione um cliente para verificar duplicados.'}
          </AlertDescription>
        </Alert>
      )}

      {!loading && groups.length > 0 && (
        <>
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {totalDuplicates} duplicado(s) detectado(s) em {groups.length} grupo(s)
            </AlertTitle>
            <AlertDescription>
              Os registos marcados com <Shield className="h-3 w-3 inline" /> serão mantidos (validados ou mais antigos).
              Os restantes estão pré-seleccionados para eliminação.
            </AlertDescription>
          </Alert>

          {groups.map((group, gi) => (
            <ZenCard key={gi} withLine animationDelay={`${gi * 50}ms`}>
              <ZenCardHeader
                title={`${group.supplier_name || group.supplier_nif} — ${group.invoices.length} cópias`}
                icon={Copy}
              />
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2 space-x-4">
                  <span>Doc: {group.document_number || '—'}</span>
                  <span>Data: {format(new Date(group.document_date), 'dd/MM/yyyy', { locale: pt })}</span>
                  <span>Valor: €{Number(group.total_amount).toFixed(2)}</span>
                  {group.atcud && <span>ATCUD: {group.atcud}</span>}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Carregado em</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acção</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.invoices.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className={inv.isKeep ? 'bg-primary/5' : selectedToDelete.has(inv.id) ? 'bg-destructive/5' : ''}
                      >
                        <TableCell>
                          {inv.isKeep ? (
                            <Shield className="h-4 w-4 text-primary" />
                          ) : (
                            <Checkbox
                              checked={selectedToDelete.has(inv.id)}
                              onCheckedChange={() => toggleSelect(inv.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {inv.created_at
                            ? format(new Date(inv.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inv.status === 'validated'
                                ? 'success'
                                : inv.status === 'classified'
                                  ? 'warning'
                                  : 'secondary'
                            }
                          >
                            {inv.status === 'validated'
                              ? 'Confirmada'
                              : inv.status === 'classified'
                                ? 'Classificada'
                                : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {inv.isKeep ? (
                            <span className="text-xs text-primary font-medium">Manter</span>
                          ) : (
                            <span className="text-xs text-destructive">
                              {selectedToDelete.has(inv.id) ? 'Eliminar' : '—'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </ZenCard>
          ))}

          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={selectedToDelete.size === 0 || deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Eliminar {selectedToDelete.size} duplicado(s)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
