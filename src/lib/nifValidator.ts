/**
 * Validação de NIF Português com dígito de controlo
 * Baseado no algoritmo oficial da Autoridade Tributária
 */

export function validatePortugueseNIF(nif: string): { valid: boolean; error?: string } {
  // Remove espaços e verifica se tem exactamente 9 dígitos
  const cleanNIF = nif.replace(/\s/g, '');
  
  if (!/^\d{9}$/.test(cleanNIF)) {
    return { valid: false, error: 'NIF deve ter exactamente 9 dígitos' };
  }

  // Verificar primeiro dígito válido
  const firstDigit = cleanNIF[0];
  const validFirstDigits = ['1', '2', '3', '5', '6', '7', '8', '9'];
  
  if (!validFirstDigits.includes(firstDigit)) {
    return { valid: false, error: 'Primeiro dígito do NIF inválido' };
  }

  // Cálculo do dígito de controlo (módulo 11)
  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  
  for (let i = 0; i < 8; i++) {
    sum += parseInt(cleanNIF[i]) * weights[i];
  }
  
  const remainder = sum % 11;
  let checkDigit: number;
  
  if (remainder === 0 || remainder === 1) {
    checkDigit = 0;
  } else {
    checkDigit = 11 - remainder;
  }
  
  const providedCheckDigit = parseInt(cleanNIF[8]);
  
  if (checkDigit !== providedCheckDigit) {
    return { valid: false, error: 'Dígito de controlo inválido' };
  }

  return { valid: true };
}

/**
 * Validação de NISS Português (Número de Identificação da Segurança Social)
 * Baseado no algoritmo oficial com tabela de pesos primos
 * 
 * O NISS tem 11 dígitos:
 * - Primeiro dígito: 1 ou 2 (tipo de beneficiário)
 * - Dígitos 2-10: número sequencial
 * - Dígito 11: dígito de controlo
 * 
 * Algoritmo: soma ponderada com tabela de primos, mod 10, subtraído de 9
 */
export function validatePortugueseNISS(niss: string): { valid: boolean; error?: string } {
  // Campo opcional - aceitar vazio
  if (!niss || niss.trim() === '') {
    return { valid: true };
  }

  // Remove espaços e verifica formato
  const cleanNISS = niss.replace(/\s/g, '');

  if (!/^\d{11}$/.test(cleanNISS)) {
    return { valid: false, error: 'NISS deve ter exactamente 11 dígitos' };
  }

  // Verificar primeiro dígito válido (1 ou 2)
  const firstDigit = cleanNISS[0];
  if (firstDigit !== '1' && firstDigit !== '2') {
    return { valid: false, error: 'Primeiro dígito do NISS deve ser 1 ou 2' };
  }

  // Tabela de pesos (números primos em ordem decrescente)
  const weights = [29, 23, 19, 17, 13, 11, 7, 5, 3, 2];
  
  // Calcular soma ponderada dos primeiros 10 dígitos
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanNISS[i]) * weights[i];
  }
  
  // Dígito de controlo = 9 - (soma mod 10)
  const checkDigit = 9 - (sum % 10);
  const providedCheckDigit = parseInt(cleanNISS[10]);
  
  if (checkDigit !== providedCheckDigit) {
    return { valid: false, error: 'Dígito de controlo inválido' };
  }

  return { valid: true };
}

/**
 * Retorna informação sobre o tipo de contribuinte baseado no primeiro dígito
 */
export function getNIFType(nif: string): string {
  const firstDigit = nif[0];
  
  switch (firstDigit) {
    case '1':
    case '2':
    case '3':
      return 'Pessoa Singular';
    case '5':
      return 'Pessoa Colectiva';
    case '6':
      return 'Organismo Público';
    case '7':
      return 'Herança Indivisa / Não Residente';
    case '8':
      return 'Empresário Individual';
    case '9':
      return 'Pessoa Colectiva Irregular';
    default:
      return 'Desconhecido';
  }
}

/**
 * Taxas de retenção oficiais portuguesas por categoria e localização
 * ACTUALIZADO 2025: Cat. B passou de 25% para 23% (Lei OE 2025)
 */
