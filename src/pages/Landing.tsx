import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import {
  FileText,
  Zap,
  Brain,
  CheckCircle,
  ArrowRight,
  QrCode,
  FileCode,
  Calculator,
  Users,
  BarChart3,
  Sparkles,
  Leaf,
  ChevronRight,
  ShieldCheck,
  Globe,
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
  Heart,
  Laptop,
  Quote,
  Lock,
   MessageCircle,
   Wifi,
   WifiOff,
   Copy,
   History,
   CloudUpload,
   Receipt,
   Map
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

// Unified icon style for consistency across landing page
const ICON_STYLE = { strokeWidth: 1.5 } as const;
import { AnimateOnScroll } from "@/hooks/useScrollAnimation";

// Import components
import logoIcon from "@/assets/logo-icon.png";
import { HeroMockup } from "@/components/landing/HeroMockup";
import { StepVisual } from "@/components/landing/StepVisual";
import { VideoDemo } from "@/components/landing/VideoDemo";

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

   // Organize features in 4 pillars: Captura, Classificação, Declarações, Gestão Pro
   const featurePillars = [
    {
       pillar: "Captura",
       description: "Digitalize documentos de múltiplas formas",
       color: "from-blue-500 to-cyan-500",
       items: [
         {
           icon: QrCode,
           title: "QR Code Português",
           description: "Leitura instantânea do QR code de facturas PT com extracção automática."
         },
         {
           icon: FileCode,
           title: "SAFT-PT & CSV",
           description: "Importa ficheiros SAFT-PT (XML) ou CSV do Portal das Finanças."
         },
         {
           icon: CloudUpload,
           title: "Bulk Import (100+)",
           description: "Processamento em lote de até 500 documentos com fila inteligente."
         },
         {
           icon: Wifi,
           title: "PWA Offline",
           description: "Funciona offline com sincronização automática quando voltar online."
         }
       ]
    },
    {
       pillar: "Classificação",
       description: "IA que aprende e se adapta ao seu negócio",
       color: "from-violet-500 to-purple-500",
       items: [
         {
           icon: Brain,
           title: "IA Few-Shot Learning",
           description: "Classificação que aprende com cada correcção e guarda preferências."
         },
         {
           icon: Copy,
           title: "Compras vs Vendas",
           description: "Detecção automática do tipo de documento com validação cruzada."
         },
         {
           icon: ShieldCheck,
           title: "Detecção Duplicados",
           description: "Verificação automática de documentos duplicados antes de guardar."
         },
         {
           icon: Map,
           title: "Taxas Regionais",
           description: "Açores 16%, Madeira 22%, Continente 23% — aplicação automática."
         }
       ]
    },
    {
       pillar: "Declarações",
       description: "Cumpra todas as obrigações fiscais",
       color: "from-emerald-500 to-green-500",
       items: [
         {
           icon: Calculator,
           title: "Calculadora IVA",
           description: "Isenção Art.53º, adicionar/retirar IVA, e cálculo de IVA a entregar."
         },
         {
           icon: Receipt,
           title: "Modelo 10",
           description: "Declaração de retenções na fonte com export PDF/CSV oficial AT."
         },
         {
           icon: BarChart3,
           title: "Segurança Social",
           description: "Cálculo de contribuições trimestrais com gráficos de evolução."
         }
       ]
    },
    {
       pillar: "Gestão Pro",
       description: "Para contabilistas e equipas",
       color: "from-orange-500 to-amber-500",
       items: [
         {
           icon: Users,
           title: "Multi-Cliente",
           description: "Gerir múltiplos clientes numa única interface com troca rápida."
         },
         {
           icon: History,
           title: "Histórico Auditável",
           description: "Audit trail completo de todas as alterações com timestamps."
         },
         {
           icon: BarChart3,
           title: "Analytics & Métricas",
           description: "Precisão da IA, taxa de correcções e evolução ao longo do tempo."
         }
       ]
    }
  ];
   
   // Flat features for backward compatibility with existing UI
   const features = featurePillars.flatMap(p => p.items);

  const stats = [
    { value: "70%", label: "Menos tempo por factura" },
    { value: "<5s", label: "Classificação automática" },
    { value: "98%", label: "Precisão QR code PT" },
    { value: "100%", label: "Conformidade RGPD" }
  ];

  const testimonials = [
    {
      quote: "O IVAzen reduziu o tempo de processamento de facturas em 70%. Agora consigo focar no que realmente importa - aconselhar os meus clientes.",
      name: "Maria Santos",
      role: "Contabilista Certificada",
      location: "Lisboa",
      initials: "MS"
    },
    {
      quote: "A classificação automática com IA é impressionante. Poupo horas todas as semanas e os erros diminuíram drasticamente.",
      name: "João Ferreira",
      role: "TOC",
      location: "Porto",
      initials: "JF"
    },
    {
      quote: "Finalmente uma ferramenta portuguesa que entende as nossas necessidades fiscais. O Modelo 10 nunca foi tão fácil.",
      name: "Ana Costa",
      role: "Gestora de Contabilidade",
      location: "Braga",
      initials: "AC"
    }
  ];

  const securityBadges = [
    { icon: ShieldCheck, label: "Conformidade RGPD" },
    { icon: Lock, label: "Dados encriptados AES-256" },
    { icon: Globe, label: "Made in Portugal 🇵🇹" },
    { icon: MessageCircle, label: "Suporte em Português" }
  ];

  const steps = [
    {
      type: 'scan' as const,
      title: "Scan & Go",
      badge: "QR Code PT • <5s",
      description: "Aponte para o QR code português. Ou arraste SAFT-PT/CSV. Suporta foto, PDF ou XML.",
      bullets: ["Leitura instantânea", "Batch até 100 facturas", "Funciona offline (PWA)"]
    },
    {
      type: 'classify' as const,
      title: "IA que Aprende",
      badge: "Few-Shot Learning • 98%",
      description: "Few-shot learning adapta-se às suas preferências. Cada correcção melhora o sistema.",
      bullets: ["98% precisão", "Melhora com uso", "Personalizado ao seu negócio"]
    },
    {
      type: 'export' as const,
      title: "Export Pro",
      badge: "SAFT-PT • Modelo 10",
      description: "SAFT-PT pronto para Modelo 10. Dashboard online para análise. Formato oficial AT.",
      bullets: ["Dashboard interactivo", "Acesso web 24/7", "Histórico auditável"]
    }
  ];

  const integrations = [
    { name: "Portal das Finanças", description: "Importação directa de ficheiros", icon: Globe },
    { name: "Segurança Social Directa", description: "Cálculo de contribuições", icon: ShieldCheck },
    { name: "SAFT-PT", description: "Formato oficial português", icon: FileCode },
    { name: "Portal Online", description: "Acesso em qualquer dispositivo", icon: Laptop }
  ];

  const faqs = [
    {
      question: "Funciona com qualquer factura portuguesa?",
      answer: "Sim! O IVAzen reconhece o formato QR code oficial português presente em todas as facturas emitidas desde Janeiro de 2022. Também suporta importação via ficheiros SAFT-PT e CSV do Portal das Finanças."
    },
    {
      question: "Os meus dados estão seguros?",
      answer: "Absolutamente. Utilizamos encriptação end-to-end, Row Level Security (RLS) a nível de base de dados, e cumprimos integralmente o RGPD. Os seus dados nunca são partilhados com terceiros."
    },
    {
      question: "Posso usar no telemóvel?",
      answer: "Sim! O IVAzen é uma Progressive Web App (PWA) que funciona em qualquer dispositivo. Pode instalar no ecrã inicial e usar mesmo offline - os dados sincronizam quando voltar a ter internet."
    },
    {
      question: "Como funciona a IA?",
      answer: "O IVAzen usa Few-Shot Learning para aprender com cada correcção que faz. Quanto mais usa, mais precisa fica. As suas preferências de classificação são guardadas e sugeridas automaticamente em importações futuras."
    },
    {
      question: "Preciso de conhecimentos técnicos?",
      answer: "Não! A interface foi desenhada para ser intuitiva. Basta apontar a câmara ou arrastar ficheiros. O IVAzen trata do resto."
    },
    {
      question: "Como posso obter acesso?",
      answer: "O IVAzen é uma ferramenta exclusiva para clientes da Accounting Advantage. Contacte-nos para saber mais sobre como podemos ajudar na gestão do seu IVA."
    }
  ];

  const trustBadges = [
    { icon: ShieldCheck, label: "Conformidade RGPD" },
    { icon: Users, label: "Accounting Advantage" },
    { icon: Globe, label: "Made in Portugal 🇵🇹" }
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "#features", label: "Funcionalidades" },
    { href: "#how-it-works", label: "Como Funciona" },
    { href: "#faq", label: "FAQ" }
  ];

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Glassmorphism */}
      <header className="sticky top-0 z-50 glass-card border-b border-primary/10">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-rose shadow-glow">
                <Heart className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="bg-gradient-to-r from-primary via-pink-400 to-accent bg-clip-text text-2xl font-display font-bold tracking-tight text-transparent">
                  IVAzen
                </span>
                <span className="text-[10px] text-muted-foreground">by Accounting Advantage</span>
              </div>
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden items-center gap-8 md:flex">
              {navLinks.map((link) => (
                <a 
                  key={link.href}
                  href={link.href} 
                  className="underline-grow text-sm text-muted-foreground transition-all duration-300 hover:text-primary"
                >
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button asChild variant="ghost" size="sm" className="hidden hover:text-primary sm:inline-flex transition-all duration-300 hover:bg-primary/10 elastic-scale">
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button asChild size="sm" className="hidden premium-button sm:inline-flex elastic-scale group">
                <Link to="/auth?tab=signup">
                  Criar Conta
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
              
              {/* Mobile menu button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </nav>
        </div>
        
        {/* Mobile menu */}
        <div 
          className={`overflow-hidden border-t border-primary/10 glass-card transition-all duration-300 ease-in-out md:hidden ${
            mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a 
                  key={link.href}
                  href={link.href} 
                  className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  onClick={handleNavClick}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-primary/10 pt-4">
                <Button asChild variant="outline" className="premium-button-outline w-full justify-center">
                  <Link to="/auth" onClick={handleNavClick}>Entrar</Link>
                </Button>
                <Button asChild className="premium-button w-full justify-center">
                  <Link to="/auth?tab=signup" onClick={handleNavClick}>
                    Criar Conta
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero with illustration - Rose Gradient */}
      <section className="relative overflow-hidden">
        {/* Background decorations - Rose */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-accent/5 to-transparent" />
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl animate-premium-float" />
        <div className="absolute -right-32 top-1/4 h-80 w-80 rounded-full bg-accent/15 blur-3xl animate-premium-float" style={{ animationDelay: '2s' }} />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-400/10 blur-3xl animate-premium-pulse" />
        
        <div className="container relative mx-auto px-4 py-16 md:py-24 lg:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Text content */}
            <AnimateOnScroll animation="fade-up" initiallyVisible>
              <div className="text-center lg:text-left">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full glass-card glow-ring border-primary/30 px-4 py-2 text-sm text-primary">
                  <Heart className="h-4 w-4 animate-premium-pulse" />
                  Powered by Accounting Advantage
                </div>
                <h1 className="mb-6 text-4xl font-display font-bold tracking-tight md:text-5xl lg:text-6xl">
                  Gestão de IVA inteligente{" "}
                  <span className="bg-gradient-to-r from-primary via-pink-400 to-accent bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                    para clientes Accounting Advantage
                  </span>
                </h1>
                <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground lg:mx-0">
                  Ferramenta exclusiva para clientes. Digitalize facturas, classifique automaticamente com IA 
                  e prepare a sua declaração de IVA em minutos.
                </p>
                <div className="flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
                  <Button asChild size="lg" className="premium-button gap-2 px-8 shadow-glow-lg elastic-scale click-bounce group">
                    <Link to="/auth">
                      Aceder à Plataforma
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" className="border-2 border-primary bg-primary/10 text-primary font-semibold hover:bg-primary/20 hover:border-primary transition-all duration-500 gap-2 elastic-scale click-bounce group hover:shadow-glow">
                    <Link to="/contact">
                      <Phone className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
                      Contactar
                    </Link>
                  </Button>
                </div>
                
                {/* Trust badges - Glass */}
                <div className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start stagger-children">
                  {trustBadges.map((badge, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-2 rounded-full glass-card-hover border-primary/20 px-4 py-2 shadow-sm transition-all duration-500 hover:shadow-glow hover:-translate-y-1 elastic-scale group"
                    >
                      <badge.icon className="h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                      <span className="text-sm font-medium transition-colors duration-300 group-hover:text-primary">{badge.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
            
            {/* Hero mockup - Premium UI */}
            <AnimateOnScroll animation="fade-up" delay={200} initiallyVisible>
              <HeroMockup />
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* Stats bar - Glass */}
      <section className="border-y border-primary/10 glass-card py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <AnimateOnScroll key={index} animation="fade-up" delay={index * 100}>
                <div className="text-center group cursor-default elastic-scale">
                  <div className="mb-1 text-3xl font-display font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent md:text-4xl transition-all duration-300 group-hover:scale-110 gradient-shimmer">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground">{stat.label}</div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Features - Glass Cards */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <AnimateOnScroll animation="fade-up" className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-display font-bold md:text-4xl">
              Tudo o que precisa para{" "}
              <span className="bg-gradient-to-r from-primary via-pink-400 to-accent bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                gerir o IVA sem stress
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Ferramentas poderosas, interface zen. Feito a pensar no trabalhador independente português.
            </p>
          </AnimateOnScroll>
           
           {/* 4 Pillar Grid */}
           <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
             {featurePillars.map((pillar, pillarIndex) => (
               <AnimateOnScroll key={pillar.pillar} animation="fade-up" delay={pillarIndex * 100}>
                 <div className="space-y-4">
                   {/* Pillar Header */}
                   <div className="text-center">
                     <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${pillar.color} px-4 py-1.5 text-sm font-semibold text-white shadow-lg`}>
                       {pillar.pillar}
                     </div>
                     <p className="mt-2 text-xs text-muted-foreground">{pillar.description}</p>
                   </div>
                   
                   {/* Pillar Features */}
                   <div className="space-y-3">
                     {pillar.items.map((feature, index) => (
                       <Card key={index} className="glass-card-hover group border-primary/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                         <CardContent className="p-4">
                           <div className="flex items-start gap-3">
                             <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${pillar.color} text-white shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                               <feature.icon className="h-4 w-4" />
                             </div>
                             <div className="min-w-0">
                               <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{feature.title}</h3>
                               <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                             </div>
                           </div>
                         </CardContent>
                       </Card>
                     ))}
                   </div>
                 </div>
               </AnimateOnScroll>
             ))}
           </div>
        </div>
      </section>

      {/* Testimonials - Glass Cards */}
      <section className="relative py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-accent/3 to-transparent" />
        <div className="container relative mx-auto px-4">
          <AnimateOnScroll animation="fade-up" className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-display font-bold md:text-4xl">
              O Que Dizem{" "}
              <span className="bg-gradient-to-r from-primary via-pink-400 to-accent bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                Os Contabilistas
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Profissionais que já transformaram a sua gestão de IVA com o IVAzen.
            </p>
          </AnimateOnScroll>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <AnimateOnScroll key={index} animation="fade-up" delay={index * 150}>
                <Card className="glass-card-hover glow-ring group h-full border-primary/10 transition-all duration-500 hover:-translate-y-3 hover:shadow-glow-lg">
                  <CardContent className="p-6">
                    {/* Quote icon */}
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                      <Quote className="h-5 w-5 text-primary" />
                    </div>

                    {/* Quote text */}
                    <blockquote className="mb-6 text-sm leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                      "{testimonial.quote}"
                    </blockquote>

                    {/* Author info */}
                    <div className="flex items-center gap-3 border-t border-primary/10 pt-4">
                      {/* Avatar with initials */}
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full gradient-rose text-white font-semibold shadow-glow transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow-lg">
                        {testimonial.initials}
                      </div>
                      <div>
                        <p className="font-semibold transition-colors duration-300 group-hover:text-primary">
                          {testimonial.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {testimonial.role}, {testimonial.location}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>

          {/* Trust/Security Badges */}
          <AnimateOnScroll animation="fade-up" delay={500} className="mt-16">
            <div className="mx-auto max-w-4xl">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {securityBadges.map((badge, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center gap-2 rounded-xl glass-card-hover border-primary/10 p-4 text-center transition-all duration-500 hover:shadow-glow hover:-translate-y-1 group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                      <badge.icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="text-sm font-medium transition-colors duration-300 group-hover:text-primary">
                      {badge.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* How it works - Visual steps with Glass */}
      <section id="how-it-works" className="relative py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-accent/5 to-transparent" />
        <div className="container relative mx-auto px-4">
          <AnimateOnScroll animation="fade-up" className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-display font-bold md:text-4xl">
              3 passos para{" "}
              <span className="bg-gradient-to-r from-primary via-pink-400 to-accent bg-clip-text text-transparent">
                zero stress fiscal
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Do QR code ao Modelo 10 em minutos, não horas.
            </p>
          </AnimateOnScroll>
          <div className="mx-auto max-w-5xl space-y-16 md:space-y-24">
            {steps.map((step, index) => (
              <AnimateOnScroll key={index} animation="fade-up" delay={index * 150}>
                <div className={`flex flex-col items-center gap-8 md:flex-row ${index % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                  {/* Visual - CSS Component */}
                  <div className="w-full md:w-1/2">
                    <div className="relative overflow-hidden rounded-2xl glass-card p-4 shadow-glow-lg glow-ring transition-all duration-300 hover:shadow-glow-lg">
                      <div className="absolute -left-4 -top-4 h-20 w-20 rounded-full bg-primary/20 blur-xl" />
                      <StepVisual type={step.type} />
                    </div>
                  </div>
                  {/* Content */}
                  <div className="w-full md:w-1/2">
                    <div className="inline-block rounded-full gradient-rose px-4 py-1 text-sm font-medium text-white shadow-glow">
                      Passo {index + 1}
                    </div>
                    <div className="mb-2 mt-4 inline-flex items-center gap-2 rounded-lg glass-card px-3 py-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-primary" />
                      {step.badge}
                    </div>
                    <h3 className="mb-3 text-2xl font-display font-bold">{step.title}</h3>
                    <p className="mb-4 text-muted-foreground">{step.description}</p>
                    <ul className="space-y-2">
                      {step.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-3xl opacity-50" />

        <div className="container relative mx-auto px-4">
          <AnimateOnScroll animation="fade-up" className="mx-auto mb-12 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full glass-card border-primary/30 px-4 py-2 text-sm text-primary">
              <Sparkles className="h-4 w-4 animate-shimmer" />
              Veja em Acao
            </div>
            <h2 className="mb-4 text-3xl font-display font-bold md:text-4xl">
              Veja como e facil usar o{" "}
              <span className="bg-gradient-to-r from-primary via-pink-400 to-accent bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                IVAzen
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Em menos de 30 segundos, digitalize uma factura e veja a magia acontecer.
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll animation="fade-up" delay={200}>
            <VideoDemo />
          </AnimateOnScroll>
        </div>
      </section>

      {/* Benefits / Why IVAzen - Glass */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <AnimateOnScroll animation="fade-up">
              <div>
                <h2 className="mb-6 text-3xl font-display font-bold md:text-4xl">
                  Porque escolher o{" "}
                  <span className="bg-gradient-to-r from-primary via-pink-400 to-accent bg-clip-text text-transparent">
                    IVAzen?
                  </span>
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4 glass-card-hover rounded-xl p-4 transition-all duration-300 hover:shadow-glow">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg gradient-rose text-white shadow-glow">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">70% menos tempo</h3>
                      <p className="text-sm text-muted-foreground">
                        Automatize a classificação. Foque no que importa.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 glass-card-hover rounded-xl p-4 transition-all duration-300 hover:shadow-glow">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg gradient-rose text-white shadow-glow">
                      <Brain className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">IA que evolui</h3>
                      <p className="text-sm text-muted-foreground">
                        Aprende consigo. Cada correcção melhora as sugestões futuras.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 glass-card-hover rounded-xl p-4 transition-all duration-300 hover:shadow-glow">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg gradient-rose text-white shadow-glow">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">100% português</h3>
                      <p className="text-sm text-muted-foreground">
                        Feito para as regras fiscais portuguesas. QR code PT, SAFT-PT, Modelo 10.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll animation="fade-up" delay={200}>
              <Card className="overflow-hidden glass-card glow-ring border-primary/20 shadow-glow-lg">
                <CardContent className="p-8">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-rose text-white shadow-glow animate-premium-pulse">
                      <Heart className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">Integração completa</p>
                      <p className="text-sm text-muted-foreground">Com os sistemas portugueses</p>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    {integrations.map((integration, index) => (
                      <div key={index} className="flex items-center gap-3 rounded-lg glass-card-hover shimmer-hover p-3 shadow-sm transition-all duration-500 hover:shadow-glow hover:-translate-x-1 group click-bounce">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                          <integration.icon className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium transition-colors duration-300 group-hover:text-primary">{integration.name}</p>
                          <p className="text-xs text-muted-foreground">{integration.description}</p>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-2 group-hover:text-primary" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* FAQ - Glass Accordion */}
      <section id="faq" className="relative py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative mx-auto px-4">
          <AnimateOnScroll animation="fade-up" className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-display font-bold md:text-4xl">
              Perguntas{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Frequentes
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Tudo o que precisa saber sobre o IVAzen.
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll animation="fade-up" delay={200} className="mx-auto max-w-3xl">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="rounded-xl glass-card-hover border-primary/10 px-6 shadow-sm transition-all duration-500 data-[state=open]:shadow-glow-lg data-[state=open]:border-primary/40 data-[state=open]:-translate-y-1 hover:border-primary/20"
                >
                  <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-all duration-300 [&[data-state=open]]:text-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground animate-fade-in">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Final CTA - Rose Gradient */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 gradient-rose opacity-90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="absolute -left-40 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-white/20 blur-3xl animate-premium-float" />
        <div className="absolute -right-40 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-accent/30 blur-3xl animate-premium-float" style={{ animationDelay: '3s' }} />
        
        <div className="container relative mx-auto px-4">
          <AnimateOnScroll animation="fade-up" className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full glass-card border-white/30 px-4 py-2 text-sm text-white">
              <Sparkles className="h-4 w-4 animate-shimmer" />
              Exclusivo para clientes Accounting Advantage
            </div>
            <h2 className="mb-6 text-3xl font-display font-bold text-white md:text-4xl lg:text-5xl">
              Pronto para simplificar{" "}
              <span className="text-white/90">
                a sua gestão de IVA?
              </span>
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-white/80">
              Aceda à plataforma e descubra como a IA pode transformar a forma como gere as suas facturas.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="gap-2 px-8 bg-white text-primary hover:bg-white/90 shadow-glow-lg hover-scale">
                <Link to="/auth">
                  Aceder Agora
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/50 backdrop-blur-sm hover-scale">
                <Link to="/contact">
                  <Phone className="h-4 w-4" />
                  Falar com a Equipa
                </Link>
              </Button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Footer - Glass */}
      <footer className="border-t border-primary/10 glass-card py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-rose shadow-glow">
                  <Heart className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-lg font-display font-bold text-transparent">IVAzen</span>
                  <span className="text-[10px] text-muted-foreground">by Accounting Advantage</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Gestão de IVA simplificada para trabalhadores independentes portugueses.
              </p>
            </div>
            
            {/* Links */}
            <div>
              <h4 className="mb-4 font-semibold">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="story-link transition-colors hover:text-primary"><span>Funcionalidades</span></a></li>
                <li><a href="#how-it-works" className="story-link transition-colors hover:text-primary"><span>Como Funciona</span></a></li>
                <li><a href="#faq" className="story-link transition-colors hover:text-primary"><span>FAQ</span></a></li>
              </ul>
            </div>
            
            {/* Legal */}
            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/privacy" className="story-link transition-colors hover:text-primary"><span>Privacidade</span></Link></li>
                <li><Link to="/terms" className="story-link transition-colors hover:text-primary"><span>Termos</span></Link></li>
                <li><Link to="/contact" className="story-link transition-colors hover:text-primary"><span>Contacto</span></Link></li>
              </ul>
            </div>

            {/* Contact - Accounting Advantage */}
            <div>
              <h4 className="mb-4 font-semibold">Accounting Advantage</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2 group">
                  <Phone className="h-4 w-4 text-primary group-hover:animate-premium-pulse" />
                  <span>+351 219 586 265</span>
                </li>
                <li className="flex items-center gap-2 group">
                  <Phone className="h-4 w-4 text-primary group-hover:animate-premium-pulse" />
                  <span>+351 910 542 488</span>
                </li>
                <li className="flex items-center gap-2 group">
                  <Mail className="h-4 w-4 text-primary group-hover:animate-premium-pulse" />
                  <a href="mailto:geral@accountingadvantage.pt" className="transition-colors hover:text-primary">
                    geral@accountingadvantage.pt
                  </a>
                </li>
                <li className="flex items-start gap-2 group">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary group-hover:animate-premium-pulse" />
                  <span>Alverca do Ribatejo</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-primary/10 pt-8 md:flex-row">
            <p className="text-sm text-muted-foreground">
              © 2025 IVAzen by Accounting Advantage. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link to="/privacy" className="story-link transition-colors hover:text-primary"><span>Privacidade</span></Link>
              <Link to="/terms" className="story-link transition-colors hover:text-primary"><span>Termos</span></Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
