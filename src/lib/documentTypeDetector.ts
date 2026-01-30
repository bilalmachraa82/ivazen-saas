/**
 * Document Type Detector
 * Detects income category (B, F, E, H) based on document content and keywords
 *
 * Portuguese Income Categories:
 * - B: Trabalho Independente (Independent work - 25% withholding)
 * - F: Rendimentos Prediais (Rental income - 28% withholding)
 * - E: Rendimentos de Capitais (Capital income - 28% withholding)
 * - H: Pensões (Pensions - variable withholding)
 */

import { ATCategoria, TAXAS_RETENCAO } from './atRecibosParser';

// ============ TYPES ============

export interface DocumentTypeResult {
  categoria: ATCategoria;
  categoriaCode: 'B' | 'F' | 'E' | 'H' | 'X';
  nome: string;
  descricao: string;
  taxaRetencao: number;
  confianca: number;           // 0-100 confidence score
  keywords: string[];          // Keywords that matched
  explicacao: string;          // Human-readable explanation
}

export interface DocumentAnalysis {
  texto: string;
  tipoDocumento: string;
  resultado: DocumentTypeResult;
  alternativas: DocumentTypeResult[];
}

// ============ KEYWORD CONFIGURATIONS ============

interface KeywordGroup {
  keywords: string[];
  weight: number;  // Higher weight = more important
}

const CATEGORIA_B_KEYWORDS: KeywordGroup[] = [
  // High confidence - specific to independent work
  {
    keywords: [
      'recibo verde', 'recibos verdes', 'prestação de serviços',
      'trabalho independente', 'act. prof.', 'actividade profissional',
    ],
    weight: 100,
  },
  // Medium-high - professional services
  {
    keywords: [
      'honorários', 'honorarios', 'avença', 'avenças',
      'consultoria', 'assessoria', 'parecer técnico',
    ],
    weight: 80,
  },
  // Medium - service descriptions
  {
    keywords: [
      'serviços prestados', 'servicos prestados', 'serviços de',
      'prestação', 'prestacao', 'desenvolvimento de', 'implementação de',
    ],
    weight: 60,
  },
  // Professions
  {
    keywords: [
      'advogado', 'médico', 'medico', 'engenheiro', 'arquitecto', 'arquiteto',
      'contabilista', 'revisor', 'auditor', 'perito', 'consultor',
      'programador', 'desenvolvedor', 'designer', 'formador', 'tradutor',
    ],
    weight: 50,
  },
  // General service terms
  {
    keywords: [
      'serviço', 'servico', 'projeto', 'projecto', 'análise', 'analise',
      'relatório', 'relatorio', 'formação', 'formacao', 'curso',
    ],
    weight: 30,
  },
];

const CATEGORIA_F_KEYWORDS: KeywordGroup[] = [
  // High confidence - rental specific
  {
    keywords: [
      'renda', 'rendas', 'arrendamento', 'contrato de arrendamento',
      'recibo de renda', 'recibo de arrendamento',
    ],
    weight: 100,
  },
  // Property roles
  {
    keywords: [
      'senhorio', 'locador', 'locatário', 'locatario', 'inquilino',
      'arrendatário', 'arrendatario', 'sub-arrendamento',
    ],
    weight: 90,
  },
  // Property types
  {
    keywords: [
      'imóvel', 'imovel', 'apartamento', 'moradia', 'fração', 'fracao',
      'habitação', 'habitacao', 'escritório', 'escritorio',
    ],
    weight: 70,
  },
  // Rental terms
  {
    keywords: [
      'aluguer', 'locação', 'locacao', 'predial', 'prédio', 'predio',
      'imobiliário', 'imobiliario', 'propriedade',
    ],
    weight: 50,
  },
  // Property documents
  {
    keywords: [
      'caderneta predial', 'registo predial', 'IMI', 'AIMI',
    ],
    weight: 40,
  },
];

