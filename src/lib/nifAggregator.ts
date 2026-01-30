/**
 * NIF Aggregator
 * Aggregates income and withholding records by NIF for Modelo 10 declarations
 *
 * Features:
 * - Groups records by NIF (beneficiary tax ID)
 * - Calculates totals per NIF and per category
 * - Handles name variations (same NIF, different name spellings)
 * - Validates aggregated data for Modelo 10 requirements
 * - Supports multiple source types (AT files, billing systems, etc.)
 */

import { ATReciboRecord, ATCategoria, ATNIFSummary } from './atRecibosParser';
import { InvoiceRecord, InvoiceNIFSummary } from './invoiceSystemParser';
import { validatePortugueseNIF } from './nifValidator';

// ============ TYPES ============

export interface AggregatedNIF {
  nif: string;
  nifValid: boolean;
  nomes: string[];               // All name variations found
  nomePrincipal: string;         // Most common or first name
  categoria: ATCategoria;
  totalBruto: number;
  totalRetencao: number;
  totalLiquido: number;
  taxaMedia: number;             // Average withholding rate
  numDocumentos: number;
  primeiroDocumento: Date;
  ultimoDocumento: Date;
  fontes: string[];              // Source files
  avisos: string[];              // Warnings
  detalhes: AggregatedDetail[];  // Individual records
}

export interface AggregatedDetail {
  id: string;
  tipo: 'at_recibo' | 'invoice' | 'manual';
  numeroDocumento: string;
  data: Date;
  valorBruto: number;
  retencao: number;
  fonte: string;
}

export interface AggregationResult {
  success: boolean;
  ano: number;
  totalNIFs: number;
  totalBruto: number;
  totalRetencao: number;
  byNIF: Map<string, AggregatedNIF>;
  byCategoria: Map<ATCategoria, CategoryTotal>;
  errors: string[];
  warnings: string[];
}

export interface CategoryTotal {
  categoria: ATCategoria;
  nome: string;
  totalBruto: number;
  totalRetencao: number;
  taxaMedia: number;
  numNIFs: number;
  numDocumentos: number;
}

export interface AggregationOptions {
  ano?: number;                  // Filter by year
  categoria?: ATCategoria;       // Filter by category
  minValor?: number;             // Minimum gross amount
  incluirSemNIF?: boolean;       // Include records without valid NIF
  agruparPorNome?: boolean;      // Group by name when NIF not available
}

// ============ MAIN AGGREGATION FUNCTIONS ============

/**
 * Aggregate AT recibo records by NIF
 */
