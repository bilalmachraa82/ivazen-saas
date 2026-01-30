# Design Tokens - IVA Inteligente

Sistema centralizado de design tokens para garantir consistencia visual em toda a aplicacao.

## Palette

**Premium Rose Pink** - Elegante, moderno, sofisticado

A paleta foi desenhada para transmitir profissionalismo e confianca, com tons de rosa que evocam elegancia e sofisticacao, complementados por acentos de rose gold.

---

## Como Usar

### Importar Tokens

```typescript
import {
  tokens,
  getColor,
  getSpacing,
  getGradient,
  getShadow,
  getEasing
} from '@/lib/design-tokens';
```

### Usar Diretamente

```typescript
// Aceder a valores especificos
const primaryColor = tokens.colors.primary.DEFAULT;  // 'hsl(335 65% 55%)'
const spacing4 = tokens.spacing[4];                   // '1rem'
const radiusLg = tokens.borderRadius.lg;              // '0.5rem'
```

### Usar Helper Functions

```typescript
// Cores por path
const color = getColor('primary.500');     // 'hsl(335 65% 55%)'
const success = getColor('success.light'); // 'hsl(158 45% 42%)'

// Espacamento
const space = getSpacing(4);   // '1rem'
const spacePx = getSpacing('px'); // '1px'

// Sombras
const shadow = getShadow('glow'); // '0 0 25px hsl(335 65% 55% / 0.15)'

// Gradientes
const gradient = getGradient('primary'); // 'linear-gradient(135deg, ...)'

// Animacoes
const easing = getEasing('spring'); // 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const duration = getDuration('fast'); // '150ms'
```

---

## Cores

### Primary (Rose Pink)

Cor principal da marca - elegancia e sofisticacao.

| Token | Valor | Uso |
|-------|-------|-----|
| `primary.50` | `hsl(335 65% 97%)` | Backgrounds subtis |
| `primary.100` | `hsl(335 65% 94%)` | Hover backgrounds |
| `primary.200` | `hsl(335 65% 88%)` | Borders claras |
| `primary.300` | `hsl(335 65% 78%)` | Icons desativados |
| `primary.400` | `hsl(335 65% 68%)` | Texto secundario |
| `primary.500` | `hsl(335 65% 55%)` | **Cor principal** |
| `primary.600` | `hsl(335 65% 48%)` | Hover states |
| `primary.700` | `hsl(335 65% 40%)` | Active states |
| `primary.800` | `hsl(335 65% 32%)` | Texto escuro |
| `primary.900` | `hsl(335 65% 24%)` | Titulos |
| `primary.950` | `hsl(335 65% 16%)` | Dark backgrounds |

### Accent (Rose Gold)

Cor de destaque - luxo e premium.

| Token | Valor | Uso |
|-------|-------|-----|
| `accent.DEFAULT` | `hsl(15 45% 65%)` | Destaques, CTAs secundarios |
| `accent.light` | `hsl(15 45% 65%)` | Light mode |
| `accent.dark` | `hsl(15 40% 55%)` | Dark mode |

### Semantic Colors

| Cor | Light Mode | Dark Mode | Uso |
|-----|------------|-----------|-----|
| **Success** | `hsl(158 45% 42%)` | `hsl(158 42% 45%)` | Sucesso, confirmacao |
| **Warning** | `hsl(28 80% 60%)` | `hsl(28 75% 55%)` | Avisos, atencao |
| **Destructive** | `hsl(0 60% 55%)` | `hsl(0 55% 50%)` | Erros, acoes destrutivas |

### Cores de UI

| Token | Light Mode | Dark Mode | Uso |
|-------|------------|-----------|-----|
| `background` | `hsl(330 20% 98%)` | `hsl(335 20% 6%)` | Fundo da pagina |
| `foreground` | `hsl(335 20% 15%)` | `hsl(330 15% 95%)` | Texto principal |
| `card` | `hsl(330 30% 99%)` | `hsl(335 20% 9%)` | Cards e containers |
| `muted` | `hsl(330 15% 93%)` | `hsl(335 15% 13%)` | Elementos desativados |
| `border` | `hsl(330 20% 88%)` | `hsl(335 15% 18%)` | Bordas e divisores |

---

## Tipografia

### Font Families

| Token | Valor | Uso |
|-------|-------|-----|
| `sans` | Inter, system-ui, sans-serif | Texto corpo |
| `display` | Poppins, system-ui, sans-serif | Titulos, headings |
| `mono` | Geist Mono, Space Mono, monospace | Codigo, numeros |

### Font Sizes

| Token | Size | Line Height | Uso |
|-------|------|-------------|-----|
| `xs` | 0.75rem (12px) | 1rem | Labels pequenos |
| `sm` | 0.875rem (14px) | 1.25rem | Texto secundario |
| `base` | 1rem (16px) | 1.5rem | Texto corpo |
| `lg` | 1.125rem (18px) | 1.75rem | Lead text |
| `xl` | 1.25rem (20px) | 1.75rem | Subtitulos |
| `2xl` | 1.5rem (24px) | 2rem | H4 |
| `3xl` | 1.875rem (30px) | 2.25rem | H3 |
| `4xl` | 2.25rem (36px) | 2.5rem | H2 |
| `5xl` | 3rem (48px) | 1.15 | H1 |
| `6xl` | 3.75rem (60px) | 1.1 | Display |
| `7xl` | 4.5rem (72px) | 1.05 | Hero titles |

