/**
 * Códigos de Rendimento - Modelo 10
 * Conforme Portaria 4/2024 de 4 de janeiro
 */

export interface IncomeCode {
  code: string;
  label: string;
  description: string;
  tooltip: string;
}

export interface IncomeCategoryConfig {
  category: string;
  label: string;
  description: string;
  codes: IncomeCode[];
}

// Categoria A - Trabalho Dependente
const CATEGORY_A_CODES: IncomeCode[] = [
  {
    code: 'A11',
    label: 'A11 - Remunerações do trabalho por conta de outrem',
    description: 'Remunerações do trabalho por conta de outrem',
    tooltip: 'Salários, ordenados, vencimentos, gratificações, percentagens, comissões, participações, subsídios, prémios, senhas de presença e quaisquer outras remunerações acessórias.',
  },
  {
    code: 'A12',
    label: 'A12 - Indemnizações por despedimento',
    description: 'Indemnizações devidas pela cessação do contrato de trabalho',
    tooltip: 'Indemnizações devidas pela cessação do contrato de trabalho antes de decorrido o prazo de 5 anos a contar da data de contratação.',
  },
  {
    code: 'A13',
    label: 'A13 - Abonos para falhas',
    description: 'Abonos para falhas',
    tooltip: 'Abonos para falhas pagos a empregados que lidem com valores monetários.',
  },
  {
    code: 'A14',
    label: 'A14 - Ajudas de custo e deslocações',
    description: 'Ajudas de custo e deslocações',
    tooltip: 'Ajudas de custo e deslocações quando excedem os limites legais ou quando a entidade pagadora não tenha optado pela respetiva tributação autónoma.',
  },
  {
    code: 'A21',
    label: 'A21 - Remunerações de órgãos estatutários',
    description: 'Remunerações de membros de órgãos estatutários',
    tooltip: 'Remunerações de membros de órgãos estatutários de pessoas coletivas e entidades equiparadas, incluindo gerentes, administradores e membros do conselho fiscal.',
  },
  {
    code: 'A22',
    label: 'A22 - Gratificações não atribuídas pela entidade patronal',
    description: 'Gratificações não atribuídas pela entidade patronal',
    tooltip: 'Gratificações auferidas pela prestação ou em razão da prestação do trabalho, quando não atribuídas pela entidade patronal.',
  },
  {
    code: 'A23',
    label: 'A23 - Rendimentos de pré-reforma',
    description: 'Rendimentos de pré-reforma, pré-aposentação ou reserva',
    tooltip: 'Rendimentos de pré-reforma, pré-aposentação ou reserva, com ou sem prestação de trabalho.',
  },
  {
    code: 'A24',
    label: 'A24 - Compensações e subsídios por cessação de funções',
    description: 'Compensações e subsídios por cessação de funções',
    tooltip: 'Compensações e subsídios referentes à cessação de funções de gestor público, administrador ou gerente de pessoa coletiva.',
  },
  {
    code: 'A25',
    label: 'A25 - Rendimentos de trabalhadores com deficiência',
    description: 'Rendimentos de trabalhadores com deficiência',
    tooltip: 'Rendimentos de trabalho dependente auferidos por trabalhadores com deficiência, beneficiando de isenção parcial.',
  },
  {
    code: 'A31',
    label: 'A31 - Outros rendimentos de trabalho dependente',
    description: 'Outros rendimentos de trabalho dependente',
    tooltip: 'Outros rendimentos de trabalho dependente não enquadráveis nos códigos anteriores.',
  },
];

