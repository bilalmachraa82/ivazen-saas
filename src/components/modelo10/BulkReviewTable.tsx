/**
 * Bulk Review Table Component
 * Displays extracted data in a table with color-coded confidence levels
 * Allows bulk approval and individual editing
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle, AlertCircle, XCircle, Trash2, CheckSquare } from 'lucide-react';
import { QueueItem, getConfidenceStatus } from '@/lib/bulkProcessor';
import { useWithholdings } from '@/hooks/useWithholdings';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface BulkReviewTableProps {
  items: QueueItem[];
  onRemove: (id: string) => void;
  selectedClientId?: string | null;
  selectedYear: number;
}

export function BulkReviewTable({ items, onRemove, selectedClientId, selectedYear }: BulkReviewTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isApproving, setIsApproving] = useState(false);
  
  // Use withholdings hook with the selected client ID for accountants
  const { addWithholding } = useWithholdings(selectedClientId);
  const { toast } = useToast();

  // Toggle individual selection
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(item => item.id)));
    }
  };

  // Auto-select green items (confidence >= 95%)
  const autoSelectGreen = () => {
    const greenItems = items.filter(item => item.confidence && item.confidence >= 0.95);
    setSelected(new Set(greenItems.map(item => item.id)));

    toast({
      title: 'Seleção automática',
      description: `${greenItems.length} documento(s) com alta confiança selecionado(s)`,
    });
  };

  // Bulk approve selected items
  const handleBulkApprove = async () => {
    const itemsToApprove = items.filter(item => selected.has(item.id));

    if (itemsToApprove.length === 0) {
      toast({
        title: 'Nenhum documento selecionado',
        description: 'Selecione pelo menos um documento para aprovar',
        variant: 'destructive',
      });
      return;
    }

    // Check if client is selected (for accountants)
    if (selectedClientId === null) {
      toast({
        title: 'Cliente não selecionado',
        description: 'Selecione um cliente antes de aprovar os documentos',
        variant: 'destructive',
      });
      return;
    }

    setIsApproving(true);

    let successCount = 0;
    let errorCount = 0;

    for (const item of itemsToApprove) {
      if (item.extractedData) {
        try {
          // Ensure the fiscal year from the form is used
          const dataToInsert = {
            ...item.extractedData,
            fiscal_year: selectedYear,
          };
          await addWithholding(dataToInsert);
          successCount++;
          onRemove(item.id); // Remove from bulk upload queue after approval
        } catch (error: any) {
          console.error('Error approving document:', error);
          errorCount++;
        }
      }
    }

    setIsApproving(false);
    setSelected(new Set());

    if (successCount > 0) {
      toast({
        title: 'Aprovação concluída',
        description: `${successCount} documento(s) adicionado(s) ao Modelo 10${errorCount > 0 ? `, ${errorCount} falharam` : ''}`,
      });
    }

    if (errorCount > 0 && successCount === 0) {
      toast({
        title: 'Erro na aprovação',
        description: 'Não foi possível adicionar os documentos. Verifique e tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // Remove selected items
  const handleRemoveSelected = () => {
    const itemsToRemove = items.filter(item => selected.has(item.id));

    itemsToRemove.forEach(item => onRemove(item.id));
    setSelected(new Set());

    toast({
      title: 'Documentos removidos',
      description: `${itemsToRemove.length} documento(s) removido(s) da fila`,
    });
  };

  if (items.length === 0) {
    return null;
  }

  // Count by confidence
  const greenCount = items.filter(item => item.confidence && item.confidence >= 0.95).length;
  const yellowCount = items.filter(item => item.confidence && item.confidence >= 0.80 && item.confidence < 0.95).length;
  const redCount = items.filter(item => item.confidence && item.confidence < 0.80).length;

  // Check if approve button should be disabled
  const isApproveDisabled = isApproving || selectedClientId === null;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Revisão de Dados Extraídos</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {greenCount > 0 && `${greenCount} alta confiança`}
                {yellowCount > 0 && ` • ${yellowCount} precisa revisão`}
                {redCount > 0 && ` • ${redCount} baixa confiança`}
              </p>
            </div>
            <div className="flex gap-2">
              {greenCount > 0 && (
                <Button variant="outline" size="sm" onClick={autoSelectGreen}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Selecionar Verdes ({greenCount})
                </Button>
              )}
              {selected.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveSelected}
                    disabled={isApproving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover ({selected.size})
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          onClick={handleBulkApprove}
                          disabled={isApproveDisabled}
                          size="sm"
                        >
                          {isApproving ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2 animate-spin" />
                              A aprovar...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Aprovar {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
                            </>
                          )}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {selectedClientId === null && (
                      <TooltipContent>
                        <p>Selecione um cliente primeiro</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selected.size === items.length && items.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Ficheiro</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Rendimento</TableHead>
                  <TableHead className="text-right">Retenção</TableHead>
                  <TableHead className="text-center">Cat</TableHead>
                  <TableHead className="text-center">Data</TableHead>
                  <TableHead className="text-center">Avisos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => {
                  const status = item.confidence ? getConfidenceStatus(item.confidence) : null;
                  const bgColor =
                    status?.color === 'green'
                      ? 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30'
                      : status?.color === 'yellow'
                      ? 'bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-950/30'
                      : 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30';

                  return (
                    <TableRow key={item.id} className={bgColor}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>

                      <TableCell>
                        {status && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={
                                  status.color === 'green'
                                    ? 'bg-green-100 text-green-700 border-green-300'
                                    : status.color === 'yellow'
                                    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                    : 'bg-red-100 text-red-700 border-red-300'
                                }
                              >
                                {status.icon} {status.label.split(' ')[0]}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Confiança: {((item.confidence || 0) * 100).toFixed(0)}%</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>

                      <TableCell className="max-w-[200px] truncate" title={item.fileName}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{item.fileName}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <code className="text-xs font-mono">
                              {item.extractedData?.beneficiary_nif || '-'}
                            </code>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>NIF do beneficiário</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      <TableCell className="max-w-[150px] truncate">
                        {item.extractedData?.beneficiary_name || (
                          <span className="text-muted-foreground italic">Sem nome</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums">
                        €{item.extractedData?.gross_amount?.toFixed(2) || '0.00'}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums">
                        €{item.extractedData?.withholding_amount?.toFixed(2) || '0.00'}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {item.extractedData?.income_category || '-'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center text-xs">
                        {item.extractedData?.payment_date ? (
                          format(new Date(item.extractedData.payment_date), 'dd/MM/yyyy', { locale: pt })
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {item.warnings && item.warnings.length > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center">
                                <AlertCircle className="h-4 w-4 text-yellow-600 cursor-help" />
                                <span className="ml-1 text-xs">{item.warnings.length}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <ul className="text-xs space-y-1">
                                {item.warnings.map((warning, i) => (
                                  <li key={i}>{warning}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