export function aggregateATRecords(
  records: ATReciboRecord[],
  options: AggregationOptions = {}
): AggregationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byNIF = new Map<string, AggregatedNIF>();
  const byCategoria = new Map<ATCategoria, CategoryTotal>();

  const ano = options.ano || new Date().getFullYear();

  for (const record of records) {
    // Filter by year if specified
    if (options.ano && record.dataInicio) {
      const recordYear = record.dataInicio.getFullYear();
      if (recordYear !== options.ano) {
        continue;
      }
    }

    // Filter by category if specified
    if (options.categoria && record.categoria !== options.categoria) {
      continue;
    }

    // Filter by minimum value
    if (options.minValor && record.valorBruto < options.minValor) {
      continue;
    }

    // Determine grouping key
    let key: string;
    let nifValid = false;

    if (record.nif && record.nif.length === 9) {
      const validation = validatePortugueseNIF(record.nif);
      nifValid = validation.valid;
      key = record.nif;

      if (!nifValid) {
        warnings.push(`Linha ${record.linha}: NIF ${record.nif} inválido`);
        if (!options.incluirSemNIF) {
          continue;
        }
      }
    } else if (options.agruparPorNome && record.nomeEmitente) {
      // Use normalized name as key when NIF not available
      key = `NOME_${normalizeNameForKey(record.nomeEmitente)}`;
      warnings.push(`Linha ${record.linha}: Agrupado por nome (NIF não disponível)`);
    } else if (options.incluirSemNIF) {
      key = 'SEM_NIF';
    } else {
      continue;
    }

    // Get or create aggregation entry
    if (!byNIF.has(key)) {
      byNIF.set(key, {
        nif: record.nif || '',
        nifValid,
        nomes: [],
        nomePrincipal: '',
        categoria: record.categoria,
        totalBruto: 0,
        totalRetencao: 0,
        totalLiquido: 0,
        taxaMedia: 0,
        numDocumentos: 0,
        primeiroDocumento: record.dataInicio,
        ultimoDocumento: record.dataInicio,
        fontes: [],
        avisos: [],
        detalhes: [],
      });
    }

    const agg = byNIF.get(key)!;

    // Update totals
    agg.totalBruto += record.valorBruto;
    agg.totalRetencao += record.retencao;
    agg.totalLiquido += record.valorLiquido;
    agg.numDocumentos += 1;

    // Track name variations
    if (record.nomeEmitente && !agg.nomes.includes(record.nomeEmitente)) {
      agg.nomes.push(record.nomeEmitente);
    }

    // Track date range
    if (record.dataInicio < agg.primeiroDocumento) {
      agg.primeiroDocumento = record.dataInicio;
    }
    if (record.dataFim > agg.ultimoDocumento) {
      agg.ultimoDocumento = record.dataFim;
    }

    // Track sources
    if (!agg.fontes.includes(record.ficheiro)) {
      agg.fontes.push(record.ficheiro);
    }

    // Add detail record
    agg.detalhes.push({
      id: record.id,
      tipo: 'at_recibo',
      numeroDocumento: record.numRecibo || record.numContrato || `Linha ${record.linha}`,
      data: record.dataInicio,
      valorBruto: record.valorBruto,
      retencao: record.retencao,
      fonte: record.ficheiro,
    });
  }

  // Calculate averages and set principal names
  for (const [, agg] of byNIF) {
    if (agg.totalBruto > 0) {
      agg.taxaMedia = (agg.totalRetencao / agg.totalBruto) * 100;
    }
    agg.nomePrincipal = agg.nomes[0] || '';

    // Add warning for multiple name variations
    if (agg.nomes.length > 1) {
      agg.avisos.push(`Múltiplas variações de nome encontradas: ${agg.nomes.join(', ')}`);
    }

    // Update category totals
    if (!byCategoria.has(agg.categoria)) {
      byCategoria.set(agg.categoria, {
        categoria: agg.categoria,
        nome: getCategoryName(agg.categoria),
        totalBruto: 0,
        totalRetencao: 0,
        taxaMedia: 0,
        numNIFs: 0,
        numDocumentos: 0,
      });
    }

    const catTotal = byCategoria.get(agg.categoria)!;
    catTotal.totalBruto += agg.totalBruto;
    catTotal.totalRetencao += agg.totalRetencao;
    catTotal.numNIFs += 1;
    catTotal.numDocumentos += agg.numDocumentos;
  }

  // Calculate category average rates
  for (const [, cat] of byCategoria) {
    if (cat.totalBruto > 0) {
      cat.taxaMedia = (cat.totalRetencao / cat.totalBruto) * 100;
    }
  }

  // Calculate totals
  let totalBruto = 0;
  let totalRetencao = 0;
  for (const [, agg] of byNIF) {
    totalBruto += agg.totalBruto;
    totalRetencao += agg.totalRetencao;
  }

  return {
    success: errors.length === 0,
    ano,
    totalNIFs: byNIF.size,
    totalBruto,
    totalRetencao,
    byNIF,
    byCategoria,
    errors,
    warnings,
  };
}

/**
 * Aggregate invoice records by NIF
 */
