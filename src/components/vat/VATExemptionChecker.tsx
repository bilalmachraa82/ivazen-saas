import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, HelpCircle, Calculator, Users, RefreshCw } from 'lucide-react';
import { ZenCard, ZenHeader } from '@/components/zen';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  checkVATExemption, 
  calculateProportionalThreshold,
  calculateToleranceThreshold,
  EXEMPTION_EXCLUSIONS, 
  VAT_CONFIG,
  type ExemptionCheckResult 
} from '@/lib/vatCalculator';
import { useVATCalculation } from '@/hooks/useVATCalculation';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export function VATExemptionChecker() {
  const { user } = useAuth();
  const [annualRevenue, setAnnualRevenue] = useState<string>('');
  const [isNewActivity, setIsNewActivity] = useState(false);
  const [startMonth, setStartMonth] = useState<string>('');
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [result, setResult] = useState<ExemptionCheckResult | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);

  // Check if user is accountant
  const { data: isAccountant } = useQuery({
    queryKey: ['is-accountant-exemption', user?.id],
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

  // Get annual turnover from real data
  const { annualTurnover, isLoading } = useVATCalculation({
    forClientId: isAccountant ? selectedClientId : null,
  });

  // Pre-fill revenue from real data
  useEffect(() => {
    if (annualTurnover > 0 && !isManualMode) {
      setAnnualRevenue(annualTurnover.toFixed(2).replace('.', ','));
    }
  }, [annualTurnover, isManualMode]);

  // Calculate result when inputs change
  useEffect(() => {
    const revenue = parseFloat(annualRevenue.replace(/[^\d.,]/g, '').replace(',', '.'));
    
    if (!isNaN(revenue) && revenue >= 0) {
      const monthValue = isNewActivity && startMonth ? parseInt(startMonth) : null;
      const checkResult = checkVATExemption(revenue, monthValue, exclusions);
      setResult(checkResult);
    } else {
      setResult(null);
    }
  }, [annualRevenue, isNewActivity, startMonth, exclusions]);

  const handleExclusionChange = (exclusionId: string, checked: boolean) => {
    if (checked) {
      setExclusions([...exclusions, exclusionId]);
    } else {
      setExclusions(exclusions.filter(id => id !== exclusionId));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const handleReset = () => {
    setIsManualMode(false);
    if (annualTurnover > 0) {
      setAnnualRevenue(annualTurnover.toFixed(2).replace('.', ','));
    }
  };

  // Calculate thresholds for display
  const threshold = isNewActivity && startMonth 
    ? calculateProportionalThreshold(parseInt(startMonth))
    : VAT_CONFIG.EXEMPTION_THRESHOLD;
  const toleranceThreshold = calculateToleranceThreshold(threshold);

  return (
    <ZenCard className="p-6">
      <ZenHeader 
        title="Verificador de Isenção de IVA" 
        description="Art. 53º do CIVA - Regime de isenção para pequenos contribuintes (2025)"
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

        {/* Data Source Indicator */}
        {annualTurnover > 0 && !isManualMode && (
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                Dados Reais
              </Badge>
              <span className="text-sm text-muted-foreground">
                Total de vendas validadas do ano actual
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
            <span className="text-sm text-muted-foreground">Modo manual activo - ideal para projecções</span>
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

        {/* Volume de Negócios */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="revenue">Volume de Negócios Anual (estimado ou real)</Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Total de rendimentos da sua actividade independente num ano civil. 
                   Inclui todos os serviços e vendas, mesmo os isentos de IVA.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
            <Input
              id="revenue"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={annualRevenue}
              onChange={(e) => {
                setAnnualRevenue(e.target.value);
                setIsManualMode(true);
              }}
              className="pl-8 text-lg"
            />
          </div>
        </div>

        {/* Início de Actividade */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="new-activity"
              checked={isNewActivity}
              onCheckedChange={(checked) => setIsNewActivity(checked as boolean)}
            />
            <Label htmlFor="new-activity" className="cursor-pointer">
              Iniciei actividade a meio do ano
            </Label>
          </div>

          {isNewActivity && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="start-month">Mês de início de actividade</Label>
              <Select value={startMonth} onValueChange={setStartMonth}>
                <SelectTrigger id="start-month" className="w-full">
                  <SelectValue placeholder="Seleccione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {startMonth && (
                <p className="text-sm text-muted-foreground">
                  Limiar proporcional: <strong>{formatCurrency(threshold)}</strong>
                  {' '}({13 - parseInt(startMonth)} meses)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Exclusões */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>Exclusões do Regime de Isenção</Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Mesmo abaixo do limiar, estas actividades obrigam a cobrar IVA desde o primeiro dia.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="space-y-2 ml-2">
            {EXEMPTION_EXCLUSIONS.map((exclusion) => (
              <div key={exclusion.id} className="flex items-start space-x-2">
                <Checkbox
                  id={exclusion.id}
                  checked={exclusions.includes(exclusion.id)}
                  onCheckedChange={(checked) => handleExclusionChange(exclusion.id, checked as boolean)}
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor={exclusion.id} className="cursor-pointer">
                    {exclusion.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{exclusion.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Limiares de Referência */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            Limiares de Referência (2025)
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Limiar de Isenção</p>
              <p className="font-medium text-lg">{formatCurrency(threshold)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Limiar de Tolerância (+25%)</p>
              <p className="font-medium text-lg">{formatCurrency(toleranceThreshold)}</p>
            </div>
          </div>
        </div>

        {/* Resultado */}
        {result && (
          <Alert 
            variant={result.isExempt ? 'default' : 'destructive'}
            className={result.isExempt ? 'border-green-500 bg-green-500/10' : ''}
          >
            {result.isExempt ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <AlertTitle className="text-lg">
              {result.isExempt ? 'Isento de IVA' : 'Obrigado a Cobrar IVA'}
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p>{result.reason}</p>
              {result.alert && (
                <div className="flex items-start gap-2 mt-3 p-2 bg-background/50 rounded">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium">{result.alert}</p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </ZenCard>
  );
}
