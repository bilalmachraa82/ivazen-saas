import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (count: number) => void;
  className?: string;
  itemsPerPageOptions?: number[];
}

export function PaginationControls({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  startIndex,
  endIndex,
  canGoNext,
  canGoPrev,
  onPageChange,
  onItemsPerPageChange,
  className,
  itemsPerPageOptions = [10, 25, 50, 100],
}: PaginationControlsProps) {
  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-4 py-4', className)}>
      {/* Items per page selector */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground whitespace-nowrap">Itens por pagina:</span>
        <Select
          value={itemsPerPage.toString()}
          onValueChange={(value) => onItemsPerPageChange(Number(value))}
        >
          <SelectTrigger className="w-[70px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {itemsPerPageOptions.map((option) => (
              <SelectItem key={option} value={option.toString()}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Showing X-Y of Z indicator */}
      <div className="text-sm text-muted-foreground whitespace-nowrap">
        Mostrando {startIndex + 1}-{endIndex} de {totalItems}
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          className="h-8 px-2"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Anterior</span>
        </Button>

        <span className="text-sm text-muted-foreground whitespace-nowrap px-2">
          Pagina {currentPage} de {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className="h-8 px-2"
        >
          <span className="hidden sm:inline mr-1">Proximo</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
