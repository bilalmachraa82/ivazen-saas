/**
 * Reconciliation Table Component
 * Side-by-side comparison table with discrepancy highlighting
 */

import { useState, useMemo } from 'react';
import { ZenCard } from '@/components/zen';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileQuestion,
} from 'lucide-react';
import { 
  ReconciliationResult, 
  MatchedRecord, 
  ExcelRecord,
  ExtractedRecord,
  formatCurrency,
  exportReportToText,
  generateAuditReport,
} from '@/lib/reconciliationEngine';
import { DeltaIndicator } from './DeltaIndicator';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'perfect' | 'tolerance' | 'discrepancy' | 'missing' | 'extra';

interface ReconciliationTableProps {
  result: ReconciliationResult;
  type: 'iva' | 'modelo10' | 'ambos';
  clientName?: string;
  className?: string;
}

export function ReconciliationTable({ 
  result, 
  type,
  clientName,
  className 
}: ReconciliationTableProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  
  // Combine all records for display
  const allRecords = useMemo(() => {
    const records: Array<{
      type: 'matched' | 'missing' | 'extra';
      data: MatchedRecord | ExcelRecord | ExtractedRecord;
    }> = [];
    
    result.matches.forEach(m => records.push({ type: 'matched', data: m }));
    result.missing.forEach(m => records.push({ type: 'missing', data: m }));
    result.extra.forEach(e => records.push({ type: 'extra', data: e }));
    
    return records;
  }, [result]);
  
  // Filter records
  const filteredRecords = useMemo(() => {
    let filtered = allRecords;
    
    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(r => {
        if (filter === 'missing') return r.type === 'missing';
        if (filter === 'extra') return r.type === 'extra';
        if (r.type !== 'matched') return false;
        const matched = r.data as MatchedRecord;
        if (filter === 'perfect') return matched.status === 'perfect';
        if (filter === 'tolerance') return matched.status === 'within_tolerance';
        if (filter === 'discrepancy') return matched.status === 'discrepancy';
        return true;
      });
    }
    
    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(r => {
        const record = r.type === 'matched' 
          ? (r.data as MatchedRecord).excel 
          : r.data;
        
        const nif = 'nif' in record ? record.nif : '';
        const name = 'name' in record ? record.name || '' : '';
        
        return nif.includes(searchLower) || name.toLowerCase().includes(searchLower);
      });
    }
    
    return filtered;
  }, [allRecords, filter, search]);
  
  const handleExport = () => {
    const report = generateAuditReport(result, { clientName });
    const text = exportReportToText(report);
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliacao-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const getRowIcon = (recordType: 'matched' | 'missing' | 'extra', matched?: MatchedRecord) => {
    if (recordType === 'missing') return <FileQuestion className="h-4 w-4 text-amber-600" />;
    if (recordType === 'extra') return <AlertTriangle className="h-4 w-4 text-blue-600" />;
    if (!matched) return null;
    
    switch (matched.status) {
      case 'perfect': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'within_tolerance': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'discrepancy': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };
  
  const getRowClassName = (recordType: 'matched' | 'missing' | 'extra', matched?: MatchedRecord) => {
    if (recordType === 'missing') return 'bg-amber-50 dark:bg-amber-900/10';
    if (recordType === 'extra') return 'bg-blue-50 dark:bg-blue-900/10';
    if (!matched) return '';
    
    switch (matched.status) {
      case 'perfect': return 'bg-green-50/50 dark:bg-green-900/10';
      case 'within_tolerance': return 'bg-green-50/30 dark:bg-green-900/5';
      case 'discrepancy': return 'bg-red-50 dark:bg-red-900/10';
      default: return '';
    }
  };
  
  const isIvaType = type === 'iva' || type === 'ambos';
  const isModelo10Type = type === 'modelo10' || type === 'ambos';
  
  return (
    <ZenCard className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-lg">Detalhe por Registo</CardTitle>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar NIF ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos ({allRecords.length})</SelectItem>
                <SelectItem value="perfect">Perfeitos ({result.summary.perfectMatches})</SelectItem>
                <SelectItem value="tolerance">Tolerância ({result.summary.withinTolerance})</SelectItem>
                <SelectItem value="discrepancy">Discrepâncias ({result.summary.outsideTolerance})</SelectItem>
                <SelectItem value="missing">Em Falta ({result.missing.length})</SelectItem>
                <SelectItem value="extra">Extras ({result.extra.length})</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Data</TableHead>
                {isIvaType && (
                  <>
                    <TableHead className="text-right">Total (Excel)</TableHead>
                    <TableHead className="text-right">Total (Sistema)</TableHead>
                    <TableHead className="text-right">IVA (Excel)</TableHead>
                    <TableHead className="text-right">IVA (Sistema)</TableHead>
                  </>
                )}
                {isModelo10Type && (
                  <>
                    <TableHead className="text-right">Bruto (Excel)</TableHead>
                    <TableHead className="text-right">Bruto (Sistema)</TableHead>
                    <TableHead className="text-right">Retenção (Excel)</TableHead>
                    <TableHead className="text-right">Retenção (Sistema)</TableHead>
                  </>
                )}
                <TableHead className="text-center">Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isIvaType ? 10 : 10} className="text-center text-muted-foreground py-8">
                    Nenhum registo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record, index) => {
                  const matched = record.type === 'matched' ? record.data as MatchedRecord : null;
                  const excel = matched?.excel || (record.type === 'missing' ? record.data as ExcelRecord : null);
                  const extracted = matched?.extracted || (record.type === 'extra' ? record.data as ExtractedRecord : null);
                  
                  const excelVat = excel 
                    ? (excel.vatStandard ?? 0) + (excel.vatIntermediate ?? 0) + (excel.vatReduced ?? 0)
                    : null;
                  const systemVat = extracted
                    ? (extracted.vatStandard ?? 0) + (extracted.vatIntermediate ?? 0) + (extracted.vatReduced ?? 0)
                    : null;
                  
                  return (
                    <TableRow 
                      key={index} 
                      className={getRowClassName(record.type, matched ?? undefined)}
                    >
                      <TableCell>{getRowIcon(record.type, matched ?? undefined)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {excel?.nif || extracted?.nif || '—'}
                      </TableCell>
                      <TableCell className="max-w-32 truncate">
                        {excel?.name || extracted?.name || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {excel?.documentDate?.toLocaleDateString('pt-PT') || 
                         extracted?.documentDate?.toLocaleDateString('pt-PT') || '—'}
                      </TableCell>
                      
                      {isIvaType && (
                        <>
                          <TableCell className="text-right font-mono">
                            {excel?.totalAmount !== undefined ? formatCurrency(excel.totalAmount) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {extracted?.totalAmount !== undefined ? formatCurrency(extracted.totalAmount) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {excelVat !== null ? formatCurrency(excelVat) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {systemVat !== null ? formatCurrency(systemVat) : '—'}
                          </TableCell>
                        </>
                      )}
                      
                      {isModelo10Type && (
                        <>
                          <TableCell className="text-right font-mono">
                            {excel?.grossAmount !== undefined ? formatCurrency(excel.grossAmount) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {extracted?.grossAmount !== undefined ? formatCurrency(extracted.grossAmount) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {excel?.withholdingAmount !== undefined ? formatCurrency(excel.withholdingAmount) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {extracted?.withholdingAmount !== undefined ? formatCurrency(extracted.withholdingAmount) : '—'}
                          </TableCell>
                        </>
                      )}
                      
                      <TableCell className="text-center">
                        {record.type === 'missing' ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Não extraído
                          </Badge>
                        ) : record.type === 'extra' ? (
                          <Badge variant="outline" className="text-blue-600 border-blue-300">
                            Extra
                          </Badge>
                        ) : matched ? (
                          <DeltaIndicator delta={matched.totalDelta} compact />
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {filteredRecords.length < allRecords.length && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Mostrando {filteredRecords.length} de {allRecords.length} registos
          </p>
        )}
      </CardContent>
    </ZenCard>
  );
}
