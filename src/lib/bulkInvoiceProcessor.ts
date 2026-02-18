/**
 * Bulk Invoice Processor
 * Processes multiple purchase/sales invoices in parallel with rate limiting
 * Based on the Modelo 10 bulk processor pattern
 */

import { supabase } from '@/integrations/supabase/client';
import { validatePortugueseNIF } from './nifValidator';
import { detectMimeType } from './mime';
import { isTemporarySupplierTaxId, normalizeSupplierTaxId, normalizeSupplierVatId } from './taxId';
import { deriveFiscalPeriodFromDocumentDate, normalizeDocumentDate } from './fiscalPeriod';

export const BULK_INVOICE_CONFIG = {
  MAX_CONCURRENT: 2,        // Max 2 docs simultaneously (prevents auth token exhaustion)
  MAX_RETRIES: 3,           // Retry up to 3 times if failed
  RETRY_DELAY_MS: 2000,     // 2s between retries (exponential backoff)
  BATCH_DELAY_MS: 1000,     // 1s delay between batches
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB max per file
  MAX_FILES_PER_BATCH: 100,
};

export interface InvoiceQueueItem {
  id: string;
  file: File;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  extractedData?: ExtractedInvoiceData;
  confidence?: number;
  warnings?: string[];
  error?: string;
  invoiceId?: string; // Database ID after save
  invoiceType: 'purchase' | 'sales';
}

export interface ExtractedInvoiceData {
  supplier_nif: string;
  supplier_vat_id?: string | null;
  supplier_name?: string | null;
  customer_nif: string | null;
  customer_name?: string | null; // For sales invoices
  document_type: string | null;
  document_date: string;
  document_number: string | null;
  atcud: string | null;
  base_reduced: number | null;
  vat_reduced: number | null;
  base_intermediate: number | null;
  vat_intermediate: number | null;
  base_standard: number | null;
  vat_standard: number | null;
  base_exempt: number | null;
  total_vat: number | null;
  total_amount: number;
  fiscal_region: string;
  fiscal_period: string;
  qr_raw?: string;
}

/**
 * Main function: Process multiple invoices in bulk
 */
export async function processBulkInvoices(
  items: InvoiceQueueItem[],
  clientId: string,
  onProgress: (id: string, item: InvoiceQueueItem) => void,
  options: { saveToDatabase?: boolean } = { saveToDatabase: true }
): Promise<InvoiceQueueItem[]> {
  const results: InvoiceQueueItem[] = [];

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < items.length; i += BULK_INVOICE_CONFIG.MAX_CONCURRENT) {
    const batch = items.slice(i, i + BULK_INVOICE_CONFIG.MAX_CONCURRENT);

    // Refresh auth session before each batch to prevent token expiration
    try {
      await supabase.auth.refreshSession();
      console.log(`[BulkProcessor] Batch ${Math.floor(i / BULK_INVOICE_CONFIG.MAX_CONCURRENT) + 1}: session refreshed, processing ${batch.length} files`);
    } catch (refreshErr) {
      console.warn('[BulkProcessor] Session refresh failed, continuing:', refreshErr);
    }

    const batchResults = await Promise.all(
      batch.map(item => processInvoiceDocument(item, clientId, onProgress, options))
    );

    results.push(...batchResults);

    // Add delay between batches to avoid rate limiting (except for last batch)
    if (i + BULK_INVOICE_CONFIG.MAX_CONCURRENT < items.length) {
      await delay(BULK_INVOICE_CONFIG.BATCH_DELAY_MS);
    }
  }

  return results;
}

/**
 * Process a single invoice document with retry logic
 */
