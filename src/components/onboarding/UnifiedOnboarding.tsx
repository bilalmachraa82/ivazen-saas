/**
 * UnifiedOnboarding Component
 *
 * Integrates all onboarding systems into a cohesive experience:
 * - Welcome modal with overview
 * - Fiscal Setup Wizard (required for new users)
 * - Interactive tour (optional, skippable)
 * - Dashboard checklist (background tracking)
 * - Celebration when 100% complete
 *
 * Features gamification with badges, progress tracking, confetti and motivational messages.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Trophy,
  Star,
  Zap,
  Rocket,
  Target,
  Award,
  PartyPopper,
  Leaf,
  Play,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Upload,
  CheckCircle,
  FileText,
  Settings,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useProfile } from '@/hooks/useProfile';
import { useAccountant } from '@/hooks/useAccountant';
import { useAuth } from '@/hooks/useAuth';
import { getOnboardingSteps, calculateProgress, isOnboardingComplete } from '@/lib/onboardingSteps';
import { FiscalSetupWizard } from './FiscalSetupWizard';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type OnboardingPhase =
  | 'welcome'
  | 'fiscal-setup'
  | 'tour-intro'
  | 'tour'
  | 'checklist'
  | 'celebration';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  unlockedAt?: Date;
}

interface TourStep {
  target: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  welcomeShown: 'ivazen-unified-onboarding-welcome-shown',
  tourCompleted: 'ivazen-unified-onboarding-tour-completed',
  tourSkipped: 'ivazen-unified-onboarding-tour-skipped',
  celebrationShown: 'ivazen-unified-onboarding-celebration-shown',
  badges: 'ivazen-unified-onboarding-badges',
  lastPhase: 'ivazen-unified-onboarding-last-phase',
};

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="stats-grid"]',
    title: 'Estatisticas Rapidas',
    description: 'Veja o resumo das suas facturas: total, pendentes, validadas e com baixa confianca da IA.',
    icon: <FileText className="h-5 w-5" />,
    position: 'bottom',
  },
  {
    target: '[data-tour="new-invoice"]',
    title: 'Carregar Factura',
    description: 'Clique aqui para digitalizar uma nova factura. Use a camara para ler o codigo QR automaticamente.',
    icon: <Upload className="h-5 w-5" />,
    position: 'bottom',
  },
  {
    target: '[data-tour="quick-actions"]',
    title: 'Acoes Rapidas',
    description: 'Acesso directo as funcionalidades principais: carregar, validar e exportar facturas.',
    icon: <CheckCircle className="h-5 w-5" />,
    position: 'top',
  },
  {
    target: '[data-tour="nav-validation"]',
    title: 'Validar Classificacoes',
    description: 'Reveja as classificacoes feitas pela IA. Quanto mais validar, mais precisa fica!',
    icon: <Sparkles className="h-5 w-5" />,
    position: 'right',
  },
  {
    target: '[data-tour="nav-settings"]',
    title: 'Configuracoes',
    description: 'Configure a sua chave API Gemini para activar a classificacao automatica por IA.',
    icon: <Settings className="h-5 w-5" />,
    position: 'right',
  },
];

const MOTIVATIONAL_MESSAGES = [
  { threshold: 0, message: 'Vamos comecar a sua jornada fiscal!', icon: Rocket },
  { threshold: 20, message: 'Otimo comeco! Continue assim!', icon: Zap },
  { threshold: 40, message: 'Ja esta a meio caminho!', icon: Target },
  { threshold: 60, message: 'Excelente progresso!', icon: Star },
  { threshold: 80, message: 'Quase la! Falta pouco!', icon: Trophy },
  { threshold: 100, message: 'Parabens! Concluiu o onboarding!', icon: PartyPopper },
];

const BADGE_DEFINITIONS: Omit<Badge, 'unlocked' | 'unlockedAt'>[] = [
  { id: 'welcome', name: 'Bem-vindo', description: 'Completou o tutorial de boas-vindas', icon: <Leaf className="h-5 w-5" /> },
  { id: 'fiscal-setup', name: 'Perfil Fiscal', description: 'Configurou o seu perfil fiscal', icon: <Shield className="h-5 w-5" /> },
  { id: 'tour-complete', name: 'Explorador', description: 'Completou o tour interactivo', icon: <Target className="h-5 w-5" /> },
  { id: 'first-invoice', name: 'Primeira Factura', description: 'Carregou a sua primeira factura', icon: <Upload className="h-5 w-5" /> },
  { id: 'first-validation', name: 'Validador', description: 'Validou a sua primeira classificacao', icon: <CheckCircle className="h-5 w-5" /> },
  { id: 'onboarding-complete', name: 'Mestre', description: 'Completou todo o onboarding', icon: <Trophy className="h-5 w-5" /> },
];

// ============================================================================
// CONFETTI COMPONENT
// ============================================================================

function Confetti({ show, duration = 3000 }: { show: boolean; duration?: number }) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number }>>([]);

  useEffect(() => {
    if (show) {
      const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => setParticles([]), duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  if (!show || particles.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-3 h-3 rounded-full"
          style={{
            left: `${particle.x}%`,
            backgroundColor: particle.color,
            top: -20,
          }}
          initial={{ y: 0, opacity: 1, rotate: 0 }}
          animate={{
            y: window.innerHeight + 100,
            opacity: 0,
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: particle.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>,
    document.body
  );
}

// ============================================================================
// BADGE DISPLAY COMPONENT
// ============================================================================

function BadgeDisplay({ badges, showAll = false }: { badges: Badge[]; showAll?: boolean }) {
  const displayBadges = showAll ? badges : badges.filter(b => b.unlocked);

  if (displayBadges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {displayBadges.map((badge) => (
        <motion.div
          key={badge.id}
          initial={badge.unlocked ? { scale: 0 } : { scale: 1 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
            badge.unlocked
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-muted/50 text-muted-foreground border border-border/50 opacity-50'
          )}
          title={badge.description}
        >
          <span className={badge.unlocked ? 'text-primary' : 'text-muted-foreground'}>
            {badge.icon}
          </span>
          <span className="font-medium">{badge.name}</span>
          {badge.unlocked && <Check className="h-3 w-3" />}
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// WELCOME MODAL COMPONENT
// ============================================================================

interface WelcomeModalProps {
  onContinue: () => void;
  onClose: () => void;
  userName?: string;
}

function WelcomeModal({ onContinue, onClose, userName }: WelcomeModalProps) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-lg"
      >
        <Card className="border-0 shadow-2xl bg-card/95 backdrop-blur overflow-hidden">
          {/* Decorative gradient line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary" />

          <CardHeader className="text-center pb-4 pt-8">
            <motion.div
              className="flex items-center justify-center gap-2 mb-4"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl">
                <Leaf className="h-8 w-8 text-primary" />
              </div>
            </motion.div>

            <CardTitle className="text-2xl">
              Bem-vindo ao IVAzen{userName ? `, ${userName}` : ''}!
            </CardTitle>
            <CardDescription className="text-base mt-2">
              A sua plataforma inteligente para gestao fiscal simplificada
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            {/* Feature highlights */}
            <div className="grid gap-3">
              {[
                { icon: Upload, title: 'Digitalize Facturas', desc: 'Scan QR codes ou faca upload de PDFs' },
                { icon: Sparkles, title: 'Classificacao IA', desc: 'A IA classifica as suas despesas automaticamente' },
                { icon: Shield, title: 'Seguranca Social', desc: 'Calculos precisos das contribuicoes trimestrais' },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* What's next */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                O que vem a seguir?
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 ml-6 list-decimal">
                <li>Configurar o seu perfil fiscal (obrigatorio)</li>
                <li>Tour rapido pela plataforma (opcional)</li>
                <li>Carregar a sua primeira factura</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={onContinue} className="w-full gap-2">
                Comecar Configuracao
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
                Ja sei usar, fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ============================================================================
// TOUR INTRO MODAL
// ============================================================================

interface TourIntroModalProps {
  onStartTour: () => void;
  onSkipTour: () => void;
}

function TourIntroModal({ onStartTour, onSkipTour }: TourIntroModalProps) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-2xl bg-card/95 backdrop-blur overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary" />

          <CardHeader className="text-center pb-4 pt-8">
            <motion.div
              className="flex items-center justify-center mb-4"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            >
              <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl">
                <Target className="h-10 w-10 text-primary" />
              </div>
            </motion.div>

            <CardTitle className="text-xl">Tour Interactivo</CardTitle>
            <CardDescription className="mt-2">
              Quer um tour rapido pela plataforma? Demora menos de 1 minuto!
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pb-8">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-primary">{TOUR_STEPS.length}</p>
                <p className="text-xs text-muted-foreground">Passos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-primary">&lt;1</p>
                <p className="text-xs text-muted-foreground">Minuto</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={onStartTour} className="w-full gap-2">
                <Play className="h-4 w-4" />
                Iniciar Tour
              </Button>
              <Button variant="outline" onClick={onSkipTour} className="w-full gap-2">
                <SkipForward className="h-4 w-4" />
                Saltar Tour
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Pode sempre aceder ao tour nas Definicoes
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ============================================================================
// INTERACTIVE TOUR OVERLAY
// ============================================================================

interface InteractiveTourOverlayProps {
  onComplete: () => void;
  onSkip: () => void;
}

function InteractiveTourOverlay({ onComplete, onSkip }: InteractiveTourOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightPosition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const updateSpotlight = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    const element = document.querySelector(step.target);
    if (!element) {
      // Element not found, try next step
      if (currentStep < TOUR_STEPS.length - 1) {
        setCurrentStep(s => s + 1);
      } else {
        onComplete();
      }
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 8;

    setSpotlight({
      top: rect.top - padding + window.scrollY,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate tooltip position
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const margin = 16;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = rect.top - tooltipHeight - margin + window.scrollY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + margin + window.scrollY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
        left = rect.left - tooltipWidth - margin;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
        left = rect.right + margin;
        break;
      default:
        top = rect.bottom + margin + window.scrollY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
    }

    // Keep tooltip within viewport
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));
    top = Math.max(margin, top);

    setTooltipPosition({ top, left });
  }, [currentStep, onComplete]);

  useEffect(() => {
    updateSpotlight();

    const handleResize = () => updateSpotlight();
    const handleScroll = () => updateSpotlight();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentStep, updateSpotlight]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  if (!spotlight) return null;

  const step = TOUR_STEPS[currentStep];

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* Overlay with cutout */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ height: document.documentElement.scrollHeight }}
      >
        <defs>
          <mask id="unified-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.left}
              y={spotlight.top}
              width={spotlight.width}
              height={spotlight.height}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#unified-spotlight-mask)"
          className="pointer-events-auto"
          onClick={handleNext}
        />
      </svg>

      {/* Spotlight border glow */}
      <motion.div
        className="absolute rounded-xl border-2 border-primary shadow-lg shadow-primary/30 pointer-events-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
        }}
      />

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card
          className="absolute w-80 shadow-2xl border-primary/20 z-[101]"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        >
          <CardContent className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    Passo {currentStep + 1} de {TOUR_STEPS.length}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -mr-2 -mt-1"
                onClick={onSkip}
                aria-label="Fechar tour"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-4">
              {step.description}
            </p>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mb-4">
              {TOUR_STEPS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    index === currentStep
                      ? 'w-6 bg-primary'
                      : index < currentStep
                      ? 'w-1.5 bg-primary/50'
                      : 'w-1.5 bg-muted-foreground/30'
                  )}
                  aria-label={`Ir para passo ${index + 1}`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1"
              >
                {currentStep === TOUR_STEPS.length - 1 ? 'Concluir' : 'Proximo'}
                {currentStep < TOUR_STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>

            {/* Keyboard hint */}
            <p className="text-[10px] text-center text-muted-foreground/60 mt-3">
              Use as setas para navegar, Esc para sair
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>,
    document.body
  );
}

