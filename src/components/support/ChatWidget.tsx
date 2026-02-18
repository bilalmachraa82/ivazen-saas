import { useState } from 'react';
import { MessageCircle, X, Send, Clock, Mail, BookOpen, ChevronDown, ExternalLink, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription } from
'@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger } from
'@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// FAQ Content
const faqs = [
{
  id: 'faq-1',
  question: 'Como digitalizo uma factura?',
  answer: 'Na pagina "Upload", pode arrastar o ficheiro da factura ou tirar uma fotografia com a camara do telemovel. O IVAzen extrai automaticamente os dados usando inteligencia artificial e preenche os campos relevantes para si.'
},
{
  id: 'faq-2',
  question: 'O que e o Modelo 10?',
  answer: 'O Modelo 10 e uma declaracao anual obrigatoria para quem fez pagamentos sujeitos a retencao na fonte. O IVAzen ajuda-o a calcular e preparar esta declaracao automaticamente com base nas suas facturas.'
},
{
  id: 'faq-3',
  question: 'Como adiciono um cliente?',
  answer: 'Pode adicionar clientes em Definicoes > Gestao de Clientes. Basta introduzir o NIF e os dados sao preenchidos automaticamente. Tambem pode criar clientes durante o upload de facturas.'
},
{
  id: 'faq-4',
  question: 'Posso exportar para Excel?',
  answer: 'Sim! Na pagina de Exportacao pode descarregar os seus dados em formato Excel (.xlsx), PDF ou CSV. Pode filtrar por periodo, tipo de factura e outros criterios antes de exportar.'
},
{
  id: 'faq-5',
  question: 'Quanto custa o IVAzen?',
  answer: 'O IVAzen oferece um plano gratuito com funcionalidades basicas. Os planos Pro e Business incluem funcionalidades avancadas como integracao contabilistica, relatorios detalhados e suporte prioritario. Consulte a nossa pagina de precos para mais detalhes.'
},
{
  id: 'faq-6',
  question: 'Os meus dados estao seguros?',
  answer: 'Sim, a seguranca e a nossa prioridade. Todos os dados sao encriptados em transito e em repouso. Utilizamos infraestrutura de cloud certificada e cumprimos com o RGPD. Nunca partilhamos os seus dados com terceiros.'
},
{
  id: 'faq-7',
  question: 'Como funciona a classificacao automatica?',
  answer: 'O nosso sistema de IA analisa cada factura e sugere automaticamente a categoria fiscal, taxa de IVA e conta contabilistica apropriada. Pode sempre corrigir ou ajustar as sugestoes antes de confirmar.'
}];


// Useful links
const usefulLinks = [
{
  title: 'Glossario Fiscal',
  description: 'Termos e definicoes fiscais',
  href: '/glossario',
  icon: BookOpen
},
{
  title: 'Termos de Servico',
  description: 'Condicoes de utilizacao',
  href: '/terms',
  icon: ExternalLink
},
{
  title: 'Politica de Privacidade',
  description: 'Como protegemos os seus dados',
  href: '/privacy',
  icon: ExternalLink
}];


interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(true);
  const [activeTab, setActiveTab] = useState('faq');
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setShowNotification(false);
    }
  };

  const handleInputChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
  {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: 'Campos obrigatorios',
        description: 'Por favor preencha todos os campos.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate sending (in production, this would call an API)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast({
      title: 'Mensagem enviada!',
      description: 'Obrigado pelo seu contacto. Responderemos em breve.'
    });

    setFormData({ name: '', email: '', message: '' });
    setIsSubmitting(false);
    setActiveTab('faq');
  };

  const handleEmailClick = () => {
    const subject = encodeURIComponent('Contacto via IVAzen');
    const body = encodeURIComponent(
      `Nome: ${formData.name}\nEmail: ${formData.email}\n\nMensagem:\n${formData.message}`
    );
    window.open(`mailto:suporte@ivazen.pt?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => handleOpenChange(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'w-14 h-14 rounded-full',
          'gradient-primary text-white',
          'shadow-lg shadow-primary/30',
          'flex items-center justify-center',
          'fab-spring',
          'hover:shadow-glow-rose-lg',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
          // Safe area for mobile
          'mb-safe',
          // Animation on mount
          'animate-slide-up'
        )}
        aria-label="Abrir chat de suporte">

        <MessageCircle className="w-6 h-6" />

        {/* Notification Badge */}
        {showNotification &&
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            1
          </span>
        }

        {/* Glow ring effect */}
        
      </button>

      {/* Chat Sheet/Modal */}
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            'w-full sm:max-w-md p-0 flex flex-col',
            'bg-background/95 backdrop-blur-xl',
            'border-l border-border/50'
          )}>

          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-accent/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-glow">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold">
                  Centro de Ajuda
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Estamos aqui para ajudar
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Content */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden">

            <TabsList className="mx-4 mt-4 grid grid-cols-3 bg-muted/50">
              <TabsTrigger value="faq" className="text-sm">
                FAQ
              </TabsTrigger>
              <TabsTrigger value="contact" className="text-sm">
                Contacto
              </TabsTrigger>
              <TabsTrigger value="info" className="text-sm">
                Info
              </TabsTrigger>
            </TabsList>

            {/* FAQ Tab */}
            <TabsContent value="faq" className="flex-1 overflow-hidden mt-0 p-0">
              <ScrollArea className="h-full px-4 py-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-4">
                    Perguntas frequentes sobre o IVAzen
                  </p>
                  <Accordion type="single" collapsible className="space-y-2">
                    {faqs.map((faq) =>
                    <AccordionItem
                      key={faq.id}
                      value={faq.id}
                      className="border border-border/50 rounded-lg px-4 bg-card/50 hover:bg-card transition-colors">

                        <AccordionTrigger className="text-sm font-medium text-left hover:no-underline py-3">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground pb-3">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="flex-1 overflow-hidden mt-0 p-0">
              <ScrollArea className="h-full px-4 py-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Envie-nos a sua questao e responderemos o mais breve possivel.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="O seu nome"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="bg-background/50" />

                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="bg-background/50" />

                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Mensagem</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Descreva a sua questao ou sugestao..."
                      value={formData.message}
                      onChange={handleInputChange}
                      rows={4}
                      className="bg-background/50 resize-none" />

                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      className="flex-1 gradient-primary"
                      disabled={isSubmitting}>

                      {isSubmitting ?
                      'A enviar...' :

                      <>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar
                        </>
                      }
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleEmailClick}
                      title="Abrir no cliente de email">

                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              </ScrollArea>
            </TabsContent>

            {/* Info Tab */}
            <TabsContent value="info" className="flex-1 overflow-hidden mt-0 p-0">
              <ScrollArea className="h-full px-4 py-4">
                <div className="space-y-6">
                  {/* Support Hours */}
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Horario de Suporte</h3>
                        <p className="text-sm text-muted-foreground">
                          Segunda a Sexta
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Manha:</span>
                        <span className="font-medium">09:00 - 13:00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tarde:</span>
                        <span className="font-medium">14:00 - 18:00</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      * Fora deste horario, deixe mensagem e respondemos no proximo dia util.
                    </p>
                  </div>

                  {/* Contact Email */}
                  <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Email Direto</h3>
                        <a
                          href="mailto:suporte@ivazen.pt"
                          className="text-sm text-primary hover:underline">

                          suporte@ivazen.pt
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Useful Links */}
                  <div>
                    <h3 className="font-semibold mb-3">Links Uteis</h3>
                    <div className="space-y-2">
                      {usefulLinks.map((link) =>
                      <a
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all group">

                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <link.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{link.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {link.description}
                            </p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Response Time */}
                  <div className="text-center py-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      Tempo medio de resposta: <strong>menos de 24 horas</strong>
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>);

}

export default ChatWidget;