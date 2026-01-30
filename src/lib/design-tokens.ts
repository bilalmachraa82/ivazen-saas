/**
 * Design Tokens - IVA Inteligente
 *
 * Sistema centralizado de design tokens para garantir consistencia
 * visual em toda a aplicacao.
 *
 * Palette: Premium Rose Pink - elegante, moderno, sofisticado
 * Fonts: Inter (body), Poppins (display), Geist Mono (code)
 *
 * @example
 * import { tokens, getColor, getSpacing } from '@/lib/design-tokens';
 *
 * // Usar diretamente
 * const primaryColor = tokens.colors.primary.DEFAULT;
 *
 * // Usar helpers
 * const color = getColor('primary.light');
 * const space = getSpacing(4);
 */

// ============================================================================
// COLOR TOKENS
// ============================================================================

export const colors = {
  // Primary - Rose Pink (elegance)
  primary: {
    DEFAULT: 'hsl(335 65% 55%)',
    light: 'hsl(335 65% 55%)',
    dark: 'hsl(335 60% 60%)',
    foreground: 'hsl(0 0% 100%)',
    50: 'hsl(335 65% 97%)',
    100: 'hsl(335 65% 94%)',
    200: 'hsl(335 65% 88%)',
    300: 'hsl(335 65% 78%)',
    400: 'hsl(335 65% 68%)',
    500: 'hsl(335 65% 55%)',
    600: 'hsl(335 65% 48%)',
    700: 'hsl(335 65% 40%)',
    800: 'hsl(335 65% 32%)',
    900: 'hsl(335 65% 24%)',
    950: 'hsl(335 65% 16%)',
  },

  // Accent - Rose Gold (luxury)
  accent: {
    DEFAULT: 'hsl(15 45% 65%)',
    light: 'hsl(15 45% 65%)',
    dark: 'hsl(15 40% 55%)',
    foreground: 'hsl(0 0% 100%)',
    50: 'hsl(15 45% 97%)',
    100: 'hsl(15 45% 94%)',
    200: 'hsl(15 45% 88%)',
    300: 'hsl(15 45% 78%)',
    400: 'hsl(15 45% 70%)',
    500: 'hsl(15 45% 65%)',
    600: 'hsl(15 45% 55%)',
    700: 'hsl(15 45% 45%)',
    800: 'hsl(15 45% 35%)',
    900: 'hsl(15 45% 25%)',
    950: 'hsl(15 45% 15%)',
  },

  // Success - Soft Sage Green
  success: {
    DEFAULT: 'hsl(158 45% 42%)',
    light: 'hsl(158 45% 42%)',
    dark: 'hsl(158 42% 45%)',
    foreground: 'hsl(0 0% 100%)',
    50: 'hsl(158 45% 97%)',
    100: 'hsl(158 45% 92%)',
    200: 'hsl(158 45% 82%)',
    300: 'hsl(158 45% 68%)',
    400: 'hsl(158 45% 55%)',
    500: 'hsl(158 45% 42%)',
    600: 'hsl(158 45% 35%)',
    700: 'hsl(158 45% 28%)',
    800: 'hsl(158 45% 22%)',
    900: 'hsl(158 45% 16%)',
    950: 'hsl(158 45% 10%)',
  },

  // Warning - Warm Peach
  warning: {
    DEFAULT: 'hsl(28 80% 60%)',
    light: 'hsl(28 80% 60%)',
    dark: 'hsl(28 75% 55%)',
    foreground: 'hsl(335 20% 15%)',
    50: 'hsl(28 80% 97%)',
    100: 'hsl(28 80% 92%)',
    200: 'hsl(28 80% 84%)',
    300: 'hsl(28 80% 74%)',
    400: 'hsl(28 80% 67%)',
    500: 'hsl(28 80% 60%)',
    600: 'hsl(28 80% 50%)',
    700: 'hsl(28 80% 42%)',
    800: 'hsl(28 80% 34%)',
    900: 'hsl(28 80% 26%)',
    950: 'hsl(28 80% 18%)',
  },

  // Destructive - Soft Coral
  destructive: {
    DEFAULT: 'hsl(0 60% 55%)',
    light: 'hsl(0 60% 55%)',
    dark: 'hsl(0 55% 50%)',
    foreground: 'hsl(0 0% 100%)',
    50: 'hsl(0 60% 97%)',
    100: 'hsl(0 60% 92%)',
    200: 'hsl(0 60% 84%)',
    300: 'hsl(0 60% 74%)',
    400: 'hsl(0 60% 65%)',
    500: 'hsl(0 60% 55%)',
    600: 'hsl(0 60% 48%)',
    700: 'hsl(0 60% 40%)',
    800: 'hsl(0 60% 32%)',
    900: 'hsl(0 60% 24%)',
    950: 'hsl(0 60% 16%)',
  },

  // Secondary - Soft Blush
  secondary: {
    DEFAULT: 'hsl(330 25% 95%)',
    light: 'hsl(330 25% 95%)',
    dark: 'hsl(335 18% 15%)',
    foreground: {
      light: 'hsl(335 20% 25%)',
      dark: 'hsl(330 12% 92%)',
    },
  },

  // Muted - Soft Rose Grays
  muted: {
    DEFAULT: 'hsl(330 15% 93%)',
    light: 'hsl(330 15% 93%)',
    dark: 'hsl(335 15% 13%)',
    foreground: {
      light: 'hsl(335 10% 45%)',
      dark: 'hsl(330 10% 60%)',
    },
  },

  // Background
  background: {
    DEFAULT: 'hsl(330 20% 98%)',
    light: 'hsl(330 20% 98%)',
    dark: 'hsl(335 20% 6%)',
  },

  // Foreground
  foreground: {
    DEFAULT: 'hsl(335 20% 15%)',
    light: 'hsl(335 20% 15%)',
    dark: 'hsl(330 15% 95%)',
  },

  // Card
  card: {
    DEFAULT: 'hsl(330 30% 99%)',
    light: 'hsl(330 30% 99%)',
    dark: 'hsl(335 20% 9%)',
    foreground: {
      light: 'hsl(335 20% 15%)',
      dark: 'hsl(330 15% 95%)',
    },
  },

  // Popover
  popover: {
    DEFAULT: 'hsl(330 30% 99%)',
    light: 'hsl(330 30% 99%)',
    dark: 'hsl(335 20% 9%)',
    foreground: {
      light: 'hsl(335 20% 15%)',
      dark: 'hsl(330 15% 95%)',
    },
  },

  // Border
  border: {
    DEFAULT: 'hsl(330 20% 88%)',
    light: 'hsl(330 20% 88%)',
    dark: 'hsl(335 15% 18%)',
  },

  // Input
  input: {
    DEFAULT: 'hsl(330 20% 88%)',
    light: 'hsl(330 20% 88%)',
    dark: 'hsl(335 15% 18%)',
  },

  // Ring (focus)
  ring: {
    DEFAULT: 'hsl(335 65% 55%)',
    light: 'hsl(335 65% 55%)',
    dark: 'hsl(335 60% 60%)',
  },

  // Sidebar
  sidebar: {
    background: {
      light: 'hsl(335 25% 12%)',
      dark: 'hsl(335 22% 5%)',
    },
    foreground: {
      light: 'hsl(330 15% 92%)',
      dark: 'hsl(330 12% 92%)',
    },
    primary: {
      light: 'hsl(335 60% 60%)',
      dark: 'hsl(335 60% 60%)',
    },
    accent: {
      light: 'hsl(335 22% 18%)',
      dark: 'hsl(335 18% 10%)',
    },
    border: {
      light: 'hsl(335 18% 20%)',
      dark: 'hsl(335 15% 14%)',
    },
  },
} as const;

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    display: ['Poppins', 'system-ui', 'sans-serif'],
    mono: ['Geist Mono', 'Space Mono', 'monospace'],
  },

  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
    sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
    base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
    lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
    xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
    '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.03em' }],
    '5xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.03em' }],
    '6xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
    '7xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.04em' }],
    '8xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
    '9xl': ['8rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
  },

  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
} as const;

