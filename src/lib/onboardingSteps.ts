/**
 * Onboarding Steps Configuration
 *
 * Defines the checklist steps shown to new users to guide them
 * through the initial setup and usage of the application.
 */

import { Upload, CheckCircle, Users, FileText, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action: {
    label: string;
    href: string;
  };
  icon: LucideIcon;
  optional?: boolean;
}

/**
 * Onboarding steps for regular clients
 */
export const CLIENT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'first_invoice',
    title: 'Carregue a primeira fatura',
    description: 'Faça upload de uma fatura de compra para começar a organizar as suas finanças.',
    action: {
      label: 'Carregar Fatura',
      href: '/upload',
    },
    icon: Upload,
  },
  {
    id: 'first_validation',
    title: 'Valide a classificação da IA',
    description: 'Reveja e aprove a classificação automática feita pela inteligência artificial.',
    action: {
      label: 'Validar Faturas',
      href: '/validation',
    },
    icon: CheckCircle,
  },
  {
    id: 'explore_calculator',
    title: 'Use a Calculadora IVA',
    description: 'Verifique se está isento de IVA e calcule valores para as suas faturas.',
    action: {
      label: 'Abrir Calculadora',
      href: '/iva-calculator',
    },
    icon: FileText,
  },
  {
    id: 'associate_accountant',
    title: 'Associe-se a um contabilista (opcional)',
    description: 'Partilhe os seus dados com um contabilista para facilitar a gestão fiscal.',
    action: {
      label: 'Adicionar Contabilista',
      href: '/settings',
    },
    icon: Users,
    optional: true,
  },
  {
    id: 'explore_modelo10',
    title: 'Explore o Modelo 10',
    description: 'Conheça a funcionalidade de retenções na fonte e upload em massa.',
    action: {
      label: 'Ver Modelo 10',
      href: '/modelo-10',
    },
    icon: Receipt,
    optional: true,
  },
];

/**
 * Onboarding steps for accountants
 */
export const ACCOUNTANT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'add_first_client',
    title: 'Aguarde a associação de clientes',
    description: 'Os seus clientes devem introduzir o seu NIF nas Definições para se associarem a si.',
    action: {
      label: 'Ver Instruções',
      href: '/settings',
    },
    icon: Users,
  },
  {
    id: 'first_client_upload',
    title: 'Carregue faturas para um cliente',
    description: 'Após ter clientes, faça upload de faturas em nome deles.',
    action: {
      label: 'Carregar Fatura',
      href: '/upload',
    },
    icon: Upload,
  },
  {
    id: 'batch_validation',
    title: 'Use validação em lote',
    description: 'No Dashboard de Contabilista, valide múltiplas faturas de uma vez.',
    action: {
      label: 'Dashboard Contabilista',
      href: '/accountant',
    },
    icon: CheckCircle,
  },
  {
    id: 'explore_bulk_upload',
    title: 'Conheça o Upload em Massa',
    description: 'Processe até 50 documentos do Modelo 10 de uma só vez e poupe 70-80% de tempo.',
    action: {
      label: 'Upload em Massa',
      href: '/modelo-10?tab=bulk',
    },
    icon: Receipt,
  },
];

/**
 * Get onboarding steps based on user role
 */
export const getOnboardingSteps = (isAccountant: boolean): OnboardingStep[] => {
  return isAccountant ? ACCOUNTANT_ONBOARDING_STEPS : CLIENT_ONBOARDING_STEPS;
};

/**
 * Calculate completion percentage
 */
export const calculateProgress = (
  completedSteps: string[],
  totalSteps: OnboardingStep[]
): number => {
  if (totalSteps.length === 0) return 100;

  const requiredSteps = totalSteps.filter(step => !step.optional);
  if (requiredSteps.length === 0) return 100;

  const completedRequired = requiredSteps.filter(step =>
    completedSteps.includes(step.id)
  ).length;

  return Math.round((completedRequired / requiredSteps.length) * 100);
};

/**
 * Check if onboarding is complete
 */
export const isOnboardingComplete = (
  completedSteps: string[],
  totalSteps: OnboardingStep[]
): boolean => {
  const requiredSteps = totalSteps.filter(step => !step.optional);
  return requiredSteps.every(step => completedSteps.includes(step.id));
};
