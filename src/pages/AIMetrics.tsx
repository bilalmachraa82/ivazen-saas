import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAIMetrics } from '@/hooks/useAIMetrics';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Loader2,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

export default function AIMetrics() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { metrics, isLoading, overallStats, calculatePrecision } = useAIMetrics();

  // Redirect if not logged in
  if (!authLoading && !user) {
    navigate('/auth');
    return null;
  }

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const getPrecisionColor = (precision: number) => {
    if (precision >= 90) return 'text-primary';
    if (precision >= 70) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getPrecisionBadge = (precision: number) => {
    if (precision >= 90) return 'default';
    if (precision >= 70) return 'secondary';
    return 'destructive';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Métricas IA</h1>
            <p className="text-muted-foreground">Análise de precisão da classificação automática</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Classificações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{overallStats.totalClassifications}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Correcções
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{overallStats.totalCorrections}</span>
            </CardContent>
          </Card>

          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Precisão Global
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <span className={`text-3xl font-bold ${getPrecisionColor(overallStats.overallPrecision)}`}>
                  {overallStats.overallPrecision}%
                </span>
                <Progress value={overallStats.overallPrecision} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Fornecedores Problemáticos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className={`text-3xl font-bold ${overallStats.problematicSuppliers > 0 ? 'text-destructive' : 'text-primary'}`}>
                {overallStats.problematicSuppliers}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Precision Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Níveis de Precisão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="default">≥90%</Badge>
                <span className="text-sm text-muted-foreground">Excelente - IA muito confiável</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">70-89%</Badge>
                <span className="text-sm text-muted-foreground">Aceitável - Revisão recomendada</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">&lt;70%</Badge>
                <span className="text-sm text-muted-foreground">Problemático - Necessita atenção</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Precisão por Fornecedor
            </CardTitle>
            <CardDescription>
              Análise detalhada da precisão da IA por fornecedor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead className="text-center">Classificações</TableHead>
                  <TableHead className="text-center">Correcções</TableHead>
                  <TableHead className="text-center">Precisão</TableHead>
                  <TableHead>Última Actividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Sem dados de métricas. As métricas serão registadas à medida que facturas são classificadas e validadas.
                    </TableCell>
                  </TableRow>
                ) : (
                  metrics.map((metric) => {
                    const precision = calculatePrecision(metric);
                    return (
                      <TableRow key={metric.id}>
                        <TableCell className="font-medium">
                          {metric.supplier_name || 'Desconhecido'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {metric.supplier_nif}
                        </TableCell>
                        <TableCell className="text-center">
                          {metric.total_classifications}
                        </TableCell>
                        <TableCell className="text-center">
                          {metric.total_corrections}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getPrecisionBadge(precision)}>
                            {precision}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {metric.last_classification_at 
                            ? new Date(metric.last_classification_at).toLocaleDateString('pt-PT')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Improvement Tips */}
        {overallStats.problematicSuppliers > 0 && (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                Sugestões de Melhoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <span>Ao validar facturas de fornecedores problemáticos, adicione classificações exemplo detalhadas</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <span>Verifique se o CAE e descrição de actividade do cliente estão correctamente preenchidos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <span>Considere criar regras específicas para categorias de despesa recorrentes</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