export function aggregateInvoiceRecords(
  records: InvoiceRecord[],
  options: AggregationOptions = {}
): AggregationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byNIF = new Map<string, AggregatedNIF>();
  const byCategoria = new Map<ATCategoria, CategoryTotal>();

  const ano = options.ano || new Date().getFullYear();

  for (const record of records) {
    // Filter by year
    if (options.ano && record.dataEmissao) {
      const recordYear = record.dataEmissao.getFullYear();
      if (recordYear !== options.ano) {
        continue;
      }
    }

    // Filter by category
    if (options.categoria && record.categoria !== options.categoria) {
      continue;
    }

    // Filter by minimum value
    if (options.minValor && record.valorBruto < options.minValor) {
      continue;
    }

    // Determine grouping key (use client NIF for withholding purposes)
    let key: string;
    let nifValid = false;

    if (record.nifCliente && record.nifCliente.length === 9) {
      const validation = validatePortugueseNIF(record.nifCliente);
      nifValid = validation.valid;
      key = record.nifCliente;

      if (!nifValid && !options.incluirSemNIF) {
        warnings.push(`Doc ${record.numeroDocumento}: NIF ${record.nifCliente} inválido`);
        continue;
      }
    } else if (options.agruparPorNome && record.nomeCliente) {
      key = `NOME_${normalizeNameForKey(record.nomeCliente)}`;
    } else if (options.incluirSemNIF) {
      key = 'SEM_NIF';
    } else {
      continue;
    }

    // Get or create aggregation entry
    if (!byNIF.has(key)) {
      byNIF.set(key, {
        nif: record.nifCliente || '',
        nifValid,
        nomes: [],
        nomePrincipal: '',
        categoria: record.categoria,
        totalBruto: 0,
        totalRetencao: 0,
        totalLiquido: 0,
        taxaMedia: 0,
        numDocumentos: 0,
        primeiroDocumento: record.dataEmissao,
        ultimoDocumento: record.dataEmissao,
        fontes: [],
        avisos: [],
        detalhes: [],
      });
    }

    const agg = byNIF.get(key)!;

    // Update totals
    agg.totalBruto += record.valorBruto;
    agg.totalRetencao += record.retencao;
    agg.totalLiquido += record.valorLiquido;
    agg.numDocumentos += 1;

    // Track name variations
    if (record.nomeCliente && !agg.nomes.includes(record.nomeCliente)) {
      agg.nomes.push(record.nomeCliente);
    }

    // Track date range
    if (record.dataEmissao < agg.primeiroDocumento) {
      agg.primeiroDocumento = record.dataEmissao;
    }
    if (record.dataEmissao > agg.ultimoDocumento) {
      agg.ultimoDocumento = record.dataEmissao;
    }

    // Track sources
    if (!agg.fontes.includes(record.ficheiro)) {
      agg.fontes.push(record.ficheiro);
    }

    // Add detail record
    agg.detalhes.push({
      id: record.id,
      tipo: 'invoice',
      numeroDocumento: record.numeroDocumento,
      data: record.dataEmissao,
      valorBruto: record.valorBruto,
      retencao: record.retencao,
      fonte: record.ficheiro,
    });
  }

  // Calculate averages and finalize
  for (const [, agg] of byNIF) {
    if (agg.totalBruto > 0) {
      agg.taxaMedia = (agg.totalRetencao / agg.totalBruto) * 100;
    }
    agg.nomePrincipal = agg.nomes[0] || '';

    if (agg.nomes.length > 1) {
      agg.avisos.push(`Múltiplas variações de nome: ${agg.nomes.join(', ')}`);
    }

    // Update category totals
    if (!byCategoria.has(agg.categoria)) {
      byCategoria.set(agg.categoria, {
        categoria: agg.categoria,
        nome: getCategoryName(agg.categoria),
        totalBruto: 0,
        totalRetencao: 0,
        taxaMedia: 0,
        numNIFs: 0,
        numDocumentos: 0,
      });
    }

    const catTotal = byCategoria.get(agg.categoria)!;
    catTotal.totalBruto += agg.totalBruto;
    catTotal.totalRetencao += agg.totalRetencao;
    catTotal.numNIFs += 1;
    catTotal.numDocumentos += agg.numDocumentos;
  }

  for (const [, cat] of byCategoria) {
    if (cat.totalBruto > 0) {
      cat.taxaMedia = (cat.totalRetencao / cat.totalBruto) * 100;
    }
  }

  let totalBruto = 0;
  let totalRetencao = 0;
  for (const [, agg] of byNIF) {
    totalBruto += agg.totalBruto;
    totalRetencao += agg.totalRetencao;
  }

  return {
    success: errors.length === 0,
    ano,
    totalNIFs: byNIF.size,
    totalBruto,
    totalRetencao,
    byNIF,
    byCategoria,
    errors,
    warnings,
  };
}

/**
 * Merge multiple aggregation results
 */
