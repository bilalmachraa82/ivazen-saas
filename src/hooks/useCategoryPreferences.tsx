import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface CategoryPreference {
  id: string;
  user_id: string;
  cae_prefix: string | null;
  category: string;
  usage_count: number;
  last_used_at: string;
  created_at: string;
}

export function useCategoryPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's category preferences
  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['category-preferences', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('category_preferences')
        .select('*')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false });
      
      if (error) throw error;
      return data as CategoryPreference[];
    },
    enabled: !!user,
  });

  // Get the most used category for a given CAE prefix
  const getSuggestedCategory = (caePrefix?: string | null): string | null => {
    if (!preferences.length) return null;
    
    // First try to find a preference matching the CAE prefix
    if (caePrefix) {
      const prefixMatch = preferences.find(p => p.cae_prefix === caePrefix.substring(0, 2));
      if (prefixMatch) return prefixMatch.category;
    }
    
    // Otherwise return the most used category overall
    return preferences[0]?.category || null;
  };

  // Save or update a category preference
  const savePreferenceMutation = useMutation({
    mutationFn: async ({ category, caePrefix }: { category: string; caePrefix?: string | null }) => {
      if (!user) throw new Error('Not authenticated');
      
      const normalizedPrefix = caePrefix?.substring(0, 2) || null;
      
      // Try to find existing preference
      const { data: existing } = await supabase
        .from('category_preferences')
        .select('id, usage_count')
        .eq('user_id', user.id)
        .eq('category', category)
        .eq('cae_prefix', normalizedPrefix || '')
        .maybeSingle();
      
      if (existing) {
        // Update existing preference
        const { error } = await supabase
          .from('category_preferences')
          .update({
            usage_count: existing.usage_count + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new preference
        const { error } = await supabase
          .from('category_preferences')
          .insert({
            user_id: user.id,
            category,
            cae_prefix: normalizedPrefix,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-preferences', user?.id] });
    },
  });

  // Save multiple preferences at once (after bulk import)
  const savePreferencesBulk = async (categories: string[], caePrefix?: string | null) => {
    // Count occurrences of each category
    const categoryCounts = new Map<string, number>();
    categories.forEach(cat => {
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });
    
    // Save each category preference
    for (const [category] of categoryCounts.entries()) {
      await savePreferenceMutation.mutateAsync({ category, caePrefix });
    }
  };

  return {
    preferences,
    isLoading,
    getSuggestedCategory,
    savePreference: savePreferenceMutation.mutate,
    savePreferencesBulk,
    isSaving: savePreferenceMutation.isPending,
  };
}
