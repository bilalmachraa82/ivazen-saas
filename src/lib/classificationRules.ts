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