export const OFFICIAL_WITHHOLDING_RATES: Record<string, Record<string, number[]>> = {
  // Categoria A - Trabalho Dependente (taxas variáveis conforme tabelas IRS)
  'A': {
    'C': [23, 20, 15, 10], // Taxas médias para referência (depende das tabelas)
    'RA': [18.4, 16, 12, 8], // Açores: -20% sobre taxas do Continente
    'RM': [18.4, 16, 12, 8], // Madeira: igual aos Açores
  },
  // Categoria B - Rendimentos empresariais e profissionais (ACTUALIZADO 2025)
  'B': {
    'C': [23, 16.5, 11.5], // Continente: 23% geral (2025), 16.5% act. específicas, 11.5% prof. liberais
    'RA': [18.4, 13.2, 9.2], // Açores: -20% sobre taxas do Continente
    'RM': [18.4, 13.2, 9.2], // Madeira: igual aos Açores
  },
  // Categoria B - Não Residentes
  'B_NR': {
    'C': [20], // 20% para não residentes
    'RA': [16], // Açores -20%
    'RM': [16], // Madeira -20%
  },
  // Categoria E - Rendimentos de capitais
  'E': {
    'C': [28, 25, 35], // Juros 28%, Dividendos 25%, Offshore 35%
    'RA': [22.4, 20, 28], // -20%
    'RM': [22.4, 20, 28], // -20%
  },
  // Categoria F - Rendimentos prediais
  'F': {
    'C': [25, 16.5], // 25% geral, 16.5% arrendamento habitacional de longa duração
    'RA': [20, 13.2], // -20%
    'RM': [20, 13.2], // -20%
  },
  // Categoria G - Incrementos patrimoniais (mais-valias)
  'G': {
    'C': [28, 25], // Mais-valias mobiliárias 28%, imobiliárias 25%
    'RA': [22.4, 20], // -20%
    'RM': [22.4, 20], // -20%
  },
  // Categoria H - Pensões (taxas variáveis conforme tabelas)
  'H': {
    'C': [23, 20, 15, 10], // Taxas médias para referência (depende das tabelas)
    'RA': [18.4, 16, 12, 8], // Açores -20%
    'RM': [18.4, 16, 12, 8], // Madeira -20%
  },
  // Categoria R - Retenções IRC (Pessoas Colectivas)
  'R': {
    'C': [25, 21, 15], // Taxas IRC aplicáveis
    'RA': [20, 16.8, 12], // -20%
    'RM': [20, 16.8, 12], // -20%
  },
};

/**
 * Retorna a taxa de retenção sugerida para uma categoria/localização
 */
export function getSuggestedRate(category: string, location: string, isNonResident: boolean = false): number {
  // Para não residentes Cat. B, usa taxas específicas
  const categoryKey = (category === 'B' && isNonResident) ? 'B_NR' : category;
  const categoryRates = OFFICIAL_WITHHOLDING_RATES[categoryKey];
  if (!categoryRates) return 23; // Default actualizado para 23% (2025)
  
  const locationRates = categoryRates[location];
  if (!locationRates) return 23;
  
  // Retorna a taxa principal (primeira)
  return locationRates[0];
}

/**
 * Retorna todas as taxas disponíveis para uma categoria/localização
 */
export function getAvailableRates(category: string, location: string, isNonResident: boolean = false): { rate: number; label: string }[] {
  // Para não residentes Cat. B, usa taxas específicas
  const categoryKey = (category === 'B' && isNonResident) ? 'B_NR' : category;
  const categoryRates = OFFICIAL_WITHHOLDING_RATES[categoryKey];
  if (!categoryRates) return [{ rate: 23, label: '23% (Geral 2025)' }];
  
  const locationRates = categoryRates[location];
  if (!locationRates) return [{ rate: 23, label: '23% (Geral 2025)' }];
  
  if (category === 'B' && isNonResident) {
    return [
      { rate: locationRates[0], label: `${locationRates[0]}% (Não Residente)` },
    ];
  }
  
  if (category === 'B') {
    return [
      { rate: locationRates[0], label: `${locationRates[0]}% (Taxa Geral 2025)` },
      { rate: locationRates[1], label: `${locationRates[1]}% (Act. Específicas)` },
      { rate: locationRates[2], label: `${locationRates[2]}% (Prof. Liberais)` },
    ];
  }
  
  if (category === 'E') {
    return [
      { rate: locationRates[0], label: `${locationRates[0]}% (Juros)` },
      { rate: locationRates[1], label: `${locationRates[1]}% (Dividendos)` },
      { rate: locationRates[2], label: `${locationRates[2]}% (Offshore)` },
    ];
  }
  
  if (category === 'F') {
    return [
      { rate: locationRates[0], label: `${locationRates[0]}% (Rendas Geral)` },
      { rate: locationRates[1], label: `${locationRates[1]}% (Arrendamento Longa Duração)` },
    ].filter((_, i) => locationRates[i] !== undefined);
  }

  if (category === 'A') {
    return [
      { rate: locationRates[0], label: `${locationRates[0]}% (Taxa Referência Alta)` },
      { rate: locationRates[1], label: `${locationRates[1]}% (Taxa Referência Média)` },
      { rate: locationRates[2], label: `${locationRates[2]}% (Taxa Referência Baixa)` },
    ].filter((_, i) => locationRates[i] !== undefined);
  }

  if (category === 'G') {
    return [
      { rate: locationRates[0], label: `${locationRates[0]}% (Mais-valias Mobiliárias)` },
      { rate: locationRates[1], label: `${locationRates[1]}% (Mais-valias Imobiliárias)` },
    ].filter((_, i) => locationRates[i] !== undefined);
  }

  if (category === 'H') {
    return [
      { rate: locationRates[0], label: `${locationRates[0]}% (Taxa Referência Alta)` },
      { rate: locationRates[1], label: `${locationRates[1]}% (Taxa Referência Média)` },
      { rate: locationRates[2], label: `${locationRates[2]}% (Taxa Referência Baixa)` },
    ].filter((_, i) => locationRates[i] !== undefined);
  }

  if (category === 'R') {
    return [
      { rate: locationRates[0], label: `${locationRates[0]}% (Taxa Geral IRC)` },
      { rate: locationRates[1], label: `${locationRates[1]}% (PME)` },
      { rate: locationRates[2], label: `${locationRates[2]}% (Taxa Reduzida)` },
    ].filter((_, i) => locationRates[i] !== undefined);
  }
  
  return locationRates.map(r => ({ rate: r, label: `${r}%` }));
}
