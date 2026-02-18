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
import { Loader2, UserCog, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { NifInput, validateNIF } from '@/components/ui/nif-input';
import { AccountantClient } from '@/hooks/useClientManagement';

const editClientSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  company_name: z.string().optional(),
  nif: z.string().refine((nif) => {
    if (!nif) return true; // Allow empty for now
    const result = validateNIF(nif, { required: false });
    return result.valid;
  }, { message: 'NIF inválido - verifique o dígito de controlo' }),
  email: z.string().email('Email inválido').or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

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
    },
  });

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
      });
    }
  }, [client, form]);

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
          company_name: data.company_name || data.full_name, // Sync company_name with full_name
          nif: data.nif || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
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
      <DialogContent className="sm:max-w-md">
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