// ============================================================================
// SPACING TOKENS
// ============================================================================

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  28: '7rem',        // 112px
  32: '8rem',        // 128px
  36: '9rem',        // 144px
  40: '10rem',       // 160px
  44: '11rem',       // 176px
  48: '12rem',       // 192px
  52: '13rem',       // 208px
  56: '14rem',       // 224px
  60: '15rem',       // 240px
  64: '16rem',       // 256px
  72: '18rem',       // 288px
  80: '20rem',       // 320px
  96: '24rem',       // 384px
} as const;

// ============================================================================
// BORDER RADIUS TOKENS
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.125rem',      // 2px
  DEFAULT: '0.25rem',  // 4px
  md: '0.375rem',      // 6px
  lg: '0.5rem',        // 8px
  xl: '0.75rem',       // 12px - default radius var
  '2xl': '1rem',       // 16px
  '3xl': '1.5rem',     // 24px
  full: '9999px',
} as const;

// ============================================================================
// SHADOW TOKENS
// ============================================================================

export const shadows = {
  // Standard shadows
  none: 'none',
  sm: '0 1px 2px 0 hsl(335 20% 15% / 0.04)',
  DEFAULT: '0 2px 4px hsl(335 20% 15% / 0.06)',
  md: '0 4px 6px -1px hsl(335 20% 15% / 0.06), 0 2px 4px -2px hsl(335 20% 15% / 0.04)',
  lg: '0 10px 15px -3px hsl(335 20% 15% / 0.08), 0 4px 6px -4px hsl(335 20% 15% / 0.04)',
  xl: '0 20px 25px -5px hsl(335 20% 15% / 0.1), 0 8px 10px -6px hsl(335 20% 15% / 0.04)',
  '2xl': '0 25px 50px -12px hsl(335 20% 15% / 0.25)',
  inner: 'inset 0 2px 4px 0 hsl(335 20% 15% / 0.05)',

  // Premium rose glow shadows
  glow: '0 0 25px hsl(335 65% 55% / 0.15)',
  'glow-lg': '0 0 40px hsl(335 65% 55% / 0.25)',
  'glow-rose': '0 0 20px hsl(335 65% 55% / 0.2), 0 0 40px hsl(335 65% 55% / 0.1)',
  'glow-rose-lg': '0 0 30px hsl(335 65% 55% / 0.25), 0 0 60px hsl(335 65% 55% / 0.15), 0 4px 20px hsl(335 65% 55% / 0.1)',

  // Glass effects
  'glass-light': '0 8px 32px 0 rgba(31, 38, 135, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
  'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
  'glass-stats': '0 4px 24px -4px hsl(335 65% 55% / 0.1), 0 1px 0 0 rgba(255, 255, 255, 0.3) inset',
  'glass-modal': '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
} as const;

