import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { ZenEmptyState } from '@/components/zen';
import { usePagination } from '@/hooks/usePagination';
import {
  Eye,
  CheckCircle,
  Clock,
  FileText,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  XCircle,
  Upload,
  ShoppingCart,
  TrendingUp,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { UnifiedDocument, DocumentType } from '@/hooks/useAllDocuments';

type SortField = 'date' | 'amount' | 'type' | 'status';
type SortOrder = 'asc' | 'desc';

interface DocumentsTableProps {
  documents: UnifiedDocument[];
  loading: boolean;
}

const documentTypeConfig: Record<
  DocumentType,
  { label: string; icon: typeof FileText; variant: 'default' | 'secondary' | 'outline' }
> = {
  purchase: { label: 'Compra', icon: ShoppingCart, variant: 'default' },
  sale: { label: 'Venda', icon: TrendingUp, variant: 'secondary' },
  withholding: { label: 'Retenção', icon: Receipt, variant: 'outline' },
};

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive'; icon: typeof Clock }
> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  classified: { label: 'Classificado', variant: 'warning', icon: AlertCircle },
  validated: { label: 'Validado', variant: 'success', icon: CheckCircle },
  draft: { label: 'Rascunho', variant: 'secondary', icon: Clock },
  included: { label: 'Incluído', variant: 'warning', icon: AlertCircle },
  submitted: { label: 'Submetido', variant: 'success', icon: CheckCircle },
};

const getConfidenceConfig = (confidence: number) => {
  if (confidence >= 80) {
    return {
      variant: 'success' as const,
      icon: CheckCircle,
      tooltip: 'Classificação confiável',
    };
  }
  if (confidence >= 60) {
    return {
      variant: 'warning' as const,
      icon: AlertTriangle,
      tooltip: 'Classificação provável - requer atenção',
    };
  }
  return {
    variant: 'destructive' as const,
    icon: XCircle,
    tooltip: 'Classificação incerta - verificação necessária',
  };
};

export function DocumentsTable({ documents, loading }: DocumentsTableProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [documents, sortField, sortOrder]);

  // Pagination
  const pagination = usePagination({
    totalItems: sortedDocuments.length,
    itemsPerPage: 15,
    initialPage: 1,
  });

  const paginatedDocuments = pagination.paginatedItems(sortedDocuments);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const navigateToDocument = (doc: UnifiedDocument) => {
    switch (doc.type) {
      case 'purchase':
        navigate('/validation');
        break;
      case 'sale':
        navigate('/sales');
        break;
      case 'withholding':
        navigate('/modelo-10');
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <ZenEmptyState
        icon={FileText}
        title="Nenhum documento encontrado"
        description="Comece por carregar documentos para poder visualizar e gerir"
        variant="primary"
        action={{
          label: 'Carregar Documento',
          onClick: () => navigate('/upload'),
          icon: Upload,
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordenar por:</span>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Data</SelectItem>
            <SelectItem value="amount">Valor</SelectItem>
            <SelectItem value="type">Tipo</SelectItem>
            <SelectItem value="status">Estado</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          {sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('date')}>
                <div className="flex items-center">
                  Data
                  <SortIcon field="date" />
                </div>
              </TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead>N.º Documento</TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('amount')}>
                <div className="flex items-center justify-end">
                  Valor
                  <SortIcon field="amount" />
                </div>
              </TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('status')}>
                <div className="flex items-center">
                  Estado
                  <SortIcon field="status" />
                </div>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDocuments.map((doc) => {
              const typeConfig = documentTypeConfig[doc.type];
              const TypeIcon = typeConfig.icon;
              const status = statusConfig[doc.status] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <TableRow key={`${doc.type}-${doc.id}`} className="hover:bg-muted/50">
                  <TableCell>
                    <Badge variant={typeConfig.variant} className="gap-1">
                      <TypeIcon className="h-3 w-3" />
                      {typeConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {doc.date ? format(new Date(doc.date), 'dd/MM/yyyy', { locale: pt }) : '-'}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {doc.entityName || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{doc.entityNif || '-'}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {doc.documentNumber || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {doc.amount > 0 ? `€${doc.amount.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {doc.classification ? (
                        <span className="text-sm">{doc.classification}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                      {doc.confidence !== null && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex">
                                {(() => {
                                  const config = getConfidenceConfig(doc.confidence);
                                  const ConfidenceIcon = config.icon;
                                  return (
                                    <Badge variant={config.variant} className="gap-1 cursor-help text-xs">
                                      <ConfidenceIcon className="h-3 w-3" />
                                      {doc.confidence}%
                                    </Badge>
                                  );
                                })()}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-48">
                                {getConfidenceConfig(doc.confidence).tooltip}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigateToDocument(doc)}
                            aria-label="Ver detalhes do documento"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Ir para {documentTypeConfig[doc.type].label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <PaginationControls
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        itemsPerPage={pagination.itemsPerPage}
        totalItems={sortedDocuments.length}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        canGoNext={pagination.canGoNext}
        canGoPrev={pagination.canGoPrev}
        onPageChange={pagination.goToPage}
        onItemsPerPageChange={pagination.setItemsPerPage}
      />
    </div>
  );
}
