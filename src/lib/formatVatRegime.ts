/**
 * Maps the DB vat_regime + iva_cadence values to human-readable Portuguese labels.
 *
 * DB values:
 *   vat_regime: 'normal' | 'normal_monthly' | 'normal_quarterly' |
 *               'exempt_53' | 'exempt_9' | 'simplified' | null
 *   iva_cadence: 'monthly' | 'quarterly' (default)
 *
 * Legacy: vat_regime='normal' uses iva_cadence to determine monthly vs quarterly.
 */
export function formatVatRegime(
  vatRegime: string | null | undefined,
  ivaCadence?: string | null,
): string {
  switch (vatRegime) {
    case 'normal_monthly':
      return 'Normal mensal por opção';
    case 'normal_quarterly':
      return 'Normal trimestral';
    case 'normal':
      // Legacy value — derive from iva_cadence
      return ivaCadence === 'monthly' ? 'Normal mensal por opção' : 'Normal trimestral';
    case 'exempt_53':
      return 'Isento Art. 53º';
    case 'exempt_9':
      return 'Isento Art. 9º';
    case 'simplified':
      return 'Regime simplificado';
    case 'exempt':
      return 'Isento';
    default:
      return 'Não definido';
  }
}

/** All valid vat_regime options for use in form selectors */
export const VAT_REGIME_OPTIONS = [
  { value: 'normal_monthly', label: 'Normal mensal por opção' },
  { value: 'normal_quarterly', label: 'Normal trimestral' },
  { value: 'exempt_53', label: 'Isento Art. 53º' },
  { value: 'exempt_9', label: 'Isento Art. 9º' },
] as const;
