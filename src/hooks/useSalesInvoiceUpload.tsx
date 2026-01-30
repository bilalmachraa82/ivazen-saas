import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { toast } from 'sonner';
import { useDuplicateCheck, DuplicateCheckResult } from './useDuplicateCheck';

interface ParsedSalesInvoice {
  supplier_nif: string; // Our NIF (the seller)
  customer_nif: string | null;
  customer_name?: string | null;
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

interface UploadResult {
  success: boolean;
  invoiceId?: string;
  error?: string;
  isDuplicate?: boolean;
  duplicateInfo?: DuplicateCheckResult;
  extractedData?: ParsedSalesInvoice;
}

interface UseSalesInvoiceUploadOptions {
  forClientId?: string | null;
}

export function useSalesInvoiceUpload(options: UseSalesInvoiceUploadOptions = {}) {
  const { forClientId } = options;
  const { user } = useAuth();
  const { profile } = useProfile();
  const { checkSalesDuplicate, isChecking: isCheckingDuplicate } = useDuplicateCheck();
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);

  // Use forClientId if provided (for accountants), otherwise use current user
  const effectiveClientId = forClientId || user?.id;

  // Log for debugging client association issues
  console.log('[useSalesInvoiceUpload] forClientId:', forClientId, '| user?.id:', user?.id, '| effectiveClientId:', effectiveClientId);

