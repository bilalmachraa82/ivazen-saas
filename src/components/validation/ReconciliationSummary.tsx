/**
 * Reconciliation Summary Component
 * Cards showing totals and accuracy metrics
 */

import { ZenCard, ZenStatsCard } from '@/components/zen';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileSpreadsheet,
  FileText,
  Calculator,
  Target,
  TrendingUp
} from 'lucide-react';
import { 
  ReconciliationResult, 
  formatCurrency 
} from '@/lib/reconciliationEngine';
import { DeltaSummary, ZeroDeltaBadge } from './DeltaIndicator';
import { cn } from '@/lib/utils';

interface ReconciliationSummaryProps {
  result: ReconciliationResult;
  type: 'iva' | 'modelo10' | 'ambos';
  className?: string;
}

export function ReconciliationSummary({ result, type, className }: ReconciliationSummaryProps) {
  const { summary, ivaRecon, modelo10Recon, isZeroDelta } = result;
  
  return (
    <div className={cn('space-y-6', className)}>
      {/* Main Result Card */}
      <ZenCard gradient={isZeroDelta ? 'success' : 'warning'} withLine className="shadow-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Resultado da Reconciliação
            </CardTitle>
            <ZeroDeltaBadge isZeroDelta={isZeroDelta} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Match Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Taxa de Correspondência</span>
              <span className="font-mono font-bold">{summary.matchRate}%</span>
            </div>
            <Progress 
              value={summary.matchRate} 
              className={cn(
                'h-3',
                summary.matchRate === 100 ? '[&>div]:bg-green-600' : 
                summary.matchRate >= 95 ? '[&>div]:bg-amber-500' : 
                '[&>div]:bg-red-500'
              )}
            />
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <FileSpreadsheet className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{summary.totalExcel}</p>
              <p className="text-xs text-muted-foreground">No Excel</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <FileText className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{summary.totalExtracted}</p>
              <p className="text-xs text-muted-foreground">Extraídos</p>
            </div>
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold text-green-600">
                {summary.perfectMatches + summary.withinTolerance}
              </p>
              <p className="text-xs text-muted-foreground">Conferem</p>
            </div>
            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-center">
              <XCircle className="h-5 w-5 mx-auto mb-1 text-red-600" />
              <p className="text-2xl font-bold text-red-600">
                {summary.outsideTolerance + summary.missing}
              </p>
              <p className="text-xs text-muted-foreground">Problemas</p>
            </div>
          </div>
        </CardContent>
      </ZenCard>
      
      {/* IVA Reconciliation */}
      {(type === 'iva' || type === 'ambos') && ivaRecon && (
        <ZenCard gradient="primary" withLine>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5" />
              Reconciliação IVA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DeltaSummary
              label="IVA Dedutível"
              excelValue={ivaRecon.vatDeductibleExcel}
              systemValue={ivaRecon.vatDeductibleSystem}
            />
            {ivaRecon.vatLiquidatedExcel !== undefined && (
              <DeltaSummary
                label="IVA Liquidado"
                excelValue={ivaRecon.vatLiquidatedExcel}
                systemValue={ivaRecon.vatLiquidatedSystem ?? 0}
              />
            )}
            {ivaRecon.balanceExcel !== undefined && (
              <DeltaSummary
                label="Saldo IVA"
                excelValue={ivaRecon.balanceExcel}
                systemValue={ivaRecon.balanceSystem ?? 0}
              />
            )}
          </CardContent>
        </ZenCard>
      )}
      
      {/* Modelo 10 Reconciliation */}
      {(type === 'modelo10' || type === 'ambos') && modelo10Recon && (
        <ZenCard gradient="default" withLine>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Reconciliação Modelo 10
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DeltaSummary
              label="Valor Bruto Total"
              excelValue={modelo10Recon.grossIncomeExcel}
              systemValue={modelo10Recon.grossIncomeSystem}
            />
            <DeltaSummary
              label="Retenção Total"
              excelValue={modelo10Recon.withholdingExcel}
              systemValue={modelo10Recon.withholdingSystem}
            />
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">NIFs Únicos</span>
              <div className="flex items-center gap-4 text-sm">
                <span>Excel: <strong>{modelo10Recon.uniqueNifsExcel}</strong></span>
                <span>Sistema: <strong>{modelo10Recon.uniqueNifsSystem}</strong></span>
                {modelo10Recon.uniqueNifsExcel === modelo10Recon.uniqueNifsSystem ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
              </div>
            </div>
          </CardContent>
        </ZenCard>
      )}
      
      {/* Discrepancies Warning */}
      {result.discrepancies.length > 0 && (
        <ZenCard gradient="warning">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              {result.discrepancies.length} Discrepâncias Detectadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {result.discrepancies.slice(0, 10).map((disc, i) => (
                <div 
                  key={i} 
                  className={cn(
                    'flex items-center justify-between p-2 rounded text-sm',
                    disc.severity === 'error' ? 'bg-red-100 dark:bg-red-900/30' : 
                    disc.severity === 'critical' ? 'bg-red-200 dark:bg-red-900/50' :
                    'bg-amber-100 dark:bg-amber-900/30'
                  )}
                >
                  <span className="font-medium">{disc.field}</span>
                  <div className="flex items-center gap-4 font-mono text-xs">
                    <span>Excel: {typeof disc.excelValue === 'number' ? formatCurrency(disc.excelValue) : disc.excelValue}</span>
                    <span>Sistema: {typeof disc.systemValue === 'number' ? formatCurrency(disc.systemValue) : disc.systemValue}</span>
                    <Badge variant="destructive" className="text-xs">
                      Δ {typeof disc.delta === 'number' ? formatCurrency(disc.delta) : disc.delta}
                    </Badge>
                  </div>
                </div>
              ))}
              {result.discrepancies.length > 10 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ... e mais {result.discrepancies.length - 10} discrepâncias
                </p>
              )}
            </div>
          </CardContent>
        </ZenCard>
      )}
    </div>
  );
}
