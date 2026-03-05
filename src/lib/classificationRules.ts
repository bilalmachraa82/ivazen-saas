/**
 * Classification Rules Engine
 * Intelligent expense classification for e-Fatura integration
 * Uses global rules, client history, and CAE context
 */

import { supabase } from '@/integrations/supabase/client';

export type Classification = 'ACTIVIDADE' | 'PESSOAL' | 'MISTA';

export interface ClassificationResult {
  classification: Classification;
  dpField: number | null; // 20-24
  deductibility: number; // 0-100
  confidence: number; // 0-100
  source: 'global_rule' | 'client_history' | 'cae_inference' | 'default';
  reason: string;
  requiresReview: boolean;
  matchedRule?: {
    id: string;
    supplierNif: string;
    notes?: string;
  };
}

export interface ClassificationInput {
  supplierNif: string;
  supplierName: string;
  valorTotal: number;
  valorIva: number;
  clientId?: string;
  clientCae?: string;
  sector?: string;
}

/**
 * DP Field mapping based on expense type and VAT rate
 */
export const DP_FIELD_MAP = {
  IMOBILIZADO: 20,      // >1000€, vida útil >1 ano
  EXISTENCIAS_6: 21,    // Taxa reduzida (6%)
  EXISTENCIAS_13: 23,   // Taxa intermédia (13%)
  EXISTENCIAS_23: 22,   // Taxa normal (23%)
  OUTROS_BENS: 24,      // Outros bens e serviços
};

/**
 * Maps human-readable classification labels to DP field values.
 * Classifications that depend on the VAT rate use null to signal
 * that the rate-based logic below should decide.
 */
const CLASSIFICATION_TO_DP: Record<string, number | null> = {
  'Imobilizado corpóreo': DP_FIELD_MAP.IMOBILIZADO,
  'Imobilizado incorpóreo': DP_FIELD_MAP.IMOBILIZADO,
  'Fornecimentos e serviços externos': DP_FIELD_MAP.OUTROS_BENS,
  'Gastos com pessoal': DP_FIELD_MAP.OUTROS_BENS,
  'Outros gastos': DP_FIELD_MAP.OUTROS_BENS,
  'Não dedutível': null,
  // Rate-dependent: resolved by dominant VAT base
  'Mercadorias': null,
  'Matérias-primas': null,
};

/** Classifications whose DP depends on the dominant VAT rate */
const RATE_DEPENDENT_CLASSIFICATIONS = new Set([
  'Mercadorias',
  'Matérias-primas',
]);

/**
 * Input for inferring the DP field from classification and VAT bases
 */
export interface InferDpInput {
  classification: string;
  base_reduced?: number | null;
  base_intermediate?: number | null;
  base_standard?: number | null;
}

/**
 * Result of DP field inference
 */
export interface InferDpResult {
  dpField: number | null;
  confident: boolean;
  requiresReview: boolean;
  reason?: string;
}

/**
 * Infer the DP (Declaracao Periodica) field from the classification
 * and the invoice's VAT base amounts.
 *
 * Rules:
 * - Fixed-DP classifications (Imobilizado, FSE, Gastos pessoal, Outros)
 *   map directly via CLASSIFICATION_TO_DP.
 * - Rate-dependent classifications (Mercadorias, Materias-primas) pick
 *   the DP that matches the dominant VAT base.
 * - If multiple non-zero bases exist and the smaller is >20% of the
 *   larger, the result is flagged as requiresReview (mixed IVA guardrail).
 * - All bases 0/null (exempt invoice) defaults to dpField=24.
 * - Unknown classification returns dpField=null, confident=false.
 */
