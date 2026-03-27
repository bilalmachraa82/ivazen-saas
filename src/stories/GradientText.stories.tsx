import type { Meta, StoryObj } from '@storybook/react';
import { GradientText } from '@/components/ui/gradient-text';

/**
 * GradientText adiciona gradientes premium a textos e titulos.
 * Usa as cores da marca para criar titulos impactantes.
 *
 * ## Variantes
 * - **primary**: Rosa para dourado (padrao, cor da marca)
 * - **success**: Verde para teal (estados positivos)
 * - **warning**: Laranja para amarelo (alertas)
 *
 * ## Elementos suportados
 * Pode ser renderizado como: h1, h2, h3, h4, span, p
 *
 * ## Animacao
 * Opcao `animated` adiciona movimento ao gradiente.
 */
const meta: Meta<typeof GradientText> = {
  title: 'UI/GradientText',
  component: GradientText,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Componente de texto com gradiente premium para titulos e headings.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'success', 'warning'],
      description: 'Variante de cor do gradiente',
      table: {
        defaultValue: { summary: 'primary' },
      },
    },
    as: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'span', 'p'],
      description: 'Elemento HTML a renderizar',
      table: {
        defaultValue: { summary: 'span' },
      },
    },
    animated: {
      control: 'boolean',
      description: 'Activar animacao do gradiente',
    },
    children: {
      control: 'text',
      description: 'Texto a exibir',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// === VARIANTES ===

/**
 * Gradiente primario - Rosa para Dourado.
 * Usar para titulos principais e CTAs.
 */
export const Primary: Story = {
  args: {
    children: 'IVA Inteligente',
    variant: 'primary',
    as: 'h1',
    className: 'text-4xl font-bold',
  },
};

/**
 * Gradiente de sucesso - Verde para Teal.
 * Usar para indicar resultados positivos.
 */
export const Success: Story = {
  args: {
    children: 'Poupanca: 1.250',
    variant: 'success',
    as: 'span',
    className: 'text-3xl font-bold',
  },
};

/**
 * Gradiente de aviso - Laranja para Amarelo.
 * Usar para chamar atencao ou alertas.
 */
export const Warning: Story = {
  args: {
    children: 'Prazo a Terminar',
    variant: 'warning',
    as: 'span',
    className: 'text-2xl font-semibold',
  },
};

// === COM ANIMACAO ===

/**
 * Gradiente animado - o gradiente move-se continuamente.
 * Usar com moderacao para elementos de destaque.
 */
export const Animated: Story = {
  args: {
    children: 'Premium',
    variant: 'primary',
    animated: true,
    as: 'span',
    className: 'text-4xl font-bold',
  },
};

/**
 * Sucesso animado.
 */
export const AnimatedSuccess: Story = {
  args: {
    children: 'Aprovado!',
    variant: 'success',
    animated: true,
    as: 'span',
    className: 'text-3xl font-bold',
  },
};

// === ELEMENTOS HTML ===

/**
 * Como H1 - Para titulos principais.
 */
export const AsH1: Story = {
  args: {
    children: 'Titulo Principal',
    variant: 'primary',
    as: 'h1',
    className: 'text-5xl font-bold',
  },
};

/**
 * Como H2 - Para subtitulos.
 */
export const AsH2: Story = {
  args: {
    children: 'Subtitulo',
    variant: 'primary',
    as: 'h2',
    className: 'text-3xl font-semibold',
  },
};

/**
 * Como H3 - Para seccoes.
 */
export const AsH3: Story = {
  args: {
    children: 'Nome da Seccao',
    variant: 'primary',
    as: 'h3',
    className: 'text-xl font-medium',
  },
};

/**
 * Como span inline.
 */
export const AsSpan: Story = {
  render: () => (
    <p className="text-lg">
      Bem-vindo ao <GradientText variant="primary" className="font-bold">IVA Inteligente</GradientText>!
    </p>
  ),
};

/**
 * Como paragrafo.
 */
export const AsParagraph: Story = {
  args: {
    children: 'Texto com gradiente aplicado a todo o paragrafo.',
    variant: 'primary',
    as: 'p',
    className: 'text-lg',
  },
};

// === EXEMPLOS DE USO ===

/**
 * Titulo de landing page.
 */
export const LandingTitle: Story = {
  render: () => (
    <div className="text-center space-y-4">
      <GradientText as="h1" variant="primary" className="text-5xl font-bold">
        Gestao de IVA
      </GradientText>
      <p className="text-xl text-muted-foreground">
        Simplificada para trabalhadores independentes
      </p>
    </div>
  ),
};

/**
 * Card de estatistica.
 */
export const StatsNumber: Story = {
  render: () => (
    <div className="text-center p-6 rounded-lg border">
      <p className="text-sm text-muted-foreground mb-2">Total Poupado</p>
      <GradientText as="span" variant="success" className="text-4xl font-bold">
        3.450,00
      </GradientText>
      <p className="text-sm text-muted-foreground mt-1">este ano</p>
    </div>
  ),
};

/**
 * Badge premium.
 */
export const PremiumBadge: Story = {
  render: () => (
    <span className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
      <GradientText variant="primary" animated className="text-sm font-semibold">
        Premium
      </GradientText>
    </span>
  ),
};

/**
 * Alerta de prazo.
 */
export const DeadlineAlert: Story = {
  render: () => (
    <div className="flex items-center gap-2 p-4 rounded-lg bg-warning/10 border border-warning/20">
      <GradientText variant="warning" className="font-semibold">
        Atencao:
      </GradientText>
      <span className="text-muted-foreground">
        Declaracao de IVA ate 15 de Fevereiro
      </span>
    </div>
  ),
};

// === GALERIA ===

/**
 * Todas as variantes lado a lado.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <GradientText variant="primary" as="h2" className="text-3xl font-bold">
        Primary - Rosa/Dourado
      </GradientText>
      <GradientText variant="success" as="h2" className="text-3xl font-bold">
        Success - Verde/Teal
      </GradientText>
      <GradientText variant="warning" as="h2" className="text-3xl font-bold">
        Warning - Laranja/Amarelo
      </GradientText>
    </div>
  ),
};

/**
 * Todas as variantes com animacao.
 */
export const AllAnimated: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <GradientText variant="primary" animated as="h2" className="text-3xl font-bold">
        Primary Animado
      </GradientText>
      <GradientText variant="success" animated as="h2" className="text-3xl font-bold">
        Success Animado
      </GradientText>
      <GradientText variant="warning" animated as="h2" className="text-3xl font-bold">
        Warning Animado
      </GradientText>
    </div>
  ),
};

/**
 * Hierarquia de titulos.
 */
export const HeadingHierarchy: Story = {
  render: () => (
    <div className="space-y-4">
      <GradientText as="h1" variant="primary" className="text-4xl font-bold">
        H1 - Titulo Principal
      </GradientText>
      <GradientText as="h2" variant="primary" className="text-3xl font-semibold">
        H2 - Subtitulo
      </GradientText>
      <GradientText as="h3" variant="primary" className="text-2xl font-medium">
        H3 - Seccao
      </GradientText>
      <GradientText as="h4" variant="primary" className="text-xl font-medium">
        H4 - Subseccao
      </GradientText>
    </div>
  ),
};
