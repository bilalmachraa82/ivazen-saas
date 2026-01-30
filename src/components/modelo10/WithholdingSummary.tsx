import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ZenCard, ZenStatsCard } from '@/components/zen';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, Home, FileText, Euro, Calculator, TrendingUp } from 'lucide-react';
import { WithholdingSummary as SummaryType } from '@/hooks/useWithholdings';

interface WithholdingSummaryProps {
  summary: SummaryType[];
  totals: {
    gross: number;
    withholding: number;
    count: number;
    categoryB: number;
    categoryE: number;
    categoryF: number;
  };
  selectedYear: number;
}

export function WithholdingSummary({ summary, totals, selectedYear }: WithholdingSummaryProps) {
  const getCategoryLabel = (category: 'A' | 'B' | 'E' | 'F' | 'G' | 'H' | 'R') => {
    const labels: Record<string, string> = {
      'A': 'Categoria A',
      'B': 'Categoria B',
      'E': 'Categoria E',
      'F': 'Categoria F',
      'G': 'Categoria G',
      'H': 'Categoria H',
      'R': 'Categoria R',
    };
    return labels[category] || `Categoria ${category}`;
  };

  const getLocationLabel = (code: string) => {
    switch (code) {
      case 'C': return 'Continente';
      case 'RA': return 'Açores';
      case 'RM': return 'Madeira';
      default: return code;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <ZenStatsCard
          label="Total Bruto"
          value={totals.gross.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
          icon={Euro}
        />
        <ZenStatsCard
          label="Total Retido"
          value={totals.withholding.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
          icon={Calculator}
        />
        <ZenStatsCard
          label="Categoria B"
          value={totals.categoryB.toString()}
          icon={Building}
        />
        <ZenStatsCard
          label="Categoria E"
          value={totals.categoryE.toString()}
          icon={TrendingUp}
        />
        <ZenStatsCard
          label="Categoria F"
          value={totals.categoryF.toString()}
          icon={Home}
        />
      </div>

      {/* Quadro 5 Preview */}
      <ZenCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resumo por Beneficiário - Quadro 5
          </CardTitle>
          <CardDescription>
            Agregação de rendimentos e retenções por NIF para o Modelo 10 de {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Sem dados para mostrar. Adicione retenções para ver o resumo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NIF</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Rendimento Bruto</TableHead>
                    <TableHead className="text-right">Retenção</TableHead>
                    <TableHead className="text-center">Nº Docs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((s, idx) => {
                    const getCategoryStyle = (cat: string) => {
                      const styles: Record<string, string> = {
                        'A': 'bg-sky-500/10 text-sky-600',
                        'B': 'bg-blue-500/10 text-blue-600',
                        'E': 'bg-purple-500/10 text-purple-600',
                        'F': 'bg-green-500/10 text-green-600',
                        'G': 'bg-amber-500/10 text-amber-600',
                        'H': 'bg-teal-500/10 text-teal-600',
                        'R': 'bg-rose-500/10 text-rose-600',
                      };
                      return styles[cat] || 'bg-gray-500/10 text-gray-600';
                    };
                    
                    return (
                    <TableRow key={idx}>
                      <TableCell className="font-mono font-medium">
                        {s.beneficiary_nif}
                      </TableCell>
                      <TableCell>{s.beneficiary_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getCategoryStyle(s.income_category)}>
                          {s.income_category === 'F' ? (
                            <Home className="h-3 w-3 mr-1" />
                          ) : (
                            <Building className="h-3 w-3 mr-1" />
                          )}
                          {getCategoryLabel(s.income_category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getLocationLabel(s.location_code)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {s.total_gross.toLocaleString('pt-PT', { 
                          style: 'currency', 
                          currency: 'EUR' 
                        })}
                      </TableCell>
                      <TableCell className="text-right text-destructive font-medium">
                        {s.total_withholding.toLocaleString('pt-PT', { 
                          style: 'currency', 
                          currency: 'EUR' 
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{s.count}</Badge>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>TOTAL</TableCell>
                    <TableCell className="text-right">
                      {totals.gross.toLocaleString('pt-PT', { 
                        style: 'currency', 
                        currency: 'EUR' 
                      })}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {totals.withholding.toLocaleString('pt-PT', { 
                        style: 'currency', 
                        currency: 'EUR' 
                      })}
                    </TableCell>
                    <TableCell className="text-center">{totals.count}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </ZenCard>
    </div>
  );
}