export function inferDpField(input: InferDpInput): InferDpResult {
  const { classification, base_reduced, base_intermediate, base_standard } = input;

  // Unknown classification — not in the map at all
  if (!(classification in CLASSIFICATION_TO_DP)) {
    return {
      dpField: null,
      confident: false,
      requiresReview: false,
      reason: `Classificacao "${classification}" nao encontrada no mapa DP`,
    };
  }

  // Non-deductible classification
  if (classification === 'Não dedutível') {
    return {
      dpField: null,
      confident: true,
      requiresReview: false,
      reason: 'Despesa nao dedutivel — sem campo DP',
    };
  }

  // Collect non-zero bases for mixed-IVA detection
  const bases: { label: string; value: number; dp: number }[] = [];
  const br = base_reduced ?? 0;
  const bi = base_intermediate ?? 0;
  const bs = base_standard ?? 0;

  if (br > 0) bases.push({ label: 'reduzida (6%)', value: br, dp: DP_FIELD_MAP.EXISTENCIAS_6 });
  if (bi > 0) bases.push({ label: 'intermedia (13%)', value: bi, dp: DP_FIELD_MAP.EXISTENCIAS_13 });
  if (bs > 0) bases.push({ label: 'normal (23%)', value: bs, dp: DP_FIELD_MAP.EXISTENCIAS_23 });

  // Detect mixed IVA: two or more non-zero bases where the smaller
  // is >20% of the larger
  let mixedIva = false;
  if (bases.length >= 2) {
    const sorted = [...bases].sort((a, b) => b.value - a.value);
    const largest = sorted[0].value;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].value / largest > 0.2) {
        mixedIva = true;
        break;
      }
    }
  }

  // Fixed-DP classifications (not rate-dependent)
  if (!RATE_DEPENDENT_CLASSIFICATIONS.has(classification)) {
    const fixedDp = CLASSIFICATION_TO_DP[classification]!;
    return {
      dpField: fixedDp,
      confident: !mixedIva,
      requiresReview: mixedIva,
      reason: mixedIva
        ? `Campo ${fixedDp} sugerido, mas factura tem bases IVA mistas — requer revisao`
        : `Campo ${fixedDp} por classificacao "${classification}"`,
    };
  }

  // Rate-dependent classifications: pick DP from dominant base
  // All bases zero/null → exempt → default to 24
  if (bases.length === 0) {
    return {
      dpField: DP_FIELD_MAP.OUTROS_BENS,
      confident: true,
      requiresReview: false,
      reason: 'Todas as bases IVA sao 0/nulas (isento) — Campo 24 por defeito',
    };
  }

  // Pick the dominant (largest) base
  const dominant = bases.reduce((max, b) => (b.value > max.value ? b : max), bases[0]);

  return {
    dpField: dominant.dp,
    confident: !mixedIva,
    requiresReview: mixedIva,
    reason: mixedIva
      ? `Campo ${dominant.dp} sugerido pela base dominante (${dominant.label}), mas factura tem bases IVA mistas — requer revisao`
      : `Campo ${dominant.dp} pela base dominante (${dominant.label})`,
  };
}

/**
 * Known supplier patterns for automatic classification
 */
const KNOWN_SUPPLIERS: Record<string, Partial<ClassificationResult>> = {
  // Utilities - Campo 24
  '503504564': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 100, reason: 'EDP - Electricidade' },
  '503423971': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 100, reason: 'NOS - Telecomunicações' },
  '501532927': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 100, reason: 'MEO - Telecomunicações' },
  '501525480': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 100, reason: 'Vodafone - Telecomunicações' },
  '500091241': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 100, reason: 'EPAL - Água' },
  
  // Fuel - 50% deduction for passenger cars
  '500220152': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 50, reason: 'GALP - Combustível (viatura ligeira)' },
  '503217580': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 50, reason: 'BP - Combustível (viatura ligeira)' },
  '500667820': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 50, reason: 'Repsol - Combustível (viatura ligeira)' },
  '502088378': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 50, reason: 'Cepsa - Combustível (viatura ligeira)' },
  
  // Supermarkets - needs review
  '500100144': { classification: 'ACTIVIDADE', dpField: null, deductibility: 0, reason: 'Continente - Validação manual', requiresReview: true },
  '500273170': { classification: 'ACTIVIDADE', dpField: null, deductibility: 0, reason: 'Pingo Doce - Validação manual', requiresReview: true },
  '501659300': { classification: 'ACTIVIDADE', dpField: null, deductibility: 0, reason: 'Lidl - Validação manual', requiresReview: true },
  '502011475': { classification: 'ACTIVIDADE', dpField: null, deductibility: 0, reason: 'Auchan - Validação manual', requiresReview: true },
  
  // Office supplies
  '500699654': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 100, reason: 'Staples - Material escritório' },
  '500699662': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 100, reason: 'Office Centre - Material escritório' },
  
  // Software/Tech
  '513755490': { classification: 'ACTIVIDADE', dpField: 24, deductibility: 100, reason: 'Software/Serviços digitais' },
  
  // Restaurants - usually not deductible unless hospitality business
  '999999990': { classification: 'PESSOAL', dpField: null, deductibility: 0, reason: 'Consumidor final - sem NIF' },
};

