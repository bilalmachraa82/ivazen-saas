import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, UserCog, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { NifInput, validateNIF } from '@/components/ui/nif-input';
import { AccountantClient } from '@/hooks/useClientManagement';

const editClientSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  company_name: z.string().optional(),
  nif: z.string().refine((nif) => {
    if (!nif) return true;
    const result = validateNIF(nif, { required: false });
    return result.valid;
  }, { message: 'NIF inválido - verifique o dígito de controlo' }),
  email: z.string().email('Email inválido').or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  // Fiscal fields
  taxpayer_kind: z.string().optional(),
  niss: z.string().optional(),
  cae: z.string().optional(),
  worker_type: z.string().optional(),
  accounting_regime: z.string().optional(),
  vat_regime: z.string().optional(),
  iva_cadence: z.enum(['monthly', 'quarterly']).optional(),
  ss_contribution_rate: z.string().optional(),
  is_first_year: z.boolean().optional(),
});

const AUTO_TAXPAYER_KIND = '__auto__';

type EditClientForm = z.infer<typeof editClientSchema>;

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: AccountantClient | null;
  onSuccess?: () => void;
}

export function EditClientDialog({ open, onOpenChange, client, onSuccess }: EditClientDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<EditClientForm>({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      full_name: '',
      company_name: '',
      nif: '',
      email: '',
      phone: '',
      address: '',
      taxpayer_kind: AUTO_TAXPAYER_KIND,
      niss: '',
      cae: '',
      worker_type: '',
      accounting_regime: '',
      vat_regime: '',
      iva_cadence: 'quarterly',
      ss_contribution_rate: '',
      is_first_year: false,
    },
  });

  // Fetch full profile data for fiscal fields
  const [fiscalData, setFiscalData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (client?.id) {
      supabase
        .from('profiles')
        .select('taxpayer_kind, niss, cae, worker_type, accounting_regime, vat_regime, iva_cadence, ss_contribution_rate, is_first_year')
        .eq('id', client.id)
        .single()
        .then(({ data }) => {
          if (data) setFiscalData(data);
        });
    }
  }, [client?.id]);

  // Reset form when client changes
  useEffect(() => {
    if (client) {
      form.reset({
        full_name: client.full_name || '',
        company_name: client.company_name || '',
        nif: client.nif || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        taxpayer_kind: (fiscalData.taxpayer_kind as string) || AUTO_TAXPAYER_KIND,
        niss: (fiscalData.niss as string) || '',
        cae: (fiscalData.cae as string) || '',
        worker_type: (fiscalData.worker_type as string) || '',
        accounting_regime: (fiscalData.accounting_regime as string) || '',
        vat_regime: (fiscalData.vat_regime as string) || '',
        iva_cadence: (fiscalData.iva_cadence as 'monthly' | 'quarterly') || 'quarterly',
        ss_contribution_rate: fiscalData.ss_contribution_rate != null ? String(fiscalData.ss_contribution_rate) : '21.4',
        is_first_year: (fiscalData.is_first_year as boolean) || false,
      });
    }
  }, [client, form, fiscalData]);

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: EditClientForm) => {
    if (!client) return;
    
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          company_name: data.company_name || data.full_name,
          nif: data.nif || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          // Fiscal fields
          taxpayer_kind: !data.taxpayer_kind || data.taxpayer_kind === AUTO_TAXPAYER_KIND ? null : data.taxpayer_kind,
          niss: data.niss || null,
          cae: data.cae || null,
          worker_type: data.worker_type || null,
          accounting_regime: data.accounting_regime || null,
          vat_regime: data.vat_regime || null,
          iva_cadence: data.iva_cadence || 'quarterly',
          ss_contribution_rate: data.ss_contribution_rate ? parseFloat(data.ss_contribution_rate) : null,
          is_first_year: data.is_first_year || false,
        })
        .eq('id', client.id);

      if (error) {
        console.error('Update error:', error);
        // Mostrar mensagem de erro mais detalhada
        const errorMessage = error.message || 'Erro desconhecido';
        const errorCode = error.code || '';
        
        if (errorCode === 'PGRST301' || errorMessage.includes('row-level security')) {
          toast.error('Sem permissão para editar este cliente', {
            description: 'Verifique se tem acesso total (full) a este cliente.'
          });
        } else if (errorCode === '23505' || errorMessage.includes('duplicate')) {
          toast.error('NIF já existe noutro perfil', {
            description: 'Este NIF já está atribuído a outro utilizador.'
          });
        } else {
          toast.error('Erro ao actualizar cliente', {
            description: errorMessage
          });
        }
        return;
      }

      toast.success('Cliente actualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['accountant-clients'] });
      queryClient.invalidateQueries({ queryKey: ['accountant-clients-unified'] });
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Edit client error:', error);
      toast.error('Erro ao actualizar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Editar Cliente
          </DialogTitle>
          <DialogDescription>
            Actualize os dados do cliente. As alterações serão refletidas em todos os documentos fiscais.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome / Denominação Social *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome pessoal ou Empresa Lda." {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Este nome será usado no Modelo 10 e documentos fiscais
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nif"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <NifInput
                      id="edit-client-nif"
                      value={field.value || ''}
                      onChange={field.onChange}
                      label="NIF"
                      placeholder="123456789"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="cliente@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+351 912 345 678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Morada</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, Código Postal, Cidade" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fiscal Fields Section */}
            <Separator className="my-2" />
            <p className="text-sm font-medium text-muted-foreground">Dados Fiscais</p>

            <FormField
              control={form.control}
              name="taxpayer_kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Contribuinte</FormLabel>
                  <Select value={field.value || AUTO_TAXPAYER_KIND} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-detectar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={AUTO_TAXPAYER_KIND}>Auto-detectar</SelectItem>
                      <SelectItem value="eni">ENI / Independente (IVA + SS)</SelectItem>
                      <SelectItem value="company">Empresa (IVA + Modelo 10)</SelectItem>
                      <SelectItem value="mixed">Misto (todas as obrigações)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define as obrigações fiscais principais. Se vazio, é inferido automaticamente.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="niss"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NISS</FormLabel>
                    <FormControl>
                      <Input placeholder="12345678901" maxLength={11} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cae"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CAE</FormLabel>
                    <FormControl>
                      <Input placeholder="69200" maxLength={5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="worker_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Trabalhador</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="independent">Trabalhador Independente</SelectItem>
                        <SelectItem value="eni">ENI</SelectItem>
                        <SelectItem value="eirl">EIRL</SelectItem>
                        <SelectItem value="agricultural">Produtor Agrícola</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accounting_regime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime Contabilístico</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="simplified">Regime Simplificado</SelectItem>
                        <SelectItem value="organized">Contabilidade Organizada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="vat_regime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime IVA</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="normal_monthly">Normal mensal por opção</SelectItem>
                        <SelectItem value="normal_quarterly">Normal trimestral</SelectItem>
                        <SelectItem value="exempt_53">Isento Art. 53º</SelectItem>
                        <SelectItem value="exempt_9">Isento Art. 9º</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="iva_cadence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Periodicidade IVA</FormLabel>
                    <Select value={field.value || 'quarterly'} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ss_contribution_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa SS (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="21.4" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_first_year"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">
                    1.o ano de atividade (isento SS)
                  </FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="zen-button">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A guardar...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Alterações
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
