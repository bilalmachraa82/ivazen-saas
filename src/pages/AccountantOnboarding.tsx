import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, Search, UserPlus, FileCheck, Settings, 
  ArrowRight, ArrowLeft, CheckCircle2, Sparkles,
  ClipboardList, Shield, TrendingUp, Rocket
} from 'lucide-react';
import { ZenCard, ZenHeader, ZenDecorations } from '@/components/zen';
import { cn } from '@/lib/utils';

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: 'Configure o seu Perfil',
    description: 'O primeiro passo é garantir que o seu perfil está completo com o seu NIF.',
    icon: Settings,
    content: {
      heading: 'Complete o seu Perfil Profissional',
      details: [
        'Aceda às Definições clicando no ícone de engrenagem no menu lateral',
        'Preencha o seu NIF (obrigatório para os clientes o identificarem)',
        'Adicione o nome da sua empresa ou nome profissional',
        'Configure o seu CAE e descrição da actividade',
      ],
      tip: 'O seu NIF é essencial para que os clientes possam ser associados a si.',
      action: { label: 'Ir para Definições', path: '/settings' },
    },
  },
  {
    id: 2,
    title: 'Pesquise Clientes',
    description: 'Encontre os seus clientes pesquisando por NIF, email ou nome.',
    icon: Search,
    content: {
      heading: 'Encontre os seus Clientes',
      details: [
        'Na secção "Gestão de Clientes" das Definições, utilize a barra de pesquisa',
        'Pode pesquisar por NIF (recomendado), email ou nome',
        'Apenas clientes sem contabilista associado aparecem nos resultados',
        'Os clientes devem ter o perfil preenchido para serem encontrados',
      ],
      tip: 'Peça aos seus clientes para preencherem o NIF no perfil deles para facilitar a pesquisa.',
      action: { label: 'Ir para Definições', path: '/settings' },
    },
  },
  {
    id: 3,
    title: 'Adicione à Carteira',
    description: 'Clique em "Adicionar" para associar o cliente a si.',
    icon: UserPlus,
    content: {
      heading: 'Associe Clientes à sua Carteira',
      details: [
        'Quando encontrar o cliente, clique no botão "Adicionar"',
        'O cliente receberá uma notificação da associação',
        'A partir desse momento, terá acesso às facturas do cliente',
        'Pode remover clientes da carteira a qualquer momento',
      ],
      tip: 'Os clientes também podem remover a associação do lado deles se necessário.',
      action: { label: 'Ir para Definições', path: '/settings' },
    },
  },
  {
    id: 4,
    title: 'Valide Facturas',
    description: 'Aceda ao Dashboard para validar as facturas dos seus clientes.',
    icon: FileCheck,
    content: {
      heading: 'Valide e Classifique Facturas',
      details: [
        'O Dashboard de Contabilista mostra todas as facturas pendentes',
        'A IA sugere classificações automáticas baseadas no histórico',
        'Pode validar facturas individualmente ou em lote',
        'As classificações validadas alimentam o sistema de aprendizagem',
      ],
      tip: 'Quanto mais facturas validar, mais precisa a IA se torna para cada fornecedor.',
      action: { label: 'Ir para Dashboard', path: '/accountant' },
    },
  },
  {
    id: 5,
    title: 'Acompanhe Métricas',
    description: 'Monitorize o progresso e estatísticas dos seus clientes.',
    icon: TrendingUp,
    content: {
      heading: 'Acompanhe o Desempenho',
      details: [
        'Veja estatísticas agregadas de todos os clientes',
        'Monitorize facturas pendentes por cliente',
        'Acompanhe o IVA dedutível total',
        'Exporte dados para relatórios quando necessário',
      ],
      tip: 'O Dashboard actualiza em tempo real à medida que os clientes carregam novas facturas.',
      action: { label: 'Ir para Dashboard', path: '/accountant' },
    },
  },
];

export default function AccountantOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const step = ONBOARDING_STEPS[currentStep];
  const StepIcon = step.icon;

  const goToNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (index: number) => {
    setCurrentStep(index);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in relative max-w-4xl mx-auto">
        <ZenDecorations />

        <ZenHeader
          icon={Rocket}
          title="Bem-vindo, Contabilista!"
          description="Guia completo para gerir os seus clientes no IVAzen"
        />

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso do guia</span>
            <span className="font-medium">{currentStep + 1} de {ONBOARDING_STEPS.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Navigation Pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {ONBOARDING_STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <button
                key={s.id}
                onClick={() => goToStep(index)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : isCompleted 
                      ? "bg-primary/20 text-primary" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Card */}
        <ZenCard gradient="primary" withLine className="shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-inner">
                <StepIcon className="h-8 w-8 text-primary" />
              </div>
              <div>
                <Badge className="mb-2 bg-primary/20 text-primary border-0">
                  Passo {step.id}
                </Badge>
                <CardTitle className="text-2xl">{step.content.heading}</CardTitle>
                <CardDescription className="text-base mt-1">
                  {step.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Steps List */}
            <div className="space-y-3">
              {step.content.details.map((detail, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm">{detail}</p>
                </div>
              ))}
            </div>

            {/* Tip Box */}
            <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-xl">
              <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-400 text-sm">Dica</p>
                <p className="text-sm text-muted-foreground">{step.content.tip}</p>
              </div>
            </div>

            {/* Action Button */}
            {step.content.action && (
              <Button 
                onClick={() => navigate(step.content.action.path)}
                className="w-full zen-button gap-2"
              >
                {step.content.action.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t border-border/50">
              <Button
                variant="outline"
                onClick={goToPrevious}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Button>
              
              {currentStep === ONBOARDING_STEPS.length - 1 ? (
                <Button
                  onClick={() => navigate('/accountant')}
                  className="zen-button gap-2"
                >
                  Começar a Usar
                  <Rocket className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={goToNext}
                  className="zen-button gap-2"
                >
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </ZenCard>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ZenCard gradient="muted" className="cursor-pointer hover:shadow-lg transition-all" animationDelay="0ms">
            <CardContent className="p-4 flex items-center gap-3" onClick={() => navigate('/settings')}>
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Gerir Clientes</p>
                <p className="text-xs text-muted-foreground">Adicionar ou remover</p>
              </div>
            </CardContent>
          </ZenCard>

          <ZenCard gradient="muted" className="cursor-pointer hover:shadow-lg transition-all" animationDelay="50ms">
            <CardContent className="p-4 flex items-center gap-3" onClick={() => navigate('/accountant')}>
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Dashboard</p>
                <p className="text-xs text-muted-foreground">Validar facturas</p>
              </div>
            </CardContent>
          </ZenCard>

          <ZenCard gradient="muted" className="cursor-pointer hover:shadow-lg transition-all" animationDelay="100ms">
            <CardContent className="p-4 flex items-center gap-3" onClick={() => navigate('/ai-metrics')}>
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Métricas IA</p>
                <p className="text-xs text-muted-foreground">Ver precisão</p>
              </div>
            </CardContent>
          </ZenCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
