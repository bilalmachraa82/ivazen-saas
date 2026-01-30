/**
 * Modelo 10 Excel Generator
 *
 * Generates comprehensive Excel files for Modelo 10 declarations
 * Following the exact format requested by Portuguese tax authorities
 *
 * Structure:
 * - ABA 1: Resumo Recibos Verdes (Cat. B, 25%)
 * - ABA 2: Resumo Recibos Renda (Cat. F, 28%)
 * - ABA 3: TOTAL GERAL
 * - ABA 4: Detalhe Recibos Verdes
 * - ABA 5: Detalhe Recibos Renda
 * - ABA 6+: Declaração por Prestador (formato EXEMPLO_DR Independentes.xlsx)
 */

import * as XLSX from 'xlsx';
import { ATReciboRecord, ATNIFSummary, ATCategoria, formatCurrency, getCategoriaDisplayName } from './atRecibosParser';
import { EmitterData, loadEmitterData } from './emitterStorage';

// ============ TYPES ============

export interface ExcelGeneratorData {
  // All records by category
  recibosVerdes: ATReciboRecord[];       // Cat. B - 25%
  recibosRenda: ATReciboRecord[];        // Cat. F - 28%

  // Summaries by NIF
  summaryVerdes: ATNIFSummary[];
  summaryRenda: ATNIFSummary[];

  // Metadata
  selectedYear: number;
  emitterData?: EmitterData;
  clientName?: string;
}

export interface ExcelGenerationResult {
  success: boolean;
  filename?: string;
  error?: string;
}

// ============ MAIN GENERATOR ============

/**
 * Generate comprehensive Modelo 10 Excel file
 */