const CATEGORIA_E_KEYWORDS: KeywordGroup[] = [
  // High confidence - capital specific
  {
    keywords: [
      'dividendo', 'dividendos', 'distribuição de lucros',
      'distribuicao de lucros', 'lucros distribuídos',
    ],
    weight: 100,
  },
  // Financial instruments
  {
    keywords: [
      'juros', 'rendimento de capitais', 'ações', 'acoes',
      'participações sociais', 'participacoes sociais', 'quotas',
    ],
    weight: 80,
  },
  // Loans and deposits
  {
    keywords: [
      'suprimentos', 'mútuos', 'mutuos', 'empréstimo',
      'depósito', 'deposito', 'aplicações financeiras',
    ],
    weight: 60,
  },
  // General capital terms
  {
    keywords: [
      'capital', 'investimento', 'rendimento', 'retorno',
    ],
    weight: 30,
  },
];

const CATEGORIA_H_KEYWORDS: KeywordGroup[] = [
  // High confidence - pension specific
  {
    keywords: [
      'pensão', 'pensao', 'pensões', 'pensoes', 'reforma',
      'aposentação', 'aposentacao', 'aposentadoria',
    ],
    weight: 100,
  },
  // Pension types
  {
    keywords: [
      'pensão de velhice', 'pensão de invalidez', 'pensão de sobrevivência',
      'pensão de alimentos', 'pensao de alimentos',
    ],
    weight: 90,
  },
  // Related terms
  {
    keywords: [
      'segurança social', 'seguranca social', 'CGA', 'ADSE',
      'fundo de pensões', 'fundo de pensoes',
    ],
    weight: 70,
  },
];

// ============ DOCUMENT TYPE PATTERNS ============

interface DocumentTypePattern {
  pattern: RegExp;
  categoria: ATCategoria;
  weight: number;
}

const DOCUMENT_TYPE_PATTERNS: DocumentTypePattern[] = [
  // Recibos Verdes - Category B
  { pattern: /recibo\s+verde/i, categoria: 'B_INDEPENDENTES', weight: 100 },
  { pattern: /fatura[\s-]recibo/i, categoria: 'B_INDEPENDENTES', weight: 80 },
  { pattern: /nota\s+de\s+honor[aá]rios/i, categoria: 'B_INDEPENDENTES', weight: 90 },
  { pattern: /act\.?\s*prof\.?/i, categoria: 'B_INDEPENDENTES', weight: 70 },

  // Recibos de Renda - Category F
  { pattern: /recibo\s+de\s+renda/i, categoria: 'F_PREDIAIS', weight: 100 },
  { pattern: /recibo\s+de\s+arrendamento/i, categoria: 'F_PREDIAIS', weight: 100 },
  { pattern: /contrato\s+de\s+arrendamento/i, categoria: 'F_PREDIAIS', weight: 90 },

  // Capital income - Category E
  { pattern: /certificado\s+de\s+dividendos/i, categoria: 'E_CAPITAIS', weight: 100 },
  { pattern: /distribui[çc][ãa]o\s+de\s+lucros/i, categoria: 'E_CAPITAIS', weight: 100 },

  // Pensions - Category H
  { pattern: /recibo\s+de\s+pens[ãa]o/i, categoria: 'H_PENSOES', weight: 100 },
  { pattern: /pens[ãa]o\s+de\s+reforma/i, categoria: 'H_PENSOES', weight: 90 },
];

// ============ MAIN DETECTION FUNCTIONS ============

/**
 * Detect document category from text content
 */
