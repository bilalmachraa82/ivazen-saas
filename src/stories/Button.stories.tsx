import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, ChevronRight, Plus, Trash2 } from 'lucide-react';

/**
 * O componente Button e a base da interface de utilizador.
 * Suporta multiplas variantes e tamanhos para diferentes contextos.
 *
 * ## Quando usar cada variante
 * - **default**: Accoes principais (submeter, confirmar)
 * - **secondary**: Accoes secundarias (cancelar, voltar)
 * - **destructive**: Accoes destrutivas (eliminar, remover)
 * - **outline**: Accoes alternativas com menor destaque
 * - **ghost**: Accoes subtis ou dentro de outros componentes
 * - **link**: Navegacao inline ou links textuais
 */
const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Botao principal da aplicacao com suporte para multiplas variantes, tamanhos e estados.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'Variante visual do botao',
      table: {
        defaultValue: { summary: 'default' },
      },
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Tamanho do botao',
      table: {
        defaultValue: { summary: 'default' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Estado desactivado do botao',
    },
    asChild: {
      control: 'boolean',
      description: 'Renderizar como componente filho (Slot)',
    },
    children: {
      control: 'text',
      description: 'Conteudo do botao',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// === VARIANTES BASICAS ===

/**
 * Variante padrao para accoes principais.
 * Usa o gradiente rosa premium da marca.
 */
export const Default: Story = {
  args: {
    children: 'Botao Principal',
    variant: 'default',
  },
};

/**
 * Variante secundaria para accoes menos importantes.
 */
export const Secondary: Story = {
  args: {
    children: 'Botao Secundario',
    variant: 'secondary',
  },
};

/**
 * Variante destrutiva para accoes perigosas.
 * Usar apenas para eliminar, remover ou accoes irreversiveis.
 */
export const Destructive: Story = {
  args: {
    children: 'Eliminar',
    variant: 'destructive',
  },
};

/**
 * Variante outline com bordas e fundo transparente.
 */
export const Outline: Story = {
  args: {
    children: 'Cancelar',
    variant: 'outline',
  },
};

/**
 * Variante ghost sem fundo - ideal para toolbars e menus.
 */
export const Ghost: Story = {
  args: {
    children: 'Opcao',
    variant: 'ghost',
  },
};

/**
 * Variante link para navegacao inline.
 */
export const Link: Story = {
  args: {
    children: 'Saber mais',
    variant: 'link',
  },
};

// === TAMANHOS ===

/**
 * Tamanho pequeno para espacos compactos.
 */
export const Small: Story = {
  args: {
    children: 'Pequeno',
    size: 'sm',
  },
};

/**
 * Tamanho padrao (44px altura minima para acessibilidade touch).
 */
export const DefaultSize: Story = {
  args: {
    children: 'Padrao',
    size: 'default',
  },
};

/**
 * Tamanho grande para CTAs e accoes de destaque.
 */
export const Large: Story = {
  args: {
    children: 'Grande',
    size: 'lg',
  },
};

/**
 * Tamanho icone para botoes apenas com icone (44x44px).
 */
export const Icon: Story = {
  args: {
    children: <Plus className="h-4 w-4" />,
    size: 'icon',
    'aria-label': 'Adicionar',
  },
};

// === COM ICONES ===

/**
 * Botao com icone a esquerda.
 */
export const WithIconLeft: Story = {
  args: {
    children: (
      <>
        <Mail className="h-4 w-4" />
        Enviar Email
      </>
    ),
  },
};

/**
 * Botao com icone a direita.
 */
export const WithIconRight: Story = {
  args: {
    children: (
      <>
        Continuar
        <ChevronRight className="h-4 w-4" />
      </>
    ),
  },
};

/**
 * Botao de eliminacao com icone.
 */
export const DeleteWithIcon: Story = {
  args: {
    variant: 'destructive',
    children: (
      <>
        <Trash2 className="h-4 w-4" />
        Eliminar
      </>
    ),
  },
};

// === ESTADOS ===

/**
 * Estado de carregamento.
 * Mostrar spinner e desactivar interacao durante operacoes assincronas.
 */
export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        A processar...
      </>
    ),
  },
};

/**
 * Estado desactivado.
 */
export const Disabled: Story = {
  args: {
    children: 'Desactivado',
    disabled: true,
  },
};

// === GALERIA DE TODAS AS VARIANTES ===

/**
 * Todas as variantes lado a lado para comparacao.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

/**
 * Todos os tamanhos lado a lado.
 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ),
};