// ============================================================================
// ANIMATION TOKENS
// ============================================================================

export const animation = {
  // Easing functions
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },

  // Duration
  duration: {
    instant: '0ms',
    fastest: '50ms',
    faster: '100ms',
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    slower: '700ms',
    slowest: '1000ms',
  },

  // Predefined animations
  presets: {
    'accordion-down': 'accordion-down 0.2s ease-out',
    'accordion-up': 'accordion-up 0.2s ease-out',
    'fade-in': 'fade-in 0.3s ease-out',
    'slide-in-right': 'slide-in-right 0.3s ease-out',
    'scale-in': 'scale-in 0.2s ease-out',
    'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
    'float': 'float 4s ease-in-out infinite',
    'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
    shimmer: 'shimmer 2s linear infinite',
    'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
    'spin-slow': 'spin-slow 20s linear infinite',
    wiggle: 'wiggle 0.3s ease-in-out',
    'spring-bounce': 'spring-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
    'spring-scale': 'spring-scale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    'spring-scale-in': 'spring-scale-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
    'pulse-cta': 'pulse-cta 2s ease-in-out infinite',
  },

  // Animation delays
  delays: {
    0: '0ms',
    75: '75ms',
    100: '100ms',
    150: '150ms',
    200: '200ms',
    300: '300ms',
    400: '400ms',
    500: '500ms',
    700: '700ms',
    1000: '1000ms',
  },
} as const;

