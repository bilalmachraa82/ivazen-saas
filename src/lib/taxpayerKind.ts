/**
 * Taxpayer kind inference and utilities.
 *
 * taxpayer_kind determines which fiscal obligations are primary for a client:
 *   - 'eni'     → IVA + Segurança Social (trabalhador independente, ENI, EIRL)
 *   - 'company' → IVA + Modelo 10 (empresa com retenções na fonte)
 *   - 'mixed'   → All obligations
 *
 * When the explicit field is not set, we infer from worker_type and data signals.
 */

export type TaxpayerKind = 'eni' | 'company' | 'mixed';

export interface TaxpayerKindInput {
  /** Explicit taxpayer_kind from profile (takes precedence) */
  taxpayer_kind?: string | null;
  /** worker_type from profile: 'independent', 'eni', 'eirl', 'agricultural' */
  worker_type?: string | null;
  /** Whether client has tax_withholdings data */
  has_withholdings?: boolean;
  /** Whether client has SS declarations or sales_invoices */
  has_ss_activity?: boolean;
}

/**
 * Resolve the effective taxpayer kind for a client.
 *
 * Priority:
 * 1. Explicit taxpayer_kind from profile (if valid)
 * 2. Inference from worker_type
 * 3. Inference from data signals (withholdings → company, ss_activity → eni)
 * 4. Default: null (show everything)
 */
export function resolveTaxpayerKind(input: TaxpayerKindInput): TaxpayerKind | null {
  // 1. Explicit value takes precedence
  if (input.taxpayer_kind === 'eni' || input.taxpayer_kind === 'company' || input.taxpayer_kind === 'mixed') {
    return input.taxpayer_kind;
  }

  // 2. Infer from worker_type
  const wt = input.worker_type;
  if (wt === 'independent' || wt === 'eni' || wt === 'eirl' || wt === 'agricultural') {
    // ENI-type workers primarily have SS obligations.
    // If they also have withholdings, they're mixed.
    if (input.has_withholdings) {
      return 'mixed';
    }
    return 'eni';
  }

  // 3. Infer from data signals
  if (input.has_withholdings && input.has_ss_activity) {
    return 'mixed';
  }
  if (input.has_withholdings) {
    return 'company';
  }
  if (input.has_ss_activity) {
    return 'eni';
  }

  // 4. No information — return null (show all)
  return null;
}

/**
 * Get Portuguese label for taxpayer kind.
 */
export function taxpayerKindLabel(kind: TaxpayerKind | null): string {
  switch (kind) {
    case 'eni': return 'ENI / Independente';
    case 'company': return 'Empresa';
    case 'mixed': return 'Misto';
    default: return 'Não definido';
  }
}

/**
 * Get short badge label for taxpayer kind.
 */
export function taxpayerKindBadge(kind: TaxpayerKind | null): string {
  switch (kind) {
    case 'eni': return 'ENI';
    case 'company': return 'Empresa';
    case 'mixed': return 'Misto';
    default: return '';
  }
}

/**
 * Check if a fiscal obligation is primary for the given taxpayer kind.
 */
export function isObligationPrimary(
  obligation: 'iva' | 'ss' | 'modelo10',
  kind: TaxpayerKind | null
): boolean {
  // IVA is always primary
  if (obligation === 'iva') return true;

  // When unknown, everything is primary
  if (!kind) return true;

  switch (kind) {
    case 'eni':
      return obligation === 'ss';
    case 'company':
      return obligation === 'modelo10';
    case 'mixed':
      return true;
    default:
      return true;
  }
}
