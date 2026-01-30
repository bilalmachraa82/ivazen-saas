import { useState, useEffect, useMemo } from 'react';
import { useProfile, SSProfileData } from '@/hooks/useProfile';
import { isValidCAECode, getCAEByCode } from '@/lib/caeData';
import { NifInput, validateNIF } from '@/components/ui/nif-input';
import { 
  WORKER_TYPES, 
  ACCOUNTING_REGIMES, 
  SS_RATES, 
  IAS_2025,
  CONTRIBUTION_RATES_BY_TYPE,
  RATE_DESCRIPTIONS,
  calculateContributionRate 
} from '@/hooks/useSocialSecurity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Briefcase, 
  Calculator, 
  Users, 
  Percent,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Leaf,
  Info,
  Sparkles,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CAEAutocomplete } from './CAEAutocomplete';
import { InfoIcon } from '@/components/ui/info-tooltip';

interface FiscalSetupWizardProps {
  onComplete: () => void;
  compact?: boolean;
}

interface CalculatedRate {
  rate: number;
  isExempt: boolean;
  reason: string;
}

export function FiscalSetupWizard({ onComplete, compact = false }: FiscalSetupWizardProps) {
  const { profile, updateSSProfile, isUpdatingSSProfile, updateProfile, isUpdating } = useProfile();
  const [step, setStep] = useState(1);
  const totalSteps = 5; // Added NIF step
  const [manualOverride, setManualOverride] = useState(false);
  
  // NIF state
  const [nif, setNif] = useState(profile?.nif || '');
  const [nifValid, setNifValid] = useState(false);
  
  // CAE state
  const [cae, setCae] = useState(profile?.cae || '');
  const [caeError, setCaeError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<SSProfileData>({
    workerType: 'independent',
    accountingRegime: 'simplified',
    hasOtherEmployment: false,
    otherEmploymentSalary: 0,
    taxableProfit: 0,
    ssContributionRate: 21.4,
    isFirstYear: false,
    hasAccountantSS: false,
  });
  
  // Sync NIF and CAE from profile when it loads
  useEffect(() => {
    if (profile?.nif) {
      setNif(profile.nif);
    }
    if (profile?.cae) {
      setCae(profile.cae);
    }
  }, [profile?.nif, profile?.cae]);
  
  // Handle CAE change from autocomplete
  const handleCaeChange = (value: string) => {
    setCae(value);
    
    if (value.length === 5) {
      if (isValidCAECode(value)) {
        setCaeError(null);
      } else {
        setCaeError('CAE fora do intervalo válido');
      }
    } else if (value.length > 0) {
      setCaeError('CAE deve ter 5 dígitos');
    } else {
      setCaeError('CAE é obrigatório');
    }
  };
  
  // Check if CAE is valid
  const isCaeValid = cae.length === 5 && isValidCAECode(cae);
  
  // Get CAE description for display
  const selectedCAEInfo = useMemo(() => getCAEByCode(cae), [cae]);
  
  // NIF validation is handled by NifInput component callback
  const handleNifValidation = (isValid: boolean) => {
    setNifValid(isValid);
  };

  // Check if NIF step is valid (NIF required, CAE required)
  const isNifValidCheck = nif.length === 9 && nifValid;
  const isStep1Valid = isNifValidCheck && isCaeValid;

  // Calculate rate dynamically based on form data
  const calculatedRate = useMemo<CalculatedRate>(() => {
    return calculateContributionRate(
      formData.workerType,
      formData.accountingRegime,
      formData.hasOtherEmployment,
      formData.otherEmploymentSalary,
      0, // Monthly relevant income - not known at setup time
      formData.isFirstYear
    );
  }, [
    formData.workerType,
    formData.accountingRegime,
    formData.hasOtherEmployment,
    formData.otherEmploymentSalary,
    formData.isFirstYear
  ]);

  // Auto-update contribution rate when calculated rate changes (unless manual override)
  useEffect(() => {
    if (!manualOverride) {
      setFormData(prev => ({
        ...prev,
        ssContributionRate: calculatedRate.rate
      }));
    }
  }, [calculatedRate.rate, manualOverride]);

  // Check if manual rate differs from calculated
  const ratesDiffer = formData.ssContributionRate !== calculatedRate.rate;

  const handleNext = () => {
    // Validate NIF and CAE on step 1 before proceeding
    if (step === 1) {
      if (!isNifValidCheck) {
        // NifInput will show error automatically
        return;
      }
      if (!isCaeValid) {
        setCaeError('CAE valido e obrigatorio');
        return;
      }
    }

    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = () => {
    // Save NIF and CAE first if changed, then SS profile
    const nifChanged = nif !== profile?.nif;
    const caeChanged = cae !== profile?.cae;
    
    if (nifChanged || caeChanged) {
      updateProfile({
        fullName: profile?.full_name || '',
        companyName: profile?.company_name || '',
        nif: nif,
        niss: profile?.niss || '',
        cae: cae,
        activityDescription: profile?.activity_description || '',
        vatRegime: profile?.vat_regime || 'normal',
      }, {
        onSuccess: () => {
          // Then update SS profile
          updateSSProfile(formData, {
            onSuccess: () => {
              onComplete();
            }
          });
        }
      });
    } else {
      updateSSProfile(formData, {
        onSuccess: () => {
          onComplete();
        }
      });
    }
  };

  const handleRateChange = (value: string) => {
    setManualOverride(true);
    setFormData({ ...formData, ssContributionRate: parseFloat(value) });
  };

  const handleUseCalculatedRate = () => {
    setManualOverride(false);
    setFormData({ ...formData, ssContributionRate: calculatedRate.rate });
  };

  const progress = (step / totalSteps) * 100;

  const wizardCard = (
    <Card className={`w-full max-w-lg shadow-2xl overflow-hidden relative ${compact ? 'border bg-card' : 'border-0 bg-card/90 backdrop-blur-sm'}`}>
      {/* Zen line decoration */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
      
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
            <Leaf className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-bold">IVAzen</span>
        </div>
        <CardTitle className="text-2xl">Configuração Fiscal</CardTitle>
        <CardDescription>
          Configure o seu perfil para cálculos precisos de Segurança Social
        </CardDescription>
        
        {/* Progress bar */}
        <div className="mt-4 space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Passo {step} de {totalSteps}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        {/* Step 1: NIF and CAE (Required) */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Identificação Fiscal</h3>
                <p className="text-sm text-muted-foreground">NIF e CAE obrigatórios</p>
              </div>
            </div>

            {/* NIF Field */}
            <NifInput
              id="wizard-nif"
              value={nif}
              onChange={setNif}
              onValidation={handleNifValidation}
              label="NIF (Numero de Contribuinte)"
              placeholder="123456789"
              required
              className="text-lg tracking-wider"
            />

            {/* CAE Field with Autocomplete */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                CAE (Código de Actividade Económica) *
                <InfoIcon term="cae" />
              </Label>
              <CAEAutocomplete
                value={cae}
                onChange={handleCaeChange}
                error={caeError}
                isValid={isCaeValid}
              />
              {caeError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {caeError}
                </p>
              )}
              {isCaeValid && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  CAE válido {selectedCAEInfo && `- ${selectedCAEInfo.sectionName}`}
                </p>
              )}
            </div>

            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-muted-foreground">
                O NIF e CAE são necessários para a classificação correcta das facturas e cálculos de Segurança Social.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 2: Worker Type */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Tipo de Trabalhador</h3>
                <p className="text-sm text-muted-foreground">Seleccione o seu tipo de actividade</p>
              </div>
            </div>

            <RadioGroup
              value={formData.workerType}
              onValueChange={(value) => setFormData({ ...formData, workerType: value })}
              className="space-y-3"
            >
              {WORKER_TYPES.map((type) => (
                <div
                  key={type.value}
                  className={`flex items-center space-x-3 p-4 rounded-xl border transition-all cursor-pointer ${
                    formData.workerType === type.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 hover:border-primary/50'
                  }`}
                  onClick={() => setFormData({ ...formData, workerType: type.value })}
                >
                  <RadioGroupItem value={type.value} id={type.value} />
                  <Label htmlFor={type.value} className="cursor-pointer flex-1">
                    <div className="flex items-center justify-between">
                      <span>{type.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {type.rate}%
                      </Badge>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {/* Dynamic rate preview based on worker type */}
            {formData.workerType && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Taxa aplicável: </span>
                  <Badge className="ml-1 bg-primary/20 text-primary hover:bg-primary/30">
                    {CONTRIBUTION_RATES_BY_TYPE[formData.workerType] || 21.4}%
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {RATE_DESCRIPTIONS[formData.workerType]}
                  </p>
                </div>
              </div>
            )}

            {(formData.workerType === 'agricultural' || formData.workerType === 'eni' || formData.workerType === 'eirl') && (
              <Alert className="bg-amber-500/10 border-amber-500/30">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  {formData.workerType === 'agricultural' 
                    ? 'Produtores agrícolas têm taxa contributiva de 25,2%.'
                    : 'ENI/EIRL têm taxa contributiva de 25,2% (rendimentos comerciais/industriais).'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 3: Accounting Regime */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Regime Contabilístico</h3>
                <p className="text-sm text-muted-foreground">Como faz a sua contabilidade?</p>
              </div>
            </div>

            <RadioGroup
              value={formData.accountingRegime}
              onValueChange={(value) => setFormData({ ...formData, accountingRegime: value })}
              className="space-y-3"
            >
              {ACCOUNTING_REGIMES.map((regime) => (
                <div
                  key={regime.value}
                  className={`flex items-center space-x-3 p-4 rounded-xl border transition-all cursor-pointer ${
                    formData.accountingRegime === regime.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 hover:border-primary/50'
                  }`}
                  onClick={() => setFormData({ ...formData, accountingRegime: regime.value })}
                >
                  <RadioGroupItem value={regime.value} id={regime.value} />
                  <Label htmlFor={regime.value} className="cursor-pointer flex-1">
                    {regime.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {formData.accountingRegime === 'organized' && (
              <div className="space-y-3 pt-4 border-t border-border/50">
                <Label htmlFor="taxableProfit">Lucro Tributável Anual (€)</Label>
                <Input
                  id="taxableProfit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.taxableProfit || ''}
                  onChange={(e) => setFormData({ ...formData, taxableProfit: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="bg-background/50"
                />
                <p className="text-xs text-muted-foreground">
                  Usado para calcular a base de incidência (mínimo: 1,5×IAS = {(IAS_2025 * 1.5).toFixed(2)}€)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Employment Accumulation */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Acumulação com TCO</h3>
                <p className="text-sm text-muted-foreground">Tem trabalho por conta de outrem?</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/50">
              <div className="space-y-1">
                <Label htmlFor="hasOtherEmployment">Acumulo com trabalho dependente</Label>
                <p className="text-xs text-muted-foreground">
                  Pode dar direito a isenção se rendimento {'<'} 4×IAS
                </p>
              </div>
              <Switch
                id="hasOtherEmployment"
                checked={formData.hasOtherEmployment}
                onCheckedChange={(checked) => setFormData({ ...formData, hasOtherEmployment: checked })}
              />
            </div>

            {formData.hasOtherEmployment && (
              <div className="space-y-3 pt-2">
                <Label htmlFor="salary">Remuneração Média Mensal TCO (€)</Label>
                <Input
                  id="salary"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.otherEmploymentSalary || ''}
                  onChange={(e) => setFormData({ ...formData, otherEmploymentSalary: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="bg-background/50"
                />
                <p className="text-xs text-muted-foreground">
                  Para isenção, o salário deve ser ≥ 1×IAS ({IAS_2025.toFixed(2)}€)
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/50 mt-4">
              <div className="space-y-1">
                <Label htmlFor="isFirstYear">Primeiro Ano de Actividade</Label>
                <p className="text-xs text-muted-foreground">
                  Isento de contribuições nos primeiros 12 meses
                </p>
              </div>
              <Switch
                id="isFirstYear"
                checked={formData.isFirstYear}
                onCheckedChange={(checked) => setFormData({ ...formData, isFirstYear: checked })}
              />
            </div>
          </div>
        )}

        {/* Step 5: Contribution Rate */}
        {step === 5 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Percent className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Taxa Contributiva</h3>
                <p className="text-sm text-muted-foreground">Taxa calculada automaticamente</p>
              </div>
            </div>

            {/* Calculated Rate Display */}
            <div className={`p-4 rounded-xl border-2 ${
              calculatedRate.isExempt 
                ? 'bg-green-500/5 border-green-500/30' 
                : 'bg-primary/5 border-primary/30'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className={`h-5 w-5 ${calculatedRate.isExempt ? 'text-green-600' : 'text-primary'}`} />
                  <span className="font-medium">Taxa Calculada Automaticamente</span>
                </div>
                <Badge 
                  className={`text-lg px-3 py-1 ${
                    calculatedRate.isExempt 
                      ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30' 
                      : 'bg-primary/20 text-primary hover:bg-primary/30'
                  }`}
                >
                  {calculatedRate.rate}%
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{calculatedRate.reason}</p>
              
              {calculatedRate.isExempt && (
                <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                  <Check className="h-4 w-4" />
                  <span>Isento de contribuições</span>
                </div>
              )}
            </div>

            {/* Manual Override Option */}
            {!calculatedRate.isExempt && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Ajustar taxa manualmente (opcional)</Label>
                  {ratesDiffer && !manualOverride && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      Modificada
                    </Badge>
                  )}
                </div>
                <Select
                  value={formData.ssContributionRate.toString()}
                  onValueChange={handleRateChange}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Seleccione a taxa" />
                  </SelectTrigger>
                  <SelectContent>
                    {SS_RATES.map((rate) => (
                      <SelectItem key={rate.value} value={rate.value}>
                        {rate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {ratesDiffer && manualOverride && (
                  <Alert className="bg-amber-500/10 border-amber-500/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-400 flex items-center justify-between">
                      <span>Taxa manual difere da calculada ({calculatedRate.rate}%)</span>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0 text-amber-700"
                        onClick={handleUseCalculatedRate}
                      >
                        Usar calculada
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/50 mt-4">
              <div className="space-y-1">
                <Label htmlFor="hasAccountantSS">SS gerida pelo contabilista</Label>
                <p className="text-xs text-muted-foreground">
                  O contabilista trata das declarações trimestrais
                </p>
              </div>
              <Switch
                id="hasAccountantSS"
                checked={formData.hasAccountantSS}
                onCheckedChange={(checked) => setFormData({ ...formData, hasAccountantSS: checked })}
              />
            </div>

            {/* Summary */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-3 mt-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Resumo da Configuração
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center justify-between">
                  <span>NIF:</span>
                  <span className="font-medium text-foreground font-mono">{nif}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>CAE:</span>
                  <span className="font-medium text-foreground font-mono">{cae}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Tipo:</span>
                  <span className="font-medium text-foreground">{WORKER_TYPES.find(t => t.value === formData.workerType)?.label}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Regime:</span>
                  <span className="font-medium text-foreground">{ACCOUNTING_REGIMES.find(r => r.value === formData.accountingRegime)?.label}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Taxa:</span>
                  <Badge className={calculatedRate.isExempt ? 'bg-green-500/20 text-green-700' : ''}>
                    {formData.ssContributionRate}%
                    {calculatedRate.isExempt && ' (Isento)'}
                  </Badge>
                </li>
                {formData.isFirstYear && (
                  <li className="flex items-center gap-2 text-green-600">
                    <Check className="h-3 w-3" />
                    <span>Isento - 1º ano de actividade</span>
                  </li>
                )}
                {formData.hasOtherEmployment && (
                  <li className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span>Acumula com TCO ({formData.otherEmploymentSalary?.toFixed(2)}€/mês)</span>
                  </li>
                )}
              </ul>

              {/* Legal Reference */}
              <div className="pt-3 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Fonte: Guia Prático do ISS, I.P. (v1.08, Março 2025) • Art. 168º do Código dos Regimes Contributivos
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={step === 1}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          {step < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={step === 1 && !isStep1Valid}
              className="gap-2"
            >
              Seguinte
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={isUpdatingSSProfile || isUpdating}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80"
            >
              {(isUpdatingSSProfile || isUpdating) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Concluir
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (compact) {
    return wizardCard;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
      
      {wizardCard}
    </div>
  );
}
