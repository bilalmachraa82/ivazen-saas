/**
 * Hook para importação de base de dados universal
 * Gere o estado, validação e inserção de dados
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  parseFile,
  detectDataType,
  autoMapColumns,
  validateAllRows,
  calculateSummary,
  generateTemplate,
  getDataTypeLabel,
  DataType,
  DuplicateStrategy,
  ColumnMapping,
  ValidationResult,
  ImportSummary,
} from '@/lib/universalImportParser';

export type ImportStep = 'upload' | 'mapping' | 'validation' | 'importing' | 'complete';

interface DuplicateInfo {
  row: number;
  existingId: string;
  existingData: Record<string, any>;
  importData: Record<string, any>;
  action: 'skip' | 'merge' | 'update';
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

export function useDatabaseImport() {
  const { user } = useAuth();
  
  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [dataType, setDataType] = useState<DataType>('unknown');
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('merge');
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // Reset state
  const reset = useCallback(() => {
    setStep('upload');
    setIsProcessing(false);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setDataType('unknown');
    setMapping([]);
    setValidationResults([]);
    setDuplicates([]);
    setSummary(null);
    setImportResult(null);
  }, []);
  
  // Handle file upload
  const handleFileUpload = useCallback(async (uploadedFile: File) => {
    setIsProcessing(true);
    setFile(uploadedFile);
    
    try {
      const { headers: parsedHeaders, rows: parsedRows } = await parseFile(uploadedFile);
      
      if (parsedRows.length === 0) {
        toast.error('O ficheiro não contém dados');
        setIsProcessing(false);
        return;
      }
      
      setHeaders(parsedHeaders);
      setRows(parsedRows);
      
      // Auto-detect data type
      const detectedType = detectDataType(parsedHeaders);
      setDataType(detectedType);
      
      // Auto-map columns
      const autoMapping = autoMapColumns(parsedHeaders, detectedType);
      setMapping(autoMapping);
      
      setStep('mapping');
      toast.success(`Ficheiro carregado: ${parsedRows.length} registos encontrados`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar ficheiro');
    } finally {
      setIsProcessing(false);
    }
  }, []);
  
  // Update column mapping
  const updateMapping = useCallback((sourceColumn: string, targetField: string) => {
    setMapping(prev => {
      // Remove existing mapping for this target field
      const filtered = prev.filter(m => m.targetField !== targetField);
      
      if (targetField === '') {
        // If target is empty, just remove the mapping
        return filtered.filter(m => m.sourceColumn !== sourceColumn);
      }
      
      // Add new mapping
      return [...filtered, {
        sourceColumn,
        targetField,
        autoDetected: false,
      }];
    });
  }, []);
  
  // Run validation
  const runValidation = useCallback(async () => {
    if (!user) {
      toast.error('Utilizador não autenticado');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Validate all rows
      const results = validateAllRows(rows, headers, mapping, dataType);
      setValidationResults(results);
      
      // Check for duplicates
      const validRecords = results.filter(r => r.valid && r.data);
      const duplicateInfos: DuplicateInfo[] = [];
      
      for (const result of validRecords) {
        if (!result.data) continue;
        
        const duplicate = await checkDuplicate(result.data, dataType, user.id);
        if (duplicate) {
          duplicateInfos.push({
            row: result.row,
            existingId: duplicate.id,
            existingData: duplicate.data,
            importData: result.data,
            action: duplicateStrategy,
          });
        }
      }
      
      setDuplicates(duplicateInfos);
      
      // Calculate summary
      const sum = calculateSummary(results, duplicateInfos.length);
      setSummary(sum);
      
      setStep('validation');
    } catch (error: any) {
      toast.error(error.message || 'Erro na validação');
    } finally {
      setIsProcessing(false);
    }
  }, [rows, headers, mapping, dataType, duplicateStrategy, user]);
  
  // Check for duplicate record
  const checkDuplicate = async (
    data: Record<string, any>,
    type: DataType,
    userId: string
  ): Promise<{ id: string; data: Record<string, any> } | null> => {
    try {
      if (type === 'clients') {
        if (!data.nif) return null;
        
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, full_name, company_name, email, nif')
          .eq('nif', data.nif)
          .neq('id', userId) // Exclude the accountant themselves
          .maybeSingle();
        
        if (existing) {
          // Check if already associated to this accountant
          const { data: association } = await supabase
            .from('client_accountants')
            .select('id')
            .eq('client_id', existing.id)
            .eq('accountant_id', userId)
            .maybeSingle();
          
          // If NOT associated, treat as non-duplicate so it goes through insertRecord
          // which will call create-client-direct and properly associate
          if (!association) {
            return null;
          }
          
          return { id: existing.id, data: existing };
        }
      }
      
      if (type === 'tax_withholdings') {
        const { data: existing } = await supabase
          .from('tax_withholdings')
          .select('id, beneficiary_nif, beneficiary_name, gross_amount, payment_date')
          .eq('beneficiary_nif', data.beneficiary_nif)
          .eq('fiscal_year', fiscalYear)
          .eq('client_id', userId);
        
        // Check for semantic duplicate (same date and similar amount)
        if (existing) {
          for (const record of existing) {
            if (
              record.payment_date === data.payment_date &&
              Math.abs((record.gross_amount || 0) - (data.gross_amount || 0)) < 1
            ) {
              return { id: record.id, data: record };
            }
          }
        }
      }
      
      if (type === 'invoices') {
        if (!data.supplier_nif || !data.document_number || !data.document_date) return null;
        
        const { data: existing } = await supabase
          .from('invoices')
          .select('id, supplier_nif, document_number, document_date, total_amount')
          .eq('supplier_nif', data.supplier_nif)
          .eq('document_number', data.document_number)
          .eq('document_date', data.document_date)
          .eq('client_id', userId)
          .maybeSingle();
        
        if (existing) {
          return { id: existing.id, data: existing };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return null;
    }
  };
  
  // Merge records (only update empty fields)
  const mergeRecords = (
    existing: Record<string, any>,
    imported: Record<string, any>
  ): Record<string, any> => {
    const updates: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(imported)) {
      // Only update if existing value is empty/null and imported value exists
      if (
        (existing[key] === null || existing[key] === undefined || existing[key] === '') &&
        value !== null && value !== undefined && value !== ''
      ) {
        updates[key] = value;
      }
    }
    
    return updates;
  };
  
  // Execute import
  const executeImport = useCallback(async () => {
    if (!user) {
      toast.error('Utilizador não autenticado');
      return;
    }
    
    setIsProcessing(true);
    setStep('importing');
    
    const result: ImportResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };
    
    try {
      const validRecords = validationResults.filter(r => r.valid && r.data);
      
      for (const record of validRecords) {
        if (!record.data) continue;
        
        // Check if it's a duplicate
        const duplicateInfo = duplicates.find(d => d.row === record.row);
        
        try {
          if (duplicateInfo) {
            if (duplicateStrategy === 'skip') {
              result.skipped++;
              continue;
            }
            
            if (duplicateStrategy === 'merge') {
              const updates = mergeRecords(duplicateInfo.existingData, record.data);
              
              if (Object.keys(updates).length > 0) {
                await updateRecord(dataType, duplicateInfo.existingId, updates);
                result.updated++;
              } else {
                result.skipped++;
              }
              continue;
            }
            
            if (duplicateStrategy === 'update') {
              await updateRecord(dataType, duplicateInfo.existingId, record.data);
              result.updated++;
              continue;
            }
          }
          
          // Insert new record
          const insertResult = await insertRecord(dataType, record.data, user.id, fiscalYear);
          if (insertResult.success) {
            // Handle 'associated' as updated, 'created' as inserted
            if (insertResult.action === 'associated' || insertResult.action === 'associated_by_email' || insertResult.action === 'associated_race_condition') {
              result.updated++;
            } else {
              result.inserted++;
            }
          } else {
            console.warn('Insert failed for record:', insertResult.error);
            result.errors++;
          }
        } catch (error) {
          console.error('Error processing record:', error);
          result.errors++;
        }
      }
      
      setImportResult(result);
      setStep('complete');
      
      toast.success(
        `Importação concluída: ${result.inserted} inseridos, ${result.updated} actualizados, ${result.skipped} ignorados`
      );
    } catch (error: any) {
      toast.error(error.message || 'Erro na importação');
      setStep('validation');
    } finally {
      setIsProcessing(false);
    }
  }, [validationResults, duplicates, duplicateStrategy, dataType, user, fiscalYear]);
  
  // Insert new record
  const insertRecord = async (
    type: DataType,
    data: Record<string, any>,
    userId: string,
    year: number
  ): Promise<{ success: boolean; action?: string; error?: string }> => {
    switch (type) {
      case 'clients':
        // Use the create-client-direct edge function for proper client creation
        try {
          const { data: result, error } = await supabase.functions.invoke('create-client-direct', {
            body: {
              full_name: data.full_name || data.company_name || 'Sem nome',
              company_name: data.company_name || data.full_name,
              nif: data.nif,
              email: data.email || null,
              phone: data.phone || null,
              address: data.address || null,
            }
          });
          
          // Edge function now always returns 200 with success/action fields
          if (error) {
            console.warn('Edge function error:', error);
            return { success: false, error: error.message };
          }
          
          // Check the response structure
          if (result?.success) {
            return { success: true, action: result.action || 'created' };
          } else {
            return { success: false, error: result?.error || 'Erro desconhecido' };
          }
        } catch (e: any) {
          console.error('Error calling create-client-direct:', e);
          return { success: false, error: e.message };
        }
        
      case 'tax_withholdings':
        try {
          const { error } = await supabase.from('tax_withholdings').insert({
            client_id: userId,
            fiscal_year: year,
            beneficiary_nif: data.beneficiary_nif,
            beneficiary_name: data.beneficiary_name || 'Sem nome',
            gross_amount: data.gross_amount,
            withholding_amount: data.withholding_amount || 0,
            withholding_rate: data.withholding_rate,
            payment_date: data.payment_date,
            income_category: data.income_category || 'B',
            document_reference: data.document_reference,
            location_code: data.location_code || 'C',
            status: 'pending',
          });
          if (error) return { success: false, error: error.message };
          return { success: true, action: 'created' };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
        
      case 'invoices':
        try {
          const { error } = await supabase.from('invoices').insert({
            client_id: userId,
            supplier_nif: data.supplier_nif,
            supplier_name: data.supplier_name,
            document_number: data.document_number,
            document_date: data.document_date,
            total_amount: data.total_amount || 0,
            total_vat: data.total_vat || 0,
            image_path: 'imported',
            status: 'pending',
          });
          if (error) return { success: false, error: error.message };
          return { success: true, action: 'created' };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
        
      case 'sales_invoices':
        try {
          const { error } = await supabase.from('sales_invoices').insert({
            client_id: userId,
            supplier_nif: userId, // For sales, supplier is the user
            customer_nif: data.customer_nif,
            customer_name: data.customer_name,
            document_number: data.document_number,
            document_date: data.document_date,
            total_amount: data.total_amount || 0,
            total_vat: data.total_vat || 0,
            image_path: 'imported',
            status: 'pending',
          });
          if (error) return { success: false, error: error.message };
          return { success: true, action: 'created' };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
        
      case 'revenue_entries':
        try {
          const { error } = await supabase.from('revenue_entries').insert({
            client_id: userId,
            period_quarter: data.period_quarter,
            category: data.category || 'prestacao_servicos',
            amount: data.amount || 0,
            source: 'import',
          });
          if (error) return { success: false, error: error.message };
          return { success: true, action: 'created' };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
        
      default:
        return { success: false, error: 'Tipo de dados não suportado' };
    }
  };
  
  // Update existing record
  const updateRecord = async (
    type: DataType,
    id: string,
    updates: Record<string, any>
  ) => {
    if (type === 'clients') {
      await supabase.from('profiles').update(updates).eq('id', id);
    } else if (type === 'tax_withholdings') {
      await supabase.from('tax_withholdings').update(updates).eq('id', id);
    } else if (type === 'invoices') {
      await supabase.from('invoices').update(updates).eq('id', id);
    } else if (type === 'sales_invoices') {
      await supabase.from('sales_invoices').update(updates).eq('id', id);
    } else if (type === 'revenue_entries') {
      await supabase.from('revenue_entries').update(updates).eq('id', id);
    }
  };

  // Get table name for data type (kept for reference)
  const _getTableName = (type: DataType): string | null => {
    switch (type) {
      case 'clients':
        return 'profiles';
      case 'tax_withholdings':
        return 'tax_withholdings';
      case 'invoices':
        return 'invoices';
      case 'sales_invoices':
        return 'sales_invoices';
      case 'revenue_entries':
        return 'revenue_entries';
      default:
        return null;
    }
  };

  // Download template
  const downloadTemplate = useCallback((type: DataType) => {
    const blob = generateTemplate(type);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${type}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);
  
  return {
    // State
    step,
    isProcessing,
    file,
    headers,
    rows,
    dataType,
    mapping,
    validationResults,
    duplicates,
    duplicateStrategy,
    fiscalYear,
    summary,
    importResult,
    
    // Actions
    reset,
    handleFileUpload,
    setDataType,
    updateMapping,
    setDuplicateStrategy,
    setFiscalYear,
    runValidation,
    executeImport,
    downloadTemplate,
    setStep,
    
    // Helpers
    getDataTypeLabel,
  };
}