async function processInvoiceDocument(
  item: InvoiceQueueItem,
  clientId: string,
  onProgress: (id: string, item: InvoiceQueueItem) => void,
  options: { saveToDatabase?: boolean }
): Promise<InvoiceQueueItem> {
  let retries = 0;

  while (retries <= BULK_INVOICE_CONFIG.MAX_RETRIES) {
    try {
      // Update status to processing
      onProgress(item.id, { ...item, status: 'processing', progress: 20 });

      // Convert file to base64 (with fallback and validation)
      const base64 = await fileToBase64(item.file);

      // Validate base64 is not empty
      const base64Content = base64.replace(/^data:[^;]+;base64,/, '');
      if (!base64Content || base64Content.length < 100) {
        throw new Error(`Ficheiro vazio após conversão: ${item.fileName} (${item.file.size} bytes)`);
      }

      // Detect correct MIME type (file.type can be empty)
      const mimeType = detectMimeType(item.file);
      console.log(`[BulkProcessor] Processing ${item.fileName}: ${Math.round(item.file.size/1024)}KB, mime=${mimeType}, base64=${Math.round(base64Content.length/1024)}KB`);

      onProgress(item.id, { ...item, status: 'processing', progress: 40 });

      // Extract data using AI edge function
      const response = await supabase.functions.invoke('extract-invoice-data', {
        body: {
          fileData: base64,
          mimeType: mimeType,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Extraction failed');
      }

      const extracted = response.data?.data;

      if (!extracted) {
        throw new Error('No data extracted from document');
      }

      onProgress(item.id, { ...item, status: 'processing', progress: 60 });

      // Map to our format
      const invoiceData: ExtractedInvoiceData = {
        // Fiscal period is derived deterministically from issue date to avoid quarter misclassification.
        supplier_nif: normalizeSupplierTaxId({
          taxId: extracted.supplier_nif || extracted.supplier_vat_id,
          supplierName: extracted.supplier_name,
          documentNumber: extracted.document_number,
        }),
        supplier_vat_id: normalizeSupplierVatId(extracted.supplier_vat_id || extracted.supplier_nif),
        supplier_name: extracted.supplier_name,
        customer_nif: extracted.customer_nif || null,
        document_type: extracted.document_type || null,
        document_date: normalizeDocumentDate(extracted.document_date) || extracted.document_date,
        document_number: extracted.document_number || null,
        atcud: extracted.atcud || null,
        base_reduced: extracted.base_reduced || null,
        vat_reduced: extracted.vat_reduced || null,
        base_intermediate: extracted.base_intermediate || null,
        vat_intermediate: extracted.vat_intermediate || null,
        base_standard: extracted.base_standard || null,
        vat_standard: extracted.vat_standard || null,
        base_exempt: extracted.base_exempt || null,
        total_vat: extracted.total_vat || null,
        total_amount: extracted.total_amount,
        fiscal_region: extracted.fiscal_region || 'PT',
        fiscal_period:
          deriveFiscalPeriodFromDocumentDate(normalizeDocumentDate(extracted.document_date) || extracted.document_date) ||
          extracted.fiscal_period ||
          new Date().toISOString().slice(0, 7).replace('-', ''),
        qr_raw: extracted.qr_content || undefined,
      };

      onProgress(item.id, { ...item, status: 'processing', progress: 70 });

      // Calculate confidence score
      const { confidence, warnings } = calculateInvoiceConfidence(invoiceData);

      let invoiceId: string | undefined;

      // Save to database if requested and extraction has minimal required fields.
      // We do not block saving solely because supplier tax id is missing/foreign.
      if (options.saveToDatabase && confidence > 0) {
        onProgress(item.id, { ...item, status: 'processing', progress: 80 });

        // Upload file to storage
        const filePath = await uploadInvoiceFile(item.file, clientId, item.invoiceType);

        if (filePath) {
          onProgress(item.id, { ...item, status: 'processing', progress: 90 });

          // Insert into database
          const dbResult = await saveInvoiceToDatabase(invoiceData, filePath, clientId, item.invoiceType);

          if (dbResult.success) {
            invoiceId = dbResult.invoiceId;

            // Trigger classification in background (for purchase invoices)
            if (item.invoiceType === 'purchase' && invoiceId) {
              supabase.functions.invoke('classify-invoice', {
                body: { invoice_id: invoiceId }
              }).catch(err => console.warn('Classification failed:', err));
            }
          } else {
            warnings.push(`Aviso: ${dbResult.error}`);
          }
        }
      }

      // Mark as completed
      const completedItem: InvoiceQueueItem = {
        ...item,
        status: 'completed',
        progress: 100,
        extractedData: invoiceData,
        confidence,
        warnings,
        invoiceId,
      };

      onProgress(item.id, completedItem);
      return completedItem;

    } catch (error: any) {
      retries++;

      if (retries > BULK_INVOICE_CONFIG.MAX_RETRIES) {
        // Final failure after all retries
        const errorItem: InvoiceQueueItem = {
          ...item,
          status: 'error',
          progress: 0,
          error: error.message || 'Processing failed'
        };
        onProgress(item.id, errorItem);
        return errorItem;
      }

      // Wait before retry (exponential backoff)
      await delay(BULK_INVOICE_CONFIG.RETRY_DELAY_MS * Math.pow(2, retries - 1));

      // Update progress to show retry
      onProgress(item.id, {
        ...item,
        status: 'processing',
        progress: 15,
        warnings: [`Tentativa ${retries + 1}/${BULK_INVOICE_CONFIG.MAX_RETRIES + 1}`]
      });
    }
  }

  // Should never reach here
  throw new Error('Unexpected error in processInvoiceDocument');
}

/**
 * Upload invoice file to Supabase Storage
 */
async function uploadInvoiceFile(
  file: File,
  clientId: string,
  invoiceType: 'purchase' | 'sales'
): Promise<string | null> {
  try {
    const subPath = invoiceType === 'sales' ? 'sales/' : '';
    const filePath = `${clientId}/${subPath}${Date.now()}_${file.name}`;

    const { error } = await supabase.storage
      .from('invoices')
      .upload(filePath, file, {
        // Some environments report PDFs as application/octet-stream. Always detect by extension fallback.
        contentType: detectMimeType(file),
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    return filePath;
  } catch (error) {
    console.error('Upload exception:', error);
    return null;
  }
}

/**
 * Save invoice to database
 */
export async function saveInvoiceToDatabase(
  data: ExtractedInvoiceData,
  imagePath: string,
  clientId: string,
  invoiceType: 'purchase' | 'sales'
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const table = invoiceType === 'sales' ? 'sales_invoices' : 'invoices';

    // Prevent duplicates in bulk upload flow (individual upload already checks duplicates).
    // Criteria (priority):
    // 1) ATCUD (when present)
    // 2) supplier_nif + document_number + document_date (when document_number present)
    try {
      const atcud = (data.atcud || '').trim();
      if (atcud) {
        const { data: existing, error: findError } = await supabase
          .from(table)
          .select('id')
          .eq('client_id', clientId)
          .eq('atcud', atcud)
          .limit(1);

        if (findError) {
          console.warn('[saveInvoiceToDatabase] ATCUD duplicate check error:', findError);
        } else if (existing && existing.length > 0) {
          return { success: true, invoiceId: existing[0].id };
        }
      }

      const docNum = (data.document_number || '').trim();
      if (docNum) {
        const { data: existing, error: findError } = await supabase
          .from(table)
          .select('id')
          .eq('client_id', clientId)
          .eq('supplier_nif', data.supplier_nif)
          .eq('document_number', docNum)
          .eq('document_date', data.document_date)
          .limit(1);

        if (findError) {
          console.warn('[saveInvoiceToDatabase] document duplicate check error:', findError);
        } else if (existing && existing.length > 0) {
          return { success: true, invoiceId: existing[0].id };
        }
      }
    } catch (dupErr) {
      console.warn('[saveInvoiceToDatabase] duplicate check exception:', dupErr);
    }

    // Base data common to both tables
    const baseData = {
      client_id: clientId,
      image_path: imagePath,
      supplier_nif: data.supplier_nif,
      ...(invoiceType === 'purchase' ? { supplier_vat_id: data.supplier_vat_id || null } : {}),
      customer_nif: data.customer_nif,
      document_type: data.document_type,
      document_date: data.document_date,
      document_number: data.document_number,
      atcud: data.atcud,
      base_reduced: data.base_reduced,
      vat_reduced: data.vat_reduced,
      base_intermediate: data.base_intermediate,
      vat_intermediate: data.vat_intermediate,
      base_standard: data.base_standard,
      vat_standard: data.vat_standard,
      base_exempt: data.base_exempt,
      total_vat: data.total_vat,
      total_amount: data.total_amount,
      fiscal_region: data.fiscal_region,
      fiscal_period: data.fiscal_period,
      qr_raw: data.qr_raw || null,
      status: 'pending',
    };

    // invoices table has supplier_name, sales_invoices has customer_name
    const insertData = invoiceType === 'sales'
      ? { ...baseData, customer_name: data.customer_name }
      : { ...baseData, supplier_name: data.supplier_name };

    let { data: result, error } = await supabase
      .from(table)
      .insert(insertData as any)
      .select('id')
      .single();

    // Backward compatible: if migration hasn't been applied yet, retry without supplier_vat_id.
    if (
      error &&
      invoiceType === 'purchase' &&
      /supplier_vat_id/i.test(error.message || '') &&
      /(does not exist|unknown|could not find)/i.test(error.message || '')
    ) {
      const fallback: any = { ...(insertData as any) };
      delete fallback.supplier_vat_id;

      ({ data: result, error } = await supabase
        .from(table)
        .insert(fallback)
        .select('id')
        .single());
    }

    if (error) {
      console.error('Insert error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invoiceId: result.id };
  } catch (error: any) {
    console.error('Save exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate confidence score based on extracted invoice data quality
 */
function calculateInvoiceConfidence(data: ExtractedInvoiceData): { confidence: number; warnings: string[] } {
  let confidence = 1.0;
  const warnings: string[] = [];

  // Supplier tax id (PT NIF or foreign VAT). We do not block saving solely on this.
  const supplierTaxId = (data.supplier_nif || '').trim();
  if (!supplierTaxId || isTemporarySupplierTaxId(supplierTaxId)) {
    confidence *= 0.75;
    warnings.push('NIF do fornecedor nao encontrado (guardada para revisao)');
  } else {
    const cleaned = supplierTaxId.replace(/\s/g, '');
    if (/^\d{9}$/.test(cleaned)) {
      const nifCheck = validatePortugueseNIF(cleaned);
      if (!nifCheck.valid) {
        confidence *= 0.65;
        warnings.push('NIF portugues parece invalido (possivel erro OCR)');
      }
    } else {
      confidence *= 0.85;
      warnings.push('Fornecedor estrangeiro (VAT nao PT) - confirmar dedutibilidade');
    }
  }

  // 2. Total amount validation
  if (!data.total_amount || data.total_amount <= 0) {
    confidence = 0;
    warnings.push('Valor total invalido ou nao encontrado');
    return { confidence, warnings };
  }

  // 3. Document date validation
  if (!data.document_date) {
    confidence = 0;
    warnings.push('Data do documento nao encontrada');
    return { confidence, warnings };
  }

  // INFORMATIVE validations (reduce confidence but don't block)

  // 4. Supplier name
  if (!data.supplier_name || data.supplier_name.trim().length < 3) {
    confidence *= 0.95;
    warnings.push('Nome do fornecedor nao encontrado ou muito curto');
  }

  // 5. Document number
  if (!data.document_number) {
    confidence *= 0.92;
    warnings.push('Numero do documento nao encontrado');
  }

  // 6. Customer NIF (for sales invoices this is important)
  if (!data.customer_nif) {
    confidence *= 0.97; // Minor reduction - not always present
  }

  // 7. Document date reasonableness
  const docDate = new Date(data.document_date);
  if (Number.isNaN(docDate.getTime())) {
    confidence *= 0.70;
    warnings.push('Data do documento inválida - confirmar período fiscal');
    return { confidence, warnings };
  }
  const docYear = docDate.getFullYear();
  const currentYear = new Date().getFullYear();
  if (docYear < 2020 || docYear > currentYear + 1) {
    confidence *= 0.85;
    warnings.push('Data do documento parece incorreta');
  }

  // 8. VAT totals consistency check
  const calculatedVat = (data.vat_reduced || 0) + (data.vat_intermediate || 0) + (data.vat_standard || 0);
  if (data.total_vat && calculatedVat > 0 && Math.abs(calculatedVat - data.total_vat) > 0.01) {
    confidence *= 0.90;
    warnings.push('Soma do IVA nao corresponde ao total');
  }

  // 9. ATCUD (Portuguese requirement since 2022)
  if (!data.atcud && docYear >= 2022) {
    confidence *= 0.95;
    warnings.push('ATCUD nao encontrado (obrigatorio desde 2022)');
  }

  return { confidence, warnings };
}

/**
 * Convert ArrayBuffer to base64 string (manual encoding)
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert file to base64 string with fallback and validation
 */
async function fileToBase64(file: File): Promise<string> {
  const mimeType = detectMimeType(file);

  // Primary method: readAsDataURL
  const result = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    const timeout = setTimeout(() => {
      reader.abort();
      reject(new Error('File reading timeout (30s)'));
    }, 30000);

    reader.onload = () => {
      clearTimeout(timeout);
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      clearTimeout(timeout);
      reject(reader.error || new Error('FileReader error'));
    };
    reader.onabort = () => {
      clearTimeout(timeout);
      reject(new Error('File reading aborted'));
    };
    reader.readAsDataURL(file);
  });

  // Validate: extract base64 portion and check length
  const base64Part = result.replace(/^data:[^;]+;base64,/, '');
  if (base64Part.length > 100) {
    console.log(`[fileToBase64] OK via readAsDataURL: file=${file.name} (${Math.round(file.size/1024)}KB), base64=${Math.round(base64Part.length/1024)}KB`);
    // Re-construct with correct MIME type
    return `data:${mimeType};base64,${base64Part}`;
  }

  // Fallback: readAsArrayBuffer + manual encoding
  console.warn(`[fileToBase64] readAsDataURL produced empty result for ${file.name}, trying ArrayBuffer fallback...`);

  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    const timeout = setTimeout(() => {
      reader.abort();
      reject(new Error('ArrayBuffer reading timeout (30s)'));
    }, 30000);

    reader.onload = () => {
      clearTimeout(timeout);
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => {
      clearTimeout(timeout);
      reject(reader.error || new Error('FileReader ArrayBuffer error'));
    };
    reader.readAsArrayBuffer(file);
  });

  const fallbackBase64 = arrayBufferToBase64(buffer);

  if (fallbackBase64.length < 100) {
    throw new Error(`Ficheiro vazio após conversão: ${file.name} (${file.size} bytes original, ${fallbackBase64.length} bytes base64)`);
  }

  console.log(`[fileToBase64] OK via ArrayBuffer fallback: file=${file.name} (${Math.round(file.size/1024)}KB), base64=${Math.round(fallbackBase64.length/1024)}KB`);
  return `data:${mimeType};base64,${fallbackBase64}`;
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
export function getInvoiceConfidenceStatus(confidence: number): {
  label: string;
  color: 'green' | 'yellow' | 'red';
  icon: string;
} {
  if (confidence >= 0.90) {
    return { label: 'Auto-aprovado', color: 'green', icon: '✓' };
  } else if (confidence >= 0.70) {
    return { label: 'Precisa revisao', color: 'yellow', icon: '⚠' };
  } else {
    return { label: 'Falhou', color: 'red', icon: '✗' };
  }
}

/**
 * Validate and prepare files for bulk upload
 */
export function validateBulkFiles(files: FileList | File[]): {
  valid: InvoiceQueueItem[];
  invalid: { file: File; reason: string }[];
} {
  const valid: InvoiceQueueItem[] = [];
  const invalid: { file: File; reason: string }[] = [];

  const fileArray = Array.from(files);

  if (fileArray.length > BULK_INVOICE_CONFIG.MAX_FILES_PER_BATCH) {
    // Take only first MAX_FILES_PER_BATCH files
    fileArray.splice(BULK_INVOICE_CONFIG.MAX_FILES_PER_BATCH);
  }

  console.log('[validateBulkFiles] Input:', fileArray.length, 'files');

  for (const file of fileArray) {
    // Check file size
    if (file.size > BULK_INVOICE_CONFIG.MAX_FILE_SIZE) {
      console.log('[validateBulkFiles] REJECTED (size):', file.name, 'size:', file.size);
      invalid.push({ file, reason: 'Ficheiro muito grande (max 10MB)' });
      continue;
    }

    // Check file type (some browsers/OS report empty file.type for valid PDFs)
    const mime = detectMimeType(file);
    const isPDF = mime === 'application/pdf';
    const isImage = mime.startsWith('image/');

    console.log('[validateBulkFiles] File:', file.name, 'size:', file.size, 'file.type:', JSON.stringify(file.type), 'detectedMime:', mime, 'isPDF:', isPDF, 'isImage:', isImage);

    if (!isPDF && !isImage) {
      console.log('[validateBulkFiles] REJECTED (type):', file.name, 'file.type:', JSON.stringify(file.type), 'detectedMime:', mime);
      invalid.push({ file, reason: `Tipo de ficheiro nao suportado (${file.type || 'sem tipo'} → ${mime})` });
      continue;
    }

    // Create queue item
    const item: InvoiceQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      fileName: file.name,
      status: 'pending',
      progress: 0,
      invoiceType: 'purchase', // Default, can be changed by user
    };

    valid.push(item);
  }

  return { valid, invalid };
}
