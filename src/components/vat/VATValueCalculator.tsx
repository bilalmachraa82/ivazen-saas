import { useState, useEffect } from 'react';
import { Calculator, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { ZenCard, ZenHeader } from '@/components/zen';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  calculateVAT, 
  calculateVATReverse, 
  getAvailableVATRates, 
  getAvailableRegions,
  type RegionKey,
  type RateType,
  type VATCalculationResult 
} from '@/lib/vatCalculator';

export function VATValueCalculator() {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [inputValue, setInputValue] = useState<string>('');
  const [region, setRegion] = useState<RegionKey>('CONTINENTAL');
  const [rateType, setRateType] = useState<RateType>('standard');
  const [result, setResult] = useState<VATCalculationResult | null>(null);

  const regions = getAvailableRegions();
  const rates = getAvailableVATRates(region);

  // Calcular resultado quando os inputs mudam
  useEffect(() => {
    const value = parseFloat(inputValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    
    if (!isNaN(value) && value > 0) {
      if (mode === 'add') {
        setResult(calculateVAT(value, region, rateType));
      } else {
        setResult(calculateVATReverse(value, region, rateType));
      }
    } else {
      setResult(null);
    }
  }, [inputValue, region, rateType, mode]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const handleReset = () => {
    setInputValue('');
    setResult(null);
  };

  return (
    <ZenCard className="p-6">
      <ZenHeader 
        title="Calculadora de IVA" 
        description="Calcule valores com e sem IVA incluído"
        icon={Calculator}
      />

      <div className="space-y-6 mt-6">
        {/* Modo de Cálculo */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'add' | 'remove')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Adicionar IVA
            </TabsTrigger>
            <TabsTrigger value="remove" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Retirar IVA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Insira o valor <strong>sem IVA</strong> para calcular o total com IVA incluído.
            </p>
          </TabsContent>
          
          <TabsContent value="remove" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Insira o valor <strong>com IVA</strong> para descobrir o valor base e o IVA incluído.
            </p>
          </TabsContent>
        </Tabs>

        {/* Valor */}
        <div className="space-y-2">
          <Label htmlFor="value">
            {mode === 'add' ? 'Valor sem IVA' : 'Valor com IVA'}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
            <Input
              id="value"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-8 text-lg"
            />
          </div>
        </div>

        {/* Região e Taxa */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="region">Região</Label>
            <Select value={region} onValueChange={(v) => setRegion(v as RegionKey)}>
              <SelectTrigger id="region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">Taxa de IVA</Label>
            <Select value={rateType} onValueChange={(v) => setRateType(v as RateType)}>
              <SelectTrigger id="rate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rates.map((r) => (
                  <SelectItem key={r.type} value={r.type}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Resultado */}
        {result && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Resultado</h4>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Valor Base</p>
                <p className="text-lg font-semibold">{formatCurrency(result.baseValue)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">IVA ({result.rate}%)</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(result.vatAmount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Total c/ IVA</p>
                <p className="text-lg font-semibold">{formatCurrency(result.totalWithVAT)}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Taxa aplicada: {result.rate}% ({result.region})
            </p>
          </div>
        )}
      </div>
    </ZenCard>
  );
}