// ============================================================================
// CELEBRATION MODAL
// ============================================================================

interface CelebrationModalProps {
  badges: Badge[];
  onClose: () => void;
}

function CelebrationModal({ badges, onClose }: CelebrationModalProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Confetti show={showConfetti} />
      {createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 50 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="w-full max-w-md"
          >
            <Card className="border-0 shadow-2xl bg-card/95 backdrop-blur overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-green-500 via-primary to-green-500" />

              <CardHeader className="text-center pb-4 pt-8">
                <motion.div
                  className="flex items-center justify-center mb-4"
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  <div className="p-4 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-full">
                    <Trophy className="h-12 w-12 text-green-500" />
                  </div>
                </motion.div>

                <CardTitle className="text-2xl">Parabens!</CardTitle>
                <CardDescription className="text-base mt-2">
                  Completou a configuracao inicial do IVAzen!
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 pb-8">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-green-500/10">
                    <p className="text-2xl font-bold text-green-500">100%</p>
                    <p className="text-xs text-muted-foreground">Completo</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10">
                    <p className="text-2xl font-bold text-primary">{badges.filter(b => b.unlocked).length}</p>
                    <p className="text-xs text-muted-foreground">Badges</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10">
                    <p className="text-2xl font-bold text-amber-500">
                      <Star className="h-6 w-6 inline" />
                    </p>
                    <p className="text-xs text-muted-foreground">Mestre!</p>
                  </div>
                </div>

                {/* Badges earned */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-center">Badges Conquistados</h4>
                  <BadgeDisplay badges={badges} />
                </div>

                {/* Next steps */}
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-primary" />
                    Proximos Passos
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>- Carregue a sua primeira factura</li>
                    <li>- Valide as classificacoes da IA</li>
                    <li>- Explore a calculadora de Seguranca Social</li>
                  </ul>
                </div>

                <Button onClick={onClose} className="w-full gap-2">
                  Comecar a Usar
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>,
        document.body
      )}
    </>
  );
}

