import { useState } from 'react';
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
import { Loader2, Copy, Check, UserPlus, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { NifInput, validateNIF } from '@/components/ui/nif-input';
const createClientSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  nif: z.string().refine((nif) => {
    const result = validateNIF(nif, { required: true });
    return result.valid;
  }, { message: 'NIF invalido - verifique o digito de controlo' }),
  email: z.string().email('Email invalido'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type CreateClientForm = z.infer<typeof createClientSchema>;

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateClientDialog({ open, onOpenChange, onSuccess }: CreateClientDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      full_name: '',
      nif: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  const handleCopyLink = async () => {
    if (!magicLink) return;
    
    try {
      await navigator.clipboard.writeText(magicLink);
      setCopied(true);
      toast.success('Link copiado para a área de transferência');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  const handleClose = () => {
    form.reset();
    setMagicLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  const onSubmit = async (data: CreateClientForm) => {
    setIsSubmitting(true);
    setMagicLink(null);

    try {
      const { data: result, error } = await supabase.functions.invoke('create-client-direct', {
        body: data,
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error(error.message || 'Erro ao criar cliente');
        return;
      }

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      if (result?.magic_link) {
        setMagicLink(result.magic_link);
        toast.success('Cliente criado com sucesso!');
        // Invalidate queries to refresh client list
        queryClient.invalidateQueries({ queryKey: ['accountant-clients'] });
        onSuccess?.();
      } else {
        toast.success('Cliente criado. Use "Esqueci a password" para gerar acesso.');
        // Invalidate queries to refresh client list
        queryClient.invalidateQueries({ queryKey: ['accountant-clients'] });
        handleClose();
        onSuccess?.();
      }
    } catch (error) {
      console.error('Create client error:', error);
      toast.error('Erro ao criar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={magicLink ? handleClose : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Criar Novo Cliente
          </DialogTitle>
          <DialogDescription>
            {magicLink 
              ? 'Cliente criado! Copie o link de acesso e envie ao cliente.'
              : 'Preencha os dados do cliente. Será gerado um link de acesso directo.'}
          </DialogDescription>
        </DialogHeader>

        {magicLink ? (
          <div className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Link de Acesso</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Este link permite ao cliente entrar directamente na conta. Válido por 24 horas.
              </p>
              <div className="flex gap-2">
                <Input 
                  value={magicLink} 
                  readOnly 
                  className="text-xs bg-background/50 font-mono"
                />
                <Button 
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              <strong>Próximos passos:</strong>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Copie o link acima</li>
                <li>Envie ao cliente por email ou WhatsApp</li>
                <li>O cliente clica no link e entra directamente</li>
                <li>Recomende que defina uma password nas Definições</li>
              </ol>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
              <Button onClick={handleCopyLink} className="zen-button">
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </Button>
            </div>
          </div>
        ) : (
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
                        id="client-nif"
                        value={field.value}
                        onChange={field.onChange}
                        label="NIF"
                        placeholder="123456789"
                        required
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
                    <FormLabel>Email *</FormLabel>
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
                      A criar...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Criar Cliente
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