// ============================================================================
// GRADIENT TOKENS
// ============================================================================

export const gradients = {
  primary: 'linear-gradient(135deg, hsl(335 65% 55%), hsl(345 60% 45%))',
  accent: 'linear-gradient(135deg, hsl(15 45% 65%), hsl(25 50% 55%))',
  success: 'linear-gradient(135deg, hsl(158 45% 42%), hsl(158 45% 35%))',
  rose: 'linear-gradient(135deg, hsl(335 65% 55%), hsl(320 55% 50%))',
  'glass-light': 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7))',
  'glass-dark': 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
  'glass-premium-light': 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
  'glass-premium-dark': 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
  'text-primary': 'linear-gradient(135deg, hsl(335 65% 55%), hsl(15 45% 65%))',
  'text-success': 'linear-gradient(135deg, hsl(158 45% 42%), hsl(175 50% 40%))',
  'text-warning': 'linear-gradient(135deg, hsl(28 80% 55%), hsl(45 90% 55%))',
} as const;

// ============================================================================
// BREAKPOINT TOKENS
// ============================================================================

export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1400px',
  '3xl': '1600px',
} as const;

// ============================================================================
// Z-INDEX TOKENS
// ============================================================================

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// ============================================================================
// GLASS MORPHISM TOKENS
// ============================================================================

export const glassMorphism = {
  blur: {
    sm: 'blur(8px)',
    DEFAULT: 'blur(16px)',
    md: 'blur(20px)',
    lg: 'blur(24px)',
    xl: 'blur(32px)',
  },
  background: {
    light: {
      card: 'rgba(255, 255, 255, 0.1)',
      button: 'rgba(255, 255, 255, 0.15)',
      input: 'rgba(255, 255, 255, 0.1)',
      modal: 'rgba(255, 255, 255, 0.85)',
      overlay: 'rgba(0, 0, 0, 0.4)',
      stats: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)',
    },
    dark: {
      card: 'rgba(0, 0, 0, 0.2)',
      button: 'rgba(0, 0, 0, 0.25)',
      input: 'rgba(0, 0, 0, 0.2)',
      modal: 'rgba(30, 30, 35, 0.9)',
      overlay: 'rgba(0, 0, 0, 0.6)',
      stats: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
    },
  },
  border: {
    light: 'rgba(255, 255, 255, 0.18)',
    dark: 'rgba(255, 255, 255, 0.08)',
  },
  saturate: 'saturate(180%)',
} as const;

// ============================================================================
// COMBINED TOKENS EXPORT
// ============================================================================

export const tokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  gradients,
  breakpoints,
  zIndex,
  glassMorphism,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ColorScale = keyof typeof colors;
export type SpacingScale = keyof typeof spacing;
export type FontSize = keyof typeof typography.fontSize;
export type FontWeight = keyof typeof typography.fontWeight;
export type FontFamily = keyof typeof typography.fontFamily;
export type BorderRadiusScale = keyof typeof borderRadius;
export type ShadowScale = keyof typeof shadows;
export type EasingFunction = keyof typeof animation.easing;
export type Duration = keyof typeof animation.duration;
export type Breakpoint = keyof typeof breakpoints;
export type ZIndexScale = keyof typeof zIndex;
export type GradientName = keyof typeof gradients;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a color value from nested path
 * @example getColor('primary.500') => 'hsl(335 65% 55%)'
 * @example getColor('success.DEFAULT') => 'hsl(158 45% 42%)'
 */
export function getColor(path: string): string {
  const parts = path.split('.');
  let result: unknown = colors;

  for (const part of parts) {
    if (result && typeof result === 'object' && part in result) {
      result = (result as Record<string, unknown>)[part];
    } else {
      console.warn(`Color path "${path}" not found`);
      return '';
    }
  }

  return typeof result === 'string' ? result : '';
}

