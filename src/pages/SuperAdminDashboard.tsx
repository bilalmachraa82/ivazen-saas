import { useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ZenCard, ZenLoader } from "@/components/zen";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Building,
  FileText,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface ClientProfile {
  id: string;
  full_name: string;
  email: string | null;
  nif: string | null;
  company_name: string | null;
  cae: string | null;
  created_at: string | null;
}

export default function SuperAdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const {
    isAdmin,
    isLoadingAdmin,
    accountants,
    isLoadingAccountants,
    globalStats,
    isLoadingStats,
    getClientsForAccountant,
    getWithholdingsForClient,
  } = useSuperAdmin();

  const [selectedAccountant, setSelectedAccountant] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [clientWithholdings, setClientWithholdings] = useState<any[]>([]);
  const [loadingWithholdings, setLoadingWithholdings] = useState(false);

  // Handle loading states
  if (authLoading || isLoadingAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <ZenLoader text="A verificar permissões..." />
        </div>
      </DashboardLayout>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Access denied if not admin
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
          <p className="text-muted-foreground">
            Não tem permissões de Super Admin para aceder a esta página.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleSelectAccountant = async (id: string, name: string) => {
    setLoadingClients(true);
    setSelectedAccountant({ id, name });
    setSelectedClient(null);
    setClientWithholdings([]);
    
    try {
      const clientsData = await getClientsForAccountant(id);
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleSelectClient = async (client: ClientProfile) => {
    setLoadingWithholdings(true);
    setSelectedClient(client);
    
    try {
      const withholdings = await getWithholdingsForClient(client.id);
      setClientWithholdings(withholdings);
    } catch (error) {
      console.error('Error loading withholdings:', error);
    } finally {
      setLoadingWithholdings(false);
    }
  };

  const handleBackToAccountants = () => {
    setSelectedAccountant(null);
    setClients([]);
    setSelectedClient(null);
    setClientWithholdings([]);
  };

  const handleBackToClients = () => {
    setSelectedClient(null);
    setClientWithholdings([]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Super Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Visão global de todos os contabilistas e clientes do sistema</p>
          </div>
        </div>
      </div>

      {/* Global Stats */}
      {!selectedAccountant && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <ZenCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contabilistas</p>
                <p className="text-2xl font-bold">
                  {isLoadingStats ? "..." : globalStats?.totalAccountants || 0}
                </p>
              </div>
            </div>
          </ZenCard>

          <ZenCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-secondary/10">
                <Building className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold">
                  {isLoadingStats ? "..." : globalStats?.totalClients || 0}
                </p>
              </div>
            </div>
          </ZenCard>

          <ZenCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent/10">
                <FileText className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Retenções (Modelo 10)</p>
                <p className="text-2xl font-bold">
                  {isLoadingStats ? "..." : globalStats?.totalWithholdings || 0}
                </p>
              </div>
            </div>
          </ZenCard>

          <ZenCard className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-muted">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">
                  {isLoadingStats ? "..." : formatCurrency(globalStats?.totalWithholdingValue || 0)}
                </p>
              </div>
            </div>
          </ZenCard>
        </div>
      )}

      {/* Breadcrumb navigation */}
      {selectedAccountant && (
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={handleBackToAccountants}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Contabilistas
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{selectedAccountant.name}</span>
          {selectedClient && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Button variant="ghost" size="sm" onClick={handleBackToClients} className="p-0 h-auto">
                Clientes
              </Button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedClient.full_name}</span>
            </>
          )}
        </div>
      )}

      {/* Accountants List */}
      {!selectedAccountant && (
        <ZenCard className="p-6">
          <h2 className="text-lg font-semibold mb-4">Todos os Contabilistas</h2>
          
          {isLoadingAccountants ? (
            <ZenLoader text="A carregar contabilistas..." />
          ) : accountants && accountants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-center">Clientes</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountants.map((accountant) => (
                  <TableRow key={accountant.id}>
                    <TableCell className="font-medium">{accountant.full_name}</TableCell>
                    <TableCell>{accountant.email || "-"}</TableCell>
                    <TableCell>{accountant.nif || "-"}</TableCell>
                    <TableCell>{accountant.company_name || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{accountant.clientCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectAccountant(accountant.id, accountant.full_name)}
                      >
                        Ver Clientes
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhum contabilista registado no sistema.
            </p>
          )}
        </ZenCard>
      )}

      {/* Clients List for Selected Accountant */}
      {selectedAccountant && !selectedClient && (
        <ZenCard className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            Clientes de {selectedAccountant.name}
          </h2>
          
          {loadingClients ? (
            <ZenLoader text="A carregar clientes..." />
          ) : clients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CAE</TableHead>
                  <TableHead>Data Registo</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.full_name}</TableCell>
                    <TableCell>{client.email || "-"}</TableCell>
                    <TableCell>{client.nif || "-"}</TableCell>
                    <TableCell>{client.company_name || "-"}</TableCell>
                    <TableCell>{client.cae || "-"}</TableCell>
                    <TableCell>
                      {client.created_at
                        ? format(new Date(client.created_at), "dd MMM yyyy", { locale: pt })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectClient(client)}
                      >
                        Ver Retenções
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Este contabilista não tem clientes associados.
            </p>
          )}
        </ZenCard>
      )}

      {/* Withholdings for Selected Client */}
      {selectedClient && (
        <ZenCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Retenções de {selectedClient.full_name}</h2>
              <p className="text-sm text-muted-foreground">
                NIF: {selectedClient.nif || "-"} | Empresa: {selectedClient.company_name || "-"}
              </p>
            </div>
          </div>
          
          {loadingWithholdings ? (
            <ZenLoader text="A carregar retenções..." />
          ) : clientWithholdings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIF Beneficiário</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead className="text-right">Retenção</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead>Ano Fiscal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientWithholdings.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono">{w.beneficiary_nif}</TableCell>
                    <TableCell>{w.beneficiary_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{w.income_category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(w.gross_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(w.withholding_amount)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(w.payment_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{w.fiscal_year}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma retenção registada para este cliente.
            </p>
          )}

          {clientWithholdings.length > 0 && (
            <div className="mt-4 pt-4 border-t flex justify-end gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Total Bruto:</span>{" "}
                <span className="font-bold">
                  {formatCurrency(
                    clientWithholdings.reduce((sum, w) => sum + Number(w.gross_amount), 0)
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Retenção:</span>{" "}
                <span className="font-bold">
                  {formatCurrency(
                    clientWithholdings.reduce((sum, w) => sum + Number(w.withholding_amount), 0)
                  )}
                </span>
              </div>
            </div>
          )}
        </ZenCard>
      )}
    </DashboardLayout>
  );
}