/**
 * CAE-based inference for expense classification
 */
const CAE_CONTEXTS: Record<string, { sectors: string[], deductibleCategories: string[] }> = {
  // Restaurants & cafes
  '56': { sectors: ['Restauração'], deductibleCategories: ['alimentar', 'bebidas', 'equipamento'] },
  '561': { sectors: ['Restaurantes'], deductibleCategories: ['alimentar', 'bebidas', 'equipamento'] },
  '563': { sectors: ['Cafés'], deductibleCategories: ['alimentar', 'bebidas', 'equipamento'] },
  
  // Retail
  '47': { sectors: ['Comércio'], deductibleCategories: ['mercadoria', 'equipamento'] },
  
  // Professional services
  '69': { sectors: ['Contabilidade/Jurídico'], deductibleCategories: ['material escritório', 'software', 'formação'] },
  '70': { sectors: ['Consultoria'], deductibleCategories: ['material escritório', 'software', 'viagens'] },
  '71': { sectors: ['Arquitectura/Engenharia'], deductibleCategories: ['material escritório', 'software', 'equipamento'] },
  
  // IT
  '62': { sectors: ['Programação'], deductibleCategories: ['software', 'hardware', 'cloud', 'formação'] },
  '63': { sectors: ['Serviços TI'], deductibleCategories: ['software', 'hardware', 'cloud', 'formação'] },
  
  // Transport
  '49': { sectors: ['Transporte'], deductibleCategories: ['combustível', 'manutenção', 'portagens'] },
};

/**
 * Classify an expense based on rules and context
 */
