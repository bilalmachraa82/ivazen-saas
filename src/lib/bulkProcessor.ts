/**
 * Bulk Document Processor for Modelo 10
 * Processes multiple tax withholding documents in parallel with rate limiting
 */

import { supabase } from '@/integrations/supabase/client';
import { validatePortugueseNIF } from './nifValidator';

export const BULK_CONFIG = {
  MAX_CONCURRENT: 5,        // Max 5 docs processing simultaneously (optimized for throughput)
  MAX_RETRIES: 3,           // Retry up to 3 times if failed
  RETRY_DELAY_MS: 1000,     // 1s between retries (exponential backoff: 1s, 2s, 4s)
  BATCH_DELAY_MS: 500,      // 500ms delay between batches to avoid rate limiting
};

export interface QueueItem {
  id: string;
  file: File;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  extractedData?: WithholdingFormData;
  confidence?: number;
  warnings?: string[];
  error?: string;
}

export interface WithholdingFormData {
  fiscal_year: number;
  beneficiary_nif: string;
  beneficiary_name?: string;
  beneficiary_address?: string;
  income_category: 'A' | 'B' | 'E' | 'F' | 'G' | 'H' | 'R';
  income_code?: string;
  location_code: 'C' | 'RA' | 'RM';
  gross_amount: number;
  exempt_amount?: number;
  dispensed_amount?: number;
  withholding_rate?: number;
  withholding_amount: number;
  payment_date: string;
  document_reference?: string;
  is_non_resident?: boolean;
  country_code?: string;
  notes?: string;
}

/**
 * Main function: Process multiple documents in bulk
 * Now accepts QueueItem[] to preserve original IDs from the upload queue
 */
export async function processBulkDocuments(
  items: QueueItem[],
  fiscalYear: number,
  onProgress: (id: string, item: QueueItem) => void
): Promise<QueueItem[]> {
  const results: QueueItem[] = [];

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < items.length; i += BULK_CONFIG.MAX_CONCURRENT) {
    const batch = items.slice(i, i + BULK_CONFIG.MAX_CONCURRENT);

    const batchResults = await Promise.all(
      batch.map(item => processDocument(item, fiscalYear, onProgress))
    );

    results.push(...batchResults);

    // Add delay between batches to avoid rate limiting (except for last batch)
    if (i + BULK_CONFIG.MAX_CONCURRENT < items.length) {
      await delay(BULK_CONFIG.BATCH_DELAY_MS);
    }
  }

  return results;
}

/**
 * Process a single document with retry logic
 */
