import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, BarChart3, PieChart, Plus } from 'lucide-react';
import { ZenEmptyState } from '@/components/zen';

interface Declaration {
  id: string;
  period_quarter: string;
  total_revenue: number;
  contribution_base: number;
  contribution_amount: number;
  contribution_rate: number;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

interface RevenueChartsProps {
  declarationsHistory: Declaration[];
  getQuarterLabel: (quarter: string) => string;
}

const chartConfig = {
  revenue: {
    label: 'Rendimento',
    color: 'hsl(var(--primary))',
  },
  contribution: {
    label: 'Contribuição',
    color: 'hsl(var(--destructive))',
  },
  base: {
    label: 'Base Incidência',
    color: 'hsl(var(--muted-foreground))',
  },
} satisfies ChartConfig;

function getShortQuarterLabel(quarter: string): string {
  const [year, q] = quarter.split('-Q');
  return `T${q} ${year.slice(2)}`;
}

export function RevenueCharts({ declarationsHistory, getQuarterLabel }: RevenueChartsProps) {
  const navigate = useNavigate();
  
  const chartData = useMemo(() => {
    if (!declarationsHistory || declarationsHistory.length === 0) {
      return [];
    }

    // Sort by quarter ascending and get last 8
    const sorted = [...declarationsHistory]
      .sort((a, b) => {
        const [yearA, qA] = a.period_quarter.split('-Q');
        const [yearB, qB] = b.period_quarter.split('-Q');
        if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
        return parseInt(qA) - parseInt(qB);
      })
      .slice(-8);

    return sorted.map((decl) => ({
      quarter: getShortQuarterLabel(decl.period_quarter),
      fullLabel: getQuarterLabel(decl.period_quarter),
      revenue: Number(decl.total_revenue),
      contribution: Number(decl.contribution_amount),
      base: Number(decl.contribution_base),
    }));
  }, [declarationsHistory, getQuarterLabel]);

  const stats = useMemo(() => {
    if (chartData.length < 2) return null;

    const current = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];
    
    const revenueChange = previous.revenue > 0 
      ? ((current.revenue - previous.revenue) / previous.revenue) * 100 
      : 0;
    
    const avgRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0) / chartData.length;
    const avgContribution = chartData.reduce((sum, d) => sum + d.contribution, 0) / chartData.length;
    const totalContributions = chartData.reduce((sum, d) => sum + d.contribution, 0);

    return {
      revenueChange,
      avgRevenue,
      avgContribution,
      totalContributions,
    };
  }, [chartData]);

  // Empty state when no data
  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ZenEmptyState
            icon={PieChart}
            title="Sem dados para gráficos"
            description="Adicione rendimentos e guarde declarações para visualizar a evolução ao longo do tempo"
            variant="primary"
            action={{
              label: 'Adicionar Rendimento',
              onClick: () => {
                // Scroll to declaration tab or trigger add dialog
                const declarationTab = document.querySelector('[value="declaration"]') as HTMLElement;
                declarationTab?.click();
              },
              icon: Plus,
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Variação Trimestral</p>
              <p className={`text-2xl font-bold ${stats.revenueChange >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {stats.revenueChange >= 0 ? '+' : ''}{stats.revenueChange.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Média Rendimentos</p>
              <p className="text-2xl font-bold">{stats.avgRevenue.toFixed(0)}€</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Média Contribuição</p>
              <p className="text-2xl font-bold">{stats.avgContribution.toFixed(0)}€</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Contribuições</p>
              <p className="text-2xl font-bold text-primary">{stats.totalContributions.toFixed(0)}€</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução dos Rendimentos
          </CardTitle>
          <CardDescription>
            Rendimentos trimestrais ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="quarter" 
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}€`}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value, name) => [`${Number(value).toFixed(2)}€`, name === 'revenue' ? 'Rendimento' : 'Base']}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                name="revenue"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Contributions Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Rendimentos vs Contribuições
          </CardTitle>
          <CardDescription>
            Comparação entre rendimentos e contribuições por trimestre
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="quarter" 
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}€`}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        revenue: 'Rendimento',
                        contribution: 'Contribuição',
                      };
                      return [`${Number(value).toFixed(2)}€`, labels[name as string] || name];
                    }}
                  />
                }
              />
              <Legend 
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    revenue: 'Rendimento',
                    contribution: 'Contribuição',
                  };
                  return labels[value] || value;
                }}
              />
              <Bar 
                dataKey="revenue" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                name="revenue"
              />
              <Bar 
                dataKey="contribution" 
                fill="hsl(var(--destructive))" 
                radius={[4, 4, 0, 0]}
                name="contribution"
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
