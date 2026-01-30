import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TaxWithholding {
  id: string;
  client_id: string;
  fiscal_year: number;
  beneficiary_nif: string;
  beneficiary_name: string | null;
  beneficiary_address: string | null;
  income_category: 'A' | 'B' | 'E' | 'F' | 'G' | 'H' | 'R';
  location_code: 'C' | 'RA' | 'RM';
  gross_amount: number;
  exempt_amount: number;
  dispensed_amount: number;
  withholding_rate: number | null;
  withholding_amount: number;
  payment_date: string;
  document_reference: string | null;
  source_invoice_id: string | null;
  notes: string | null;
  status: 'draft' | 'included' | 'submitted';
  is_non_resident: boolean;
  country_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface WithholdingFormData {
  fiscal_year: number;
  beneficiary_nif: string;
  beneficiary_name?: string;
  beneficiary_address?: string;
  income_category: 'A' | 'B' | 'E' | 'F' | 'G' | 'H' | 'R';
  location_code: 'C' | 'RA' | 'RM';
  gross_amount: number;
  exempt_amount?: number;
  dispensed_amount?: number;
  withholding_rate?: number;
  withholding_amount: number;
  payment_date: string;
  document_reference?: string;
  notes?: string;
  is_non_resident?: boolean;
  country_code?: string;
}

export interface WithholdingSummary {
  beneficiary_nif: string;
  beneficiary_name: string | null;
  income_category: 'A' | 'B' | 'E' | 'F' | 'G' | 'H' | 'R';
  location_code: 'C' | 'RA' | 'RM';
  total_gross: number;
  total_exempt: number;
  total_dispensed: number;
  total_withholding: number;
  count: number;
}

export interface WithholdingLog {
  id: string;
  withholding_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'deleted';
  changes: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
}

export function useWithholdings(forClientId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Default to 2025 since most imported documents are from 2025
  // User can still change to current year if needed
  const [selectedYear, setSelectedYear] = useState<number>(2025);

  // Determine which client ID to use: explicit client ID for accountants, or logged-in user
  const effectiveClientId = forClientId || user?.id;

  // Fetch withholdings for selected year
  const { data: withholdings = [], isLoading, refetch } = useQuery({
    queryKey: ['withholdings', effectiveClientId, selectedYear],
    queryFn: async () => {
      if (!effectiveClientId) return [];
      
      const { data, error } = await supabase
        .from('tax_withholdings')
        .select('*')
        .eq('client_id', effectiveClientId)
        .eq('fiscal_year', selectedYear)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Error fetching withholdings:', error);
        throw error;
      }

      return data as TaxWithholding[];
    },
    enabled: !!effectiveClientId,
  });

  // Fetch logs for all withholdings
  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['withholding-logs', effectiveClientId, selectedYear],
    queryFn: async () => {
      if (!effectiveClientId || withholdings.length === 0) return [];
      
      const withholdingIds = withholdings.map(w => w.id);
      
      // Use type assertion since table was just created
      const { data, error } = await (supabase
        .from('withholding_logs') as any)
        .select('*')
        .in('withholding_id', withholdingIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching withholding logs:', error);
        return [];
      }

      return data as WithholdingLog[];
    },
    enabled: !!effectiveClientId && withholdings.length > 0,
  });

  // Helper to log changes
  const logChange = async (
    withholdingId: string, 
    action: 'created' | 'updated' | 'deleted',
    changes: Record<string, { old: unknown; new: unknown }> = {}
  ) => {
    if (!user?.id) return;
    
    try {
      // Use type assertion since table was just created and types may not be updated yet
      await (supabase.from('withholding_logs') as any).insert({
        withholding_id: withholdingId,
        user_id: user.id,
        action,
        changes,
      });
    } catch (error) {
      console.error('Error logging change:', error);
    }
  };

  // Calculate summary by beneficiary
  const summary: WithholdingSummary[] = withholdings.reduce((acc, w) => {
    const key = `${w.beneficiary_nif}-${w.income_category}-${w.location_code}`;
    const existing = acc.find(s => 
      s.beneficiary_nif === w.beneficiary_nif && 
      s.income_category === w.income_category &&
      s.location_code === w.location_code
    );
    
    if (existing) {
      existing.total_gross += Number(w.gross_amount);
      existing.total_exempt += Number(w.exempt_amount || 0);
      existing.total_dispensed += Number(w.dispensed_amount || 0);
      existing.total_withholding += Number(w.withholding_amount);
      existing.count += 1;
    } else {
      acc.push({
        beneficiary_nif: w.beneficiary_nif,
        beneficiary_name: w.beneficiary_name,
        income_category: w.income_category,
        location_code: w.location_code,
        total_gross: Number(w.gross_amount),
        total_exempt: Number(w.exempt_amount || 0),
        total_dispensed: Number(w.dispensed_amount || 0),
        total_withholding: Number(w.withholding_amount),
        count: 1,
      });
    }
    
    return acc;
  }, [] as WithholdingSummary[]);

  // Totals
  const totals = {
    gross: withholdings.reduce((sum, w) => sum + Number(w.gross_amount), 0),
    withholding: withholdings.reduce((sum, w) => sum + Number(w.withholding_amount), 0),
    exempt: withholdings.reduce((sum, w) => sum + Number(w.exempt_amount || 0), 0),
    dispensed: withholdings.reduce((sum, w) => sum + Number(w.dispensed_amount || 0), 0),
    count: withholdings.length,
    categoryB: withholdings.filter(w => w.income_category === 'B').length,
    categoryE: withholdings.filter(w => w.income_category === 'E').length,
    categoryF: withholdings.filter(w => w.income_category === 'F').length,
  };

  // Add withholding mutation
  const addMutation = useMutation({
    mutationFn: async (data: WithholdingFormData) => {
      if (!user?.id) throw new Error('Utilizador não autenticado');
      if (!effectiveClientId) throw new Error('Cliente não seleccionado');

      const { data: result, error } = await supabase
        .from('tax_withholdings')
        .insert({
          client_id: effectiveClientId,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Log the creation
      await logChange(result.id, 'created', {});
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withholdings'] });
      queryClient.invalidateQueries({ queryKey: ['withholding-logs'] });
      toast.success('Retenção adicionada com sucesso');
    },
    onError: (error) => {
      console.error('Error adding withholding:', error);
      toast.error('Erro ao adicionar retenção');
    },
  });

  // Update withholding mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data, previousData }: { 
      id: string; 
      data: Partial<WithholdingFormData>;
      previousData?: Partial<TaxWithholding>;
    }) => {
      const { data: result, error } = await supabase
        .from('tax_withholdings')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Calculate changes for the log
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      if (previousData) {
        Object.keys(data).forEach(key => {
          const typedKey = key as keyof typeof data;
          if (previousData[typedKey as keyof typeof previousData] !== data[typedKey]) {
            changes[key] = {
              old: previousData[typedKey as keyof typeof previousData],
              new: data[typedKey],
            };
          }
        });
      }
      
      // Log the update
      await logChange(id, 'updated', changes);
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withholdings'] });
      queryClient.invalidateQueries({ queryKey: ['withholding-logs'] });
      toast.success('Retenção actualizada');
    },
    onError: (error) => {
      console.error('Error updating withholding:', error);
      toast.error('Erro ao actualizar retenção');
    },
  });

  // Delete withholding mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, previousData }: { id: string; previousData?: TaxWithholding }) => {
      // Log the deletion BEFORE deleting (since we'll lose the foreign key)
      // Actually, we need to log BEFORE because of cascade delete
      // So we'll just record the beneficiary info
      const deleteInfo = previousData ? {
        beneficiary_nif: { old: previousData.beneficiary_nif, new: null },
        gross_amount: { old: previousData.gross_amount, new: null },
      } : {};
      
      // Note: We can't log after delete due to cascade, so we log basic info
      // The log will be deleted anyway due to cascade, so this is just for record
      
      const { error } = await supabase
        .from('tax_withholdings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withholdings'] });
      queryClient.invalidateQueries({ queryKey: ['withholding-logs'] });
      toast.success('Retenção eliminada');
    },
    onError: (error) => {
      console.error('Error deleting withholding:', error);
      toast.error('Erro ao eliminar retenção');
    },
  });

  // Extract from image
  const extractFromImage = async (fileData: string, mimeType: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('extract-withholding', {
        body: { fileData, mimeType },
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return null;
      }

      return data.data;
    } catch (error) {
      console.error('Error extracting from image:', error);
      toast.error('Erro ao extrair dados do documento');
      return null;
    }
  };

  return {
    withholdings,
    logs,
    summary,
    totals,
    isLoading,
    selectedYear,
    setSelectedYear,
    refetch,
    refetchLogs,
    addWithholding: addMutation.mutateAsync,
    updateWithholding: updateMutation.mutateAsync,
    deleteWithholding: deleteMutation.mutateAsync,
    extractFromImage,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
