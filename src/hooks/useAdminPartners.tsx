import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Partner {
  id: string;
  name: string;
  initials: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerFormData {
  name: string;
  initials: string;
  website_url?: string;
  logo_url?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export const useAdminPartners = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all partners (including inactive)
  const partnersQuery = useQuery({
    queryKey: ['admin-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as Partner[];
    },
  });

  // Create partner
  const createMutation = useMutation({
    mutationFn: async (data: PartnerFormData) => {
      const { data: partner, error } = await supabase
        .from('partners')
        .insert({
          name: data.name,
          initials: data.initials,
          website_url: data.website_url || null,
          logo_url: data.logo_url || null,
          is_active: data.is_active ?? true,
          display_order: data.display_order ?? 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return partner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast({ title: "Parceiro criado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar parceiro", description: error.message, variant: "destructive" });
    },
  });

  // Update partner
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PartnerFormData> }) => {
      const { data: partner, error } = await supabase
        .from('partners')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return partner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast({ title: "Parceiro atualizado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar parceiro", description: error.message, variant: "destructive" });
    },
  });

  // Delete partner
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast({ title: "Parceiro eliminado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao eliminar parceiro", description: error.message, variant: "destructive" });
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('partners')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (error) => {
      toast({ title: "Erro ao alterar estado", description: error.message, variant: "destructive" });
    },
  });

  // Upload logo
  const uploadLogo = async (file: File, partnerId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${partnerId}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('partner-logos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('partner-logos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  // Delete logo
  const deleteLogo = async (partnerId: string, logoUrl: string) => {
    const fileName = logoUrl.split('/').pop();
    if (fileName) {
      await supabase.storage.from('partner-logos').remove([fileName]);
    }
  };

  return {
    partners: partnersQuery.data ?? [],
    isLoading: partnersQuery.isLoading,
    error: partnersQuery.error,
    createPartner: createMutation.mutateAsync,
    updatePartner: updateMutation.mutateAsync,
    deletePartner: deleteMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    uploadLogo,
    deleteLogo,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

export const useIsAdmin = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-role-admin', userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId,
  });
};