export function detectDocumentType(
  text: string,
  tipoDocumento?: string
): DocumentTypeResult {
  const normalizedText = normalizeText(text);
  const normalizedTipo = tipoDocumento ? normalizeText(tipoDocumento) : '';
  const fullText = `${normalizedTipo} ${normalizedText}`;

  // First, check document type patterns
  for (const pattern of DOCUMENT_TYPE_PATTERNS) {
    if (pattern.pattern.test(fullText)) {
      return createResult(
        pattern.categoria,
        pattern.weight,
        [pattern.pattern.source],
        `Documento identificado pelo padrão: ${pattern.pattern.source}`
      );
    }
  }

  // Score each category by keywords
  const scores = {
    B_INDEPENDENTES: scoreKeywords(fullText, CATEGORIA_B_KEYWORDS),
    F_PREDIAIS: scoreKeywords(fullText, CATEGORIA_F_KEYWORDS),
    E_CAPITAIS: scoreKeywords(fullText, CATEGORIA_E_KEYWORDS),
    H_PENSOES: scoreKeywords(fullText, CATEGORIA_H_KEYWORDS),
  };

  // Find highest scoring category
  let bestCategoria: ATCategoria = 'B_INDEPENDENTES';
  let bestScore = scores.B_INDEPENDENTES;
  let bestKeywords: string[] = [];

  for (const [cat, result] of Object.entries(scores) as [ATCategoria, { score: number; keywords: string[] }][]) {
    if (result.score > bestScore.score) {
      bestCategoria = cat;
      bestScore = result;
      bestKeywords = result.keywords;
    }
  }

  // Calculate confidence (normalize to 0-100)
  const maxPossibleScore = 300; // Reasonable max for multiple high-weight matches
  const confianca = Math.min(100, Math.round((bestScore.score / maxPossibleScore) * 100));

  // Generate explanation
  let explicacao = '';
  if (bestKeywords.length > 0) {
    explicacao = `Categoria detectada com base em: ${bestKeywords.slice(0, 5).join(', ')}`;
  } else {
    explicacao = 'Categoria predefinida (sem palavras-chave específicas encontradas)';
  }

  return createResult(bestCategoria, confianca, bestKeywords, explicacao);
}

/**
 * Analyze document and provide alternatives
 */
export function analyzeDocument(
  texto: string,
  tipoDocumento?: string
): DocumentAnalysis {
  const resultado = detectDocumentType(texto, tipoDocumento);

  // Get scores for all categories for alternatives
  const normalizedText = normalizeText(`${tipoDocumento || ''} ${texto}`);
  const allScores: { categoria: ATCategoria; score: number; keywords: string[] }[] = [
    { categoria: 'B_INDEPENDENTES', ...scoreKeywords(normalizedText, CATEGORIA_B_KEYWORDS) },
    { categoria: 'F_PREDIAIS', ...scoreKeywords(normalizedText, CATEGORIA_F_KEYWORDS) },
    { categoria: 'E_CAPITAIS', ...scoreKeywords(normalizedText, CATEGORIA_E_KEYWORDS) },
    { categoria: 'H_PENSOES', ...scoreKeywords(normalizedText, CATEGORIA_H_KEYWORDS) },
  ];

  // Sort by score descending
  allScores.sort((a, b) => b.score - a.score);

  // Create alternatives (excluding the main result)
  const alternativas: DocumentTypeResult[] = allScores
    .filter(s => s.categoria !== resultado.categoria && s.score > 0)
    .map(s => {
      const confianca = Math.min(100, Math.round((s.score / 300) * 100));
      return createResult(
        s.categoria,
        confianca,
        s.keywords,
        `Alternativa baseada em: ${s.keywords.slice(0, 3).join(', ')}`
      );
    });

  return {
    texto: texto.substring(0, 200),
    tipoDocumento: tipoDocumento || 'Desconhecido',
    resultado,
    alternativas,
  };
}

/**
 * Quick check if document is rental (Category F)
 */
export function isRendaDocument(text: string): boolean {
  const result = detectDocumentType(text);
  return result.categoria === 'F_PREDIAIS' && result.confianca >= 50;
}

/**
 * Quick check if document is independent work (Category B)
 */
export function isTrabalhoIndependenteDocument(text: string): boolean {
  const result = detectDocumentType(text);
  return result.categoria === 'B_INDEPENDENTES' && result.confianca >= 50;
}

/**
 * Get withholding rate for detected category
 */
export function getWithholdingRate(text: string): number {
  const result = detectDocumentType(text);
  return TAXAS_RETENCAO[result.categoria];
}

// ============ HELPER FUNCTIONS ============

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, ' ')        // Replace punctuation with spaces
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();
}

/**
 * Score text against keyword groups
 */
