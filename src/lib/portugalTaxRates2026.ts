/**
 * Portugal Tax Rates 2026
 * Official tax rates and thresholds for Portuguese tax compliance
 *
 * Sources:
 * - Portal das Finanças: https://info.portaldasfinancas.gov.pt
 * - Orçamento de Estado 2026 (OE2026)
 * - Código do IRS (CIRS)
 * - Código do IVA (CIVA)
 *
 * Last updated: January 2026
 */

// ============ IRS WITHHOLDING RATES ============

/**
 * Categoria B - Trabalho Independente (Independent Workers / Recibos Verdes)
 * UPDATED: Reduced from 25% to 23% as per OE2025/2026
 */
export const TAXA_RETENCAO_CATEGORIA_B = 0.23; // 23%

/**
 * Special rates for Categoria B (specific professions/situations)
 */
export const TAXAS_ESPECIAIS_CATEGORIA_B = {
  GERAL: 0.23,           // 23% - General rate
  ESPECIAL_1: 0.165,     // 16.5% - Specific cases
  ESPECIAL_2: 0.115,     // 11.5% - Specific cases
  ESPECIAL_3: 0.20,      // 20% - Specific cases
};

/**
 * Categoria F - Rendimentos Prediais (Rental Income)
 */
export const TAXAS_RETENCAO_CATEGORIA_F = {
  HABITACIONAL: 0.25,       // 25% - Residential rentals
  NAO_HABITACIONAL: 0.28,   // 28% - Commercial/Rural rentals
};

/**
 * Categoria E - Rendimentos de Capitais (Capital Income)
 */
export const TAXA_RETENCAO_CATEGORIA_E = 0.28; // 28%

/**
 * Categoria H - Pensões (Pensions)
 * Note: Variable based on IRS tables, default shown
 */
export const TAXA_RETENCAO_CATEGORIA_H = 0.25; // Variable

/**
 * All category rates for easy import
 */
export const TAXAS_RETENCAO = {
  B: TAXA_RETENCAO_CATEGORIA_B,
  F_HABITACIONAL: TAXAS_RETENCAO_CATEGORIA_F.HABITACIONAL,
  F_NAO_HABITACIONAL: TAXAS_RETENCAO_CATEGORIA_F.NAO_HABITACIONAL,
  E: TAXA_RETENCAO_CATEGORIA_E,
  H: TAXA_RETENCAO_CATEGORIA_H,
};

// ============ RETENTION EXEMPTIONS ============

/**
 * Exemption thresholds (Artigo 101.º-B CIRS)
 */
export const LIMITES_DISPENSA_RETENCAO = {
  /**
   * Categoria F: Annual income threshold
   * Landlords with F income ≤ €10,000/year may be exempt
   */
  CATEGORIA_F_ANUAL: 10000,

  /**
   * Minimum retention amount
   * Retentions < €25 are exempt
   */
  VALOR_MINIMO: 25,
};

/**
 * Check if retention is exempt
 */
export function verificarDispensaRetencao(
  rendimento: number,
  categoria: string,
  rendimentoAnual?: number
): { dispensado: boolean; motivo?: string } {
  // Check minimum value
  if (rendimento < LIMITES_DISPENSA_RETENCAO.VALOR_MINIMO) {
    return {
      dispensado: true,
      motivo: `Valor inferior a €${LIMITES_DISPENSA_RETENCAO.VALOR_MINIMO} (Art. 101.º-B CIRS)`,
    };
  }

  // Check Categoria F annual threshold
  if (categoria === 'F' && rendimentoAnual !== undefined) {
    if (rendimentoAnual <= LIMITES_DISPENSA_RETENCAO.CATEGORIA_F_ANUAL) {
      return {
        dispensado: true,
        motivo: `Rendimento anual Cat. F ≤ €${LIMITES_DISPENSA_RETENCAO.CATEGORIA_F_ANUAL} (Art. 101.º-B CIRS)`,
      };
    }
  }

  return { dispensado: false };
}

// ============ IVA (VAT) RATES ============

/**
 * IVA rates for Continental Portugal
 */
export const TAXAS_IVA = {
  NORMAL: 0.23,       // 23% - Standard rate
  INTERMEDIA: 0.13,   // 13% - Intermediate rate
  REDUZIDA: 0.06,     // 6% - Reduced rate
};

/**
 * IVA rates for Açores
 */
export const TAXAS_IVA_ACORES = {
  NORMAL: 0.16,       // 16%
  INTERMEDIA: 0.09,   // 9%
  REDUZIDA: 0.04,     // 4%
};

/**
 * IVA rates for Madeira
 */
export const TAXAS_IVA_MADEIRA = {
  NORMAL: 0.22,       // 22%
  INTERMEDIA: 0.12,   // 12%
  REDUZIDA: 0.05,     // 5%
};

/**
 * IVA exemption thresholds (Artigo 53.º CIVA)
 */
export const LIMITES_IVA = {
  /**
   * Annual turnover limit for VAT exemption
   */
  ISENCAO: 15000,

  /**
   * 25% above exemption limit - mandatory change to normal regime
   */
  ALERTA_25_PERCENT: 18750,

  /**
   * EU limit for foreign companies
   */
  LIMITE_UE: 100000,
};

/**
 * Check IVA exemption status
 */
