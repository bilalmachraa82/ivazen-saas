import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ZenCard, ZenCardContent, ZenCardHeader } from '@/components/zen/ZenCard';
import { ZenHeader } from '@/components/zen/ZenHeader';
import { ZenStatsCard } from '@/components/zen/ZenStatsCard';
import { ZenDecorations } from '@/components/zen/ZenDecorations';
import { DocumentsTable } from '@/components/documents/DocumentsTable';
import { DocumentsFilters } from '@/components/documents/DocumentsFilters';
import { useAllDocuments } from '@/hooks/useAllDocuments';
import { FileText, ShoppingCart, TrendingUp, Receipt, Clock, CheckCircle } from 'lucide-react';

export default function Documents() {
  const { documents, loading, filters, setFilters, fiscalPeriods, allStatuses, stats } =
    useAllDocuments();

  return (
    <DashboardLayout>
      <div className="relative space-y-8 animate-fade-in">
        <ZenDecorations variant="default" />

        {/* Header */}
        <ZenHeader
          icon={FileText}
          title="Todos os Documentos"
          description="Visão completa de todos os documentos importados: compras, vendas e retenções"
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <ZenStatsCard
            label="Total"
            value={stats.totalDocuments}
            icon={FileText}
            variant="primary"
          />
          <ZenStatsCard
            label="Compras"
            value={stats.totalPurchases}
            icon={ShoppingCart}
            variant="default"
          />
          <ZenStatsCard
            label="Vendas"
            value={stats.totalSales}
            icon={TrendingUp}
            variant="default"
          />
          <ZenStatsCard
            label="Retenções"
            value={stats.totalWithholdings}
            icon={Receipt}
            variant="default"
          />
          <ZenStatsCard
            label="Por Rever"
            value={stats.pendingReview}
            icon={Clock}
            variant="warning"
          />
          <ZenStatsCard
            label="Validados"
            value={stats.validated}
            icon={CheckCircle}
            variant="success"
          />
        </div>

        {/* Filters */}
        <ZenCard>
          <ZenCardContent className="pt-6">
            <DocumentsFilters
              filters={filters}
              onFiltersChange={setFilters}
              fiscalPeriods={fiscalPeriods}
              allStatuses={allStatuses}
            />
          </ZenCardContent>
        </ZenCard>

        {/* Documents Table */}
        <ZenCard>
          <ZenCardHeader title="Lista de Documentos" icon={FileText} />
          <ZenCardContent>
            <div className="mb-4 text-sm text-muted-foreground">
              A mostrar {documents.length} documento{documents.length !== 1 ? 's' : ''}
              {filters.search && ` para "${filters.search}"`}
            </div>
            <DocumentsTable documents={documents} loading={loading} />
          </ZenCardContent>
        </ZenCard>
      </div>
    </DashboardLayout>
  );
}