async function processDocument(
  item: QueueItem,
  fiscalYear: number,
  onProgress: (id: string, item: QueueItem) => void
): Promise<QueueItem> {
  let retries = 0;

  while (retries <= BULK_CONFIG.MAX_RETRIES) {
    try {
      // Update status to processing
      onProgress(item.id, { ...item, status: 'processing', progress: 30 });

      // Convert file to base64
      const base64 = await fileToBase64(item.file);

      onProgress(item.id, { ...item, status: 'processing', progress: 50 });

      // Extract data using existing edge function
      const response = await supabase.functions.invoke('extract-withholding', {
        body: {
          fileData: base64,
          mimeType: item.file.type
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Extraction failed');
      }

      const extracted = response.data?.data;

      if (!extracted) {
        throw new Error('No data extracted from document');
      }

      // Add fiscal_year and set defaults
      const completeData: WithholdingFormData = {
        fiscal_year: fiscalYear,
        location_code: extracted.location_code || 'C', // Default to Continental if not specified
        ...extracted,
      };

      onProgress(item.id, { ...item, status: 'processing', progress: 80 });

      // Calculate confidence score
      const { confidence, warnings } = calculateConfidence(completeData);

      // Mark as completed
      const completedItem: QueueItem = {
        ...item,
        status: 'completed',
        progress: 100,
        extractedData: completeData,
        confidence,
        warnings,
      };

      onProgress(item.id, completedItem);
      return completedItem;

    } catch (error: any) {
      retries++;

      if (retries > BULK_CONFIG.MAX_RETRIES) {
        // Final failure after all retries
        const errorItem: QueueItem = {
          ...item,
          status: 'error',
          progress: 0,
          error: error.message || 'Processing failed'
        };
        onProgress(item.id, errorItem);
        return errorItem;
      }

      // Wait before retry (exponential backoff: 2s, 4s)
      await delay(BULK_CONFIG.RETRY_DELAY_MS * Math.pow(2, retries - 1));

      // Update progress to show retry
      onProgress(item.id, {
        ...item,
        status: 'processing',
        progress: 20,
        warnings: [`Tentativa ${retries + 1}/${BULK_CONFIG.MAX_RETRIES + 1}`]
      });
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error('Unexpected error in processDocument');
}

/**
 * Calculate confidence score based on extracted data quality
 */
function calculateConfidence(data: any): { confidence: number; warnings: string[] } {
  let confidence = 1.0;
  const warnings: string[] = [];

  // CRITICAL validations (block if failed)

  // 1. NIF validation
  if (!data.beneficiary_nif) {
    confidence = 0;
    warnings.push('❌ NIF não encontrado');
    return { confidence, warnings };
  }

  const nifCheck = validatePortugueseNIF(data.beneficiary_nif);
  if (!nifCheck.valid) {
    confidence = 0;
    warnings.push('❌ NIF inválido (dígito de controlo)');
    return { confidence, warnings };
  }

  // 2. Gross amount validation
  if (!data.gross_amount || data.gross_amount <= 0) {
    confidence = 0;
    warnings.push('❌ Valor bruto inválido ou não encontrado');
    return { confidence, warnings };
  }

  // 3. Withholding must not exceed gross amount
  if (data.withholding_amount && data.withholding_amount > data.gross_amount) {
    confidence = 0;
    warnings.push('❌ Retenção maior que valor bruto');
    return { confidence, warnings };
  }

  // INFORMATIVE validations (reduce confidence but don't block)

  // 4. Beneficiary name
  if (!data.beneficiary_name || data.beneficiary_name.trim().length < 3) {
    confidence *= 0.95;
    warnings.push('⚠️ Nome do beneficiário não encontrado ou muito curto');
  }

  // 5. Payment date
  if (!data.payment_date) {
    confidence *= 0.90;
    warnings.push('⚠️ Data de pagamento não encontrada');
  } else {
    // Validate date is reasonable (between 2020 and 2027)
    const paymentYear = new Date(data.payment_date).getFullYear();
    if (paymentYear < 2020 || paymentYear > 2027) {
      confidence *= 0.85;
      warnings.push('⚠️ Data de pagamento parece incorreta');
    }
  }

  // 6. Income category
  const validCategories = ['A', 'B', 'E', 'F', 'G', 'H', 'R'];
  if (!data.income_category || !validCategories.includes(data.income_category)) {
    confidence *= 0.88;
    warnings.push('⚠️ Categoria de rendimento não identificada ou inválida');
  }

  // 7. Withholding rate warning (INFORMATIVE ONLY - does NOT block)
  if (data.gross_amount > 0 && data.withholding_amount > 0) {
    const calculatedRate = (data.withholding_amount / data.gross_amount) * 100;

    // Only warn if rate seems VERY wrong (not a standard rate)
    // Standard rates: 23%, 25%, 20%, 16.5%, 11.5%
    // We allow 0% (exempt) and don't validate exact match
    if (calculatedRate < 5) {
      confidence *= 0.95;
      warnings.push(`⚠️ Taxa calculada ${calculatedRate.toFixed(1)}% parece baixa (mas pode ser válida)`);
    } else if (calculatedRate > 35) {
      confidence *= 0.92;
      warnings.push(`⚠️ Taxa calculada ${calculatedRate.toFixed(1)}% parece alta (verificar)`);
    } else if (calculatedRate > 5 && calculatedRate < 35) {
      // Rate seems reasonable, check if it's close to known rates
      const knownRates = [11.5, 16.5, 20, 23, 25, 28];
      const closestRate = knownRates.find(rate => Math.abs(calculatedRate - rate) < 2);

      if (!closestRate) {
        // Not close to any known rate, but not blocking
        confidence *= 0.93;
        warnings.push(`⚠️ Taxa calculada ${calculatedRate.toFixed(1)}% não corresponde a taxas comuns (mas pode ser válida)`);
      }
    }
  } else if (data.gross_amount > 0 && (!data.withholding_amount || data.withholding_amount === 0)) {
    // No withholding - could be exempt (valid)
    warnings.push('ℹ️ Sem retenção (pode ser isento)');
  }

  // 8. Document reference
  if (!data.document_reference) {
    confidence *= 0.98; // Minor reduction
    // Don't add warning - not critical
  }

  return { confidence, warnings };
}

/**
 * Convert file to base64 string
 * Includes cleanup to prevent memory leaks with multiple files
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    const cleanup = () => {
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
    };

    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      cleanup();
      resolve(base64);
    };

    reader.onerror = (error) => {
      cleanup();
      reject(error);
    };

    reader.onabort = () => {
      cleanup();
      reject(new Error('File reading aborted'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Delay utility for retry backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get confidence status label
 */
export function getConfidenceStatus(confidence: number): {
  label: string;
  color: 'green' | 'yellow' | 'red';
  icon: string;
} {
  if (confidence >= 0.95) {
    return { label: 'Auto-aprovado', color: 'green', icon: '✓' };
  } else if (confidence >= 0.80) {
    return { label: 'Precisa revisão', color: 'yellow', icon: '⚠' };
  } else {
    return { label: 'Falhou', color: 'red', icon: '✗' };
  }
}
