import { useMemo } from 'react';
import { ZenCard } from '@/components/zen';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, PieChart, TrendingUp, Building, Home } from 'lucide-react';
import { TaxWithholding } from '@/hooks/useWithholdings';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface WithholdingDashboardProps {
  withholdings: TaxWithholding[];
  selectedYear: number;
}

const CATEGORY_COLORS = {
  B: 'hsl(217, 91%, 60%)', // Blue
  E: 'hsl(270, 50%, 60%)', // Purple
  F: 'hsl(142, 71%, 45%)', // Green
};

const CATEGORY_LABELS = {
  B: 'Cat. B - Empresarial',
  E: 'Cat. E - Capitais',
  F: 'Cat. F - Prediais',
};

const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function WithholdingDashboard({ withholdings, selectedYear }: WithholdingDashboardProps) {
  // Calculate data for category distribution pie chart
  const categoryData = useMemo(() => {
    const categories = ['B', 'E', 'F'] as const;
    return categories.map(cat => {
      const items = withholdings.filter(w => w.income_category === cat);
      return {
        name: CATEGORY_LABELS[cat],
        value: items.reduce((sum, w) => sum + Number(w.gross_amount), 0),
        withholding: items.reduce((sum, w) => sum + Number(w.withholding_amount), 0),
        count: items.length,
        category: cat,
      };
    }).filter(d => d.count > 0);
  }, [withholdings]);

  // Calculate monthly evolution data
  const monthlyData = useMemo(() => {
    const monthlyMap = new Map<number, { gross: number; withholding: number; count: number }>();
    
    // Initialize all months
    for (let i = 0; i < 12; i++) {
      monthlyMap.set(i, { gross: 0, withholding: 0, count: 0 });
    }
    
    // Aggregate data by month
    withholdings.forEach(w => {
      const month = new Date(w.payment_date).getMonth();
      const current = monthlyMap.get(month)!;
      current.gross += Number(w.gross_amount);
      current.withholding += Number(w.withholding_amount);
      current.count += 1;
    });
    
    return MONTHS_PT.map((name, index) => ({
      name,
      month: index,
      bruto: monthlyMap.get(index)!.gross,
      retido: monthlyMap.get(index)!.withholding,
      liquido: monthlyMap.get(index)!.gross - monthlyMap.get(index)!.withholding,
      count: monthlyMap.get(index)!.count,
    }));
  }, [withholdings]);

  // Calculate category by month data for stacked bar chart
  const categoryByMonthData = useMemo(() => {
    const monthlyMap = new Map<number, { B: number; E: number; F: number }>();
    
    // Initialize all months
    for (let i = 0; i < 12; i++) {
      monthlyMap.set(i, { B: 0, E: 0, F: 0 });
    }
    
    // Aggregate data by month and category
    withholdings.forEach(w => {
      const month = new Date(w.payment_date).getMonth();
      const current = monthlyMap.get(month)!;
      current[w.income_category] += Number(w.gross_amount);
    });
    
    return MONTHS_PT.map((name, index) => ({
      name,
      ...monthlyMap.get(index)!,
    }));
  }, [withholdings]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-PT', { 
      style: 'currency', 
      currency: 'EUR',
      maximumFractionDigits: 0,
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Bruto: {formatCurrency(data.value)}
          </p>
          <p className="text-sm text-destructive">
            Retido: {formatCurrency(data.withholding)}
          </p>
          <p className="text-sm text-muted-foreground">
            Documentos: {data.count}
          </p>
        </div>
      );
    }
    return null;
  };

  if (withholdings.length === 0) {
    return (
      <ZenCard>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Sem dados para mostrar.</p>
            <p className="text-sm">Adicione retenções para ver o dashboard.</p>
          </div>
        </CardContent>
      </ZenCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Category Distribution & Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution Pie Chart */}
        <ZenCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Distribuição por Categoria
            </CardTitle>
            <CardDescription>
              Rendimentos brutos por categoria de rendimento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name.split(' - ')[0]} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CATEGORY_COLORS[entry.category as keyof typeof CATEGORY_COLORS]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </ZenCard>

        {/* Monthly Evolution Line Chart */}
        <ZenCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução Mensal {selectedYear}
            </CardTitle>
            <CardDescription>
              Rendimentos brutos, retenções e líquidos por mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="bruto" 
                    name="Bruto" 
                    stroke="hsl(217, 91%, 60%)" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(217, 91%, 60%)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="retido" 
                    name="Retido" 
                    stroke="hsl(0, 84%, 60%)" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(0, 84%, 60%)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="liquido" 
                    name="Líquido" 
                    stroke="hsl(142, 71%, 45%)" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(142, 71%, 45%)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </ZenCard>
      </div>

      {/* Row 2: Stacked Bar Chart by Category */}
      <ZenCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Rendimentos por Categoria e Mês
          </CardTitle>
          <CardDescription>
            Distribuição mensal de rendimentos brutos por categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryByMonthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  dataKey="B" 
                  name="Cat. B - Empresarial" 
                  stackId="a" 
                  fill={CATEGORY_COLORS.B} 
                />
                <Bar 
                  dataKey="E" 
                  name="Cat. E - Capitais" 
                  stackId="a" 
                  fill={CATEGORY_COLORS.E} 
                />
                <Bar 
                  dataKey="F" 
                  name="Cat. F - Prediais" 
                  stackId="a" 
                  fill={CATEGORY_COLORS.F} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </ZenCard>

      {/* Row 3: Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ZenCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cat. B</p>
              <p className="font-semibold">
                {formatCurrency(categoryData.find(c => c.category === 'B')?.value || 0)}
              </p>
            </div>
          </div>
        </ZenCard>

        <ZenCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cat. E</p>
              <p className="font-semibold">
                {formatCurrency(categoryData.find(c => c.category === 'E')?.value || 0)}
              </p>
            </div>
          </div>
        </ZenCard>

        <ZenCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Home className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cat. F</p>
              <p className="font-semibold">
                {formatCurrency(categoryData.find(c => c.category === 'F')?.value || 0)}
              </p>
            </div>
          </div>
        </ZenCard>

        <ZenCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <BarChart3 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taxa Média</p>
              <p className="font-semibold">
                {withholdings.length > 0 
                  ? ((withholdings.reduce((sum, w) => sum + Number(w.withholding_amount), 0) / 
                      withholdings.reduce((sum, w) => sum + Number(w.gross_amount), 0)) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
          </div>
        </ZenCard>
      </div>
    </div>
  );
}
