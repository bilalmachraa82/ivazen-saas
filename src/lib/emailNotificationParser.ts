/**
 * Email Notification Parser
 * Parses email notifications from AT (Autoridade Tributária) Portal das Finanças
 *
 * Supports:
 * - Recibos Verdes notifications
 * - Rental income (rendas) notifications
 * - Tax withholding notifications
 * - Payment confirmations
 *
 * Keywords detection for automatic categorization
 */

import { ATCategoria, TAXAS_RETENCAO } from './atRecibosParser';
import { validatePortugueseNIF } from './nifValidator';

// ============ TYPES ============

export interface EmailNotification {
  id: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
  attachments: string[];
}

export interface ParsedEmailData {
  id: string;
  tipo: EmailType;
  categoria: ATCategoria;
  nifEmitente: string;
  nomeEmitente: string;
  nifBeneficiario: string;
  nomeBeneficiario: string;
  numeroDocumento: string;
  dataDocumento: Date | null;
  valorBruto: number;
  retencao: number;
  valorLiquido: number;
  taxaRetencao: number;
  keywordsEncontradas: string[];
  confianca: number;
  fonte: string;
  warnings: string[];
}

export type EmailType =
  | 'recibo_verde'
  | 'recibo_renda'
  | 'notificacao_retencao'
  | 'confirmacao_pagamento'
  | 'declaracao'
  | 'outro';

export interface EmailParseResult {
  success: boolean;
  data: ParsedEmailData | null;
  emailType: EmailType;
  errors: string[];
  warnings: string[];
}

// ============ KEYWORD CONFIGURATIONS ============

interface KeywordPattern {
  pattern: RegExp;
  type: EmailType;
  categoria?: ATCategoria;
  weight: number;
}

/**
 * AT Email subject patterns
 */
const SUBJECT_PATTERNS: KeywordPattern[] = [
  // Recibos Verdes
  {
    pattern: /recibo\s+verde/i,
    type: 'recibo_verde',
    categoria: 'B_INDEPENDENTES',
    weight: 100,
  },
  {
    pattern: /emiss[ãa]o\s+de\s+recibo/i,
    type: 'recibo_verde',
    categoria: 'B_INDEPENDENTES',
    weight: 90,
  },
  {
    pattern: /fatura[\s-]recibo/i,
    type: 'recibo_verde',
    categoria: 'B_INDEPENDENTES',
    weight: 85,
  },
  // Rendas
  {
    pattern: /recibo\s+de\s+renda/i,
    type: 'recibo_renda',
    categoria: 'F_PREDIAIS',
    weight: 100,
  },
  {
    pattern: /arrendamento/i,
    type: 'recibo_renda',
    categoria: 'F_PREDIAIS',
    weight: 80,
  },
  {
    pattern: /renda\s+mensal/i,
    type: 'recibo_renda',
    categoria: 'F_PREDIAIS',
    weight: 85,
  },
  // Retenções
  {
    pattern: /reten[çc][ãa]o\s+na\s+fonte/i,
    type: 'notificacao_retencao',
    weight: 90,
  },
  {
    pattern: /reten[çc][ãa]o\s+irs/i,
    type: 'notificacao_retencao',
    weight: 85,
  },
  // Pagamentos
  {
    pattern: /confirma[çc][ãa]o\s+de\s+pagamento/i,
    type: 'confirmacao_pagamento',
    weight: 90,
  },
  {
    pattern: /pagamento\s+efectuado/i,
    type: 'confirmacao_pagamento',
    weight: 85,
  },
  // Declarações
  {
    pattern: /modelo\s+10/i,
    type: 'declaracao',
    weight: 100,
  },
  {
    pattern: /declara[çc][ãa]o\s+anual/i,
    type: 'declaracao',
    weight: 80,
  },
];

/**
 * Body content keywords for category detection
 */
const BODY_KEYWORDS = {
  // Category B - Independent work
  B_INDEPENDENTES: [
    'prestação de serviços',
    'trabalho independente',
    'recibo verde',
    'act. prof.',
    'honorários',
    'consultoria',
    'serviços prestados',
  ],
  // Category F - Rental income
  F_PREDIAIS: [
    'renda',
    'arrendamento',
    'locador',
    'locatário',
    'inquilino',
    'senhorio',
    'imóvel',
    'habitação',
  ],
  // Category E - Capital income
  E_CAPITAIS: [
    'dividendos',
    'juros',
    'lucros',
    'rendimento de capitais',
    'participações',
  ],
  // Category H - Pensions
  H_PENSOES: [
    'pensão',
    'reforma',
    'aposentação',
  ],
};

/**
 * AT sender email patterns
 */