export function verificarIsencaoIVA(volumeNegocios: number): {
  isento: boolean;
  alertaProximo: boolean;
  obrigatorioNormal: boolean;
  mensagem: string;
} {
  if (volumeNegocios <= LIMITES_IVA.ISENCAO) {
    const percentagem = (volumeNegocios / LIMITES_IVA.ISENCAO) * 100;
    const alertaProximo = percentagem >= 80;

    return {
      isento: true,
      alertaProximo,
      obrigatorioNormal: false,
      mensagem: alertaProximo
        ? `Atenção: ${percentagem.toFixed(0)}% do limite de isenção IVA`
        : `Isento de IVA (Art. 53.º CIVA) - ${percentagem.toFixed(0)}% do limite`,
    };
  }

  if (volumeNegocios <= LIMITES_IVA.ALERTA_25_PERCENT) {
    return {
      isento: false,
      alertaProximo: false,
      obrigatorioNormal: false,
      mensagem: `Volume de negócios excede €${LIMITES_IVA.ISENCAO} - considerar regime normal IVA`,
    };
  }

  return {
    isento: false,
    alertaProximo: false,
    obrigatorioNormal: true,
    mensagem: `OBRIGATÓRIO: Mudança para regime normal IVA (volume > €${LIMITES_IVA.ALERTA_25_PERCENT})`,
  };
}

// ============ SOCIAL SECURITY ============

/**
 * Social Security contribution rates (Taxas Contributivas)
 */
export const TAXAS_SEGURANCA_SOCIAL = {
  /**
   * For-profit entities (Entidades com fins lucrativos)
   */
  LUCRATIVOS: {
    ENTIDADE: 0.2375,     // 23.75%
    TRABALHADOR: 0.11,    // 11%
    TOTAL: 0.3475,        // 34.75%
  },

  /**
   * Non-profit entities (IPSS, etc.)
   */
  IPSS: {
    ENTIDADE: 0.223,      // 22.3%
    TRABALHADOR: 0.11,    // 11%
    TOTAL: 0.333,         // 33.3%
  },
};

/**
 * IAS 2026 - Indexante dos Apoios Sociais
 */
export const IAS_2026 = 537.13; // €537.13 (increased 2.8% from 2025)

/**
 * Payment deadlines
 */
export const PRAZOS_SEGURANCA_SOCIAL = {
  /**
   * Day of month for SS contributions payment
   */
  DIA_PAGAMENTO: 20,

  /**
   * Day of month for DMR confirmation
   */
  DIA_DMR: 20,
};

// ============ MODELO 10 ============

/**
 * Modelo 10 submission deadline
 */
export const PRAZO_MODELO_10 = {
  ANO: 2026,
  MES: 2,  // February
  DIA: 10, // 10th
  DESCRICAO: '10 de Fevereiro de 2026',
};

/**
 * Valid income categories for Modelo 10
 */
export const CATEGORIAS_MODELO_10 = {
  A: {
    codigo: 'A',
    nome: 'Trabalho Dependente',
    descricao: 'Rendimentos de trabalho dependente',
  },
  B: {
    codigo: 'B',
    nome: 'Trabalho Independente',
    descricao: 'Rendimentos de trabalho independente (recibos verdes)',
    taxaDefault: 0.23,
  },
  E: {
    codigo: 'E',
    nome: 'Rendimentos de Capitais',
    descricao: 'Dividendos, juros, lucros distribuídos',
    taxaDefault: 0.28,
  },
  F: {
    codigo: 'F',
    nome: 'Rendimentos Prediais',
    descricao: 'Rendimentos de arrendamento de imóveis',
    taxaHabitacional: 0.25,
    taxaNaoHabitacional: 0.28,
  },
  G: {
    codigo: 'G',
    nome: 'Incrementos Patrimoniais',
    descricao: 'Mais-valias',
  },
  H: {
    codigo: 'H',
    nome: 'Pensões',
    descricao: 'Pensões de reforma, invalidez, sobrevivência',
    taxaDefault: 0.25,
  },
};

/**
 * Fiscal regions
 */
export const REGIOES_FISCAIS = {
  C: { codigo: 'C', nome: 'Continente' },
  RA: { codigo: 'RA', nome: 'Região Autónoma dos Açores' },
  RM: { codigo: 'RM', nome: 'Região Autónoma da Madeira' },
};

// ============ CALENDAR 2026 ============

/**
 * Key fiscal deadlines 2026
 */
export const CALENDARIO_FISCAL_2026 = [
  { data: '2026-01-22', obrigacao: 'IVA - Declaração alterações (Art. 53.º)' },
  { data: '2026-02-10', obrigacao: 'Modelo 10 - Entrega obrigatória', critico: true },
  { data: '2026-02-16', obrigacao: 'Comunicação contratos arrendamento' },
  { data: '2026-04-01', obrigacao: 'IRS - Início período entrega' },
  { data: '2026-06-30', obrigacao: 'IRS - Fim período entrega', critico: true },
  { data: '2026-07-15', obrigacao: 'IES - Entrega obrigatória' },
];

/**
 * Get withholding rate for category
 */
export function getTaxaRetencao(
  categoria: string,
  tipoImovel?: 'habitacional' | 'nao_habitacional'
): number {
  switch (categoria.toUpperCase()) {
    case 'B':
      return TAXA_RETENCAO_CATEGORIA_B;
    case 'E':
      return TAXA_RETENCAO_CATEGORIA_E;
    case 'F':
      if (tipoImovel === 'nao_habitacional') {
        return TAXAS_RETENCAO_CATEGORIA_F.NAO_HABITACIONAL;
      }
      return TAXAS_RETENCAO_CATEGORIA_F.HABITACIONAL;
    case 'H':
      return TAXA_RETENCAO_CATEGORIA_H;
    default:
      return TAXA_RETENCAO_CATEGORIA_B; // Default to B rate
  }
}

/**
 * Format percentage for display
 */
export function formatPercentage(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format currency for display (Portuguese format)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}