### Font Weights

| Token | Valor | Uso |
|-------|-------|-----|
| `light` | 300 | Texto leve |
| `normal` | 400 | Texto corpo |
| `medium` | 500 | Enfase leve |
| `semibold` | 600 | Subtitulos |
| `bold` | 700 | Titulos, CTAs |

---

## Espacamento

Sistema baseado em multiplos de 4px.

| Token | Valor | Pixels | Uso |
|-------|-------|--------|-----|
| `0` | 0 | 0px | Reset |
| `0.5` | 0.125rem | 2px | Micro spacing |
| `1` | 0.25rem | 4px | Gaps minimos |
| `2` | 0.5rem | 8px | Padding interno |
| `3` | 0.75rem | 12px | Gaps pequenos |
| `4` | 1rem | 16px | Padding padrao |
| `5` | 1.25rem | 20px | Gaps medios |
| `6` | 1.5rem | 24px | Sections pequenas |
| `8` | 2rem | 32px | Sections medias |
| `10` | 2.5rem | 40px | Sections grandes |
| `12` | 3rem | 48px | Headers |
| `16` | 4rem | 64px | Hero sections |
| `20` | 5rem | 80px | Margem entre sections |
| `24` | 6rem | 96px | Espacamento XL |

---

## Border Radius

| Token | Valor | Uso |
|-------|-------|-----|
| `none` | 0 | Sem arredondamento |
| `sm` | 0.125rem (2px) | Elementos pequenos |
| `DEFAULT` | 0.25rem (4px) | Inputs, badges |
| `md` | 0.375rem (6px) | Buttons pequenos |
| `lg` | 0.5rem (8px) | Cards pequenos |
| `xl` | 0.75rem (12px) | **Padrao** - Cards, modals |
| `2xl` | 1rem (16px) | Cards grandes |
| `3xl` | 1.5rem (24px) | Banners |
| `full` | 9999px | Pills, avatars |

---

## Sombras

### Sombras Standard

| Token | Uso |
|-------|-----|
| `sm` | Elementos elevados subtilmente |
| `DEFAULT` | Elevacao base |
| `md` | Cards, dropdowns |
| `lg` | Modals, popovers |
| `xl` | Elementos em destaque |
| `2xl` | Modals grandes, hero elements |

### Glow Effects (Premium)

| Token | Uso |
|-------|-----|
| `glow` | Glow rosa sutil |
| `glow-lg` | Glow rosa intenso |
| `glow-rose` | Glow rosa duplo |
| `glow-rose-lg` | Glow rosa premium com camadas |

### Glass Effects

| Token | Uso |
|-------|-----|
| `glass-light` | Cards glass em light mode |
| `glass-dark` | Cards glass em dark mode |
| `glass-stats` | Stats cards glass |
| `glass-modal` | Modal glass effect |

---

## Animacoes

### Easing Functions

| Token | Valor | Uso |
|-------|-------|-----|
| `linear` | linear | Loops infinitos |
| `ease` | ease | General purpose |
| `easeInOut` | ease-in-out | Transicoes suaves |
| `spring` | cubic-bezier(0.34, 1.56, 0.64, 1) | **Micro-interacoes premium** |
| `smooth` | cubic-bezier(0.4, 0, 0.2, 1) | Movimentos suaves |
| `bounce` | cubic-bezier(0.175, 0.885, 0.32, 1.275) | Bouncy effects |
| `snappy` | cubic-bezier(0.16, 1, 0.3, 1) | Respostas rapidas |

### Duration

| Token | Valor | Uso |
|-------|-------|-----|
| `instant` | 0ms | Sem animacao |
| `fastest` | 50ms | Feedback imediato |
| `faster` | 100ms | Hover states |
| `fast` | 150ms | **Interacoes** |
| `normal` | 300ms | **Transicoes padrao** |
| `slow` | 500ms | Modals, toasts |
| `slower` | 700ms | Animacoes de entrada |
| `slowest` | 1000ms | Hero animations |

### Animacoes Pre-definidas

```typescript
// Exemplo de uso
animation.presets['fade-in']        // 'fade-in 0.3s ease-out'
animation.presets['spring-scale']   // 'spring-scale 0.4s cubic-bezier(...)'
animation.presets['pulse-cta']      // 'pulse-cta 2s ease-in-out infinite'
```

---

## Gradientes

| Token | Descricao | Uso |
|-------|-----------|-----|
| `primary` | Rosa primario para rosa escuro | CTAs, buttons |
| `accent` | Rose gold | Destaques premium |
| `success` | Verde sage | Estados de sucesso |
| `rose` | Rosa para magenta | Hero backgrounds |
| `glass-light` | Branco transparente | Glass cards light |
| `glass-dark` | Branco muito transparente | Glass cards dark |
| `text-primary` | Rosa para rose gold | Gradient text |

