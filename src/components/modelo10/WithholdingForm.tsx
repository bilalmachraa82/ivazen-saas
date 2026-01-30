import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ZenCard } from '@/components/zen';
import { Upload, FileText, Loader2, Globe, HelpCircle } from 'lucide-react';
import { InfoIcon } from '@/components/ui/info-tooltip';
import { NifInput, validateNIF as validateNIFInput } from '@/components/ui/nif-input';
import { WithholdingFormData } from '@/hooks/useWithholdings';
import { validatePortugueseNIF, getSuggestedRate, getAvailableRates } from '@/lib/nifValidator';
import { COUNTRIES, isValidCountryCode, hasTaxTreaty } from '@/lib/countries';
import { INCOME_CATEGORIES, getIncomeCodesForCategory, IncomeCode } from '@/lib/incomeCodeData';

// Custom NIF validation with control digit (usando validador do componente NifInput)
const nifSchema = z.string().refine((nif) => {
  const result = validateNIFInput(nif, { required: true });
  return result.valid;
}, { message: 'NIF invalido - verifique o digito de controlo' });

const formSchema = z.object({
  fiscal_year: z.number().min(2020).max(2099),
  beneficiary_nif: nifSchema,
  beneficiary_name: z.string().optional(),
  beneficiary_address: z.string().optional(),
  income_category: z.enum(['A', 'B', 'E', 'F', 'G', 'H', 'R']),
  income_code: z.string().optional(),
  location_code: z.enum(['C', 'RA', 'RM']),
  gross_amount: z.number().positive('Valor deve ser positivo'),
  exempt_amount: z.number().min(0).optional(),
  dispensed_amount: z.number().min(0).optional(),
  withholding_rate: z.number().min(0).max(100).optional(),
  withholding_amount: z.number().min(0),
  payment_date: z.string().min(1, 'Data é obrigatória'),
  document_reference: z.string().optional(),
  notes: z.string().optional(),
  is_non_resident: z.boolean().optional(),
  country_code: z.string().refine((code) => !code || isValidCountryCode(code), {
    message: 'Código de país inválido (use ISO 3166-1 alpha-2)',
  }).optional(),
}).refine((data) => {
  // Validate that payment_date is within fiscal_year
  if (!data.payment_date) return true;
  const paymentYear = new Date(data.payment_date).getFullYear();
  return paymentYear === data.fiscal_year;
}, {
  message: 'A data de pagamento deve estar dentro do ano fiscal selecionado',
  path: ['payment_date'],
}).refine((data) => {
  // If non-resident, country code is required
  if (data.is_non_resident && !data.country_code) {
    return false;
  }
  return true;
}, {
  message: 'Código de país é obrigatório para não residentes',
  path: ['country_code'],
});

interface WithholdingFormProps {
  onSubmit: (data: WithholdingFormData) => Promise<void>;
  onExtract: (fileData: string, mimeType: string) => Promise<any>;
  isSubmitting: boolean;
  defaultYear?: number;
}

