import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ValidationLogChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface ValidationLogEntry {
  id: string;
  invoice_id: string;
  invoice_type: 'purchase' | 'sales';
  user_id: string;
  user_name?: string;
  user_email?: string;
  action: 'validated' | 'rejected' | 'edited' | 'classification_changed' | 'created';
  changes: ValidationLogChange[];
  created_at: string;
}

interface UseValidationHistoryOptions {
  invoiceId: string | null;
  invoiceType: 'purchase' | 'sales';
  enabled?: boolean;
}

export function useValidationHistory({
  invoiceId,
  invoiceType,
  enabled = true
}: UseValidationHistoryOptions) {
  const { user } = useAuth();
  const [history, setHistory] = useState<ValidationLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!invoiceId || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('invoice_validation_logs')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('invoice_type', invoiceType)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching validation history:', fetchError);
        setError(fetchError.message);
        return;
      }

      // Map the data to our interface
      const mappedHistory: ValidationLogEntry[] = (data || []).map(log => ({
        id: log.id,
        invoice_id: log.invoice_id,
        invoice_type: log.invoice_type as 'purchase' | 'sales',
        user_id: log.user_id,
        action: log.action as ValidationLogEntry['action'],
        changes: Array.isArray(log.changes) ? (log.changes as unknown as ValidationLogChange[]) : [],
        created_at: log.created_at ?? new Date().toISOString(),
      }));

      setHistory(mappedHistory);
    } catch (err) {
      console.error('Unexpected error fetching validation history:', err);
      setError('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, invoiceType, enabled]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const logValidation = useCallback(async (
    action: ValidationLogEntry['action'],
    changes: ValidationLogChange[] = []
  ): Promise<boolean> => {
    if (!invoiceId || !user) {
      console.error('Cannot log validation: missing invoiceId or user');
      return false;
    }

    try {
      const { error: insertError } = await supabase
        .from('invoice_validation_logs')
        .insert([{
          invoice_id: invoiceId,
          invoice_type: invoiceType,
          user_id: user.id,
          action,
          changes: changes as unknown as import('@/integrations/supabase/types').Json,
        }]);

      if (insertError) {
        console.error('Error logging validation:', insertError);
        return false;
      }

      // Refresh history after logging
      await fetchHistory();
      return true;
    } catch (err) {
      console.error('Unexpected error logging validation:', err);
      return false;
    }
  }, [invoiceId, invoiceType, user, fetchHistory]);

  // Utility function to create changes array from old and new objects
  const createChangesArray = useCallback((
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    fieldsToCompare: string[]
  ): ValidationLogChange[] => {
    const changes: ValidationLogChange[] = [];

    for (const field of fieldsToCompare) {
      const oldVal = oldValues[field];
      const newVal = newValues[field];

      // Compare values (handle null/undefined)
      if (oldVal !== newVal && !(oldVal == null && newVal == null)) {
        changes.push({
          field,
          old_value: oldVal ?? null,
          new_value: newVal ?? null,
        });
      }
    }

    return changes;
  }, []);

  return {
    history,
    loading,
    error,
    logValidation,
    createChangesArray,
    refetch: fetchHistory,
  };
}

// Helper function to get field display name in Portuguese
export function getFieldDisplayName(field: string): string {
  const fieldNames: Record<string, string> = {
    // Purchase invoice fields
    final_classification: 'Classificacao',
    final_dp_field: 'Campo DP',
    final_deductibility: 'Dedutibilidade',
    ai_classification: 'Classificacao IA',
    ai_dp_field: 'Campo DP IA',
    ai_deductibility: 'Dedutibilidade IA',
    status: 'Estado',
    validated_at: 'Data Validacao',
    validated_by: 'Validado por',
    supplier_name: 'Fornecedor',
    supplier_nif: 'NIF Fornecedor',
    total_amount: 'Valor Total',
    total_vat: 'IVA Total',

    // Sales invoice fields
    revenue_category: 'Categoria Receita',
    customer_name: 'Cliente',
    customer_nif: 'NIF Cliente',
    notes: 'Notas',

    // Common fields
    document_number: 'Numero Documento',
    document_date: 'Data Documento',
    document_type: 'Tipo Documento',
  };

  return fieldNames[field] || field;
}

// Helper function to get action display name in Portuguese
export function getActionDisplayName(action: ValidationLogEntry['action']): string {
  const actionNames: Record<ValidationLogEntry['action'], string> = {
    validated: 'Validada',
    rejected: 'Rejeitada',
    edited: 'Editada',
    classification_changed: 'Classificacao Alterada',
    created: 'Criada',
  };

  return actionNames[action] || action;
}

// Helper function to format value for display
export function formatValueForDisplay(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }

  // Handle deductibility percentage
  if (field === 'final_deductibility' || field === 'ai_deductibility') {
    return `${value}%`;
  }

  // Handle DP field
  if (field === 'final_dp_field' || field === 'ai_dp_field') {
    const dpFieldLabels: Record<number, string> = {
      10: 'Campo 10 - Aquisições intracomunitárias (Base)',
      20: 'Campo 20 - Imobilizado',
      21: 'Campo 21 - Existências (6%)',
      22: 'Campo 22 - Existências (23%)',
      23: 'Campo 23 - Existências (13%)',
      24: 'Campo 24 - Outros bens e serviços',
    };
    return dpFieldLabels[value as number] || `Campo ${value}`;
  }

  // Handle status
  if (field === 'status') {
    const statusLabels: Record<string, string> = {
      pending: 'Pendente',
      validated: 'Validada',
      rejected: 'Rejeitada',
    };
    return statusLabels[value as string] || String(value);
  }

  // Handle dates
  if (field.includes('_at') || field.includes('date')) {
    try {
      return new Date(value as string).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(value);
    }
  }

  // Handle amounts
  if (field.includes('amount') || field.includes('vat')) {
    return `€${Number(value).toFixed(2)}`;
  }

  return String(value);
}