const AT_SENDER_PATTERNS = [
  /noreply@at\.gov\.pt/i,
  /portaldasfinancas@at\.gov\.pt/i,
  /notificacoes@at\.gov\.pt/i,
  /@at\.gov\.pt$/i,
  /autoridade.*tribut[aá]ria/i,
];

// ============ MAIN PARSER ============

/**
 * Parse an email notification from AT
 */
export function parseEmailNotification(email: EmailNotification): EmailParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Verify sender is from AT
    const isATEmail = AT_SENDER_PATTERNS.some(p => p.test(email.from));
    if (!isATEmail) {
      warnings.push('Email não parece ser do Portal das Finanças AT');
    }

    // Detect email type from subject
    const { type, categoria, confidence: subjectConfidence } = detectEmailType(email.subject);

    // Extract data from body
    const extractedData = extractDataFromBody(email.body, type);

    // Detect category from body if not determined from subject
    const finalCategoria = categoria || detectCategoryFromBody(email.body);

    // Calculate overall confidence
    const bodyConfidence = calculateBodyConfidence(email.body, finalCategoria);
    const overallConfidence = Math.round((subjectConfidence + bodyConfidence) / 2);

    const parsedData: ParsedEmailData = {
      id: email.id,
      tipo: type,
      categoria: finalCategoria,
      nifEmitente: extractedData.nifEmitente,
      nomeEmitente: extractedData.nomeEmitente,
      nifBeneficiario: extractedData.nifBeneficiario,
      nomeBeneficiario: extractedData.nomeBeneficiario,
      numeroDocumento: extractedData.numeroDocumento,
      dataDocumento: extractedData.dataDocumento,
      valorBruto: extractedData.valorBruto,
      retencao: extractedData.retencao,
      valorLiquido: extractedData.valorLiquido,
      taxaRetencao: extractedData.valorBruto > 0
        ? (extractedData.retencao / extractedData.valorBruto)
        : TAXAS_RETENCAO[finalCategoria],
      keywordsEncontradas: extractedData.keywords,
      confianca: overallConfidence,
      fonte: `Email: ${email.subject}`,
      warnings: [...warnings, ...extractedData.warnings],
    };

    return {
      success: true,
      data: parsedData,
      emailType: type,
      errors,
      warnings: parsedData.warnings,
    };

  } catch (err: any) {
    return {
      success: false,
      data: null,
      emailType: 'outro',
      errors: [`Erro ao processar email: ${err.message}`],
      warnings,
    };
  }
}

/**
 * Parse multiple email notifications
 */
export function parseEmailBatch(emails: EmailNotification[]): {
  results: EmailParseResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    byType: Map<EmailType, number>;
    byCategoria: Map<ATCategoria, number>;
  };
} {
  const results: EmailParseResult[] = [];
  const byType = new Map<EmailType, number>();
  const byCategoria = new Map<ATCategoria, number>();
  let successful = 0;
  let failed = 0;

  for (const email of emails) {
    const result = parseEmailNotification(email);
    results.push(result);

    if (result.success && result.data) {
      successful++;
      byType.set(result.emailType, (byType.get(result.emailType) || 0) + 1);
      byCategoria.set(result.data.categoria, (byCategoria.get(result.data.categoria) || 0) + 1);
    } else {
      failed++;
    }
  }

  return {
    results,
    summary: {
      total: emails.length,
      successful,
      failed,
      byType,
      byCategoria,
    },
  };
}

// ============ HELPER FUNCTIONS ============

/**
 * Detect email type from subject line
 */
function detectEmailType(subject: string): {
  type: EmailType;
  categoria: ATCategoria | null;
  confidence: number;
} {
  let bestMatch: { type: EmailType; categoria: ATCategoria | null; weight: number } = {
    type: 'outro',
    categoria: null,
    weight: 0,
  };

  const normalizedSubject = subject.toLowerCase();

  for (const pattern of SUBJECT_PATTERNS) {
    if (pattern.pattern.test(normalizedSubject)) {
      if (pattern.weight > bestMatch.weight) {
        bestMatch = {
          type: pattern.type,
          categoria: pattern.categoria || null,
          weight: pattern.weight,
        };
      }
    }
  }

  return {
    type: bestMatch.type,
    categoria: bestMatch.categoria,
    confidence: bestMatch.weight,
  };
}

/**
 * Detect category from email body
 */
function detectCategoryFromBody(body: string): ATCategoria {
  const normalizedBody = body.toLowerCase();
  const scores: Record<ATCategoria, number> = {
    B_INDEPENDENTES: 0,
    F_PREDIAIS: 0,
    E_CAPITAIS: 0,
    H_PENSOES: 0,
    OUTRO: 0,
  };

  for (const [category, keywords] of Object.entries(BODY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedBody.includes(keyword.toLowerCase())) {
        scores[category as ATCategoria] += keyword.length;
      }
    }
  }

  // Find highest scoring category
  let maxCategory: ATCategoria = 'B_INDEPENDENTES';
  let maxScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = category as ATCategoria;
    }
  }

  return maxCategory;
}

