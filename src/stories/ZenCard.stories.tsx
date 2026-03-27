import type { Meta, StoryObj } from '@storybook/react';
import { ZenCard, ZenCardHeader, ZenCardContent } from '@/components/zen/ZenCard';
import { Calculator, TrendingUp, FileText, Settings, Star } from 'lucide-react';

/**
 * ZenCard e o componente de card premium da aplicacao.
 * Oferece estilos Zen com gradientes, efeitos glass e decoracoes visuais.
 *
 * ## Variantes disponiveis
 * - **default**: Card solido com gradiente de fundo
 * - **glass**: Efeito de vidro translucido
 * - **glass-premium**: Glass com mais brilho e destaque
 *
 * ## Gradientes
 * - **default**: Neutro com toque de primario
 * - **primary**: Destaque rosa/primario
 * - **success**: Verde para estados positivos
 * - **warning**: Laranja para alertas
 * - **muted**: Tons subtis
 */
const meta: Meta<typeof ZenCard> = {
  title: 'Zen/ZenCard',
  component: ZenCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Card premium com estilos Zen, suporte para glass morphism e decoracoes visuais.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'glass', 'glass-premium'],
      description: 'Estilo visual do card',
      table: {
        defaultValue: { summary: 'default' },
      },
    },
    gradient: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'muted'],
      description: 'Cor do gradiente de fundo',
      table: {
        defaultValue: { summary: 'default' },
      },
    },
    withLine: {
      control: 'boolean',
      description: 'Mostrar linha decorativa a esquerda',
    },
    withCircle: {
      control: 'boolean',
      description: 'Mostrar circulo decorativo no canto',
    },
    hoverScale: {
      control: 'boolean',
      description: 'Activar efeito de escala no hover',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// === VARIANTES PRINCIPAIS ===

/**
 * Variante padrao com gradiente subtil.
 */
export const Default: Story = {
  args: {
    variant: 'default',
    children: (
      <>
        <ZenCardHeader title="Card Padrao" icon={FileText} />
        <ZenCardContent>
          <p className="text-muted-foreground">
            Este e o estilo padrao do ZenCard com um gradiente subtil de fundo.
          </p>
        </ZenCardContent>
      </>
    ),
  },
};

/**
 * Variante glass com efeito de vidro translucido.
 * Ideal para sobreposicoes e cards em fundos coloridos.
 */
export const Glass: Story = {
  args: {
    variant: 'glass',
    children: (
      <>
        <ZenCardHeader title="Glass Card" icon={Star} />
        <ZenCardContent>
          <p className="text-muted-foreground">
            Efeito de vidro com backdrop blur para um visual moderno.
          </p>
        </ZenCardContent>
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] p-8 bg-gradient-to-br from-primary/20 via-accent/10 to-background rounded-xl">
        <Story />
      </div>
    ),
  ],
};

/**
 * Variante glass-premium com mais brilho.
 * Reservar para elementos de destaque e CTAs.
 */
export const GlassPremium: Story = {
  args: {
    variant: 'glass-premium',
    children: (
      <>
        <ZenCardHeader title="Premium Glass" icon={Star} />
        <ZenCardContent>
          <p className="text-muted-foreground">
            Versao premium do glass com shimmer effect.
          </p>
        </ZenCardContent>
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] p-8 bg-gradient-to-br from-primary/30 via-accent/20 to-background rounded-xl">
        <Story />
      </div>
    ),
  ],
};

// === GRADIENTES ===

/**
 * Gradiente primario (rosa).
 */
export const GradientPrimary: Story = {
  args: {
    variant: 'default',
    gradient: 'primary',
    children: (
      <>
        <ZenCardHeader title="Primario" icon={TrendingUp} />
        <ZenCardContent>
          <p className="text-muted-foreground">Gradiente rosa da marca.</p>
        </ZenCardContent>
      </>
    ),
  },
};

/**
 * Gradiente de sucesso (verde).
 */
export const GradientSuccess: Story = {
  args: {
    variant: 'default',
    gradient: 'success',
    children: (
      <>
        <ZenCardHeader title="Sucesso" icon={TrendingUp} />
        <ZenCardContent>
          <p className="text-muted-foreground">Para indicar estados positivos.</p>
        </ZenCardContent>
      </>
    ),
  },
};

/**
 * Gradiente de aviso (laranja).
 */
