import { useState, useEffect } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Info, Calendar, Calculator, RefreshCw, Users } from 'lucide-react';
import { ZenCard, ZenHeader } from '@/components/zen';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateVATPayment, type VATPaymentResult } from '@/lib/vatCalculator';
import { useVATCalculation } from '@/hooks/useVATCalculation';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function VATPaymentCalculator() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [vatCollected, setVatCollected] = useState<string>('');
  const [vatDeductible, setVatDeductible] = useState<string>('');
  const [result, setResult] = useState<VATPaymentResult | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);

  // Check if user is accountant
  const { data: isAccountant } = useQuery({
    queryKey: ['is-accountant-vat', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'accountant')
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Get clients if accountant
  const { clients } = useClientManagement();

  // Get VAT calculation from real data
  const { data: vatData, isLoading, hasData } = useVATCalculation({
    forClientId: isAccountant ? selectedClientId : null,
    year: selectedYear,
    quarter: selectedQuarter,
  });

  // Pre-fill values from real data when available
  useEffect(() => {
    if (hasData && vatData && !isManualMode) {
      setVatCollected(vatData.vatCollected.toFixed(2).replace('.', ','));
      setVatDeductible(vatData.vatDeductible.toFixed(2).replace('.', ','));
    }
  }, [vatData, hasData, isManualMode]);

  // Calculate result when inputs change
  useEffect(() => {
    const collected = parseFloat(vatCollected.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const deductible = parseFloat(vatDeductible.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    
    if (collected > 0 || deductible > 0) {
      setResult(calculateVATPayment(collected, deductible));
    } else {
      setResult(null);
    }
  }, [vatCollected, vatDeductible]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  // Calculate deadline for selected quarter
  const getDeadlineForQuarter = (year: number, quarter: number) => {
    const deadlines: Record<number, { month: number; nextYear: boolean }> = {
      1: { month: 4, nextYear: false },  // May (0-indexed: 4)
      2: { month: 7, nextYear: false },  // August
      3: { month: 10, nextYear: false }, // November
      4: { month: 1, nextYear: true },   // February next year
    };
    const d = deadlines[quarter];
    const deadlineYear = d.nextYear ? year + 1 : year;
    return new Date(deadlineYear, d.month, 20);
  };

  const deadline = getDeadlineForQuarter(selectedYear, selectedQuarter);
  const daysUntilDeadline = Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const handleReset = () => {
    setIsManualMode(false);
    if (hasData && vatData) {
      setVatCollected(vatData.vatCollected.toFixed(2).replace('.', ','));
      setVatDeductible(vatData.vatDeductible.toFixed(2).replace('.', ','));
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const quarters = [
    { value: '1', label: '1º Trimestre (Jan-Mar)' },
    { value: '2', label: '2º Trimestre (Abr-Jun)' },
    { value: '3', label: '3º Trimestre (Jul-Set)' },
    { value: '4', label: '4º Trimestre (Out-Dez)' },
  ];

  return (
    <ZenCard className="p-6">
      <ZenHeader 
        title="IVA a Entregar ao Estado" 
        description="Calcule o IVA trimestral a pagar ou a recuperar"
        icon={Calculator}
      />

      <div className="space-y-6 mt-6">
        {/* Client Selector for Accountants */}
        {isAccountant && clients && clients.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cliente
            </Label>
            <Select value={selectedClientId || ''} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.full_name} {client.nif && `(${client.nif})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Period Selector */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ano</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Trimestre</Label>
            <Select value={selectedQuarter.toString()} onValueChange={(v) => setSelectedQuarter(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quarters.map((q) => (
                  <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Source Indicator */}
        {hasData && !isManualMode && (
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                Dados Automáticos
              </Badge>
              <span className="text-sm text-muted-foreground">
                {vatData?.salesCount ?? 0} vendas • {vatData?.purchasesCount ?? 0} compras
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsManualMode(true)}
              className="text-xs"
            >
              Ajustar manualmente
            </Button>
          </div>
        )}

        {isManualMode && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Modo manual activo</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              className="text-xs gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Repor automático
            </Button>
          </div>
        )}

        {!hasData && !isLoading && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Sem dados para o período</AlertTitle>
            <AlertDescription>
              Não foram encontradas faturas validadas para este trimestre. 
              Pode inserir valores manualmente abaixo.
            </AlertDescription>
          </Alert>
        )}

        {/* IVA Liquidado */}
        <div className="space-y-2">
          <Label htmlFor="collected" className="flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
            IVA Liquidado (cobrado aos clientes)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
            <Input
              id="collected"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={vatCollected}
              onChange={(e) => {
                setVatCollected(e.target.value);
                setIsManualMode(true);
              }}
              className="pl-8"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Total de IVA que cobrou nas suas facturas durante o trimestre
          </p>
        </div>

        {/* IVA Dedutível */}
        <div className="space-y-2">
          <Label htmlFor="deductible" className="flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4 text-green-500" />
            IVA Dedutível (pago a fornecedores)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
            <Input
              id="deductible"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={vatDeductible}
              onChange={(e) => {
                setVatDeductible(e.target.value);
                setIsManualMode(true);
              }}
              className="pl-8"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Total de IVA pago em compras e despesas relacionadas com a actividade
          </p>
        </div>

        {/* Resultado */}
        {result && (
          <div className={`rounded-lg p-5 space-y-4 ${
            result.isRecoverable 
              ? 'bg-green-500/10 border border-green-500/30' 
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {result.isRecoverable ? 'IVA a Recuperar' : 'IVA a Entregar'}
                </p>
                <p className={`text-3xl font-bold ${
                  result.isRecoverable ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(result.vatPayable)}
                </p>
              </div>
              {result.isRecoverable ? (
                <ArrowDownCircle className="h-12 w-12 text-green-500 opacity-50" />
              ) : (
                <ArrowUpCircle className="h-12 w-12 text-red-500 opacity-50" />
              )}
            </div>

            <div className="pt-3 border-t border-current/10 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA Liquidado</span>
                <span>{formatCurrency(result.vatCollected)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA Dedutível</span>
                <span>- {formatCurrency(result.vatDeductible)}</span>
              </div>
              <div className="flex justify-between font-medium pt-1 border-t border-current/10">
                <span>{result.isRecoverable ? 'A Recuperar' : 'A Entregar'}</span>
                <span className={result.isRecoverable ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(result.vatPayable)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Próximo Prazo */}
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertTitle>Prazo de Entrega</AlertTitle>
          <AlertDescription className="mt-2">
            <p>
              <strong>{selectedQuarter}º Trimestre {selectedYear}</strong>: até{' '}
              <strong>
                {deadline.toLocaleDateString('pt-PT', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </strong>
            </p>
            <p className={`text-sm mt-1 ${daysUntilDeadline <= 7 && daysUntilDeadline > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
              {daysUntilDeadline > 0 
                ? `Faltam ${daysUntilDeadline} dias`
                : daysUntilDeadline === 0 
                  ? 'Último dia para entrega!'
                  : 'Prazo expirado'
              }
            </p>
          </AlertDescription>
        </Alert>

        {/* Informação adicional */}
        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
          <p className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            <strong>Regime Trimestral:</strong> Aplica-se a volume de negócios até €650.000/ano
          </p>
          <p>
            A declaração periódica de IVA é entregue no Portal das Finanças.
            Se o IVA dedutível for superior ao liquidado, pode solicitar reembolso ou reportar crédito.
          </p>
        </div>
      </div>
    </ZenCard>
  );
}