// Categoria B - Trabalho Independente
const CATEGORY_B_CODES: IncomeCode[] = [
  {
    code: 'B11',
    label: 'B11 - Prestações de serviços de profissionais',
    description: 'Prestações de serviços de atividades profissionais',
    tooltip: 'Rendimentos de prestações de serviços de atividades profissionais especificamente previstas na tabela a que se refere o artigo 151.º do CIRS.',
  },
  {
    code: 'B12',
    label: 'B12 - Rendimentos de atividades agrícolas',
    description: 'Rendimentos de atividades agrícolas, silvícolas e pecuárias',
    tooltip: 'Rendimentos provenientes de atividades agrícolas, silvícolas e pecuárias.',
  },
  {
    code: 'B13',
    label: 'B13 - Rendimentos de atividades comerciais e industriais',
    description: 'Rendimentos de atividades comerciais e industriais',
    tooltip: 'Rendimentos provenientes de atividades comerciais e industriais, artesanais e de prestação de serviços não previstas na lista de atividades profissionais.',
  },
  {
    code: 'B14',
    label: 'B14 - Propriedade intelectual (não autor original)',
    description: 'Propriedade intelectual quando não auferida pelo autor original',
    tooltip: 'Rendimentos de propriedade intelectual quando não sejam auferidos pelo autor ou titular originário.',
  },
  {
    code: 'B15',
    label: 'B15 - Propriedade intelectual (autor original)',
    description: 'Propriedade intelectual auferida pelo autor original',
    tooltip: 'Rendimentos de propriedade intelectual, industrial ou de prestação de informações, quando auferidos pelo autor ou titular originário.',
  },
  {
    code: 'B16',
    label: 'B16 - Subsídios destinados à exploração',
    description: 'Subsídios ou subvenções à exploração',
    tooltip: 'Subsídios ou subvenções no âmbito do exercício de atividade independente.',
  },
  {
    code: 'B21',
    label: 'B21 - Atos isolados de natureza comercial',
    description: 'Atos isolados de natureza comercial ou industrial',
    tooltip: 'Rendimentos de atos isolados de natureza comercial ou industrial.',
  },
  {
    code: 'B22',
    label: 'B22 - Atos isolados de prestação de serviços',
    description: 'Atos isolados de prestação de serviços',
    tooltip: 'Rendimentos de atos isolados de prestação de serviços de atividades profissionais.',
  },
  {
    code: 'B23',
    label: 'B23 - Outros rendimentos empresariais/profissionais',
    description: 'Outros rendimentos empresariais e profissionais',
    tooltip: 'Outros rendimentos empresariais e profissionais não enquadráveis nos códigos anteriores.',
  },
];

// Categoria E - Rendimentos de Capitais
const CATEGORY_E_CODES: IncomeCode[] = [
  {
    code: 'E11',
    label: 'E11 - Juros de depósitos',
    description: 'Juros de depósitos à ordem ou a prazo',
    tooltip: 'Juros de depósitos à ordem ou a prazo, incluindo certificados de depósito.',
  },
  {
    code: 'E12',
    label: 'E12 - Dividendos',
    description: 'Lucros e dividendos',
    tooltip: 'Lucros e reservas colocados à disposição dos associados ou titulares, incluindo adiantamentos por conta de lucros.',
  },
  {
    code: 'E13',
    label: 'E13 - Juros de títulos de dívida',
    description: 'Juros de títulos de dívida',
    tooltip: 'Juros e outras formas de remuneração de obrigações e títulos de dívida.',
  },
  {
    code: 'E14',
    label: 'E14 - Rendimentos de seguros',
    description: 'Rendimentos de contratos de seguro',
    tooltip: 'Rendimentos de contratos de seguro e de operações do ramo Vida.',
  },
  {
    code: 'E15',
    label: 'E15 - Outros rendimentos de capitais',
    description: 'Outros rendimentos de capitais',
    tooltip: 'Outros rendimentos de capitais não especificados nos códigos anteriores.',
  },
];

// Categoria F - Rendimentos Prediais
const CATEGORY_F_CODES: IncomeCode[] = [
  {
    code: 'F1',
    label: 'F1 - Rendas de prédios urbanos',
    description: 'Rendas de prédios urbanos',
    tooltip: 'Rendas de prédios urbanos, incluindo as resultantes de contratos de arrendamento, subarrendamento e cedência de uso de prédios.',
  },
  {
    code: 'F2',
    label: 'F2 - Rendas de prédios rústicos',
    description: 'Rendas de prédios rústicos',
    tooltip: 'Rendas de prédios rústicos, incluindo as resultantes de contratos de arrendamento rural.',
  },
];

