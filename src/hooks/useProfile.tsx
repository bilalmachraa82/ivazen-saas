import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export interface Profile {
  id: string;
  full_name: string;
  company_name: string | null;
  nif: string | null;
  niss: string | null;
  cae: string | null;
  activity_description: string | null;
  vat_regime: string | null;
  accountant_id: string | null;
  created_at: string | null;
  ss_contribution_rate: number | null;
  is_first_year: boolean | null;
  has_accountant_ss: boolean | null;
  last_ss_declaration: string | null;
  // New fields for SS compliance
  worker_type: string | null;
  accounting_regime: string | null;
  has_other_employment: boolean | null;
  other_employment_salary: number | null;
  taxable_profit: number | null;
  // Contact fields
  phone: string | null;
  address: string | null;
  // AT certificate contact email
  at_contact_email: string | null;
}

interface AccountantProfile {
  id: string;
  full_name: string;
  company_name: string | null;
  nif: string | null;
}

export interface ProfileFormData {
  fullName: string;
  companyName: string;
  nif: string;
  niss: string;
  cae: string;
  activityDescription: string;
  vatRegime: string;
}

export interface SSProfileData {
  workerType: string;
  accountingRegime: string;
  hasOtherEmployment: boolean;
  otherEmploymentSalary: number;
  taxableProfit: number;
  ssContributionRate: number;
  isFirstYear: boolean;
  hasAccountantSS: boolean;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current user's profile
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user?.id,
  });

  // Check if profile needs fiscal setup
  const needsFiscalSetup = profile && !profile.worker_type;

  // Fetch accountant info if associated
  const { data: accountant, isLoading: isLoadingAccountant } = useQuery({
    queryKey: ['accountant', profile?.accountant_id],
    queryFn: async () => {
      if (!profile?.accountant_id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, nif')
        .eq('id', profile.accountant_id)
        .maybeSingle();

      if (error) throw error;
      return data as AccountantProfile | null;
    },
    enabled: !!profile?.accountant_id,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (formData: ProfileFormData) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName.trim(),
          company_name: formData.companyName.trim() || null,
          nif: formData.nif.trim() || null,
          niss: formData.niss.trim() || null,
          cae: formData.cae.trim() || null,
          activity_description: formData.activityDescription.trim() || null,
          vat_regime: formData.vatRegime || 'normal',
        })
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Perfil actualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Profile update error:', error);
      toast.error('Erro ao actualizar perfil');
    },
  });

  // Update SS profile data
  const updateSSProfileMutation = useMutation({
    mutationFn: async (data: Partial<SSProfileData>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const updateData: Record<string, any> = {};
      
      if (data.workerType !== undefined) updateData.worker_type = data.workerType;
      if (data.accountingRegime !== undefined) updateData.accounting_regime = data.accountingRegime;
      if (data.hasOtherEmployment !== undefined) updateData.has_other_employment = data.hasOtherEmployment;
      if (data.otherEmploymentSalary !== undefined) updateData.other_employment_salary = data.otherEmploymentSalary;
      if (data.taxableProfit !== undefined) updateData.taxable_profit = data.taxableProfit;
      if (data.ssContributionRate !== undefined) updateData.ss_contribution_rate = data.ssContributionRate;
      if (data.isFirstYear !== undefined) updateData.is_first_year = data.isFirstYear;
      if (data.hasAccountantSS !== undefined) updateData.has_accountant_ss = data.hasAccountantSS;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Definições fiscais guardadas!');
    },
    onError: (error) => {
      console.error('Update SS profile error:', error);
      toast.error('Erro ao guardar definições fiscais');
    },
  });

  // Search for accountant by NIF
  const searchAccountant = async (nif: string): Promise<AccountantProfile | null> => {
    if (!nif || nif.length !== 9) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, nif')
      .eq('nif', nif)
      .neq('id', user?.id || '')
      .maybeSingle();

    if (error) {
      console.error('Search accountant error:', error);
      return null;
    }

    return data as AccountantProfile | null;
  };

  // Associate with accountant
  const associateAccountantMutation = useMutation({
    mutationFn: async (accountantId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ accountant_id: accountantId })
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['accountant'] });
      toast.success('Contabilista associado com sucesso!');
    },
    onError: (error) => {
      console.error('Associate accountant error:', error);
      toast.error('Erro ao associar contabilista');
    },
  });

  // Remove accountant association (client-side)
  const removeAccountantMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase.rpc('remove_my_accountant');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['accountant'] });
      toast.success('Associação removida com sucesso!');
    },
    onError: (error) => {
      console.error('Remove accountant error:', error);
      toast.error('Erro ao remover associação');
    },
  });

  return {
    profile,
    accountant,
    needsFiscalSetup,
    isLoading: isLoadingProfile || isLoadingAccountant,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
    updateSSProfile: updateSSProfileMutation.mutate,
    isUpdatingSSProfile: updateSSProfileMutation.isPending,
    searchAccountant,
    associateAccountant: associateAccountantMutation.mutate,
    isAssociating: associateAccountantMutation.isPending,
    removeAccountant: removeAccountantMutation.mutate,
    isRemoving: removeAccountantMutation.isPending,
  };
}