export function mergeAggregations(
  results: AggregationResult[],
  options: AggregationOptions = {}
): AggregationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byNIF = new Map<string, AggregatedNIF>();
  const byCategoria = new Map<ATCategoria, CategoryTotal>();

  let ano = options.ano || new Date().getFullYear();

  for (const result of results) {
    errors.push(...result.errors);
    warnings.push(...result.warnings);

    for (const [key, agg] of result.byNIF) {
      if (!byNIF.has(key)) {
        // Clone the aggregation
        byNIF.set(key, {
          ...agg,
          nomes: [...agg.nomes],
          fontes: [...agg.fontes],
          avisos: [...agg.avisos],
          detalhes: [...agg.detalhes],
        });
      } else {
        // Merge with existing
        const existing = byNIF.get(key)!;
        existing.totalBruto += agg.totalBruto;
        existing.totalRetencao += agg.totalRetencao;
        existing.totalLiquido += agg.totalLiquido;
        existing.numDocumentos += agg.numDocumentos;

        // Merge names
        for (const nome of agg.nomes) {
          if (!existing.nomes.includes(nome)) {
            existing.nomes.push(nome);
          }
        }

        // Merge sources
        for (const fonte of agg.fontes) {
          if (!existing.fontes.includes(fonte)) {
            existing.fontes.push(fonte);
          }
        }

        // Merge details
        existing.detalhes.push(...agg.detalhes);

        // Update date range
        if (agg.primeiroDocumento < existing.primeiroDocumento) {
          existing.primeiroDocumento = agg.primeiroDocumento;
        }
        if (agg.ultimoDocumento > existing.ultimoDocumento) {
          existing.ultimoDocumento = agg.ultimoDocumento;
        }
      }
    }
  }

  // Recalculate averages
  for (const [, agg] of byNIF) {
    if (agg.totalBruto > 0) {
      agg.taxaMedia = (agg.totalRetencao / agg.totalBruto) * 100;
    }
    agg.nomePrincipal = agg.nomes[0] || '';

    if (agg.nomes.length > 1) {
      agg.avisos = agg.avisos.filter(a => !a.startsWith('Múltiplas'));
      agg.avisos.push(`Múltiplas variações de nome: ${agg.nomes.join(', ')}`);
    }

    // Update category totals
    if (!byCategoria.has(agg.categoria)) {
      byCategoria.set(agg.categoria, {
        categoria: agg.categoria,
        nome: getCategoryName(agg.categoria),
        totalBruto: 0,
        totalRetencao: 0,
        taxaMedia: 0,
        numNIFs: 0,
        numDocumentos: 0,
      });
    }

    const catTotal = byCategoria.get(agg.categoria)!;
    catTotal.totalBruto += agg.totalBruto;
    catTotal.totalRetencao += agg.totalRetencao;
    catTotal.numNIFs += 1;
    catTotal.numDocumentos += agg.numDocumentos;
  }

  for (const [, cat] of byCategoria) {
    if (cat.totalBruto > 0) {
      cat.taxaMedia = (cat.totalRetencao / cat.totalBruto) * 100;
    }
  }

  let totalBruto = 0;
  let totalRetencao = 0;
  for (const [, agg] of byNIF) {
    totalBruto += agg.totalBruto;
    totalRetencao += agg.totalRetencao;
  }

  return {
    success: errors.length === 0,
    ano,
    totalNIFs: byNIF.size,
    totalBruto,
    totalRetencao,
    byNIF,
    byCategoria,
    errors,
    warnings,
  };
}

// ============ CONVERSION FOR MODELO 10 ============

export interface Modelo10Beneficiary {
  nif: string;
  nome: string;
  categoria: string;           // B, F, E, H
  rendimentoBruto: number;
  retencaoIRS: number;
  taxaRetencao: number;        // Percentage
  regiaoFiscal: string;        // C, RA, RM
}

/**
 * Convert aggregation result to Modelo 10 beneficiary format
 */