export function WithholdingForm({ onSubmit, onExtract, isSubmitting, defaultYear }: WithholdingFormProps) {
  const [isExtracting, setIsExtracting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fiscal_year: defaultYear || new Date().getFullYear(),
      beneficiary_nif: '',
      beneficiary_name: '',
      beneficiary_address: '',
      income_category: 'B',
      income_code: '',
      location_code: 'C',
      gross_amount: 0,
      exempt_amount: 0,
      dispensed_amount: 0,
      withholding_rate: 25,
      withholding_amount: 0,
      payment_date: '',
      document_reference: '',
      notes: '',
      is_non_resident: false,
      country_code: '',
    },
  });

  // Watch category and location to suggest rates
  const watchCategory = form.watch('income_category');
  const watchLocation = form.watch('location_code');
  const watchNif = form.watch('beneficiary_nif');
  const watchGross = form.watch('gross_amount');
  const watchRate = form.watch('withholding_rate');
  const watchIsNonResident = form.watch('is_non_resident');

  // Get available rates for current category/location
  const availableRates = getAvailableRates(watchCategory, watchLocation);

  // Update suggested rate when category or location changes
  useEffect(() => {
    const suggestedRate = getSuggestedRate(watchCategory, watchLocation);
    form.setValue('withholding_rate', suggestedRate);
  }, [watchCategory, watchLocation]);

  // NIF validation is now handled by NifInput component

  // Auto-calculate withholding
  const calculateWithholding = () => {
    if (watchGross && watchRate) {
      const calculated = (watchGross * watchRate) / 100;
      form.setValue('withholding_amount', Math.round(calculated * 100) / 100);
    }
  };

  useEffect(() => {
    calculateWithholding();
  }, [watchGross, watchRate]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const extracted = await onExtract(base64, file.type);
        
        if (extracted) {
          // Fill form with extracted data
          if (extracted.beneficiary_nif) form.setValue('beneficiary_nif', extracted.beneficiary_nif);
          if (extracted.beneficiary_name) form.setValue('beneficiary_name', extracted.beneficiary_name);
          if (extracted.beneficiary_address) form.setValue('beneficiary_address', extracted.beneficiary_address);
          if (extracted.income_category) form.setValue('income_category', extracted.income_category);
          if (extracted.gross_amount) form.setValue('gross_amount', extracted.gross_amount);
          if (extracted.exempt_amount !== undefined) form.setValue('exempt_amount', extracted.exempt_amount);
          if (extracted.dispensed_amount !== undefined) form.setValue('dispensed_amount', extracted.dispensed_amount);
          if (extracted.withholding_rate) form.setValue('withholding_rate', extracted.withholding_rate);
          if (extracted.withholding_amount) form.setValue('withholding_amount', extracted.withholding_amount);
          if (extracted.payment_date) form.setValue('payment_date', extracted.payment_date);
          if (extracted.document_reference) form.setValue('document_reference', extracted.document_reference);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    await onSubmit(values as WithholdingFormData);
    form.reset();
  };

  // Note: Auto-calculation is now handled via useEffect above

  return (
    <ZenCard>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Adicionar Retenção
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Upload Section */}
        <div className="mb-6 p-4 border-2 border-dashed border-muted rounded-lg text-center">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="withholding-upload"
            disabled={isExtracting}
          />
          <label
            htmlFor="withholding-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">A extrair dados com IA...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Carregar recibo para extracção automática
                </span>
              </>
            )}
          </label>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fiscal Year */}
              <FormField
                control={form.control}
                name="fiscal_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano Fiscal</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Date */}
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Pagamento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Beneficiary NIF with validation indicator */}
              <FormField
                control={form.control}
                name="beneficiary_nif"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NifInput
                        id="beneficiary_nif"
                        value={field.value}
                        onChange={field.onChange}
                        label="NIF do Beneficiario"
                        placeholder="123456789"
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Beneficiary Name */}
              <FormField
                control={form.control}
                name="beneficiary_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Beneficiário</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome completo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Non-Resident Section */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <FormField
                control={form.control}
                name="is_non_resident"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Beneficiário Não Residente
                      </FormLabel>
                      <FormDescription>
                        Assinale se o beneficiário não tem residência fiscal em Portugal
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {watchIsNonResident && (
                <>
                  <FormField
                    control={form.control}
                    name="country_code"
                    render={({ field }) => {
                      const selectedCountry = field.value ? COUNTRIES.find(c => c.code === field.value) : null;
                      const hasTreaty = selectedCountry?.hasTaxTreaty;
                      return (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            País de Residência
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <p>Código ISO 3166-1 alpha-2. Países com convenção fiscal (CDT) podem ter taxas reduzidas.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione o país" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-60">
                              {COUNTRIES.filter(c => c.code !== 'PT').map((country) => (
                                <SelectItem key={country.code} value={country.code}>
                                  <span className="flex items-center gap-2">
                                    {country.flag} {country.name} ({country.code})
                                    {country.hasTaxTreaty && (
                                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                                        CDT
                                      </span>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {hasTreaty ? (
                              <span className="text-green-600 dark:text-green-400">
                                ✓ Portugal tem Convenção de Dupla Tributação com este país
                              </span>
                            ) : selectedCountry ? (
                              <span className="text-amber-600 dark:text-amber-400">
                                ⚠ Sem convenção fiscal - aplicam-se taxas gerais
                              </span>
                            ) : (
                              'Código ISO do país de residência fiscal (obrigatório para não residentes)'
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="income_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Categoria de Rendimento
                      <InfoIcon term="reciboverde" />
                    </FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      // Reset income code when category changes
                      form.setValue('income_code' as any, '');
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INCOME_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.category} value={cat.category}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Seleccione a categoria principal do rendimento
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Income Code with Tooltips */}
              <FormField
                control={form.control}
                name="income_code"
                render={({ field }) => {
                  const codes = getIncomeCodesForCategory(watchCategory);
                  return (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Código de Rendimento
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p>Códigos conforme Portaria 4/2024 de 4 de janeiro</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione o código específico" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {codes.map((code) => (
                            <TooltipProvider key={code.code}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <SelectItem value={code.code} className="cursor-pointer">
                                    <span className="flex items-center gap-2">
                                      {code.label}
                                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </span>
                                  </SelectItem>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-sm">
                                  <p className="font-medium">{code.description}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{code.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Código específico do tipo de rendimento (Portaria 4/2024)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Location */}
              <FormField
                control={form.control}
                name="location_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localização</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="C">Continente</SelectItem>
                        <SelectItem value="RA">Região Autónoma dos Açores</SelectItem>
                        <SelectItem value="RM">Região Autónoma da Madeira</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Gross Amount */}
              <FormField
                control={form.control}
                name="gross_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Bruto (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => {
                          field.onChange(parseFloat(e.target.value) || 0);
                          setTimeout(calculateWithholding, 0);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Exempt Amount */}
              <FormField
                control={form.control}
                name="exempt_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rendimentos Isentos (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>Rendimentos isentos de retenção</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dispensed Amount */}
              <FormField
                control={form.control}
                name="dispensed_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dispensados de Retenção (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>Rendimentos dispensados de retenção</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Withholding Rate with suggestions */}
              <FormField
                control={form.control}
                name="withholding_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Taxa de Retenção (%)
                      <InfoIcon term="retencao" />
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseFloat(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione taxa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableRates.map((rate) => (
                          <SelectItem key={rate.rate} value={rate.rate.toString()}>
                            {rate.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="0">0% (Sem retenção)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Taxas oficiais para {watchCategory === 'B' ? 'Cat. B' : watchCategory === 'E' ? 'Cat. E' : 'Cat. F'} - {watchLocation}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Withholding Amount */}
              <FormField
                control={form.control}
                name="withholding_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Retido (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Document Reference */}
              <FormField
                control={form.control}
                name="document_reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referência do Documento</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nº do recibo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Beneficiary Address */}
            <FormField
              control={form.control}
              name="beneficiary_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Morada do Beneficiário</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Morada completa" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Observações adicionais" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                'Adicionar Retenção'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </ZenCard>
  );
}
