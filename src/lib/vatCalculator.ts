/**
 * Calculadora de IVA para Trabalhadores Independentes
 * Baseado no Art. 53º do CIVA (Código do IVA) - Portugal
 * ACTUALIZADO 2025: Limiar de isenção passou para €15.000
 */

// Configuração de IVA 2025
export const VAT_CONFIG = {
  // Limiar de isenção Art. 53º CIVA (2025)
  EXEMPTION_THRESHOLD: 15000,
  // Limiar de tolerância (+25%) - acima disto, IVA imediato na factura que excede
  TOLERANCE_THRESHOLD: 18750, // 15.000 × 1.25
  
  // Taxas de IVA por região
  RATES: {
    CONTINENTAL: {
      standard: 23,
      intermediate: 13,
      reduced: 6,
      label: 'Continente',
    },
    AZORES: {
      standard: 16,
      intermediate: 9,
      reduced: 4,
      label: 'Açores',
    },
    MADEIRA: {
      standard: 22,
      intermediate: 12,
      reduced: 5,
      label: 'Madeira',
    },
  },
} as const;

// Exclusões do regime de isenção (Art. 53º CIVA)
export const EXEMPTION_EXCLUSIONS = [
  { 
    id: 'exports', 
    label: 'Faço operações de exportação',
    description: 'Exportações de bens ou serviços para fora da UE',
  },
  { 
    id: 'anexo_e', 
    label: 'Tenho actividades do Anexo E do CIVA',
    description: 'Desperdícios, resíduos e sucatas recicláveis',
  },
  { 
    id: 'imports', 
    label: 'Faço importações de bens',
    description: 'Importação de bens sujeitos a IVA na entrada',
  },
  { 
    id: 'intra_eu', 
    label: 'Faço aquisições intracomunitárias',
    description: 'Compras a fornecedores de outros países da UE',
  },
] as const;

export type RegionKey = keyof typeof VAT_CONFIG.RATES;
export type RateType = 'standard' | 'intermediate' | 'reduced';

export interface ExemptionCheckResult {
  isExempt: boolean;
  reason: string;
  alert?: string;
  proportionalLimit?: number;
  effectiveStartMonth?: number;
}

export interface VATCalculationResult {
  baseValue: number;
  vatAmount: number;
  totalWithVAT: number;
  rate: number;
  region: string;
}

export interface VATPaymentResult {
  vatCollected: number;
  vatDeductible: number;
  vatPayable: number;
  isRecoverable: boolean;
}

/**
 * Calcula o limiar proporcional para início de actividade a meio do ano
 * @param startMonth Mês de início (1-12)
 * @returns Limiar proporcional
 */
export function calculateProportionalThreshold(startMonth: number): number {
  if (startMonth < 1 || startMonth > 12) {
    return VAT_CONFIG.EXEMPTION_THRESHOLD;
  }
  
  const remainingMonths = 13 - startMonth; // Meses restantes incluindo o mês de início
  const proportionalLimit = (VAT_CONFIG.EXEMPTION_THRESHOLD * remainingMonths) / 12;
  
  return Math.round(proportionalLimit * 100) / 100;
}

/**
 * Calcula o limiar de tolerância proporcional (+25%)
 * @param threshold Limiar base
 * @returns Limiar de tolerância
 */
export function calculateToleranceThreshold(threshold: number): number {
  return Math.round(threshold * 1.25 * 100) / 100;
}

/**
 * Verifica se o trabalhador está isento de IVA
 * @param annualRevenue Volume de negócios anual (estimado ou real)
 * @param startMonth Mês de início de actividade (1-12, ou null se ano completo)
 * @param exclusions Lista de exclusões aplicáveis (ids)
 * @returns Resultado da verificação
 */