  // Classify sales invoice by revenue category
  const classifySalesCategory = async (invoiceId: string): Promise<void> => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-sales-category', {
        body: { invoice_id: invoiceId }
      });

      if (error) {
        console.error('Classify sales category error:', error);
        // Don't show error toast - classification is optional
        return;
      }

      if (data?.success) {
        console.log('Sales invoice categorized:', data.category);
      }
    } catch (error) {
      console.error('Classify sales category exception:', error);
    } finally {
      setIsClassifying(false);
    }
  };

  const parseQRCode = async (qrContent: string): Promise<ParsedSalesInvoice | null> => {
    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-qr', {
        body: { qr_content: qrContent }
      });

      if (error) {
        console.error('Parse QR error:', error);
        toast.error('Erro ao processar QR code');
        return null;
      }

      if (!data.success) {
        toast.error(data.error || 'QR code inválido');
        return null;
      }

      return data.data as ParsedSalesInvoice;
    } catch (error) {
      console.error('Parse QR exception:', error);
      toast.error('Erro de comunicação com o servidor');
      return null;
    } finally {
      setIsParsing(false);
    }
  };

  const uploadImage = async (file: File | Blob, fileName: string): Promise<string | null> => {
    if (!user) {
      toast.error('Utilizador não autenticado');
      return null;
    }

    if (!effectiveClientId) {
      toast.error('Cliente não definido');
      return null;
    }

    setIsUploading(true);
    try {
      // Use effectiveClientId for path - allows accountants to upload to client folders
      const filePath = `${effectiveClientId}/sales/${Date.now()}_${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Erro ao carregar imagem');
        return null;
      }

      return filePath;
    } catch (error) {
      console.error('Upload exception:', error);
      toast.error('Erro ao carregar imagem');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const createSalesInvoice = async (
    parsedData: ParsedSalesInvoice, 
    imagePath: string
  ): Promise<UploadResult> => {
    console.log('[createSalesInvoice] Creating sales invoice with client_id:', effectiveClientId);
    
    if (!effectiveClientId) {
      console.error('[createSalesInvoice] ERRO: effectiveClientId é undefined');
      return { success: false, error: 'Cliente não definido' };
    }

    try {
      const { data, error } = await supabase
        .from('sales_invoices')
        .insert({
          client_id: effectiveClientId,
          image_path: imagePath,
          supplier_nif: parsedData.supplier_nif, // Our NIF
          customer_nif: parsedData.customer_nif,
          customer_name: parsedData.customer_name,
          document_type: parsedData.document_type,
          document_date: parsedData.document_date,
          document_number: parsedData.document_number,
          atcud: parsedData.atcud,
          base_reduced: parsedData.base_reduced,
          vat_reduced: parsedData.vat_reduced,
          base_intermediate: parsedData.base_intermediate,
          vat_intermediate: parsedData.vat_intermediate,
          base_standard: parsedData.base_standard,
          vat_standard: parsedData.vat_standard,
          base_exempt: parsedData.base_exempt,
          total_vat: parsedData.total_vat,
          total_amount: parsedData.total_amount,
          fiscal_region: parsedData.fiscal_region,
          fiscal_period: parsedData.fiscal_period,
          qr_raw: parsedData.qr_raw || null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        console.error('Insert sales invoice error:', error);
        return { success: false, error: 'Erro ao guardar factura de venda' };
      }

      return { success: true, invoiceId: data.id };
    } catch (error) {
      console.error('Create sales invoice exception:', error);
      return { success: false, error: 'Erro ao guardar factura de venda' };
    }
  };

  // Extract invoice data using AI vision (for PDFs or when QR not detected)
  const extractSalesInvoiceData = async (file: File): Promise<ParsedSalesInvoice | null> => {
    if (!user) {
      toast.error('Utilizador não autenticado');
      return null;
    }

    setIsExtracting(true);
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('extract-invoice-data', {
        body: { 
          fileData: base64, 
          mimeType: file.type,
          userId: user.id 
        }
      });

      if (error) {
        console.error('Extract invoice data error:', error);
        toast.error('Erro ao extrair dados da factura');
        return null;
      }

      if (!data.success) {
        toast.error(data.error || 'Não foi possível extrair dados da factura');
        return null;
      }

      const extracted = data.data;
      
      return {
        supplier_nif: extracted.supplier_nif,
        customer_nif: extracted.customer_nif || null,
        customer_name: extracted.customer_name,
        document_type: extracted.document_type || null,
        document_date: extracted.document_date,
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
        fiscal_period: extracted.fiscal_period || new Date().toISOString().slice(0, 7).replace('-', ''),
        qr_raw: extracted.qr_content || undefined,
      } as ParsedSalesInvoice;

    } catch (error) {
      console.error('Extract invoice data exception:', error);
      toast.error('Erro de comunicação com o servidor');
      return null;
    } finally {
      setIsExtracting(false);
    }
  };

  // Process sales invoice with QR code
  const processSalesInvoice = async (
    imageFile: File | Blob,
    qrContent: string,
    fileName: string = 'sales_invoice.jpg',
    skipDuplicateCheck: boolean = false
  ): Promise<UploadResult> => {
    // Step 1: Parse QR code
    const parsedData = await parseQRCode(qrContent);
    if (!parsedData) {
      return { success: false, error: 'Falha ao processar QR code' };
    }

    // Step 1.5: Check for duplicates (unless skipped)
    if (!skipDuplicateCheck) {
      const duplicateCheck = await checkSalesDuplicate({
        supplier_nif: parsedData.supplier_nif,
        document_number: parsedData.document_number,
        document_date: parsedData.document_date,
        atcud: parsedData.atcud,
      });

      if (duplicateCheck.isDuplicate) {
        toast.error(`Factura de venda duplicada: ${duplicateCheck.reason}`);
        return { 
          success: false, 
          error: duplicateCheck.reason,
          isDuplicate: true,
          duplicateInfo: duplicateCheck,
        };
      }
    }

    // Step 2: Upload image
    const imagePath = await uploadImage(imageFile, fileName);
    if (!imagePath) {
      return { success: false, error: 'Falha ao carregar imagem' };
    }

    // Step 3: Create sales invoice record
    const result = await createSalesInvoice(parsedData, imagePath);
    
    if (result.success && result.invoiceId) {
      // Step 4: Classify sales category (async, non-blocking)
      classifySalesCategory(result.invoiceId);
      toast.success('Factura de venda guardada com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao processar factura de venda');
    }

    return result;
  };

  // Process sales invoice without QR code (using AI extraction)
  // If validateOnly is true, returns extracted data without saving (for mismatch validation)
  const processSalesInvoiceWithAI = async (
    file: File,
    fileName?: string,
    skipDuplicateCheck: boolean = false,
    validateOnly: boolean = false
  ): Promise<UploadResult> => {
    // Step 1: Extract data using AI
    const extractedData = await extractSalesInvoiceData(file);
    if (!extractedData) {
      return { success: false, error: 'Falha ao extrair dados da factura' };
    }

    // If validateOnly, return extracted data for mismatch check
    if (validateOnly) {
      return { success: true, extractedData };
    }

    // Step 1.5: Check for duplicates (unless skipped)
    if (!skipDuplicateCheck) {
      const duplicateCheck = await checkSalesDuplicate({
        supplier_nif: extractedData.supplier_nif,
        document_number: extractedData.document_number,
        document_date: extractedData.document_date,
        atcud: extractedData.atcud,
      });

      if (duplicateCheck.isDuplicate) {
        toast.error(`Factura de venda duplicada: ${duplicateCheck.reason}`);
        return { 
          success: false, 
          error: duplicateCheck.reason,
          isDuplicate: true,
          duplicateInfo: duplicateCheck,
          extractedData,
        };
      }
    }

    // Step 2: Upload file
    const imagePath = await uploadImage(file, fileName || file.name);
    if (!imagePath) {
      return { success: false, error: 'Falha ao carregar ficheiro', extractedData };
    }

    // Step 3: Create sales invoice record
    const result = await createSalesInvoice(extractedData, imagePath);
    
    if (result.success && result.invoiceId) {
      // Step 4: Classify sales category (async, non-blocking)
      classifySalesCategory(result.invoiceId);
      toast.success('Factura de venda extraída e guardada!');
    } else {
      toast.error(result.error || 'Erro ao processar factura de venda');
    }

    return { ...result, extractedData };
  };

  return {
    isUploading,
    isParsing,
    isExtracting,
    isClassifying,
    isCheckingDuplicate,
    isProcessing: isUploading || isParsing || isExtracting || isCheckingDuplicate,
    parseQRCode,
    uploadImage,
    createSalesInvoice,
    processSalesInvoice,
    processSalesInvoiceWithAI,
    extractSalesInvoiceData,
    classifySalesCategory,
  };
}
