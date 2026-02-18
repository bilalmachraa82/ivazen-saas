import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, ProfileFormData } from '@/hooks/useProfile';
import { useClientManagement } from '@/hooks/useClientManagement';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Building2, User, Shield, Settings as SettingsIcon, Mail, Smartphone, Download, CheckCircle, AlertTriangle, RotateCcw, HelpCircle, Briefcase, Calculator, Wand2, Bell, Users, Palette, Moon, Sun, Database } from 'lucide-react';
import { ZenCard, ZenHeader, ZenDecorations } from '@/components/zen';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Link } from 'react-router-dom';
import { validateNISS } from '@/lib/utils';
import { NifInput } from '@/components/ui/nif-input';
import { useInteractiveTour } from '@/components/onboarding/InteractiveTour';
import { FiscalSetupWizard } from '@/components/onboarding/FiscalSetupWizard';
import { WORKER_TYPES, ACCOUNTING_REGIMES, SS_RATES } from '@/hooks/useSocialSecurity';
import { ClientManagementPanel } from '@/components/settings/ClientManagementPanel';
import { MyAccountantsPanel } from '@/components/settings/MyAccountantsPanel';
import { NotificationPreferences } from '@/components/settings/NotificationPreferences';
import { DatabaseImporter } from '@/components/settings/DatabaseImporter';
import { InfoIcon } from '@/components/ui/info-tooltip';
import { useTheme } from 'next-themes';

const VAT_REGIMES = [
  { value: 'normal', label: 'Regime Normal' },
  { value: 'simplified', label: 'Regime Simplificado' },
  { value: 'exempt', label: 'Isento de IVA' },
  { value: 'small', label: 'Pequenos Retalhistas' },
];

// SS_RATES imported from useSocialSecurity hook