// ============================================================================
// DASHBOARD PROGRESS CARD
// ============================================================================

interface OnboardingProgressCardProps {
  progress: number;
  badges: Badge[];
  completedSteps: string[];
  totalSteps: number;
  onDismiss: () => void;
  onResetTour: () => void;
}

export function OnboardingProgressCard({
  progress,
  badges,
  completedSteps,
  totalSteps,
  onDismiss,
  onResetTour,
}: OnboardingProgressCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { isAccountant } = useAccountant();
  const steps = getOnboardingSteps(isAccountant);

  // Get current motivational message
  const motivation = MOTIVATIONAL_MESSAGES.reduce((prev, curr) =>
    progress >= curr.threshold ? curr : prev
  );
  const MotivationIcon = motivation.icon;

  if (progress >= 100) return null;

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MotivationIcon className="h-5 w-5 text-primary" />
                Progresso do Onboarding
              </CardTitle>
              <Badge variant="outline" className="font-normal">
                {completedSteps.length}/{totalSteps}
              </Badge>
            </div>
            <CardDescription className="mt-1 flex items-center gap-2">
              <span>{motivation.message}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress}% completo</span>
            {progress < 100 && <span>Faltam {totalSteps - completedSteps.length} passos</span>}
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CardContent className="space-y-4 pt-0">
              {/* Badges */}
              {badges.filter(b => b.unlocked).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Badges Conquistados</p>
                  <BadgeDisplay badges={badges} />
                </div>
              )}

              {/* Checklist */}
              <div className="space-y-2">
                {steps.map((step) => {
                  const isCompleted = completedSteps.includes(step.id);
                  const StepIcon = step.icon;

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg transition-all',
                        isCompleted
                          ? 'bg-success/5 text-success'
                          : 'bg-muted/30 text-muted-foreground'
                      )}
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center h-6 w-6 rounded-full shrink-0',
                          isCompleted
                            ? 'bg-success text-success-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <StepIcon className="h-3 w-3" />
                        )}
                      </div>
                      <span className={cn('text-sm', isCompleted && 'line-through')}>
                        {step.title}
                      </span>
                      {step.optional && (
                        <Badge variant="secondary" className="text-[10px] ml-auto">
                          Opcional
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={onResetTour} className="text-xs">
                  <Target className="h-3 w-3 mr-1" />
                  Rever Tour
                </Button>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ============================================================================
// MAIN UNIFIED ONBOARDING COMPONENT
// ============================================================================

interface UnifiedOnboardingProps {
  children?: React.ReactNode;
}

export function UnifiedOnboarding({ children }: UnifiedOnboardingProps) {
  const { user } = useAuth();
  const { profile, needsFiscalSetup } = useProfile();
  const { isAccountant } = useAccountant();
  const { completedSteps, isLoading, completeStep, dismissOnboarding, isDismissed } = useOnboardingProgress();
  const navigate = useNavigate();

  // State
  const [phase, setPhase] = useState<OnboardingPhase | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [showProgressCard, setShowProgressCard] = useState(true);

  // Computed values
  const steps = getOnboardingSteps(isAccountant);
  const progress = calculateProgress(completedSteps, steps);
  const isComplete = isOnboardingComplete(completedSteps, steps);

  // Initialize badges
  useEffect(() => {
    const savedBadges = localStorage.getItem(STORAGE_KEYS.badges);
    if (savedBadges) {
      try {
        const parsed = JSON.parse(savedBadges);
        setBadges(BADGE_DEFINITIONS.map(def => ({
          ...def,
          unlocked: parsed[def.id]?.unlocked || false,
          unlockedAt: parsed[def.id]?.unlockedAt ? new Date(parsed[def.id].unlockedAt) : undefined,
        })));
      } catch {
        setBadges(BADGE_DEFINITIONS.map(def => ({ ...def, unlocked: false })));
      }
    } else {
      setBadges(BADGE_DEFINITIONS.map(def => ({ ...def, unlocked: false })));
    }
  }, []);

  // Save badges on change
  useEffect(() => {
    if (badges.length > 0) {
      const badgeData = badges.reduce((acc, badge) => ({
        ...acc,
        [badge.id]: { unlocked: badge.unlocked, unlockedAt: badge.unlockedAt?.toISOString() },
      }), {});
      localStorage.setItem(STORAGE_KEYS.badges, JSON.stringify(badgeData));
    }
  }, [badges]);

  // Unlock badge helper
  const unlockBadge = useCallback((badgeId: string) => {
    setBadges(prev => prev.map(badge =>
      badge.id === badgeId && !badge.unlocked
        ? { ...badge, unlocked: true, unlockedAt: new Date() }
        : badge
    ));
  }, []);

  // Determine initial phase
  useEffect(() => {
    if (isLoading || !user) return;

    const welcomeShown = localStorage.getItem(STORAGE_KEYS.welcomeShown);
    const tourCompleted = localStorage.getItem(STORAGE_KEYS.tourCompleted);
    const tourSkipped = localStorage.getItem(STORAGE_KEYS.tourSkipped);
    const celebrationShown = localStorage.getItem(STORAGE_KEYS.celebrationShown);

    // First login - show welcome
    if (!welcomeShown && needsFiscalSetup) {
      setPhase('welcome');
      return;
    }

    // Needs fiscal setup
    if (needsFiscalSetup) {
      setPhase('fiscal-setup');
      return;
    }

    // Tour not done and not skipped
    if (!tourCompleted && !tourSkipped) {
      setPhase('tour-intro');
      return;
    }

    // 100% complete but celebration not shown
    if (isComplete && !celebrationShown) {
      setPhase('celebration');
      return;
    }

    // Default - show checklist in background
    setPhase('checklist');
  }, [isLoading, user, needsFiscalSetup, isComplete]);

  // Phase handlers
  const handleWelcomeContinue = () => {
    localStorage.setItem(STORAGE_KEYS.welcomeShown, 'true');
    unlockBadge('welcome');
    setPhase('fiscal-setup');
  };

  const handleWelcomeClose = () => {
    localStorage.setItem(STORAGE_KEYS.welcomeShown, 'true');
    if (needsFiscalSetup) {
      setPhase('fiscal-setup');
    } else {
      setPhase('checklist');
    }
  };

  const handleFiscalSetupComplete = () => {
    unlockBadge('fiscal-setup');
    completeStep('fiscal_setup');

    const tourCompleted = localStorage.getItem(STORAGE_KEYS.tourCompleted);
    const tourSkipped = localStorage.getItem(STORAGE_KEYS.tourSkipped);

    if (!tourCompleted && !tourSkipped) {
      setPhase('tour-intro');
    } else {
      setPhase('checklist');
    }
  };

  const handleTourStart = () => {
    setPhase('tour');
  };

  const handleTourSkip = () => {
    localStorage.setItem(STORAGE_KEYS.tourSkipped, 'true');
    setPhase('checklist');
  };

  const handleTourComplete = () => {
    localStorage.setItem(STORAGE_KEYS.tourCompleted, 'true');
    unlockBadge('tour-complete');
    completeStep('tour_complete');
    setPhase('checklist');
  };

  const handleCelebrationClose = () => {
    localStorage.setItem(STORAGE_KEYS.celebrationShown, 'true');
    unlockBadge('onboarding-complete');
    setPhase('checklist');
  };

  const handleDismiss = () => {
    dismissOnboarding();
    setShowProgressCard(false);
  };

  const handleResetTour = () => {
    localStorage.removeItem(STORAGE_KEYS.tourCompleted);
    localStorage.removeItem(STORAGE_KEYS.tourSkipped);
    setPhase('tour-intro');
  };

  // Auto-unlock badges based on completed steps
  useEffect(() => {
    if (completedSteps.includes('first_invoice')) {
      unlockBadge('first-invoice');
    }
    if (completedSteps.includes('first_validation')) {
      unlockBadge('first-validation');
    }
    if (isComplete) {
      unlockBadge('onboarding-complete');
    }
  }, [completedSteps, isComplete, unlockBadge]);

  // Check for celebration trigger
  useEffect(() => {
    const celebrationShown = localStorage.getItem(STORAGE_KEYS.celebrationShown);
    if (isComplete && !celebrationShown && phase === 'checklist') {
      setPhase('celebration');
    }
  }, [isComplete, phase]);

  // Render based on phase
  if (isLoading) return null;

  return (
    <>
      {/* Welcome Modal */}
      <AnimatePresence>
        {phase === 'welcome' && (
          <WelcomeModal
            onContinue={handleWelcomeContinue}
            onClose={handleWelcomeClose}
            userName={profile?.full_name?.split(' ')[0]}
          />
        )}
      </AnimatePresence>

      {/* Fiscal Setup Wizard */}
      {phase === 'fiscal-setup' && (
        <FiscalSetupWizard onComplete={handleFiscalSetupComplete} />
      )}

      {/* Tour Intro Modal */}
      <AnimatePresence>
        {phase === 'tour-intro' && (
          <TourIntroModal
            onStartTour={handleTourStart}
            onSkipTour={handleTourSkip}
          />
        )}
      </AnimatePresence>

      {/* Interactive Tour */}
      {phase === 'tour' && (
        <InteractiveTourOverlay
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}

      {/* Celebration Modal */}
      <AnimatePresence>
        {phase === 'celebration' && (
          <CelebrationModal
            badges={badges}
            onClose={handleCelebrationClose}
          />
        )}
      </AnimatePresence>

      {/* Dashboard Progress Card - only in checklist phase */}
      {phase === 'checklist' && showProgressCard && !isDismissed && !isComplete && (
        <OnboardingProgressCard
          progress={progress}
          badges={badges}
          completedSteps={completedSteps}
          totalSteps={steps.filter(s => !s.optional).length}
          onDismiss={handleDismiss}
          onResetTour={handleResetTour}
        />
      )}

      {/* Render children when not in full-screen phases */}
      {phase !== 'fiscal-setup' && children}
    </>
  );
}

// ============================================================================
// HOOK FOR EXTERNAL ACCESS
// ============================================================================

export function useUnifiedOnboarding() {
  const resetOnboarding = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  };

  const isOnboardingInProgress = () => {
    const welcomeShown = localStorage.getItem(STORAGE_KEYS.welcomeShown);
    const tourCompleted = localStorage.getItem(STORAGE_KEYS.tourCompleted);
    const tourSkipped = localStorage.getItem(STORAGE_KEYS.tourSkipped);
    return !welcomeShown || (!tourCompleted && !tourSkipped);
  };

  return {
    resetOnboarding,
    isOnboardingInProgress,
    STORAGE_KEYS,
  };
}

export default UnifiedOnboarding;
