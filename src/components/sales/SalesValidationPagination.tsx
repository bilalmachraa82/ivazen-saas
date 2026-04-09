import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SalesValidationPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function SalesValidationPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  className,
}: SalesValidationPaginationProps) {
  if (totalCount === 0) {
    return null;
  }

  const currentPage = page + 1;
  const startIndex = page * pageSize;
  const endIndex = Math.min(totalCount, startIndex + pageSize);

  return (
    <div className={cn('flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="text-sm text-muted-foreground">
        Mostrando {startIndex + 1}-{endIndex} de {totalCount}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>

        <span className="px-2 text-sm text-muted-foreground">
          Pagina {currentPage} de {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={currentPage >= totalPages}
          className="gap-1"
        >
          Proximo
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