export default function Settings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const {
    profile,
    accountant,
    isLoading,
    updateProfile,
    isUpdating,
    removeAccountant,
    isRemoving,
  } = useProfile();

  const { isInstalled, isIOS, canInstall, promptInstall } = usePWAInstall();
  const { resetTour, isTourCompleted } = useInteractiveTour();
  const { isAccountant } = useClientManagement();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showTourResetConfirm, setShowTourResetConfirm] = useState(false);
  const [showFiscalWizard, setShowFiscalWizard] = useState(false);
  const [activeTab, setActiveTab] = useState('perfil');
  const [formData, setFormData] = useState<ProfileFormData>({
    fullName: '',
    companyName: '',
    nif: '',
    niss: '',
    cae: '',
    activityDescription: '',
    vatRegime: 'normal',
  });

  // SS Settings
  const [ssContributionRate, setSsContributionRate] = useState('21.4');
  const [isFirstYear, setIsFirstYear] = useState(false);
  const [hasAccountantSS, setHasAccountantSS] = useState(false);
  const [hasOtherEmployment, setHasOtherEmployment] = useState(false);
  const [otherEmploymentSalary, setOtherEmploymentSalary] = useState('');
  const [workerType, setWorkerType] = useState('independent');
  const [accountingRegime, setAccountingRegime] = useState('simplified');
  const [taxableProfit, setTaxableProfit] = useState('');
  const [isSavingSS, setIsSavingSS] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // NISS validation state
  const [nissError, setNissError] = useState<string | undefined>(undefined);
  const [nifValid, setNifValid] = useState<boolean>(true);

  // Theme mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = resolvedTheme || theme;
  const isDark = currentTheme === 'dark';

  // Populate form with profile data
  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        companyName: profile.company_name || '',
        nif: profile.nif || '',
        niss: profile.niss || '',
        cae: profile.cae || '',
        activityDescription: profile.activity_description || '',
        vatRegime: profile.vat_regime || 'normal',
      });
      setSsContributionRate(String(profile.ss_contribution_rate || 21.4));
      setIsFirstYear(profile.is_first_year || false);
      setHasAccountantSS(profile.has_accountant_ss || false);
      setHasOtherEmployment(profile.has_other_employment || false);
      setOtherEmploymentSalary(String(profile.other_employment_salary || ''));
      setWorkerType(profile.worker_type || 'independent');
      setAccountingRegime(profile.accounting_regime || 'simplified');
      setTaxableProfit(String(profile.taxable_profit || ''));
    }
  }, [profile]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      toast.error('O nome e obrigatorio');
      return;
    }

    if (formData.nif && !nifValid) {
      toast.error('NIF invalido - verifique o digito de controlo');
      return;
    }

    if (formData.cae && formData.cae.length !== 5) {
      toast.error('O CAE deve ter 5 digitos');
      return;
    }

    updateProfile(formData);
  };

  const handleSaveSSSettings = async () => {
    if (!user?.id) return;

    setIsSavingSS(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ss_contribution_rate: parseFloat(ssContributionRate),
          is_first_year: isFirstYear,
          has_accountant_ss: hasAccountantSS,
          has_other_employment: hasOtherEmployment,
          other_employment_salary: hasOtherEmployment ? parseFloat(otherEmploymentSalary) || 0 : 0,
          worker_type: workerType,
          accounting_regime: accountingRegime,
          taxable_profit: accountingRegime === 'organized' ? parseFloat(taxableProfit) || 0 : 0,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Definicoes SS guardadas');
    } catch (error) {
      console.error('Save SS settings error:', error);
      toast.error('Erro ao guardar definicoes SS');
    } finally {
      setIsSavingSS(false);
    }
  };

  // Tab configuration
  const tabs = [
    { value: 'perfil', label: 'Perfil', icon: User },
    { value: 'fiscal', label: 'Fiscal', icon: Calculator },
    { value: 'notificacoes', label: 'Notificacoes', icon: Bell },
    { value: 'contabilistas', label: isAccountant ? 'Clientes' : 'Contabilistas', icon: Users },
    { value: 'importar', label: 'Importar', icon: Database },
    { value: 'aplicacao', label: 'Aplicacao', icon: Palette },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in relative">
        <ZenDecorations />

        <ZenHeader
          icon={SettingsIcon}
          title="Definicoes"
          description="Configure o seu perfil e preferencias com tranquilidade"
        />

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Mobile: Select dropdown */}
            <div className="block sm:hidden mb-4">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full bg-background/50 border-border/50">
                  <SelectValue>
                    {tabs.find(t => t.value === activeTab)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tabs.map((tab) => (
                    <SelectItem key={tab.value} value={tab.value}>
                      <div className="flex items-center gap-2">
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop: Horizontal scrollable tabs */}
            <TabsList className="hidden sm:inline-flex w-full justify-start gap-1 bg-muted/50 p-1 overflow-x-auto">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Tab: Perfil */}
            <TabsContent value="perfil" className="mt-6 space-y-6">
              {/* Profile Form */}
              <form onSubmit={handleSubmit}>
                <ZenCard gradient="default" withLine className="shadow-xl" animationDelay="0ms">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      Informacoes da Empresa
                    </CardTitle>
                    <CardDescription>
                      Estas informacoes ajudam a IA a classificar melhor as suas facturas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-sm font-medium">Nome Completo *</Label>
                        <Input
                          id="fullName"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          placeholder="O seu nome"
                          className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyName" className="text-sm font-medium">Nome da Empresa</Label>
                        <Input
                          id="companyName"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="Nome comercial"
                          className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <NifInput
                        id="nif"
                        value={formData.nif}
                        onChange={(value) => setFormData({ ...formData, nif: value })}
                        onValidation={(isValid) => setNifValid(isValid)}
                        label="NIF"
                        placeholder="123456789"
                      />
                      <div className="space-y-2">
                        <Label htmlFor="niss" className="text-sm font-medium flex items-center gap-2">
                          NISS
                          <InfoIcon term="niss" />
                        </Label>
                        <Input
                          id="niss"
                          value={formData.niss}
                          onChange={(e) => {
                            setFormData({ ...formData, niss: e.target.value.replace(/\D/g, '') });
                            if (nissError) setNissError(undefined);
                          }}
                          onBlur={(e) => {
                            const result = validateNISS(e.target.value);
                            setNissError(result.error);
                          }}
                          placeholder="12345678901"
                          maxLength={11}
                          aria-invalid={!!nissError}
                          aria-describedby={nissError ? "niss-error" : undefined}
                          className={`bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors font-mono ${
                            nissError ? 'border-destructive focus:border-destructive' : ''
                          }`}
                        />
                        {nissError ? (
                          <p id="niss-error" className="text-xs text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {nissError}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            N Seg. Social (11 digitos) - para Quick Access
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cae" className="text-sm font-medium">CAE Principal</Label>
                        <Input
                          id="cae"
                          value={formData.cae}
                          onChange={(e) => setFormData({ ...formData, cae: e.target.value.replace(/\D/g, '') })}
                          placeholder="56101"
                          maxLength={5}
                          className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                          Codigo de Actividade Economica
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vatRegime" className="text-sm font-medium">Regime de IVA</Label>
                        <Select
                          value={formData.vatRegime}
                          onValueChange={(value) => setFormData({ ...formData, vatRegime: value })}
                        >
                          <SelectTrigger id="vatRegime" className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                            <SelectValue placeholder="Seleccione o regime" />
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_REGIMES.map((regime) => (
                              <SelectItem key={regime.value} value={regime.value}>
                                {regime.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="activity" className="text-sm font-medium">Descricao da Actividade</Label>
                      <Textarea
                        id="activity"
                        value={formData.activityDescription}
                        onChange={(e) => setFormData({ ...formData, activityDescription: e.target.value })}
                        placeholder="Descreva brevemente a actividade da sua empresa (ex: Cafe e pastelaria, servicos de consultoria, etc.)"
                        rows={3}
                        className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Esta descricao ajuda a IA a entender melhor o contexto das suas despesas
                      </p>
                    </div>

                    <Button type="submit" className="zen-button gap-2 shadow-lg hover:shadow-xl transition-all duration-300" disabled={isUpdating}>
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {isUpdating ? 'A guardar...' : 'Guardar Alteracoes'}
                    </Button>
                  </CardContent>
                </ZenCard>
              </form>

              {/* Account Info */}
              <ZenCard gradient="muted" withCircle className="shadow-lg" animationDelay="100ms">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-muted to-muted/50">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    Conta
                  </CardTitle>
                  <CardDescription>
                    Informacoes da sua conta
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Email</Label>
                    <Input
                      value={user.email || ''}
                      disabled
                      className="bg-muted/50 border-border/30 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">ID da Conta</Label>
                    <Input
                      value={user.id}
                      disabled
                      className="bg-muted/50 border-border/30 font-mono text-xs"
                    />
                  </div>
                </CardContent>
              </ZenCard>
            </TabsContent>

            {/* Tab: Fiscal */}
            <TabsContent value="fiscal" className="mt-6 space-y-6">
              {/* Social Security Settings */}
              <ZenCard gradient="default" withLine className="shadow-xl" animationDelay="0ms">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    Seguranca Social
                  </CardTitle>
                  <CardDescription>
                    Configure as suas definicoes de contribuicoes conforme a legislacao oficial
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Worker Type */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      Tipo de Trabalhador
                    </Label>
                    <Select value={workerType} onValueChange={setWorkerType}>
                      <SelectTrigger className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKER_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Accounting Regime */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      Regime Contabilistico
                    </Label>
                    <Select value={accountingRegime} onValueChange={setAccountingRegime}>
                      <SelectTrigger className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNTING_REGIMES.map((regime) => (
                          <SelectItem key={regime.value} value={regime.value}>
                            {regime.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {accountingRegime === 'organized' && (
                      <div className="mt-3 space-y-2">
                        <Label className="text-sm font-medium">Lucro Tributavel (EUR)</Label>
                        <Input
                          type="number"
                          value={taxableProfit}
                          onChange={(e) => setTaxableProfit(e.target.value)}
                          placeholder="0.00"
                          className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
                        />
                        <p className="text-xs text-muted-foreground">
                          Lucro tributavel do ano anterior para calculo da contribuicao
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Contribution Rate */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Taxa Contributiva</Label>
                    <Select value={ssContributionRate} onValueChange={setSsContributionRate}>
                      <SelectTrigger className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SS_RATES.map((rate) => (
                          <SelectItem key={rate.value} value={rate.value}>
                            {rate.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {accountingRegime === 'simplified'
                        ? 'Taxa aplicada sobre 70% do rendimento relevante (servicos) ou 20% (vendas)'
                        : 'Taxa aplicada sobre o lucro tributavel'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Primeiro Ano de Actividade</Label>
                      <p className="text-sm text-muted-foreground">
                        Isento de contribuicoes nos primeiros 12 meses
                      </p>
                    </div>
                    <Switch
                      checked={isFirstYear}
                      onCheckedChange={setIsFirstYear}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Acumulacao com TCO</Label>
                      <p className="text-sm text-muted-foreground">
                        Trabalha tambem por conta de outrem?
                      </p>
                    </div>
                    <Switch
                      checked={hasOtherEmployment}
                      onCheckedChange={setHasOtherEmployment}
                    />
                  </div>

                  {hasOtherEmployment && (
                    <div className="ml-4 p-4 bg-muted/20 rounded-xl border border-border/30 space-y-3">
                      <Label className="text-sm font-medium">Remuneracao TCO Mensal (EUR)</Label>
                      <Input
                        type="number"
                        value={otherEmploymentSalary}
                        onChange={(e) => setOtherEmploymentSalary(e.target.value)}
                        placeholder="0.00"
                        className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
                      />
                      <p className="text-xs text-muted-foreground">
                        Se maior ou igual a 1 IAS (522,50 EUR), pode estar isento de contribuicoes como T.I.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">SS gerida pelo Contabilista</Label>
                      <p className="text-sm text-muted-foreground">
                        O seu contabilista trata da declaracao trimestral
                      </p>
                    </div>
                    <Switch
                      checked={hasAccountantSS}
                      onCheckedChange={setHasAccountantSS}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleSaveSSSettings} disabled={isSavingSS} className="zen-button gap-2 shadow-lg hover:shadow-xl transition-all duration-300">
                      {isSavingSS ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Guardar Definicoes SS
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setShowFiscalWizard(true)}
                      className="gap-2 border-primary/30 hover:bg-primary/10"
                    >
                      <Wand2 className="h-4 w-4" />
                      Reconfigurar com Wizard
                    </Button>
                  </div>
                </CardContent>
              </ZenCard>

              {/* Fiscal Setup Wizard Dialog */}
              <Dialog open={showFiscalWizard} onOpenChange={setShowFiscalWizard}>
                <DialogContent className="max-w-lg p-0 overflow-hidden bg-transparent border-0 shadow-none">
                  <FiscalSetupWizard
                    compact
                    onComplete={() => {
                      setShowFiscalWizard(false);
                      // Reload profile data
                      window.location.reload();
                    }}
                  />
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Tab: Notificacoes */}
            <TabsContent value="notificacoes" className="mt-6">
              <NotificationPreferences />
            </TabsContent>

            {/* Tab: Contabilistas */}
            <TabsContent value="contabilistas" className="mt-6">
              {isAccountant ? <ClientManagementPanel /> : <MyAccountantsPanel />}
            </TabsContent>

            {/* Tab: Aplicacao */}
            <TabsContent value="aplicacao" className="mt-6 space-y-6">
              {/* Theme Settings */}
              <ZenCard gradient="default" withLine className="shadow-xl" animationDelay="0ms">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <Palette className="h-5 w-5 text-primary" />
                    </div>
                    Aparencia
                  </CardTitle>
                  <CardDescription>
                    Personalize a aparencia da aplicacao
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {mounted && isDark ? (
                          <Moon className="h-5 w-5 text-primary" />
                        ) : (
                          <Sun className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Tema</p>
                        <p className="text-sm text-muted-foreground">
                          {mounted ? (isDark ? 'Modo escuro activo' : 'Modo claro activo') : 'A carregar...'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={mounted && !isDark ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme('light')}
                        className="gap-2"
                      >
                        <Sun className="h-4 w-4" />
                        Claro
                      </Button>
                      <Button
                        variant={mounted && isDark ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme('dark')}
                        className="gap-2"
                      >
                        <Moon className="h-4 w-4" />
                        Escuro
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </ZenCard>

              {/* App Preferences */}
              <ZenCard gradient="muted" withLine className="shadow-lg" animationDelay="100ms">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <HelpCircle className="h-5 w-5 text-primary" />
                    </div>
                    Tour Interactivo
                  </CardTitle>
                  <CardDescription>
                    Reinicie o tour de introducao da aplicacao
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <RotateCcw className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Tour Interactivo</p>
                        <p className="text-sm text-muted-foreground">
                          {isTourCompleted()
                            ? 'Ja completou o tour de introducao'
                            : 'O tour sera mostrado na proxima visita'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        resetTour();
                        toast.success('Tour reiniciado! Visite o Dashboard para ver o tour.');
                      }}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reiniciar Tour
                    </Button>
                  </div>
                </CardContent>
              </ZenCard>

              {/* Install App Section */}
              <ZenCard gradient="primary" withCircle className="shadow-lg" animationDelay="200ms">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    Instalar Aplicacao
                  </CardTitle>
                  <CardDescription>
                    Instale a app no seu dispositivo para acesso rapido
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isInstalled ? (
                    <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl border border-green-500/20">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">App Instalada</p>
                        <p className="text-sm text-muted-foreground">
                          A aplicacao esta instalada no seu dispositivo
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/30 rounded-xl">
                        <p className="text-sm text-muted-foreground mb-4">
                          Instale a app para aceder rapidamente, trabalhar offline e receber notificacoes.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {canInstall && !isIOS ? (
                            <Button
                              onClick={promptInstall}
                              className="zen-button gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Instalar Agora
                            </Button>
                          ) : (
                            <Link to="/install">
                              <Button className="zen-button gap-2">
                                <Download className="h-4 w-4" />
                                Ver Instrucoes
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </ZenCard>
            </TabsContent>

            {/* Tab: Importar */}
            <TabsContent value="importar" className="mt-6 space-y-6">
              <DatabaseImporter />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
