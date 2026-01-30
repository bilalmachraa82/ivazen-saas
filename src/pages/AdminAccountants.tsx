import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAccountantRequests, PendingRequest } from '@/hooks/useAccountantRequest';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, CheckCircle, XCircle, Loader2, Clock, 
  Award, Building2, Briefcase, Mail, Calendar
} from 'lucide-react';
import { ZenCard, ZenHeader, ZenDecorations, ZenEmptyState } from '@/components/zen';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SPECIALIZATION_LABELS: Record<string, string> = {
  fiscal: 'Fiscalidade',
  contabilidade: 'Contabilidade Geral',
  iva: 'IVA',
  irs: 'IRS',
  irc: 'IRC',
  seguranca_social: 'Segurança Social',
  trabalhadores_independentes: 'Trab. Independentes',
  startups: 'Startups',
  comercio: 'Comércio',
  restauracao: 'Restauração',
};

export default function AdminAccountants() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const {
    isAdmin,
    pendingRequests,
    pendingCount,
    isLoadingRequests,
    approveRequest,
    isApproving,
    rejectRequest,
    isRejecting,
  } = useAdminAccountantRequests();

  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (isAdmin === false) {
    return (
      <DashboardLayout>
        <ZenEmptyState
          icon={Users}
          title="Acesso Restrito"
          description="Esta página é apenas para administradores."
        />
      </DashboardLayout>
    );
  }

  const handleAction = (request: PendingRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes('');
  };

  const confirmAction = () => {
    if (!selectedRequest || !actionType) return;

    if (actionType === 'approve') {
      approveRequest({ 
        requestId: selectedRequest.id, 
        notes: adminNotes || undefined 
      });
    } else {
      if (!adminNotes.trim()) {
        return; // Require notes for rejection
      }
      rejectRequest({ 
        requestId: selectedRequest.id, 
        notes: adminNotes 
      });
    }

    setSelectedRequest(null);
    setActionType(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in relative">
        <ZenDecorations />

        <ZenHeader
          icon={Briefcase}
          title="Pedidos de Contabilistas"
          description="Gerir pedidos de registo de contabilistas certificados"
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ZenCard gradient="primary" className="shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-warning/20">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </ZenCard>
        </div>

        {/* Pending Requests */}
        <ZenCard gradient="default" withLine className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Pedidos Pendentes
              {pendingCount > 0 && (
                <Badge className="bg-warning/20 text-warning border-0">
                  {pendingCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Reveja e aprove ou rejeite pedidos de registo de contabilistas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRequests ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Não há pedidos pendentes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div 
                    key={request.id}
                    className="p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* User Info */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{request.full_name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {request.email}
                            </p>
                          </div>
                        </div>

                        {/* Credentials */}
                        <div className="flex flex-wrap gap-2">
                          {request.occ_number && (
                            <Badge variant="outline" className="gap-1">
                              <Award className="h-3 w-3" />
                              OCC: {request.occ_number}
                            </Badge>
                          )}
                          {request.cedula_number && (
                            <Badge variant="outline" className="gap-1">
                              <Award className="h-3 w-3" />
                              Cédula: {request.cedula_number}
                            </Badge>
                          )}
                          {request.company_name && (
                            <Badge variant="secondary" className="gap-1">
                              <Building2 className="h-3 w-3" />
                              {request.company_name}
                            </Badge>
                          )}
                          {request.years_experience && (
                            <Badge variant="secondary">
                              {request.years_experience} anos exp.
                            </Badge>
                          )}
                        </div>

                        {/* Specializations */}
                        {request.specializations && request.specializations.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {request.specializations.map(spec => (
                              <Badge key={spec} variant="outline" className="text-xs">
                                {SPECIALIZATION_LABELS[spec] || spec}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Motivation */}
                        {request.motivation && (
                          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                            "{request.motivation}"
                          </p>
                        )}

                        {/* Date */}
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Submetido em {new Date(request.created_at).toLocaleDateString('pt-PT')}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 lg:flex-col">
                        <Button 
                          onClick={() => handleAction(request, 'approve')}
                          className="gap-2 flex-1 lg:flex-none"
                          disabled={isApproving || isRejecting}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Aprovar
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handleAction(request, 'reject')}
                          className="gap-2 flex-1 lg:flex-none text-destructive hover:bg-destructive/10"
                          disabled={isApproving || isRejecting}
                        >
                          <XCircle className="h-4 w-4" />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </ZenCard>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Aprovar Pedido' : 'Rejeitar Pedido'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' 
                ? `Aprovar ${selectedRequest?.full_name} como contabilista? O utilizador receberá acesso imediato às funcionalidades de contabilista.`
                : `Rejeitar o pedido de ${selectedRequest?.full_name}? É obrigatório indicar o motivo.`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Textarea
              placeholder={actionType === 'approve' 
                ? 'Notas opcionais...' 
                : 'Motivo da rejeição (obrigatório)...'
              }
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmAction}
              disabled={(isApproving || isRejecting) || (actionType === 'reject' && !adminNotes.trim())}
              className={actionType === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {(isApproving || isRejecting) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {actionType === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
