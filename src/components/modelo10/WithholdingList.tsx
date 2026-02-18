import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZenCard, ZenEmptyState } from '@/components/zen';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Trash2, FileText, Building, Home, Loader2, FileDown, Files, Pencil } from 'lucide-react';
import { TaxWithholding, WithholdingFormData } from '@/hooks/useWithholdings';
import { useProfile } from '@/hooks/useProfile';
import { usePagination } from '@/hooks/usePagination';
import { generateBeneficiaryPDF, prepareBeneficiaryData, generateAllBeneficiaryPDFs, getUniqueBeneficiaries } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { WithholdingFilters, WithholdingFiltersState } from './WithholdingFilters';
import { WithholdingEditDialog } from './WithholdingEditDialog';

interface WithholdingListProps {
  withholdings: TaxWithholding[];
  onDelete: (id: string) => Promise<void>;
  onDeleteAll?: () => Promise<void>;
  onUpdate: (id: string, data: Partial<WithholdingFormData>, previousData?: TaxWithholding) => Promise<void>;
  isDeleting: boolean;
  isDeletingAll?: boolean;
  isUpdating: boolean;
  fiscalYear: number;
}

export function WithholdingList({ withholdings, onDelete, onDeleteAll, onUpdate, isDeleting, isDeletingAll, isUpdating, fiscalYear }: WithholdingListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingWithholding, setEditingWithholding] = useState<TaxWithholding | null>(null);
  const [filters, setFilters] = useState<WithholdingFiltersState>({
    search: '',
    category: 'all',
    month: 'all',
    status: 'all',
  });
  const { profile } = useProfile();

  // Filter withholdings based on current filters
  const filteredWithholdings = useMemo(() => {
    return withholdings.filter((w) => {
      // Search filter (NIF or name)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesNif = w.beneficiary_nif.toLowerCase().includes(searchLower);
        const matchesName = w.beneficiary_name?.toLowerCase().includes(searchLower);
        if (!matchesNif && !matchesName) return false;
      }

      // Category filter
      if (filters.category !== 'all' && w.income_category !== filters.category) {
        return false;
      }

      // Month filter
      if (filters.month !== 'all') {
        const paymentMonth = format(new Date(w.payment_date), 'MM');
        if (paymentMonth !== filters.month) return false;
      }

      // Status filter
      if (filters.status !== 'all' && w.status !== filters.status) {
        return false;
      }

      return true;
    });
  }, [withholdings, filters]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  const handleGeneratePDF = (w: TaxWithholding) => {
    try {
      const beneficiaryData = prepareBeneficiaryData(
        withholdings, 
        w.beneficiary_nif, 
        w.income_category
      );
      generateBeneficiaryPDF(beneficiaryData, profile, fiscalYear);
      toast.success('PDF gerado com sucesso');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleGenerateAllPDFs = () => {
    try {
      const count = generateAllBeneficiaryPDFs(withholdings, profile, fiscalYear);
      toast.success(`${count} PDF(s) gerado(s) com sucesso`);
    } catch (error) {
      console.error('Error generating all PDFs:', error);
      toast.error('Erro ao gerar PDFs');
    }
  };

  const uniqueBeneficiariesCount = useMemo(() => {
    return getUniqueBeneficiaries(withholdings).length;
  }, [withholdings]);

  // Pagination
  const pagination = usePagination({
    totalItems: filteredWithholdings.length,
    itemsPerPage: 10,
    initialPage: 1,
  });

  const paginatedWithholdings = pagination.paginatedItems(filteredWithholdings);

  const getCategoryBadge = (category: 'A' | 'B' | 'E' | 'F' | 'G' | 'H' | 'R') => {
    const categoryStyles: Record<string, { bg: string; icon: typeof Building }> = {
      'A': { bg: 'bg-sky-500/10 text-sky-600', icon: Building },
      'B': { bg: 'bg-blue-500/10 text-blue-600', icon: Building },
      'E': { bg: 'bg-purple-500/10 text-purple-600', icon: Building },
      'F': { bg: 'bg-green-500/10 text-green-600', icon: Home },
      'G': { bg: 'bg-amber-500/10 text-amber-600', icon: Building },
      'H': { bg: 'bg-teal-500/10 text-teal-600', icon: Building },
      'R': { bg: 'bg-rose-500/10 text-rose-600', icon: Building },
    };
    
    const style = categoryStyles[category] || { bg: 'bg-gray-500/10 text-gray-600', icon: Building };
    const Icon = style.icon;
    
    return (
      <Badge variant="secondary" className={style.bg}>
        <Icon className="h-3 w-3 mr-1" />
        Cat. {category}
      </Badge>
    );
  };

  const getLocationLabel = (code: string) => {
    switch (code) {
      case 'C': return 'Continente';
      case 'RA': return 'Açores';
      case 'RM': return 'Madeira';
      default: return code;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Rascunho</Badge>;
      case 'included':
        return <Badge variant="secondary">Incluído</Badge>;
      case 'submitted':
        return <Badge className="bg-green-500">Submetido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (withholdings.length === 0) {
    return (
      <ZenEmptyState
        icon={FileText}
        title="Sem retenções"
        description="Ainda não adicionou nenhuma retenção na fonte para este ano fiscal."
      />
    );
  }

  return (
    <ZenCard>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Lista de Retenções ({filteredWithholdings.length}
          {filteredWithholdings.length !== withholdings.length && ` de ${withholdings.length}`})
        </CardTitle>

        <div className="flex items-center gap-2">
          {uniqueBeneficiariesCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateAllPDFs}
              className="flex items-center gap-2"
            >
              <Files className="h-4 w-4" />
              <span className="hidden sm:inline">Gerar Todos PDFs</span>
              <Badge variant="secondary" className="ml-1">
                {uniqueBeneficiariesCount}
              </Badge>
            </Button>
          )}

          {onDeleteAll && withholdings.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeletingAll}
                  className="flex items-center gap-2"
                >
                  {isDeletingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Eliminar Todos</span>
                  <Badge variant="secondary" className="ml-1 bg-destructive-foreground/20">
                    {withholdings.length}
                  </Badge>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar TODAS as retenções de {fiscalYear}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acção vai eliminar permanentemente <strong>{withholdings.length} retenção(ões)</strong> do ano fiscal {fiscalYear}.
                    Esta acção não pode ser revertida.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDeleteAll()}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Eliminar Todos ({withholdings.length})
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <WithholdingFilters filters={filters} onFiltersChange={setFilters} />
        
        {filteredWithholdings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma retenção encontrada com os filtros selecionados.
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Beneficiário</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Retido</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedWithholdings.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    {format(new Date(w.payment_date), 'dd/MM/yyyy', { locale: pt })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {w.beneficiary_name || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {w.beneficiary_nif}
                  </TableCell>
                  <TableCell>{getCategoryBadge(w.income_category)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getLocationLabel(w.location_code)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(w.gross_amount).toLocaleString('pt-PT', { 
                      style: 'currency', 
                      currency: 'EUR' 
                    })}
                  </TableCell>
                  <TableCell className="text-right text-destructive font-medium">
                    {Number(w.withholding_amount).toLocaleString('pt-PT', { 
                      style: 'currency', 
                      currency: 'EUR' 
                    })}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {(Number(w.gross_amount) - Number(w.withholding_amount)).toLocaleString('pt-PT', { 
                      style: 'currency', 
                      currency: 'EUR' 
                    })}
                  </TableCell>
                  <TableCell>{getStatusBadge(w.status)}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingWithholding(w)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleGeneratePDF(w)}
                      title="Gerar PDF"
                    >
                      <FileDown className="h-4 w-4 text-primary" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isDeleting && deletingId === w.id}
                        >
                          {isDeleting && deletingId === w.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar retenção?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acção não pode ser revertida. A retenção será 
                            permanentemente eliminada.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(w.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          itemsPerPage={pagination.itemsPerPage}
          totalItems={filteredWithholdings.length}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          canGoNext={pagination.canGoNext}
          canGoPrev={pagination.canGoPrev}
          onPageChange={pagination.goToPage}
          onItemsPerPageChange={pagination.setItemsPerPage}
        />
          </>
        )}

        {/* Edit Dialog */}
        <WithholdingEditDialog
          withholding={editingWithholding}
          open={!!editingWithholding}
          onOpenChange={(open) => !open && setEditingWithholding(null)}
          onSubmit={async (id, data) => {
            await onUpdate(id, data, editingWithholding || undefined);
            setEditingWithholding(null);
          }}
          isSubmitting={isUpdating}
        />
      </CardContent>
    </ZenCard>
  );
}
