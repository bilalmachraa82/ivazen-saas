/**
 * Social Security (Seguranca Social) Revenue Category Coefficients
 * Single source of truth for all SS coefficient values across the application.
 *
 * These coefficients determine the percentage of revenue that counts as
 * "relevant income" (rendimento relevante) for Social Security contribution
 * calculations under the simplified regime (regime simplificado).
 *
 * Legal basis: Codigo Contributivo, Art. 162.o — Determinacao do rendimento relevante
 *
 * IMPORTANT: All coefficient values carry a PENDING LEGAL VALIDATION tag.
 * Before any production release, a qualified Portuguese accountant or tax
 * advisor must confirm every value against the current legislation.
 */

// ---------------------------------------------------------------------------
// Coefficient values
// ---------------------------------------------------------------------------

/** SS coefficient for Prestacao de Servicos (Cat. B) */
export const COEFF_PRESTACAO_SERVICOS = 0.70; // PENDING LEGAL VALIDATION

/** SS coefficient for Vendas de Mercadorias */
export const COEFF_VENDAS = 0.20; // PENDING LEGAL VALIDATION

/** SS coefficient for Hotelaria e Restauracao (conservative value) */
export const COEFF_HOTELARIA = 0.15; // PENDING LEGAL VALIDATION

/** SS coefficient for Producao Agricola */
export const COEFF_PRODUCAO_AGRICOLA = 0.20; // PENDING LEGAL VALIDATION

/** SS coefficient for Rendimentos Prediais (Cat. F) */
export const COEFF_RENDAS = 0.95; // PENDING LEGAL VALIDATION

/** SS coefficient for Rendimentos de Capitais (Cat. E) */
export const COEFF_CAPITAIS = 0.95; // PENDING LEGAL VALIDATION

/** SS coefficient for Propriedade Intelectual (primeira transmissao) */
export const COEFF_PROP_INTELECTUAL = 0.50; // PENDING LEGAL VALIDATION

/** SS coefficient for Subsidios */
export const COEFF_SUBSIDIOS = 0.70; // PENDING LEGAL VALIDATION

/** SS coefficient for Outros Rendimentos (fallback) */
export const COEFF_OUTROS = 0.70; // PENDING LEGAL VALIDATION

// ---------------------------------------------------------------------------
// Coefficients map (keyed by category slug)
// ---------------------------------------------------------------------------

/**
 * Map of category slugs to their SS coefficients.
 * Use this when you need to look up a coefficient by category key.
 */
export const SS_COEFFICIENTS: Record<string, number> = {
  prestacao_servicos: COEFF_PRESTACAO_SERVICOS,   // PENDING LEGAL VALIDATION
  vendas: COEFF_VENDAS,                           // PENDING LEGAL VALIDATION
  hotelaria: COEFF_HOTELARIA,                     // PENDING LEGAL VALIDATION
  producao_agricola: COEFF_PRODUCAO_AGRICOLA,      // PENDING LEGAL VALIDATION
  rendas: COEFF_RENDAS,                           // PENDING LEGAL VALIDATION
  capitais: COEFF_CAPITAIS,                       // PENDING LEGAL VALIDATION
  prop_intelectual: COEFF_PROP_INTELECTUAL,        // PENDING LEGAL VALIDATION
  subsidios: COEFF_SUBSIDIOS,                     // PENDING LEGAL VALIDATION
  outros: COEFF_OUTROS,                           // PENDING LEGAL VALIDATION
} as const;

/** Default coefficient when category is unknown */
export const SS_DEFAULT_COEFFICIENT = COEFF_OUTROS; // PENDING LEGAL VALIDATION

// ---------------------------------------------------------------------------
// Category metadata (labels, IRS category codes, display order)
// ---------------------------------------------------------------------------

export interface SSCategoryMeta {
  /** Internal slug / key */
  value: string;
  /** Human-readable Portuguese label */
  label: string;
  /** SS coefficient (rendimento relevante) */
  coefficient: number;
  /** IRS income category code, if applicable */
  irsCategoryCode?: string;
}

/**
 * Full list of SS revenue categories with labels and coefficients.
 * This is the canonical source — import this instead of defining local arrays.
 */
export const SS_REVENUE_CATEGORIES: readonly SSCategoryMeta[] = [
  { value: 'prestacao_servicos', label: 'Prestacao de Servicos (Cat. B)', coefficient: COEFF_PRESTACAO_SERVICOS, irsCategoryCode: 'B' },   // PENDING LEGAL VALIDATION
  { value: 'vendas',             label: 'Vendas de Produtos',            coefficient: COEFF_VENDAS,              irsCategoryCode: 'B' },   // PENDING LEGAL VALIDATION
  { value: 'hotelaria',          label: 'Hotelaria e Restauracao',       coefficient: COEFF_HOTELARIA,           irsCategoryCode: 'B' },   // PENDING LEGAL VALIDATION
  { value: 'producao_agricola',  label: 'Producao Agricola',             coefficient: COEFF_PRODUCAO_AGRICOLA,   irsCategoryCode: 'B' },   // PENDING LEGAL VALIDATION
  { value: 'rendas',             label: 'Rendimentos Prediais (Cat. F)', coefficient: COEFF_RENDAS,              irsCategoryCode: 'F' },   // PENDING LEGAL VALIDATION
  { value: 'capitais',           label: 'Rendimentos de Capitais (Cat. E)', coefficient: COEFF_CAPITAIS,         irsCategoryCode: 'E' },   // PENDING LEGAL VALIDATION
  { value: 'prop_intelectual',   label: 'Propriedade Intelectual',       coefficient: COEFF_PROP_INTELECTUAL },                            // PENDING LEGAL VALIDATION
  { value: 'subsidios',          label: 'Subsidios',                     coefficient: COEFF_SUBSIDIOS },                                   // PENDING LEGAL VALIDATION
  { value: 'outros',             label: 'Outros Rendimentos',            coefficient: COEFF_OUTROS },                                      // PENDING LEGAL VALIDATION
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the SS coefficient for a given category slug.
 * Returns the default coefficient (0.70) for unknown categories.
 */
export function getSSCoefficient(category: string): number {
  return SS_COEFFICIENTS[category] ?? SS_DEFAULT_COEFFICIENT;
}

/**
 * Retrieve the display label for a given category slug.
 * Returns the slug itself if the category is not found.
 */
export function getSSCategoryLabel(category: string): string {
  return SS_REVENUE_CATEGORIES.find(c => c.value === category)?.label ?? category;
}

/**
 * List of all valid SS category slug values.
 */
export const SS_CATEGORY_VALUES = SS_REVENUE_CATEGORIES.map(c => c.value);

/**
 * Type representing a valid SS category slug.
 */
export type SSCategorySlug = (typeof SS_REVENUE_CATEGORIES)[number]['value'];