/**
 * Calculate confidence score from body content
 */
function calculateBodyConfidence(body: string, categoria: ATCategoria): number {
  const normalizedBody = body.toLowerCase();
  const keywords = BODY_KEYWORDS[categoria] || [];

  let matchCount = 0;
  for (const keyword of keywords) {
    if (normalizedBody.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  // Calculate confidence based on keyword matches
  const maxKeywords = keywords.length;
  if (maxKeywords === 0) return 30;

  return Math.min(100, Math.round((matchCount / maxKeywords) * 100) + 30);
}

/**
 * Extract data from email body
 */
function extractDataFromBody(body: string, type: EmailType): {
  nifEmitente: string;
  nomeEmitente: string;
  nifBeneficiario: string;
  nomeBeneficiario: string;
  numeroDocumento: string;
  dataDocumento: Date | null;
  valorBruto: number;
  retencao: number;
  valorLiquido: number;
  keywords: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const keywords: string[] = [];

  // Extract NIFs
  const nifPattern = /\b(\d{9})\b/g;
  const nifs: string[] = [];
  let match;
  while ((match = nifPattern.exec(body)) !== null) {
    const nif = match[1];
    if (validatePortugueseNIF(nif).valid) {
      nifs.push(nif);
    }
  }

  // Extract document number
  const docPatterns = [
    /n[.º°]?\s*(\d+\/\d{4})/i,                    // N.º 123/2025
    /recibo\s+n[.º°]?\s*(\d+)/i,                  // Recibo n.º 123
    /documento\s+n[.º°]?\s*([A-Z0-9-]+)/i,        // Documento n.º ABC-123
    /refer[êe]ncia[:\s]+([A-Z0-9-]+)/i,           // Referência: ABC-123
  ];

  let numeroDocumento = '';
  for (const pattern of docPatterns) {
    const match = body.match(pattern);
    if (match) {
      numeroDocumento = match[1];
      break;
    }
  }

  // Extract date
  const datePatterns = [
    /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,        // DD-MM-YYYY or DD/MM/YYYY
    /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,        // YYYY-MM-DD
    /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,     // 15 de Janeiro de 2025
  ];

  let dataDocumento: Date | null = null;
  for (const pattern of datePatterns) {
    const match = body.match(pattern);
    if (match) {
      dataDocumento = parsePortugueseDate(match);
      if (dataDocumento) break;
    }
  }

  // Extract amounts
  const amountPatterns = [
    /valor\s*(?:bruto)?[:\s]*€?\s*([\d.,]+)/i,
    /montante[:\s]*€?\s*([\d.,]+)/i,
    /total[:\s]*€?\s*([\d.,]+)/i,
    /€\s*([\d.,]+)/,
  ];

  let valorBruto = 0;
  for (const pattern of amountPatterns) {
    const match = body.match(pattern);
    if (match) {
      valorBruto = parsePortugueseNumber(match[1]);
      break;
    }
  }

  // Extract retention amount
  const retencaoPatterns = [
    /reten[çc][ãa]o[:\s]*€?\s*([\d.,]+)/i,
    /irs[:\s]*€?\s*([\d.,]+)/i,
    /valor\s+retido[:\s]*€?\s*([\d.,]+)/i,
  ];

  let retencao = 0;
  for (const pattern of retencaoPatterns) {
    const match = body.match(pattern);
    if (match) {
      retencao = parsePortugueseNumber(match[1]);
      break;
    }
  }

  // Extract liquid amount
  const liquidoPatterns = [
    /valor\s+l[íi]quido[:\s]*€?\s*([\d.,]+)/i,
    /l[íi]quido[:\s]*€?\s*([\d.,]+)/i,
    /a\s+receber[:\s]*€?\s*([\d.,]+)/i,
  ];

  let valorLiquido = 0;
  for (const pattern of liquidoPatterns) {
    const match = body.match(pattern);
    if (match) {
      valorLiquido = parsePortugueseNumber(match[1]);
      break;
    }
  }

  // Calculate missing values
  if (valorBruto === 0 && valorLiquido > 0 && retencao > 0) {
    valorBruto = valorLiquido + retencao;
  }
  if (valorLiquido === 0 && valorBruto > 0) {
    valorLiquido = valorBruto - retencao;
  }

  // Extract names
  const namePatterns = [
    /emitente[:\s]+([^\n\r]+)/i,
    /prestador[:\s]+([^\n\r]+)/i,
    /locador[:\s]+([^\n\r]+)/i,
    /benefici[aá]rio[:\s]+([^\n\r]+)/i,
  ];

  let nomeEmitente = '';
  let nomeBeneficiario = '';
  for (const pattern of namePatterns) {
    const match = body.match(pattern);
    if (match) {
      const name = match[1].trim().substring(0, 100);
      if (pattern.source.includes('benefici')) {
        nomeBeneficiario = name;
      } else {
        nomeEmitente = name;
      }
    }
  }

  // Collect found keywords
  for (const [, categoryKeywords] of Object.entries(BODY_KEYWORDS)) {
    for (const keyword of categoryKeywords) {
      if (body.toLowerCase().includes(keyword.toLowerCase())) {
        keywords.push(keyword);
      }
    }
  }

  // Validate extracted data
  if (valorBruto === 0) {
    warnings.push('Valor bruto não encontrado no email');
  }
  if (nifs.length === 0) {
    warnings.push('Nenhum NIF válido encontrado no email');
  }
  if (!dataDocumento) {
    warnings.push('Data do documento não encontrada no email');
  }

  return {
    nifEmitente: nifs[0] || '',
    nomeEmitente,
    nifBeneficiario: nifs[1] || nifs[0] || '',
    nomeBeneficiario,
    numeroDocumento,
    dataDocumento,
    valorBruto,
    retencao,
    valorLiquido,
    keywords: [...new Set(keywords)],
    warnings,
  };
}

/**
 * Parse Portuguese date format
 */
function parsePortugueseDate(match: RegExpMatchArray): Date | null {
  const monthNames: Record<string, number> = {
    janeiro: 0, fevereiro: 1, março: 2, marco: 2, abril: 3,
    maio: 4, junho: 5, julho: 6, agosto: 7,
    setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
  };

  try {
    // Check if it's "15 de Janeiro de 2025" format
    if (match.length === 4 && isNaN(parseInt(match[2]))) {
      const day = parseInt(match[1]);
      const month = monthNames[match[2].toLowerCase()];
      const year = parseInt(match[3]);
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }

    // Check if it's YYYY-MM-DD format
    if (match[1].length === 4) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }

    // DD-MM-YYYY format
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  } catch {
    return null;
  }
}

/**
 * Parse Portuguese number format
 */
function parsePortugueseNumber(value: string): number {
  // Remove currency symbols and spaces
  let cleaned = value.replace(/[€\s]/g, '');

  // Handle Portuguese format (1.234,56)
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ============ EMAIL MONITORING KEYWORDS ============

/**
 * Keywords to monitor in email subjects for automatic processing
 */
export const EMAIL_MONITOR_KEYWORDS = {
  // High priority - process immediately
  HIGH: [
    'recibo verde',
    'fatura-recibo',
    'retenção na fonte',
    'modelo 10',
    'declaração',
  ],
  // Medium priority - queue for processing
  MEDIUM: [
    'recibo de renda',
    'arrendamento',
    'pagamento',
    'notificação',
  ],
  // Low priority - log only
  LOW: [
    'informação',
    'aviso',
    'lembrete',
  ],
};

/**
 * Check if email should be processed based on keywords
 */
export function shouldProcessEmail(subject: string): {
  shouldProcess: boolean;
  priority: 'high' | 'medium' | 'low' | 'none';
  matchedKeywords: string[];
} {
  const normalizedSubject = subject.toLowerCase();
  const matchedKeywords: string[] = [];

  // Check high priority
  for (const keyword of EMAIL_MONITOR_KEYWORDS.HIGH) {
    if (normalizedSubject.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
      return { shouldProcess: true, priority: 'high', matchedKeywords };
    }
  }

  // Check medium priority
  for (const keyword of EMAIL_MONITOR_KEYWORDS.MEDIUM) {
    if (normalizedSubject.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }
  if (matchedKeywords.length > 0) {
    return { shouldProcess: true, priority: 'medium', matchedKeywords };
  }

  // Check low priority
  for (const keyword of EMAIL_MONITOR_KEYWORDS.LOW) {
    if (normalizedSubject.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }
  if (matchedKeywords.length > 0) {
    return { shouldProcess: false, priority: 'low', matchedKeywords };
  }

  return { shouldProcess: false, priority: 'none', matchedKeywords: [] };
}

/**
 * Filter emails by sender (AT only)
 */
export function filterATEmails(emails: EmailNotification[]): EmailNotification[] {
  return emails.filter(email =>
    AT_SENDER_PATTERNS.some(pattern => pattern.test(email.from))
  );
}

/**
 * Get email type display name
 */
export function getEmailTypeDisplayName(type: EmailType): string {
  switch (type) {
    case 'recibo_verde':
      return 'Recibo Verde';
    case 'recibo_renda':
      return 'Recibo de Renda';
    case 'notificacao_retencao':
      return 'Notificação de Retenção';
    case 'confirmacao_pagamento':
      return 'Confirmação de Pagamento';
    case 'declaracao':
      return 'Declaração';
    default:
      return 'Outro';
  }
}