export function toModelo10Format(
  result: AggregationResult,
  regiaoFiscal: string = 'C'
): Modelo10Beneficiary[] {
  const beneficiaries: Modelo10Beneficiary[] = [];

  for (const [, agg] of result.byNIF) {
    // Skip entries without valid NIF
    if (!agg.nifValid && !agg.nif.startsWith('NOME_')) {
      continue;
    }

    // Skip SEM_NIF entries
    if (agg.nif === 'SEM_NIF' || agg.nif === '') {
      continue;
    }

    beneficiaries.push({
      nif: agg.nif.replace('NOME_', ''), // Remove prefix if name-based
      nome: agg.nomePrincipal,
      categoria: mapCategoriaToCode(agg.categoria),
      rendimentoBruto: Math.round(agg.totalBruto * 100) / 100,
      retencaoIRS: Math.round(agg.totalRetencao * 100) / 100,
      taxaRetencao: Math.round(agg.taxaMedia * 100) / 100,
      regiaoFiscal,
    });
  }

  // Sort by NIF
  beneficiaries.sort((a, b) => a.nif.localeCompare(b.nif));

  return beneficiaries;
}

// ============ HELPER FUNCTIONS ============

/**
 * Normalize a name for use as a grouping key
 */
function normalizeNameForKey(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^A-Z0-9]/g, '')       // Remove non-alphanumeric
    .substring(0, 20);               // Limit length
}

/**
 * Map ATCategoria to single letter code
 */
function mapCategoriaToCode(categoria: ATCategoria): string {
  switch (categoria) {
    case 'B_INDEPENDENTES': return 'B';
    case 'F_PREDIAIS': return 'F';
    case 'E_CAPITAIS': return 'E';
    case 'H_PENSOES': return 'H';
    default: return 'B';
  }
}

/**
 * Get category display name
 */
function getCategoryName(categoria: ATCategoria): string {
  switch (categoria) {
    case 'B_INDEPENDENTES': return 'Trabalho Independente';
    case 'F_PREDIAIS': return 'Rendimentos Prediais';
    case 'E_CAPITAIS': return 'Rendimentos de Capitais';
    case 'H_PENSOES': return 'Pensões';
    default: return 'Outro';
  }
}

// ============ REPORT GENERATION ============

/**
 * Generate a text summary report of aggregation
 */
export function generateAggregationReport(result: AggregationResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('RELATÓRIO DE AGREGAÇÃO POR NIF');
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(`Ano: ${result.ano}`);
  lines.push(`Total de NIFs: ${result.totalNIFs}`);
  lines.push(`Total Bruto: ${formatCurrency(result.totalBruto)}`);
  lines.push(`Total Retenção: ${formatCurrency(result.totalRetencao)}`);
  lines.push('');

  lines.push('POR CATEGORIA:');
  lines.push('-'.repeat(50));
  for (const [, cat] of result.byCategoria) {
    lines.push(`  ${cat.nome}:`);
    lines.push(`    NIFs: ${cat.numNIFs} | Docs: ${cat.numDocumentos}`);
    lines.push(`    Bruto: ${formatCurrency(cat.totalBruto)}`);
    lines.push(`    Retenção: ${formatCurrency(cat.totalRetencao)} (${cat.taxaMedia.toFixed(1)}%)`);
  }
  lines.push('');

  lines.push('DETALHE POR NIF:');
  lines.push('-'.repeat(70));

  const sortedNIFs = Array.from(result.byNIF.entries())
    .sort((a, b) => b[1].totalBruto - a[1].totalBruto);

  for (const [key, agg] of sortedNIFs) {
    lines.push(`  ${agg.nif || key}: ${agg.nomePrincipal}`);
    lines.push(`    Bruto: ${formatCurrency(agg.totalBruto)} | Retenção: ${formatCurrency(agg.totalRetencao)} (${agg.taxaMedia.toFixed(1)}%)`);
    lines.push(`    Documentos: ${agg.numDocumentos} | Fontes: ${agg.fontes.join(', ')}`);
    if (agg.avisos.length > 0) {
      lines.push(`    ⚠ ${agg.avisos.join('; ')}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('AVISOS:');
    lines.push('-'.repeat(50));
    for (const warning of result.warnings.slice(0, 20)) {
      lines.push(`  • ${warning}`);
    }
    if (result.warnings.length > 20) {
      lines.push(`  ... e mais ${result.warnings.length - 20} avisos`);
    }
  }

  return lines.join('\n');
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

// ============ EXPORTS ============

export {
  normalizeNameForKey,
  mapCategoriaToCode,
  getCategoryName,
  formatCurrency as formatCurrencyValue,
};