export function checkVATExemption(
  annualRevenue: number,
  startMonth: number | null,
  exclusions: string[] = []
): ExemptionCheckResult {
  // Verificar exclusões primeiro
  if (exclusions.length > 0) {
    const exclusionLabels = exclusions.map(id => 
      EXEMPTION_EXCLUSIONS.find(e => e.id === id)?.label || id
    );
    return {
      isExempt: false,
      reason: `Não pode beneficiar da isenção do Art. 53º porque: ${exclusionLabels.join(', ')}`,
      alert: 'Deve cobrar IVA desde o início da actividade.',
    };
  }

  // Calcular limiar (proporcional se início a meio do ano)
  const threshold = startMonth ? calculateProportionalThreshold(startMonth) : VAT_CONFIG.EXEMPTION_THRESHOLD;
  const toleranceThreshold = calculateToleranceThreshold(threshold);

  // Verificar se ultrapassa limiar de tolerância (+25%)
  if (annualRevenue > toleranceThreshold) {
    return {
      isExempt: false,
      reason: `Volume de negócios (€${annualRevenue.toLocaleString('pt-PT')}) ultrapassa o limiar de tolerância de €${toleranceThreshold.toLocaleString('pt-PT')} (+25%).`,
      alert: 'ATENÇÃO: A factura que excede este valor deve imediatamente incluir IVA!',
      proportionalLimit: threshold,
    };
  }

  // Verificar se ultrapassa limiar normal mas está dentro da tolerância
  if (annualRevenue > threshold) {
    return {
      isExempt: false,
      reason: `Volume de negócios (€${annualRevenue.toLocaleString('pt-PT')}) ultrapassa o limiar de isenção de €${threshold.toLocaleString('pt-PT')}.`,
      alert: `Está dentro da margem de tolerância (+25%), mas deve comunicar à AT e começar a cobrar IVA no próximo ano fiscal.`,
      proportionalLimit: threshold,
    };
  }

  // Dentro do limiar - isento
  const margin = threshold - annualRevenue;
  let alert: string | undefined;
  
  if (margin < 2000) {
    alert = `Atenção: Está a €${margin.toLocaleString('pt-PT')} do limiar. Acompanhe de perto.`;
  }

  return {
    isExempt: true,
    reason: `Isento de IVA ao abrigo do Art. 53º do CIVA (volume de negócios inferior a €${threshold.toLocaleString('pt-PT')}).`,
    alert,
    proportionalLimit: startMonth ? threshold : undefined,
    effectiveStartMonth: startMonth || undefined,
  };
}

/**
 * Calcula o IVA sobre um valor
 * @param baseValue Valor sem IVA
 * @param region Região (CONTINENTAL, AZORES, MADEIRA)
 * @param rateType Tipo de taxa (standard, intermediate, reduced)
 * @returns Resultado do cálculo
 */
export function calculateVAT(
  baseValue: number,
  region: RegionKey = 'CONTINENTAL',
  rateType: RateType = 'standard'
): VATCalculationResult {
  const regionRates = VAT_CONFIG.RATES[region];
  const rate = regionRates[rateType];
  const vatAmount = Math.round(baseValue * (rate / 100) * 100) / 100;
  const totalWithVAT = Math.round((baseValue + vatAmount) * 100) / 100;

  return {
    baseValue,
    vatAmount,
    totalWithVAT,
    rate,
    region: regionRates.label,
  };
}

/**
 * Calcula o valor base a partir do valor com IVA (fórmula inversa)
 * @param totalWithVAT Valor total com IVA incluído
 * @param region Região
 * @param rateType Tipo de taxa
 * @returns Resultado do cálculo
 */
export function calculateVATReverse(
  totalWithVAT: number,
  region: RegionKey = 'CONTINENTAL',
  rateType: RateType = 'standard'
): VATCalculationResult {
  const regionRates = VAT_CONFIG.RATES[region];
  const rate = regionRates[rateType];
  const baseValue = Math.round((totalWithVAT / (1 + rate / 100)) * 100) / 100;
  const vatAmount = Math.round((totalWithVAT - baseValue) * 100) / 100;

  return {
    baseValue,
    vatAmount,
    totalWithVAT,
    rate,
    region: regionRates.label,
  };
}

/**
 * Calcula o IVA a entregar ao Estado (ou a recuperar)
 * @param vatCollected IVA liquidado (cobrado aos clientes)
 * @param vatDeductible IVA dedutível (pago a fornecedores)
 * @returns Resultado do cálculo
 */
export function calculateVATPayment(
  vatCollected: number,
  vatDeductible: number
): VATPaymentResult {
  const vatPayable = Math.round((vatCollected - vatDeductible) * 100) / 100;
  
  return {
    vatCollected,
    vatDeductible,
    vatPayable: Math.abs(vatPayable),
    isRecoverable: vatPayable < 0,
  };
}

/**
 * Retorna as taxas disponíveis para uma região
 */
export function getAvailableVATRates(region: RegionKey): { type: RateType; rate: number; label: string }[] {
  const regionRates = VAT_CONFIG.RATES[region];
  return [
    { type: 'standard', rate: regionRates.standard, label: `${regionRates.standard}% (Taxa Normal)` },
    { type: 'intermediate', rate: regionRates.intermediate, label: `${regionRates.intermediate}% (Taxa Intermédia)` },
    { type: 'reduced', rate: regionRates.reduced, label: `${regionRates.reduced}% (Taxa Reduzida)` },
  ];
}

/**
 * Retorna todas as regiões disponíveis
 */
export function getAvailableRegions(): { key: RegionKey; label: string }[] {
  return [
    { key: 'CONTINENTAL', label: 'Continente' },
    { key: 'AZORES', label: 'Açores' },
    { key: 'MADEIRA', label: 'Madeira' },
  ];
}