export async function classifyExpense(input: ClassificationInput): Promise<ClassificationResult> {
  const { supplierNif, supplierName, valorTotal, valorIva, clientId, clientCae } = input;
  
  // 1. Check in-memory known suppliers first (fastest)
  if (KNOWN_SUPPLIERS[supplierNif]) {
    const rule = KNOWN_SUPPLIERS[supplierNif];
    return {
      classification: rule.classification || 'ACTIVIDADE',
      dpField: rule.dpField ?? 24,
      deductibility: rule.deductibility ?? 100,
      confidence: 95,
      source: 'global_rule',
      reason: rule.reason || 'Regra global',
      requiresReview: rule.requiresReview || false,
    };
  }
  
  // 2. Query database for classification rules
  try {
    const { data: dbRules } = await supabase
      .from('classification_rules')
      .select('*')
      .or(`supplier_nif.eq.${supplierNif},is_global.eq.true`)
      .order('is_global', { ascending: true }) // Client rules first
      .limit(5);
    
    if (dbRules && dbRules.length > 0) {
      // Prefer client-specific rule
      const rule = dbRules.find(r => r.client_id === clientId) || dbRules[0];
      
      // Update usage count
      await supabase
        .from('classification_rules')
        .update({ 
          usage_count: (rule.usage_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', rule.id);
      
      return {
        classification: rule.classification as Classification,
        dpField: rule.dp_field,
        deductibility: rule.deductibility ?? 100,
        confidence: rule.confidence ?? 80,
        source: rule.is_global ? 'global_rule' : 'client_history',
        reason: rule.notes || `Regra: ${rule.supplier_name_pattern || rule.supplier_nif}`,
        requiresReview: rule.requires_review || false,
        matchedRule: {
          id: rule.id,
          supplierNif: rule.supplier_nif,
          notes: rule.notes || undefined,
        },
      };
    }
  } catch (error) {
    console.warn('[classificationRules] Database query failed:', error);
  }
  
  // 3. CAE-based inference
  if (clientCae) {
    const caePrefix = clientCae.substring(0, 2);
    const caeContext = CAE_CONTEXTS[caePrefix] || CAE_CONTEXTS[clientCae.substring(0, 3)];
    
    if (caeContext) {
      // Check if supplier name matches any deductible categories
      const nameLower = supplierName.toLowerCase();
      const isLikelyDeductible = caeContext.deductibleCategories.some(cat => 
        nameLower.includes(cat)
      );
      
      if (isLikelyDeductible) {
        return {
          classification: 'ACTIVIDADE',
          dpField: valorTotal > 1000 ? 20 : 24, // Imobilizado se >1000€
          deductibility: 100,
          confidence: 60,
          source: 'cae_inference',
          reason: `Inferência por CAE ${clientCae} (${caeContext.sectors.join(', ')})`,
          requiresReview: true,
        };
      }
    }
  }
  
  // 4. Value-based heuristics
  if (valorTotal > 1000) {
    return {
      classification: 'ACTIVIDADE',
      dpField: 20, // Imobilizado
      deductibility: 100,
      confidence: 50,
      source: 'default',
      reason: 'Valor elevado - possível imobilizado (Campo 20)',
      requiresReview: true,
    };
  }
  
  // 5. Default classification - needs review
  return {
    classification: 'ACTIVIDADE',
    dpField: 24, // Outros bens e serviços
    deductibility: 100,
    confidence: 30,
    source: 'default',
    reason: 'Classificação por defeito - requer validação manual',
    requiresReview: true,
  };
}

/**
 * Bulk classify multiple expenses
 */
export async function classifyExpenses(
  inputs: ClassificationInput[]
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();
  
  // Process in parallel batches
  const batchSize = 10;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(input => classifyExpense(input))
    );
    
    batch.forEach((input, idx) => {
      results.set(input.supplierNif, batchResults[idx]);
    });
  }
  
  return results;
}

/**
 * Save a classification decision as a new rule
 */
export async function saveClassificationRule(
  supplierNif: string,
  supplierName: string,
  classification: Classification,
  dpField: number | null,
  deductibility: number,
  clientId: string,
  notes?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('classification_rules')
      .upsert({
        supplier_nif: supplierNif,
        supplier_name_pattern: `${supplierName}%`,
        classification,
        dp_field: dpField,
        deductibility,
        confidence: 90, // User-validated
        client_id: clientId,
        is_global: false,
        requires_review: false,
        notes,
        created_by: clientId,
      }, {
        onConflict: 'supplier_nif,client_id'
      });
    
    return !error;
  } catch (error) {
    console.error('[classificationRules] Failed to save rule:', error);
    return false;
  }
}

/**
 * Get classification statistics for a client
 */
export async function getClassificationStats(clientId: string): Promise<{
  totalRules: number;
  autoClassified: number;
  needsReview: number;
}> {
  try {
    const { data: rules, count } = await supabase
      .from('classification_rules')
      .select('*', { count: 'exact' })
      .or(`client_id.eq.${clientId},is_global.eq.true`);
    
    const needsReview = rules?.filter(r => r.requires_review).length || 0;
    
    return {
      totalRules: count || 0,
      autoClassified: (count || 0) - needsReview,
      needsReview,
    };
  } catch (error) {
    return { totalRules: 0, autoClassified: 0, needsReview: 0 };
  }
}
