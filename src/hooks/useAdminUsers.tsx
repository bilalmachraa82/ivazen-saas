import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRoles {
  id: string;
  email: string | null;
  full_name: string;
  nif: string | null;
  company_name: string | null;
  cae: string | null;
  created_at: string | null;
  roles: AppRole[];
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export function useAdminUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if current user is admin
  const { data: isAdmin, isLoading: isCheckingAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Fetch all users with their roles (admin only)
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Get all profiles including email
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, nif, company_name, cae, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRoles[] = profiles.map((profile) => {
        const userRoles = (roles as UserRole[])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role);

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          nif: profile.nif,
          company_name: profile.company_name,
          cae: profile.cae,
          created_at: profile.created_at,
          roles: userRoles,
        };
      });

      return usersWithRoles;
    },
    enabled: isAdmin === true,
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`Role ${variables.role} adicionada com sucesso`);
    },
    onError: (error: Error) => {
      console.error('Error adding role:', error);
      toast.error('Erro ao adicionar role');
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`Role ${variables.role} removida com sucesso`);
    },
    onError: (error: Error) => {
      console.error('Error removing role:', error);
      toast.error('Erro ao remover role');
    },
  });

  // Search user by email, name or NIF
  const searchUser = async (query: string): Promise<UserWithRoles[]> => {
    const searchTerm = `%${query}%`;
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, nif, company_name, cae, created_at')
      .or(`full_name.ilike.${searchTerm},nif.ilike.${searchTerm},company_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(10);

    if (error) throw error;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', profiles.map(p => p.id));

    return profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      nif: profile.nif,
      company_name: profile.company_name,
      cae: profile.cae,
      created_at: profile.created_at,
      roles: (roles || [])
        .filter(r => r.user_id === profile.id)
        .map(r => r.role),
    }));
  };

  return {
    isAdmin,
    isCheckingAdmin,
    users,
    isLoadingUsers,
    addRole: addRoleMutation.mutate,
    removeRole: removeRoleMutation.mutate,
    isAddingRole: addRoleMutation.isPending,
    isRemovingRole: removeRoleMutation.isPending,
    searchUser,
  };
}
