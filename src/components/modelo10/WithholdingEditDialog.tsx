import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Globe, HelpCircle } from 'lucide-react';
import { TaxWithholding, WithholdingFormData } from '@/hooks/useWithholdings';
import { getSuggestedRate, getAvailableRates } from '@/lib/nifValidator';
import { NifInput, validateNIF } from '@/components/ui/nif-input';
import { COUNTRIES, isValidCountryCode } from '@/lib/countries';
import { INCOME_CATEGORIES, getIncomeCodesForCategory } from '@/lib/incomeCodeData';

// Custom NIF validation with control digit (usando validador do NifInput)
const nifSchema = z.string().refine((nif) => {
  const result = validateNIF(nif, { required: true });
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
  if (!data.payment_date) return true;
  const paymentYear = new Date(data.payment_date).getFullYear();
  return paymentYear === data.fiscal_year;
}, {
  message: 'A data de pagamento deve estar dentro do ano fiscal selecionado',
  path: ['payment_date'],
}).refine((data) => {
  if (data.is_non_resident && !data.country_code) {
    return false;
  }
  return true;
}, {
  message: 'Código de país é obrigatório para não residentes',
  path: ['country_code'],
});

interface WithholdingEditDialogProps {
  withholding: TaxWithholding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: Partial<WithholdingFormData>) => Promise<void>;
  isSubmitting: boolean;
}

export function WithholdingEditDialog({
  withholding,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting
}: WithholdingEditDialogProps) {

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fiscal_year: withholding?.fiscal_year || new Date().getFullYear(),
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

  // Populate form when withholding changes
  useEffect(() => {
    if (withholding) {
      form.reset({
        fiscal_year: withholding.fiscal_year,
        beneficiary_nif: withholding.beneficiary_nif,
        beneficiary_name: withholding.beneficiary_name || '',
        beneficiary_address: withholding.beneficiary_address || '',
        income_category: withholding.income_category as 'A' | 'B' | 'E' | 'F' | 'G' | 'H' | 'R',
        income_code: (withholding as any).income_code || '',
        location_code: withholding.location_code as 'C' | 'RA' | 'RM',
        gross_amount: Number(withholding.gross_amount),
        exempt_amount: Number(withholding.exempt_amount) || 0,
        dispensed_amount: Number(withholding.dispensed_amount) || 0,
        withholding_rate: Number(withholding.withholding_rate) || 0,
        withholding_amount: Number(withholding.withholding_amount),
        payment_date: withholding.payment_date,
        document_reference: withholding.document_reference || '',
        notes: withholding.notes || '',
        is_non_resident: withholding.is_non_resident || false,
        country_code: withholding.country_code || '',
      });
    }
  }, [withholding, form]);

  // Watch fields for validation and auto-calculation
  const watchCategory = form.watch('income_category');
  const watchLocation = form.watch('location_code');
  const watchNif = form.watch('beneficiary_nif');
  const watchGross = form.watch('gross_amount');
  const watchRate = form.watch('withholding_rate');
  const watchIsNonResident = form.watch('is_non_resident');

  const availableRates = getAvailableRates(watchCategory, watchLocation);

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

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!withholding) return;
    await onSubmit(withholding.id, values as WithholdingFormData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Retenção</DialogTitle>
          <DialogDescription>
            Altere os dados da retenção na fonte
          </DialogDescription>
        </DialogHeader>

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

              {/* Beneficiary NIF */}
              <FormField
                control={form.control}
                name="beneficiary_nif"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <NifInput
                        id="edit-beneficiary-nif"
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
                <FormField
                  control={form.control}
                  name="country_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>País de Residência</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione o país" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.flag} {country.name} ({country.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Código ISO do país de residência fiscal (obrigatório para não residentes)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Income Category */}
              <FormField
                control={form.control}
                name="income_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria de Rendimento</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('income_code', '');
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Withholding Rate */}
              <FormField
                control={form.control}
                name="withholding_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de Retenção (%)</FormLabel>
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
                      <Input {...field} placeholder="Ex: RV 2025/001" />
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
                    <Textarea {...field} placeholder="Morada completa" />
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
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Notas adicionais" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A guardar...
                  </>
                ) : (
                  'Guardar Alterações'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