// Categoria G - Incrementos Patrimoniais
const CATEGORY_G_CODES: IncomeCode[] = [
  {
    code: 'G1',
    label: 'G1 - Mais-valias de imóveis',
    description: 'Mais-valias imobiliárias',
    tooltip: 'Ganhos obtidos na alienação onerosa de direitos reais sobre bens imóveis.',
  },
  {
    code: 'G2',
    label: 'G2 - Mais-valias de valores mobiliários',
    description: 'Mais-valias de valores mobiliários',
    tooltip: 'Ganhos obtidos na alienação onerosa de partes sociais, ações e outros valores mobiliários.',
  },
  {
    code: 'G3',
    label: 'G3 - Mais-valias de propriedade intelectual',
    description: 'Mais-valias de propriedade intelectual/industrial',
    tooltip: 'Ganhos obtidos na alienação onerosa de propriedade intelectual ou industrial, ou de experiência adquirida.',
  },
  {
    code: 'G4',
    label: 'G4 - Indemnizações por danos não patrimoniais',
    description: 'Indemnizações por danos não patrimoniais',
    tooltip: 'Importâncias auferidas por indemnizações que visem a reparação de danos não patrimoniais.',
  },
  {
    code: 'G5',
    label: 'G5 - Outros incrementos patrimoniais',
    description: 'Outros incrementos patrimoniais',
    tooltip: 'Outros incrementos patrimoniais não enquadráveis nos códigos anteriores.',
  },
];

// Categoria H - Pensões
const CATEGORY_H_CODES: IncomeCode[] = [
  {
    code: 'H1',
    label: 'H1 - Pensões de reforma/velhice',
    description: 'Pensões de reforma, velhice ou invalidez',
    tooltip: 'Pensões de reforma, velhice, invalidez ou sobrevivência, pagas por sistemas de segurança social.',
  },
  {
    code: 'H2',
    label: 'H2 - Pensões de alimentos',
    description: 'Pensões de alimentos',
    tooltip: 'Prestações devidas a título de alimentos.',
  },
  {
    code: 'H3',
    label: 'H3 - Outras pensões',
    description: 'Outras pensões',
    tooltip: 'Outras pensões não especificadas nos códigos anteriores.',
  },
];

// Categoria R - Retenções IRC
const CATEGORY_R_CODES: IncomeCode[] = [
  {
    code: 'R1',
    label: 'R1 - Rendimentos de propriedade intelectual',
    description: 'Rendimentos de propriedade intelectual (IRC)',
    tooltip: 'Rendimentos de propriedade intelectual ou prestação de informações respeitantes a experiência adquirida no setor industrial, comercial ou científico.',
  },
  {
    code: 'R2',
    label: 'R2 - Uso de equipamentos',
    description: 'Uso ou concessão de uso de equipamentos (IRC)',
    tooltip: 'Rendimentos derivados do uso ou concessão do uso de equipamento agrícola, industrial, comercial ou científico.',
  },
  {
    code: 'R3',
    label: 'R3 - Comissões de intermediação',
    description: 'Comissões de intermediação (IRC)',
    tooltip: 'Comissões por intermediação na celebração de quaisquer contratos.',
  },
  {
    code: 'R4',
    label: 'R4 - Prestações de serviços de gestão',
    description: 'Prestações de serviços de gestão (IRC)',
    tooltip: 'Rendimentos de prestações de serviços de gestão, consultoria, estudos, análises, programação, auditoria, etc.',
  },
  {
    code: 'R5',
    label: 'R5 - Prestações de serviços técnicos',
    description: 'Prestações de serviços técnicos (IRC)',
    tooltip: 'Rendimentos de prestações de serviços de carácter técnico, incluindo serviços de engenharia, arquitetura, design, etc.',
  },
  {
    code: 'R6',
    label: 'R6 - Contraprestações de contratos de associação',
    description: 'Contratos de associação em participação (IRC)',
    tooltip: 'Rendimentos devidos como contraprestação da associação em participação e da associação à quota.',
  },
  {
    code: 'R7',
    label: 'R7 - Juros de suprimentos',
    description: 'Juros de suprimentos (IRC)',
    tooltip: 'Juros ou quaisquer outros rendimentos de capitais devidos por entidades sujeitas a IRC a entidades sujeitas a IRC.',
  },
  {
    code: 'R8',
    label: 'R8 - Rendimentos de títulos de dívida',
    description: 'Rendimentos de títulos de dívida (IRC)',
    tooltip: 'Rendimentos de títulos de participação, obrigações, títulos de dívida e outros valores mobiliários.',
  },
  {
    code: 'R9',
    label: 'R9 - Prémios de jogo',
    description: 'Prémios de jogos e sorteios (IRC)',
    tooltip: 'Prémios de lotarias, apostas mútuas, totoloto e jogos sociais.',
  },
  {
    code: 'R10',
    label: 'R10 - Comissões a mediadores de seguros',
    description: 'Comissões a mediadores de seguros (IRC)',
    tooltip: 'Comissões de seguros auferidas por mediadores de seguros.',
  },
  {
    code: 'R11',
    label: 'R11 - Rendimentos de fundos de investimento',
    description: 'Rendimentos de fundos de investimento (IRC)',
    tooltip: 'Rendimentos distribuídos por organismos de investimento coletivo.',
  },
  {
    code: 'R12',
    label: 'R12 - Outros rendimentos IRC',
    description: 'Outros rendimentos sujeitos a retenção IRC',
    tooltip: 'Outros rendimentos sujeitos a retenção na fonte em sede de IRC não especificados nos códigos anteriores.',
  },
];