function scoreKeywords(text: string, groups: KeywordGroup[]): { score: number; keywords: string[] } {
  let totalScore = 0;
  const matchedKeywords: string[] = [];

  for (const group of groups) {
    for (const keyword of group.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      if (text.includes(normalizedKeyword)) {
        totalScore += group.weight;
        matchedKeywords.push(keyword);
      }
    }
  }

  return { score: totalScore, keywords: matchedKeywords };
}

/**
 * Create a DocumentTypeResult
 */
function createResult(
  categoria: ATCategoria,
  confianca: number,
  keywords: string[],
  explicacao: string
): DocumentTypeResult {
  const info = getCategoriaInfo(categoria);

  return {
    categoria,
    categoriaCode: info.code,
    nome: info.nome,
    descricao: info.descricao,
    taxaRetencao: TAXAS_RETENCAO[categoria],
    confianca,
    keywords,
    explicacao,
  };
}

/**
 * Get category information
 */
function getCategoriaInfo(categoria: ATCategoria): {
  code: 'B' | 'F' | 'E' | 'H' | 'X';
  nome: string;
  descricao: string;
} {
  switch (categoria) {
    case 'B_INDEPENDENTES':
      return {
        code: 'B',
        nome: 'Trabalho Independente',
        descricao: 'Rendimentos de trabalho independente (profissionais liberais, recibos verdes)',
      };
    case 'F_PREDIAIS':
      return {
        code: 'F',
        nome: 'Rendimentos Prediais',
        descricao: 'Rendimentos de arrendamento de imóveis (rendas)',
      };
    case 'E_CAPITAIS':
      return {
        code: 'E',
        nome: 'Rendimentos de Capitais',
        descricao: 'Rendimentos de capitais (dividendos, juros, lucros)',
      };
    case 'H_PENSOES':
      return {
        code: 'H',
        nome: 'Pensões',
        descricao: 'Pensões (reforma, invalidez, sobrevivência, alimentos)',
      };
    default:
      return {
        code: 'X',
        nome: 'Outro',
        descricao: 'Categoria não identificada',
      };
  }
}

// ============ EXPORTS ============

/**
 * Get all category codes and names
 */
export function getAllCategories(): Array<{
  codigo: string;
  categoria: ATCategoria;
  nome: string;
  taxa: number;
}> {
  return [
    { codigo: 'B', categoria: 'B_INDEPENDENTES', nome: 'Trabalho Independente', taxa: 0.25 },
    { codigo: 'F', categoria: 'F_PREDIAIS', nome: 'Rendimentos Prediais', taxa: 0.28 },
    { codigo: 'E', categoria: 'E_CAPITAIS', nome: 'Rendimentos de Capitais', taxa: 0.28 },
    { codigo: 'H', categoria: 'H_PENSOES', nome: 'Pensões', taxa: 0.25 },
  ];
}

/**
 * Get keywords for a specific category
 */
export function getKeywordsForCategory(categoria: ATCategoria): string[] {
  const allKeywords: string[] = [];

  let groups: KeywordGroup[] = [];
  switch (categoria) {
    case 'B_INDEPENDENTES':
      groups = CATEGORIA_B_KEYWORDS;
      break;
    case 'F_PREDIAIS':
      groups = CATEGORIA_F_KEYWORDS;
      break;
    case 'E_CAPITAIS':
      groups = CATEGORIA_E_KEYWORDS;
      break;
    case 'H_PENSOES':
      groups = CATEGORIA_H_KEYWORDS;
      break;
  }

  for (const group of groups) {
    allKeywords.push(...group.keywords);
  }

  return [...new Set(allKeywords)]; // Remove duplicates
}

/**
 * Format category for display
 */
export function formatCategoria(categoria: ATCategoria): string {
  const info = getCategoriaInfo(categoria);
  return `${info.code}. ${info.nome}`;
}

/**
 * Parse category code to ATCategoria
 */
export function parseCategoriaCode(code: string): ATCategoria {
  switch (code.toUpperCase()) {
    case 'B':
      return 'B_INDEPENDENTES';
    case 'F':
      return 'F_PREDIAIS';
    case 'E':
      return 'E_CAPITAIS';
    case 'H':
      return 'H_PENSOES';
    default:
      return 'OUTRO';
  }
}