/**
 * Get a spacing value
 * @example getSpacing(4) => '1rem'
 * @example getSpacing('px') => '1px'
 */
export function getSpacing(key: string | number): string {
  const spacingKey = String(key) as keyof typeof spacing;
  if (spacingKey in spacing) {
    return spacing[spacingKey];
  }
  console.warn(`Spacing key "${key}" not found`);
  return '';
}

/**
 * Get a border radius value
 * @example getBorderRadius('lg') => '0.5rem'
 */
export function getBorderRadius(key: BorderRadiusScale): string {
  return borderRadius[key] ?? borderRadius.DEFAULT;
}

/**
 * Get a shadow value
 * @example getShadow('md') => '0 4px 6px -1px ...'
 */
export function getShadow(key: ShadowScale): string {
  return shadows[key] ?? shadows.DEFAULT;
}

/**
 * Get an easing function
 * @example getEasing('spring') => 'cubic-bezier(0.34, 1.56, 0.64, 1)'
 */
export function getEasing(key: EasingFunction): string {
  return animation.easing[key];
}

/**
 * Get an animation duration
 * @example getDuration('fast') => '150ms'
 */
export function getDuration(key: Duration): string {
  return animation.duration[key];
}

/**
 * Get a gradient value
 * @example getGradient('primary') => 'linear-gradient(135deg, ...)'
 */
export function getGradient(key: GradientName): string {
  return gradients[key];
}

/**
 * Get a breakpoint value
 * @example getBreakpoint('md') => '768px'
 */
export function getBreakpoint(key: Breakpoint): string {
  return breakpoints[key];
}

/**
 * Get a z-index value
 * @example getZIndex('modal') => 1400
 */
export function getZIndex(key: ZIndexScale): number | string {
  return zIndex[key];
}

/**
 * Get font family as CSS string
 * @example getFontFamily('display') => "'Poppins', system-ui, sans-serif"
 */
export function getFontFamily(key: FontFamily): string {
  return typography.fontFamily[key].join(', ');
}

/**
 * Get font size with line height
 * @example getFontSize('lg') => { fontSize: '1.125rem', lineHeight: '1.75rem' }
 */
export function getFontSize(key: FontSize): {
  fontSize: string;
  lineHeight: string;
  letterSpacing?: string;
} {
  const [size, options] = typography.fontSize[key];
  return {
    fontSize: size,
    lineHeight: options.lineHeight,
    letterSpacing: options.letterSpacing,
  };
}

/**
 * Create CSS custom properties string from tokens
 * Useful for dynamic theming
 */
export function createCssVariables(theme: 'light' | 'dark' = 'light'): string {
  const vars: string[] = [];

  // Add color variables
  vars.push(`--color-primary: ${colors.primary.DEFAULT};`);
  vars.push(`--color-accent: ${colors.accent.DEFAULT};`);
  vars.push(`--color-success: ${colors.success.DEFAULT};`);
  vars.push(`--color-warning: ${colors.warning.DEFAULT};`);
  vars.push(`--color-destructive: ${colors.destructive.DEFAULT};`);
  vars.push(`--color-background: ${colors.background[theme]};`);
  vars.push(`--color-foreground: ${colors.foreground[theme]};`);
  vars.push(`--color-border: ${colors.border[theme]};`);

  // Add common spacing
  vars.push(`--spacing-1: ${spacing[1]};`);
  vars.push(`--spacing-2: ${spacing[2]};`);
  vars.push(`--spacing-4: ${spacing[4]};`);
  vars.push(`--spacing-8: ${spacing[8]};`);

  // Add border radius
  vars.push(`--radius: ${borderRadius.xl};`);
  vars.push(`--radius-sm: ${borderRadius.sm};`);
  vars.push(`--radius-lg: ${borderRadius.lg};`);

  return vars.join('\n');
}

// Default export
export default tokens;