// Configuração completa de todas as categorias
export const INCOME_CATEGORIES: IncomeCategoryConfig[] = [
  {
    category: 'A',
    label: 'A - Trabalho Dependente',
    description: 'Rendimentos de trabalho por conta de outrem',
    codes: CATEGORY_A_CODES,
  },
  {
    category: 'B',
    label: 'B - Trabalho Independente',
    description: 'Rendimentos empresariais e profissionais (Recibos Verdes)',
    codes: CATEGORY_B_CODES,
  },
  {
    category: 'E',
    label: 'E - Rendimentos de Capitais',
    description: 'Juros, dividendos e outros rendimentos de capitais',
    codes: CATEGORY_E_CODES,
  },
  {
    category: 'F',
    label: 'F - Rendimentos Prediais',
    description: 'Rendas de imóveis',
    codes: CATEGORY_F_CODES,
  },
  {
    category: 'G',
    label: 'G - Incrementos Patrimoniais',
    description: 'Mais-valias e outros incrementos',
    codes: CATEGORY_G_CODES,
  },
  {
    category: 'H',
    label: 'H - Pensões',
    description: 'Pensões de reforma, invalidez e alimentos',
    codes: CATEGORY_H_CODES,
  },
  {
    category: 'R',
    label: 'R - Retenções IRC',
    description: 'Retenções a pessoas coletivas',
    codes: CATEGORY_R_CODES,
  },
];

/**
 * Obtém os códigos de rendimento para uma categoria específica
 */
export function getIncomeCodesForCategory(category: string): IncomeCode[] {
  const config = INCOME_CATEGORIES.find(c => c.category === category);
  return config?.codes || [];
}

/**
 * Obtém um código de rendimento específico
 */
export function getIncomeCode(code: string): IncomeCode | undefined {
  for (const category of INCOME_CATEGORIES) {
    const found = category.codes.find(c => c.code === code);
    if (found) return found;
  }
  return undefined;
}

/**
 * Obtém a categoria a partir de um código de rendimento
 */
export function getCategoryFromCode(code: string): string | undefined {
  if (!code || code.length < 1) return undefined;
  return code.charAt(0);
}

/**
 * Valida se um código é válido para uma categoria
 */
export function isValidCodeForCategory(code: string, category: string): boolean {
  const codes = getIncomeCodesForCategory(category);
  return codes.some(c => c.code === code);
}
