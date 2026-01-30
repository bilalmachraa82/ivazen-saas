import { useState } from 'react';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, User, UserMinus, Loader2, Crown, Eye, Shield, Info 
} from 'lucide-react';
import { ZenCard } from '@/components/zen';
import { useMyAccountants, MyAccountant } from '@/hooks/useMyAccountants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ACCESS_LEVEL_LABELS: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  full: { label: 'Acesso Total', icon: Shield, color: 'text-primary' },
  readonly: { label: 'Apenas Leitura', icon: Eye, color: 'text-muted-foreground' },
  limited: { label: 'Acesso Limitado', icon: Eye, color: 'text-warning' },
};

export function MyAccountantsPanel() {
  const {
    accountants,
    primaryAccountant,
    otherAccountants,
    isLoading,
    removeAccountant,
    isRemoving,
    hasMultipleAccountants,
  } = useMyAccountants();

  const [accountantToRemove, setAccountantToRemove] = useState<MyAccountant | null>(null);

  const getAccessBadge = (accessLevel: string) => {
    const config = ACCESS_LEVEL_LABELS[accessLevel] || ACCESS_LEVEL_LABELS.full;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} border-current/30`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <ZenCard gradient="muted" withCircle className="shadow-xl animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </ZenCard>
    );
  }

  if (accountants.length === 0) {
    return (
      <ZenCard gradient="muted" withCircle className="shadow-xl" animationDelay="150ms">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            Os Meus Contabilistas
          </CardTitle>
          <CardDescription>
            Nenhum contabilista associado à sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/30 rounded-xl border border-dashed border-border">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Sem contabilista associado</p>
                <p className="text-xs text-muted-foreground">
                  O seu contabilista pode adicionar a sua conta à carteira dele para 
                  validar as suas facturas e ajudá-lo com as declarações fiscais.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </ZenCard>
    );
  }

  return (
    <>
      <ZenCard gradient="muted" withCircle className="shadow-xl" animationDelay="150ms">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            Os Meus Contabilistas
            <Badge className="bg-primary/20 text-primary border-0">
              {accountants.length} {accountants.length === 1 ? 'contabilista' : 'contabilistas'}
            </Badge>
          </CardTitle>
          <CardDescription>
            {hasMultipleAccountants 
              ? 'Vários contabilistas têm acesso aos seus dados fiscais'
              : 'O seu contabilista pode validar e gerir as suas facturas'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary Accountant */}
          {primaryAccountant && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Contabilista Principal
              </label>
              <div className="flex items-center justify-between p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-primary/30 to-primary/20 shadow-md">
                    <Crown className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{primaryAccountant.full_name}</p>
                    {primaryAccountant.company_name && (
                      <p className="text-sm text-muted-foreground">{primaryAccountant.company_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {primaryAccountant.nif && (
                        <Badge variant="outline" className="text-xs border-primary/30">
                          NIF: {primaryAccountant.nif}
                        </Badge>
                      )}
                      {getAccessBadge(primaryAccountant.access_level)}
                    </div>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setAccountantToRemove(primaryAccountant)}
                      disabled={isRemoving}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remover acesso deste contabilista</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Other Accountants */}
          {otherAccountants.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Outros Contabilistas com Acesso
              </label>
              <div className="space-y-2">
                {otherAccountants.map((accountant) => (
                  <div 
                    key={accountant.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{accountant.full_name}</p>
                        {accountant.company_name && (
                          <p className="text-xs text-muted-foreground">{accountant.company_name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {accountant.nif && (
                            <Badge variant="outline" className="text-xs">
                              NIF: {accountant.nif}
                            </Badge>
                          )}
                          {getAccessBadge(accountant.access_level)}
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setAccountantToRemove(accountant)}
                      disabled={isRemoving}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info about access */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Nota:</strong> Os contabilistas associados podem ver e validar as suas facturas, 
              ajudando com a organização fiscal. Pode remover o acesso a qualquer momento.
            </p>
          </div>
        </CardContent>
      </ZenCard>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!accountantToRemove} onOpenChange={() => setAccountantToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Acesso do Contabilista</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja remover o acesso de <strong>{accountantToRemove?.full_name}</strong>?
              <br /><br />
              {accountantToRemove?.is_primary && (
                <span className="text-warning">
                  ⚠️ Este é o seu contabilista principal. Ao removê-lo, 
                  {otherAccountants.length > 0 
                    ? ' outro contabilista será promovido a principal.'
                    : ' ficará sem contabilista associado.'
                  }
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (accountantToRemove) {
                  removeAccountant(accountantToRemove.id);
                  setAccountantToRemove(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Remover Acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
