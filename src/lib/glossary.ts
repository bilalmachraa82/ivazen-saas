/**
 * Portuguese Tax Glossary
 *
 * Definitions for technical terms used throughout the application.
 * Used by InfoTooltip component to provide contextual help.
 */

export interface GlossaryTerm {
  term: string;
  definition: string;
  link?: string;
  example?: string;
}

export const GLOSSARY: Record<string, GlossaryTerm> = {
  nif: {
    term: 'NIF',
    definition: 'Número de Identificação Fiscal. É o seu número de contribuinte composto por 9 dígitos.',
    link: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/Folhetos_informativos/nif.htm',
    example: '123456789',
  },
  cae: {
    term: 'CAE',
    definition: 'Classificação Portuguesa de Atividades Económicas. Código que identifica a sua área de atividade profissional.',
    link: 'https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_classificacoes&classificacoeestemas=55581&contexto=cl&selTab=tab0',
    example: '62010 - Atividades de programação informática',
  },
  iva: {
    term: 'IVA',
    definition: 'Imposto sobre o Valor Acrescentado. Imposto indireto sobre o consumo cobrado em cada etapa da produção e distribuição.',
    link: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa/',
    example: 'Taxa normal: 23%, Taxa intermédia: 13%, Taxa reduzida: 6%',
  },
  niss: {
    term: 'NISS',
    definition: 'Número de Identificação da Segurança Social. Número único que identifica cada pessoa no sistema de Segurança Social.',
    link: 'https://www.seg-social.pt/',
    example: '12345678901',
  },
  modelo10: {
    term: 'Modelo 10',
    definition: 'Declaração de retenções na fonte sobre rendimentos. Deve ser entregue anualmente até 20 de janeiro.',
    link: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/Folhetos_informativos/modelo10.htm',
    example: 'Retenções de IRS sobre recibos verdes, rendas, etc.',
  },
  retencao: {
    term: 'Retenção na Fonte',
    definition: 'Montante que é retido no momento do pagamento de um rendimento, como adiantamento do imposto devido.',
    example: 'Recibo verde de €1000 com retenção de 25% = €250 retidos',
  },
  reciboverde: {
    term: 'Recibo Verde',
    definition: 'Documento emitido por trabalhadores independentes para comprovar a prestação de serviços e recebimento de pagamentos.',
    example: 'Categoria B de rendimentos (trabalho independente)',
  },
  occ: {
    term: 'OCC',
    definition: 'Ordem dos Contabilistas Certificados. Organização profissional que regula e certifica contabilistas em Portugal.',
    link: 'https://www.occ.pt/',
  },
  cedula: {
    term: 'Cédula Profissional',
    definition: 'Documento que certifica a inscrição de um contabilista na Ordem dos Contabilistas Certificados.',
  },
  saftpt: {
    term: 'SAF-T (PT)',
    definition: 'Standard Audit File for Tax purposes. Ficheiro XML com todos os documentos contabilísticos e fiscais.',
    link: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/Folhetos_informativos/saft_pt.htm',
  },
  qrcode: {
    term: 'QR Code AT',
    definition: 'Código QR presente nas faturas emitidas através do Portal das Finanças, contém dados da fatura validados pela AT.',
    example: 'Permite upload automático com validação oficial',
  },
  volumenegocios: {
    term: 'Volume de Negócios',
    definition: 'Total de vendas ou prestações de serviços realizadas num determinado período.',
    example: 'Usado para verificar isenção de IVA (limite €15.000)',
  },
  dedutibilidade: {
    term: 'Dedutibilidade',
    definition: 'Percentagem de uma despesa que pode ser deduzida para efeitos fiscais.',
    example: 'Combustível: 100% dedutível se viatura comercial',
  },
  categoriab: {
    term: 'Categoria B',
    definition: 'Rendimentos de trabalho independente (prestação de serviços, recibos verdes).',
    link: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs/',
  },
  categoriaf: {
    term: 'Categoria F',
    definition: 'Rendimentos de prediais (rendas de imóveis).',
  },
  categoriag: {
    term: 'Categoria G',
    definition: 'Incrementos patrimoniais (mais-valias).',
  },
  categoriae: {
    term: 'Categoria E',
    definition: 'Rendimentos de capitais (juros, dividendos).',
  },
  categoriaa: {
    term: 'Categoria A',
    definition: 'Rendimentos de trabalho dependente (salários).',
  },
  categoriah: {
    term: 'Categoria H',
    definition: 'Pensões (reforma, invalidez, sobrevivência).',
  },
  categoriar: {
    term: 'Categoria R',
    definition: 'Rendimentos não incluídos nas outras categorias.',
  },
  irs: {
    term: 'IRS',
    definition: 'Imposto sobre o Rendimento de Pessoas Singulares. Imposto anual sobre rendimentos.',
    link: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs/',
  },
  irc: {
    term: 'IRC',
    definition: 'Imposto sobre o Rendimento de Pessoas Coletivas. Imposto anual sobre lucros de empresas.',
  },
  at: {
    term: 'AT',
    definition: 'Autoridade Tributária e Aduaneira. Organismo responsável pela administração dos impostos em Portugal.',
    link: 'https://www.portaldasfinancas.gov.pt/',
  },
  ss: {
    term: 'Segurança Social',
    definition: 'Sistema de proteção social que garante prestações em situações de doença, desemprego, velhice, etc.',
    link: 'https://www.seg-social.pt/',
  },
  contribuicao: {
    term: 'Contribuição SS',
    definition: 'Valor que os trabalhadores independentes pagam mensalmente à Segurança Social (base: 21,4% dos rendimentos).',
  },
  regime: {
    term: 'Regime de IVA',
    definition: 'Enquadramento fiscal para efeitos de IVA. Pode ser Normal, Isento ou Misto.',
    example: 'Isento: volume de negócios < €15.000',
  },
  confidence: {
    term: 'Confiança (AI)',
    definition: 'Percentagem que indica o nível de certeza da IA na extração de dados de um documento.',
    example: '≥95%: Alta confiança | 80-94%: Média | <80%: Baixa',
  },
};

/**
 * Get a glossary term definition
 */
export const getGlossaryTerm = (key: string): GlossaryTerm | null => {
  return GLOSSARY[key.toLowerCase()] || null;
};

/**
 * Search glossary by partial match
 */
export const searchGlossary = (query: string): GlossaryTerm[] => {
  const lowerQuery = query.toLowerCase();
  return Object.values(GLOSSARY).filter(
    term =>
      term.term.toLowerCase().includes(lowerQuery) ||
      term.definition.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Get all glossary terms sorted alphabetically
 */
export const getAllTerms = (): GlossaryTerm[] => {
  return Object.values(GLOSSARY).sort((a, b) => a.term.localeCompare(b.term));
};