export function generateModelo10Excel(data: ExcelGeneratorData): ExcelGenerationResult {
  try {
    const emitter = data.emitterData || loadEmitterData();
    const wb = XLSX.utils.book_new();

    // ============ ABA 1: Resumo Recibos Verdes ============
    if (data.summaryVerdes.length > 0) {
      const wsVerdes = createResumoSheet(data.summaryVerdes, 'B', 25, data.selectedYear);
      XLSX.utils.book_append_sheet(wb, wsVerdes, 'Resumo Recibos Verdes');
    }

    // ============ ABA 2: Resumo Recibos Renda ============
    if (data.summaryRenda.length > 0) {
      const wsRenda = createResumoSheet(data.summaryRenda, 'F', 28, data.selectedYear);
      XLSX.utils.book_append_sheet(wb, wsRenda, 'Resumo Recibos Renda');
    }

    // ============ ABA 3: TOTAL GERAL ============
    const wsTotalGeral = createTotalGeralSheet(
      data.summaryVerdes,
      data.summaryRenda,
      data.selectedYear
    );
    XLSX.utils.book_append_sheet(wb, wsTotalGeral, 'TOTAL GERAL');

    // ============ ABA 4: Detalhe Recibos Verdes ============
    if (data.recibosVerdes.length > 0) {
      const wsDetalheVerdes = createDetalheSheet(data.recibosVerdes);
      XLSX.utils.book_append_sheet(wb, wsDetalheVerdes, 'Detalhe Recibos Verdes');
    }

    // ============ ABA 5: Detalhe Recibos Renda ============
    if (data.recibosRenda.length > 0) {
      const wsDetalheRenda = createDetalheSheet(data.recibosRenda);
      XLSX.utils.book_append_sheet(wb, wsDetalheRenda, 'Detalhe Recibos Renda');
    }

    // ============ ABA 6+: Declaração por Prestador ============
    // Generate one declaration sheet per NIF
    const allSummaries = [...data.summaryVerdes, ...data.summaryRenda];
    const uniqueNIFs = new Map<string, { nif: string; nome: string; categoria: ATCategoria; totalBruto: number; totalRetencao: number }>();

    for (const summary of allSummaries) {
      if (!summary.nif) continue;

      if (uniqueNIFs.has(summary.nif)) {
        // Aggregate if same NIF appears in both categories
        const existing = uniqueNIFs.get(summary.nif)!;
        existing.totalBruto += summary.totalBruto;
        existing.totalRetencao += summary.totalRetencao;
      } else {
        uniqueNIFs.set(summary.nif, {
          nif: summary.nif,
          nome: summary.nome,
          categoria: summary.categoria,
          totalBruto: summary.totalBruto,
          totalRetencao: summary.totalRetencao,
        });
      }
    }

    // Create declaration sheets
    let declarationIndex = 1;
    for (const [nif, prestador] of uniqueNIFs) {
      const wsDeclaracao = createDeclaracaoSheet(
        prestador,
        emitter,
        data.selectedYear
      );

      // Truncate sheet name to Excel's 31 character limit
      const sheetName = `Decl_${nif}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, wsDeclaracao, sheetName);
      declarationIndex++;
    }

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Modelo10_Completo_${data.selectedYear}_${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);

    return { success: true, filename };

  } catch (error: any) {
    console.error('Excel generation error:', error);
    return { success: false, error: error.message };
  }
}

// ============ SHEET GENERATORS ============

/**
 * Create summary sheet (Resumo)
 */
function createResumoSheet(
  summaries: ATNIFSummary[],
  categoria: string,
  taxa: number,
  year: number
): XLSX.WorkSheet {
  // Header rows
  const data: any[][] = [
    [`RESUMO DE RENDIMENTOS - CATEGORIA ${categoria}`],
    [`Ano Fiscal: ${year} | Taxa de Retenção: ${taxa}%`],
    [],
    ['NIF', 'Nome', 'Nº Recibos', 'Total Bruto (€)', 'Retenção (€)', 'Líquido (€)'],
  ];

  // Data rows
  let totalBruto = 0;
  let totalRetencao = 0;
  let totalLiquido = 0;
  let totalRecibos = 0;

  for (const summary of summaries) {
    data.push([
      summary.nif,
      summary.nome,
      summary.numRecibos,
      Number(summary.totalBruto.toFixed(2)),
      Number(summary.totalRetencao.toFixed(2)),
      Number(summary.totalLiquido.toFixed(2)),
    ]);

    totalBruto += summary.totalBruto;
    totalRetencao += summary.totalRetencao;
    totalLiquido += summary.totalLiquido;
    totalRecibos += summary.numRecibos;
  }

  // Totals row
  data.push([]);
  data.push([
    'TOTAL',
    '',
    totalRecibos,
    Number(totalBruto.toFixed(2)),
    Number(totalRetencao.toFixed(2)),
    Number(totalLiquido.toFixed(2)),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  ws['!cols'] = [
    { wch: 12 },  // NIF
    { wch: 35 },  // Nome
    { wch: 12 },  // Nº Recibos
    { wch: 15 },  // Total Bruto
    { wch: 15 },  // Retenção
    { wch: 15 },  // Líquido
  ];

  // Merge header cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Subtitle
  ];

  return ws;
}

/**
 * Create TOTAL GERAL sheet
 */
function createTotalGeralSheet(
  summaryVerdes: ATNIFSummary[],
  summaryRenda: ATNIFSummary[],
  year: number
): XLSX.WorkSheet {
  // Calculate totals
  const totalsVerdes = summaryVerdes.reduce(
    (acc, s) => ({
      bruto: acc.bruto + s.totalBruto,
      retencao: acc.retencao + s.totalRetencao,
      liquido: acc.liquido + s.totalLiquido,
      recibos: acc.recibos + s.numRecibos,
      prestadores: acc.prestadores + 1,
    }),
    { bruto: 0, retencao: 0, liquido: 0, recibos: 0, prestadores: 0 }
  );

  const totalsRenda = summaryRenda.reduce(
    (acc, s) => ({
      bruto: acc.bruto + s.totalBruto,
      retencao: acc.retencao + s.totalRetencao,
      liquido: acc.liquido + s.totalLiquido,
      recibos: acc.recibos + s.numRecibos,
      prestadores: acc.prestadores + 1,
    }),
    { bruto: 0, retencao: 0, liquido: 0, recibos: 0, prestadores: 0 }
  );

  const data: any[][] = [
    ['RESUMO GERAL - MODELO 10'],
    [`Ano Fiscal: ${year}`],
    [],
    ['CATEGORIA', 'PRESTADORES', 'RECIBOS', 'TOTAL BRUTO (€)', 'RETENÇÃO (€)', 'LÍQUIDO (€)', 'TAXA'],
    [],
    [
      'B. Trabalho Independente',
      totalsVerdes.prestadores,
      totalsVerdes.recibos,
      Number(totalsVerdes.bruto.toFixed(2)),
      Number(totalsVerdes.retencao.toFixed(2)),
      Number(totalsVerdes.liquido.toFixed(2)),
      '25%',
    ],
    [
      'F. Rendimentos Prediais',
      totalsRenda.prestadores,
      totalsRenda.recibos,
      Number(totalsRenda.bruto.toFixed(2)),
      Number(totalsRenda.retencao.toFixed(2)),
      Number(totalsRenda.liquido.toFixed(2)),
      '28%',
    ],
    [],
    [
      'TOTAL GERAL',
      totalsVerdes.prestadores + totalsRenda.prestadores,
      totalsVerdes.recibos + totalsRenda.recibos,
      Number((totalsVerdes.bruto + totalsRenda.bruto).toFixed(2)),
      Number((totalsVerdes.retencao + totalsRenda.retencao).toFixed(2)),
      Number((totalsVerdes.liquido + totalsRenda.liquido).toFixed(2)),
      '',
    ],
    [],
    [],
    ['Data de Geração:', new Date().toLocaleDateString('pt-PT')],
    ['Gerado por:', 'IVAzen - Sistema de Gestão Fiscal'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 28 },  // Categoria
    { wch: 12 },  // Prestadores
    { wch: 10 },  // Recibos
    { wch: 18 },  // Total Bruto
    { wch: 15 },  // Retenção
    { wch: 15 },  // Líquido
    { wch: 8 },   // Taxa
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  ];

  return ws;
}

/**
 * Create detail sheet (Detalhe)
 */
function createDetalheSheet(records: ATReciboRecord[]): XLSX.WorkSheet {
  const data: any[][] = [
    ['DETALHE DE RECIBOS'],
    [],
    ['NIF', 'Nome Emitente', 'Referência', 'Nº Recibo', 'Data Início', 'Data Fim', 'Valor Bruto (€)', 'Retenção (€)', 'Líquido (€)', 'Ficheiro'],
  ];

  for (const record of records) {
    data.push([
      record.nif,
      record.nomeEmitente,
      record.referencia,
      record.numRecibo,
      record.dataInicio.toLocaleDateString('pt-PT'),
      record.dataFim.toLocaleDateString('pt-PT'),
      Number(record.valorBruto.toFixed(2)),
      Number(record.retencao.toFixed(2)),
      Number(record.valorLiquido.toFixed(2)),
      record.ficheiro,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 12 },  // NIF
    { wch: 30 },  // Nome
    { wch: 15 },  // Referência
    { wch: 12 },  // Nº Recibo
    { wch: 12 },  // Data Início
    { wch: 12 },  // Data Fim
    { wch: 15 },  // Valor Bruto
    { wch: 12 },  // Retenção
    { wch: 15 },  // Líquido
    { wch: 25 },  // Ficheiro
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
  ];

  return ws;
}

/**
 * Create Declaração sheet (formato EXATO do EXEMPLO_DR Independentes.xlsx)
 *
 * Structure based on real template analysis:
 * - Row 1: "DECLARAÇÃO DE IRS "
 * - Row 2: "(Alinea b do Nº1 do Art. 119 do CIRS e Art. 128 do CIRC)"
 * - Rows 4-6: Emitter company info
 * - Rows 12-14: Prestador info (name, address, postal)
 * - Row 18: Date
 * - Row 24: Categoria de Rendimentos
 * - Row 26: Ano dos rendimentos
 * - Row 27: NIF do prestador
 * - Row 28: NIF da Empresa
 * - Row 31: Rendimentos Devidos (header)
 * - Row 34: Total de Rendimentos sujeitos a IRS
 * - Row 36: Rendimentos sujeitos a retenção
 * - Row 38: Rendimentos dispensados de retenção
 * - Row 40: Imposto Retido (header)
 * - Row 41: Total de Imposto Retido
 * - Rows 49-50: Signature area
 */
function createDeclaracaoSheet(
  prestador: { nif: string; nome: string; categoria: ATCategoria; totalBruto: number; totalRetencao: number },
  emitter: EmitterData,
  year: number
): XLSX.WorkSheet {
  // Category display matching template exactly
  const categoriaDisplay = prestador.categoria === 'F_PREDIAIS'
    ? 'F: PREDIAIS'
    : prestador.categoria === 'B_INDEPENDENTES'
      ? 'B: INDEPENDENTES'
      : prestador.categoria === 'E_CAPITAIS'
        ? 'E: CAPITAIS'
        : getCategoriaDisplayName(prestador.categoria);

  // Date formatting matching template: "Lisboa 31 de Janeiro de 2025"
  const hoje = new Date();
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const dataFormatada = `Lisboa, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  // Create empty 96 row x 28 col grid (matching template dimensions: A1:AB96)
  const data: any[][] = [];
  for (let i = 0; i < 96; i++) {
    data.push(new Array(28).fill(''));
  }

  // ============ HEADER (Rows 1-2) ============
  // Row 1 (index 0): Title - merged D1:R1
  data[0][3] = 'DECLARAÇÃO DE IRS ';

  // Row 2 (index 1): Subtitle - merged D2:R2
  data[1][3] = '(Alinea b do Nº1 do Art. 119 do CIRS e Art. 128 do CIRC)';

  // ============ EMITTER INFO (Rows 4-9) ============
  // Row 4 (index 3): Company name - merged D4:K4
  data[3][3] = emitter.companyName || 'EMPRESA NÃO CONFIGURADA';

  // Row 5 (index 4): Company address - merged D5:K5
  data[4][3] = emitter.companyAddress || 'MORADA NÃO CONFIGURADA';

  // Row 6 (index 5): Company postal - merged D6:K6
  data[5][3] = emitter.companyPostalCode
    ? `${emitter.companyPostalCode} ${emitter.companyCity}`
    : emitter.companyCity || 'CÓDIGO POSTAL E LOCALIDADE';

  // Row 8 (index 7): Additional postal (from template structure)
  // (Leave empty or use secondary address if available)

  // ============ PRESTADOR INFO (Rows 12-15) ============
  // Row 12 (index 11): Prestador name - merged L12:P12
  data[11][3] = prestador.nome;

  // Row 13 (index 12): Prestador address (blank - info not available from AT export)
  data[12][3] = '';

  // Row 14 (index 13): Prestador postal
  data[13][3] = '';

  // ============ DATE (Row 18) ============
  // Row 18 (index 17): Date - merged D18:P18 with leading spaces
  data[17][3] = `                                                         ${dataFormatada}`;

  // ============ CATEGORIA & YEAR (Rows 24-28) ============
  // Row 24 (index 23): Categoria
  data[23][3] = 'Categoria de Rendimentos: ';
  data[23][7] = categoriaDisplay;

  // Row 26 (index 25): Ano
  data[25][3] = 'Ano dos rendimentos: ';
  data[25][7] = year;

  // Row 27 (index 26): NIF do prestador
  data[26][3] = 'NIF: ';
  data[26][7] = prestador.nif;

  // Row 28 (index 27): NIF da Empresa
  data[27][3] = 'NIF da Empresa:';
  data[27][7] = emitter.companyNIF || '';

  // ============ RENDIMENTOS SECTION (Rows 31-38) ============
  // Row 31 (index 30): Section header
  data[30][3] = 'Rendimentos Devidos';

  // Row 34 (index 33): Total rendimentos - value in column P (index 15)
  data[33][4] = 'Total de Rendimentos sujeitos a IRS';
  data[33][15] = prestador.totalBruto;

  // Row 36 (index 35): Rendimentos com retenção
  data[35][5] = 'Rendimentos sujeitos a retençao na fonte';
  data[35][15] = prestador.totalBruto;

  // Row 38 (index 37): Rendimentos dispensados
  data[37][5] = 'Rendimentos sujeitos a IRS mas dispensados de retenção';
  data[37][15] = 0;

  // ============ IMPOSTO SECTION (Rows 40-41) ============
  // Row 40 (index 39): Section header
  data[39][3] = 'Imposto Retido';

  // Row 41 (index 40): Total imposto
  data[40][4] = 'Total de Imposto Retido';
  data[40][15] = prestador.totalRetencao;

  // ============ SIGNATURE (Rows 49-50) ============
  // Row 49 (index 48): Signature line
  data[48][3] = '_______';

  // Row 50 (index 49): Signature label
  data[49][3] = '       ( Assinatura, Carimbo)';

  // ============ FOOTER (Row 58-59) ============
  // Row 58 (index 57): Page number
  data[57][3] = '(Página 1 de 1)';

  // Row 59 (index 58): License/software info
  data[58][3] = `Licença de: ${emitter.companyName || 'IVAzen'}`;
  data[58][15] = '© IVAzen';

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // ============ COLUMN WIDTHS ============
  ws['!cols'] = [
    { wch: 4 },   // A
    { wch: 4 },   // B
    { wch: 4 },   // C
    { wch: 8 },   // D - Start of main content
    { wch: 8 },   // E
    { wch: 8 },   // F
    { wch: 8 },   // G
    { wch: 12 },  // H - Values (NIF, Year)
    { wch: 8 },   // I
    { wch: 8 },   // J
    { wch: 8 },   // K
    { wch: 8 },   // L - Prestador name start
    { wch: 8 },   // M
    { wch: 8 },   // N
    { wch: 8 },   // O
    { wch: 15 },  // P - Monetary values
    { wch: 8 },   // Q
    { wch: 8 },   // R
  ];

  // ============ MERGED CELLS (matching template exactly) ============
  ws['!merges'] = [
    // Header merges
    { s: { r: 0, c: 3 }, e: { r: 0, c: 17 } },   // D1:R1 - Title
    { s: { r: 1, c: 3 }, e: { r: 1, c: 17 } },   // D2:R2 - Subtitle

    // Emitter merges
    { s: { r: 3, c: 3 }, e: { r: 3, c: 10 } },   // D4:K4 - Company name
    { s: { r: 4, c: 3 }, e: { r: 4, c: 10 } },   // D5:K5 - Address
    { s: { r: 5, c: 3 }, e: { r: 5, c: 10 } },   // D6:K6 - Postal

    // Prestador merges
    { s: { r: 11, c: 11 }, e: { r: 11, c: 15 } }, // L12:P12 - Prestador name
    { s: { r: 12, c: 11 }, e: { r: 12, c: 15 } }, // L13:P13 - Address
    { s: { r: 13, c: 11 }, e: { r: 13, c: 15 } }, // L14:P14 - Postal (if any)

    // Date merge
    { s: { r: 17, c: 3 }, e: { r: 17, c: 15 } },  // D18:P18 - Date

    // Categoria merges
    { s: { r: 23, c: 3 }, e: { r: 23, c: 5 } },   // D24:F24 - Label
    { s: { r: 25, c: 3 }, e: { r: 25, c: 5 } },   // D26:F26 - Year label
    { s: { r: 25, c: 7 }, e: { r: 25, c: 8 } },   // H26:I26 - Year value
    { s: { r: 26, c: 3 }, e: { r: 26, c: 5 } },   // D27:F27 - NIF label
    { s: { r: 26, c: 7 }, e: { r: 26, c: 9 } },   // H27:J27 - NIF value
    { s: { r: 27, c: 3 }, e: { r: 27, c: 4 } },   // D28:E28 - NIF Empresa label
    { s: { r: 27, c: 7 }, e: { r: 27, c: 9 } },   // H28:J28 - NIF Empresa value

    // Section headers
    { s: { r: 30, c: 3 }, e: { r: 30, c: 9 } },   // D31:J31 - Rendimentos Devidos
    { s: { r: 39, c: 3 }, e: { r: 39, c: 9 } },   // D40:J40 - Imposto Retido

    // Signature merge
    { s: { r: 49, c: 11 }, e: { r: 49, c: 12 } }, // L50:M50 - Signature label
  ];

  return ws;
}

// ============ HELPER FUNCTIONS ============

/**
 * Format number in Portuguese style (1.234,56)
 */
function formatPortugueseNumber(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Simple export for single category (backward compatible)
 */
export function generateSimpleExcel(
  summaries: ATNIFSummary[],
  records: ATReciboRecord[],
  categoria: ATCategoria,
  year: number
): ExcelGenerationResult {
  const isRenda = categoria === 'F_PREDIAIS';

  return generateModelo10Excel({
    recibosVerdes: isRenda ? [] : records,
    recibosRenda: isRenda ? records : [],
    summaryVerdes: isRenda ? [] : summaries,
    summaryRenda: isRenda ? summaries : [],
    selectedYear: year,
  });
}