export const GradientWarning: Story = {
  args: {
    variant: 'default',
    gradient: 'warning',
    children: (
      <>
        <ZenCardHeader title="Aviso" icon={Settings} />
        <ZenCardContent>
          <p className="text-muted-foreground">Para alertas e avisos.</p>
        </ZenCardContent>
      </>
    ),
  },
};

// === DECORACOES ===

/**
 * Com linha decorativa a esquerda.
 */
export const WithLine: Story = {
  args: {
    variant: 'default',
    withLine: true,
    children: (
      <>
        <ZenCardHeader title="Com Linha" icon={Calculator} />
        <ZenCardContent>
          <p className="text-muted-foreground">
            Linha gradiente rosa a esquerda para destaque visual.
          </p>
        </ZenCardContent>
      </>
    ),
  },
};

/**
 * Com circulo decorativo no canto.
 */
export const WithCircle: Story = {
  args: {
    variant: 'default',
    withCircle: true,
    children: (
      <>
        <ZenCardHeader title="Com Circulo" icon={Star} />
        <ZenCardContent>
          <p className="text-muted-foreground">
            Circulo glow no canto superior direito.
          </p>
        </ZenCardContent>
      </>
    ),
  },
};

/**
 * Com todas as decoracoes e hover scale.
 */
export const FullDecorations: Story = {
  args: {
    variant: 'default',
    gradient: 'primary',
    withLine: true,
    withCircle: true,
    hoverScale: true,
    children: (
      <>
        <ZenCardHeader title="Card Premium" icon={Star} />
        <ZenCardContent>
          <p className="text-muted-foreground">
            Todas as decoracoes activas com efeito hover.
          </p>
        </ZenCardContent>
      </>
    ),
  },
};

// === EXEMPLOS DE USO ===

/**
 * Card de estatisticas.
 */
export const StatsCard: Story = {
  args: {
    variant: 'default',
    gradient: 'success',
    withLine: true,
    children: (
      <>
        <ZenCardHeader title="IVA a Pagar" icon={Calculator} />
        <ZenCardContent>
          <div className="space-y-2">
            <p className="text-3xl font-bold">1.250,00</p>
            <p className="text-sm text-muted-foreground">Este trimestre</p>
          </div>
        </ZenCardContent>
      </>
    ),
  },
};

/**
 * Card clickavel com hover.
 */
export const ClickableCard: Story = {
  args: {
    variant: 'glass',
    hoverScale: true,
    onClick: () => alert('Card clicado!'),
    children: (
      <>
        <ZenCardHeader title="Clica-me" icon={TrendingUp} />
        <ZenCardContent>
          <p className="text-muted-foreground">
            Card interactivo com efeito de hover.
          </p>
        </ZenCardContent>
      </>
    ),
  },
};

// === GALERIA ===

/**
 * Todas as variantes lado a lado.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-[500px]">
      <ZenCard variant="default">
        <ZenCardHeader title="Default" icon={FileText} />
        <ZenCardContent>
          <p className="text-sm text-muted-foreground">Variante padrao</p>
        </ZenCardContent>
      </ZenCard>

      <ZenCard variant="glass">
        <ZenCardHeader title="Glass" icon={Star} />
        <ZenCardContent>
          <p className="text-sm text-muted-foreground">Efeito glass</p>
        </ZenCardContent>
      </ZenCard>

      <ZenCard variant="glass-premium">
        <ZenCardHeader title="Glass Premium" icon={Star} />
        <ZenCardContent>
          <p className="text-sm text-muted-foreground">Glass com shimmer</p>
        </ZenCardContent>
      </ZenCard>
    </div>
  ),
};

/**
 * Todos os gradientes.
 */
export const AllGradients: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[500px]">
      <ZenCard gradient="default">
        <ZenCardContent className="p-4">
          <p className="font-medium">Default</p>
        </ZenCardContent>
      </ZenCard>
      <ZenCard gradient="primary">
        <ZenCardContent className="p-4">
          <p className="font-medium">Primary</p>
        </ZenCardContent>
      </ZenCard>
      <ZenCard gradient="success">
        <ZenCardContent className="p-4">
          <p className="font-medium">Success</p>
        </ZenCardContent>
      </ZenCard>
      <ZenCard gradient="warning">
        <ZenCardContent className="p-4">
          <p className="font-medium">Warning</p>
        </ZenCardContent>
      </ZenCard>
      <ZenCard gradient="muted">
        <ZenCardContent className="p-4">
          <p className="font-medium">Muted</p>
        </ZenCardContent>
      </ZenCard>
    </div>
  ),
};