### Exemplo de Gradient Text

```css
.gradient-text {
  background: linear-gradient(135deg, hsl(335 65% 55%), hsl(15 45% 65%));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## Glass Morphism

Sistema de elementos glass/frosted para efeitos premium.

### Blur Levels

| Token | Valor | Uso |
|-------|-------|-----|
| `sm` | blur(8px) | Subtle glass |
| `DEFAULT` | blur(16px) | Standard glass |
| `md` | blur(20px) | Cards glass |
| `lg` | blur(24px) | Modals glass |
| `xl` | blur(32px) | Heavy blur |

### Glass Backgrounds

```typescript
// Light mode
glassMorphism.background.light.card    // 'rgba(255, 255, 255, 0.1)'
glassMorphism.background.light.modal   // 'rgba(255, 255, 255, 0.85)'

// Dark mode
glassMorphism.background.dark.card     // 'rgba(0, 0, 0, 0.2)'
glassMorphism.background.dark.modal    // 'rgba(30, 30, 35, 0.9)'
```

---

## Breakpoints

| Token | Valor | Uso |
|-------|-------|-----|
| `xs` | 320px | Mobile pequeno |
| `sm` | 640px | Mobile |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Desktop grande |
| `2xl` | 1400px | Container max |
| `3xl` | 1600px | Ultra wide |

---

## Z-Index

| Token | Valor | Uso |
|-------|-------|-----|
| `base` | 0 | Elementos base |
| `docked` | 10 | Elementos fixos na base |
| `dropdown` | 1000 | Menus dropdown |
| `sticky` | 1100 | Headers sticky |
| `banner` | 1200 | Banners |
| `overlay` | 1300 | Overlays/backdrops |
| `modal` | 1400 | Modals |
| `popover` | 1500 | Popovers |
| `toast` | 1700 | Toast notifications |
| `tooltip` | 1800 | Tooltips |

---

## Exemplos de Uso em Componentes

### Button com Spring Animation

```tsx
import { tokens, getEasing, getDuration } from '@/lib/design-tokens';

const buttonStyles = {
  backgroundColor: tokens.colors.primary.DEFAULT,
  borderRadius: tokens.borderRadius.xl,
  padding: `${tokens.spacing[3]} ${tokens.spacing[6]}`,
  transition: `transform ${getDuration('fast')} ${getEasing('spring')}`,
  ':hover': {
    transform: 'scale(1.02) translateY(-2px)',
    boxShadow: tokens.shadows.glow,
  },
  ':active': {
    transform: 'scale(0.98)',
  },
};
```

### Card Glass

```tsx
import { tokens } from '@/lib/design-tokens';

const cardGlassStyles = {
  background: tokens.glassMorphism.background.light.card,
  backdropFilter: tokens.glassMorphism.blur.md,
  border: `1px solid ${tokens.glassMorphism.border.light}`,
  boxShadow: tokens.shadows['glass-light'],
  borderRadius: tokens.borderRadius.xl,
  padding: tokens.spacing[6],
};
```

### Typography Heading

```tsx
import { getFontFamily, getFontSize } from '@/lib/design-tokens';

const headingStyles = {
  fontFamily: getFontFamily('display'),
  ...getFontSize('4xl'),
  fontWeight: tokens.typography.fontWeight.semibold,
  color: tokens.colors.foreground.DEFAULT,
};
```

---

## Integracao com Tailwind

Os tokens estao alinhados com a configuracao do `tailwind.config.ts`. Podes usar as classes Tailwind normais que mapeiam para estes tokens:

```html
<!-- Cores -->
<div class="bg-primary text-primary-foreground">...</div>
<div class="text-success bg-success/10">...</div>

<!-- Sombras -->
<div class="shadow-md shadow-glow">...</div>

<!-- Animacoes -->
<div class="animate-fade-in animate-spring-scale">...</div>

<!-- Glass -->
<div class="glass-premium">...</div>
```

---

## Boas Praticas

1. **Usar tokens em vez de valores hardcoded** - Garante consistencia e facilita mudancas globais.

2. **Respeitar a hierarquia de cores** - Use `primary` para CTAs principais, `accent` para destaques secundarios.

3. **Animacoes com spring easing** - Para micro-interacoes, use sempre `easing.spring` para um feel premium.

4. **Espacamento consistente** - Use multiplos de 4 (`spacing[1]`, `spacing[2]`, `spacing[4]`, etc.).

5. **Dark mode ready** - Sempre verificar se o token tem variante `.light` e `.dark`.

6. **Acessibilidade** - Verificar contraste entre foreground e background. Os tokens foram desenhados com WCAG AA em mente.

---

## Changelog

### v1.0.0
- Criacao inicial do sistema de design tokens
- Paleta Rose Pink completa (50-950)
- Sistema de tipografia (Inter, Poppins, Geist Mono)
- Espacamento baseado em multiplos de 4px
- Sistema de sombras incluindo glow effects
- Animacoes com spring easing
- Glass morphism tokens
- Helper functions para acesso facil
