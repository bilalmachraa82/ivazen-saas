import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AIMetric {
  id: string;
  supplier_nif: string;
  supplier_name: string | null;
  total_classifications: number;
  total_corrections: number;
  last_classification_at: string | null;
  last_correction_at: string | null;
  created_at: string;
}

export function useAIMetrics() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all AI metrics
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ['ai-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_metrics')
        .select('*')
        .order('total_corrections', { ascending: false });

      if (error) throw error;
      
      return (data || []) as AIMetric[];
    },
    enabled: !!user?.id,
  });

  // Calculate precision rate
  const calculatePrecision = (metric: AIMetric) => {
    if (metric.total_classifications === 0) return 100;
    const correctionRate = (metric.total_corrections / metric.total_classifications) * 100;
    return Math.round(100 - correctionRate);
  };

  // Get overall stats
  const overallStats = {
    totalClassifications: metrics.reduce((sum, m) => sum + m.total_classifications, 0),
    totalCorrections: metrics.reduce((sum, m) => sum + m.total_corrections, 0),
    overallPrecision: metrics.length > 0 
      ? Math.round(100 - (metrics.reduce((sum, m) => sum + m.total_corrections, 0) / 
          Math.max(1, metrics.reduce((sum, m) => sum + m.total_classifications, 0))) * 100)
      : 100,
    problematicSuppliers: metrics.filter(m => calculatePrecision(m) < 70).length,
  };

  // Update metric on classification
  const recordClassification = useMutation({
    mutationFn: async (data: { supplierNif: string; supplierName?: string }) => {
      // Try to update existing
      const { data: existing } = await supabase
        .from('ai_metrics')
        .select('id, total_classifications')
        .eq('supplier_nif', data.supplierNif)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('ai_metrics')
          .update({
            total_classifications: existing.total_classifications + 1,
            last_classification_at: new Date().toISOString(),
            supplier_name: data.supplierName || null,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_metrics')
          .insert({
            supplier_nif: data.supplierNif,
            supplier_name: data.supplierName || null,
            total_classifications: 1,
            last_classification_at: new Date().toISOString(),
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-metrics'] });
    },
  });

  // Record correction
  const recordCorrection = useMutation({
    mutationFn: async (data: { supplierNif: string; supplierName?: string }) => {
      const { data: existing } = await supabase
        .from('ai_metrics')
        .select('id, total_corrections')
        .eq('supplier_nif', data.supplierNif)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('ai_metrics')
          .update({
            total_corrections: existing.total_corrections + 1,
            last_correction_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_metrics')
          .insert({
            supplier_nif: data.supplierNif,
            supplier_name: data.supplierName || null,
            total_corrections: 1,
            last_correction_at: new Date().toISOString(),
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-metrics'] });
    },
  });

  return {
    metrics,
    isLoading,
    overallStats,
    calculatePrecision,
    recordClassification: recordClassification.mutate,
    recordCorrection: recordCorrection.mutate,
  };
}
