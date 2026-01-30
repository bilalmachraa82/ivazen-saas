import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Users, 
  Search, 
  MoreHorizontal, 
  UserPlus, 
  UserMinus, 
  Shield, 
  Calculator,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const roleLabels: Record<AppRole, { label: string; color: string }> = {
  client: { label: 'Cliente', color: 'bg-blue-500/10 text-blue-600' },
  accountant: { label: 'Contabilista', color: 'bg-purple-500/10 text-purple-600' },
  admin: { label: 'Administrador', color: 'bg-red-500/10 text-red-600' },
};

export default function AdminUsers() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const {
    isAdmin,
    isCheckingAdmin,
    users,
    isLoadingUsers,
    addRole,
    removeRole,
    isAddingRole,
    isRemovingRole,
  } = useAdminUsers();

  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'add' | 'remove';
    userId: string;
    userName: string;
    role: AppRole;
  } | null>(null);

  if (loading || !user || isCheckingAdmin) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-12 w-full max-w-md" />
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Card className="border-destructive/50">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-6">
              Esta página é apenas para administradores.
            </p>
            <Button onClick={() => navigate('/')}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.nif?.toLowerCase().includes(query) ||
      u.company_name?.toLowerCase().includes(query)
    );
  });

  const handleAddRole = (userId: string, userName: string, role: AppRole) => {
    setConfirmDialog({
      open: true,
      type: 'add',
      userId,
      userName,
      role,
    });
  };

  const handleRemoveRole = (userId: string, userName: string, role: AppRole) => {
    setConfirmDialog({
      open: true,
      type: 'remove',
      userId,
      userName,
      role,
    });
  };

  const confirmAction = () => {
    if (!confirmDialog) return;
    
    if (confirmDialog.type === 'add') {
      addRole({ userId: confirmDialog.userId, role: confirmDialog.role });
    } else {
      removeRole({ userId: confirmDialog.userId, role: confirmDialog.role });
    }
    setConfirmDialog(null);
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'accountant':
        return <Calculator className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administração de Utilizadores</h1>
          <p className="text-muted-foreground mt-1">
            Gestão de roles e permissões
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Utilizadores
            </CardTitle>
            <CardDescription>
              Pesquise e gerir roles dos utilizadores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome, NIF ou empresa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoadingUsers ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum utilizador encontrado</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Data Registo</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.full_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {u.email || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.nif || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.company_name || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 ? (
                              <span className="text-sm text-muted-foreground">Sem roles</span>
                            ) : (
                              u.roles.map((role) => (
                                <Badge
                                  key={role}
                                  variant="secondary"
                                  className={`gap-1 ${roleLabels[role].color}`}
                                >
                                  {getRoleIcon(role)}
                                  {roleLabels[role].label}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString('pt-PT')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!u.roles.includes('accountant') && (
                                <DropdownMenuItem
                                  onClick={() => handleAddRole(u.id, u.full_name, 'accountant')}
                                  disabled={isAddingRole}
                                >
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Adicionar Contabilista
                                </DropdownMenuItem>
                              )}
                              {u.roles.includes('accountant') && (
                                <DropdownMenuItem
                                  onClick={() => handleRemoveRole(u.id, u.full_name, 'accountant')}
                                  disabled={isRemovingRole}
                                  className="text-destructive"
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Remover Contabilista
                                </DropdownMenuItem>
                              )}
                              {!u.roles.includes('admin') && (
                                <DropdownMenuItem
                                  onClick={() => handleAddRole(u.id, u.full_name, 'admin')}
                                  disabled={isAddingRole}
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Adicionar Admin
                                </DropdownMenuItem>
                              )}
                              {u.roles.includes('admin') && u.id !== user?.id && (
                                <DropdownMenuItem
                                  onClick={() => handleRemoveRole(u.id, u.full_name, 'admin')}
                                  disabled={isRemovingRole}
                                  className="text-destructive"
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Remover Admin
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.type === 'add' ? 'Adicionar Role' : 'Remover Role'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === 'add'
                ? `Tem a certeza que quer adicionar a role "${roleLabels[confirmDialog?.role || 'client'].label}" ao utilizador ${confirmDialog?.userName}?`
                : `Tem a certeza que quer remover a role "${roleLabels[confirmDialog?.role || 'client'].label}" do utilizador ${confirmDialog?.userName}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              {(isAddingRole || isRemovingRole) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
