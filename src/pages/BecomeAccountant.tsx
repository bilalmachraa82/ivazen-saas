import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAccountantRequest, AccountantRequestForm } from '@/hooks/useAccountantRequest';
import { useClientManagement } from '@/hooks/useClientManagement';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Briefcase, CheckCircle, Clock, XCircle, Loader2, 
  Award, Building2, FileCheck, Send, AlertTriangle
} from 'lucide-react';
import { ZenCard, ZenHeader, ZenDecorations } from '@/components/zen';

const SPECIALIZATIONS = [
  { id: 'fiscal', label: 'Fiscalidade' },
  { id: 'contabilidade', label: 'Contabilidade Geral' },
  { id: 'iva', label: 'IVA e Impostos Indirectos' },
  { id: 'irs', label: 'IRS e Rendimentos' },
  { id: 'irc', label: 'IRC e Sociedades' },
  { id: 'seguranca_social', label: 'Segurança Social' },
  { id: 'trabalhadores_independentes', label: 'Trabalhadores Independentes' },
  { id: 'startups', label: 'Startups e Tech' },
  { id: 'comercio', label: 'Comércio e Retalho' },
  { id: 'restauracao', label: 'Restauração e Hotelaria' },
];

export default function BecomeAccountant() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { isAccountant } = useClientManagement();
  const { 
    myRequest, 
    isLoadingRequest, 
    hasPendingRequest,
    isApproved,
    isRejected,
    submitRequest, 
    isSubmitting 
  } = useAccountantRequest();

  const [formData, setFormData] = useState<AccountantRequestForm>({
    occ_number: '',
    cedula_number: '',
    company_name: '',
    tax_office: '',
    specializations: [],
    years_experience: undefined,
    motivation: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // If already an accountant, redirect to accountant dashboard
  useEffect(() => {
    if (isAccountant) {
      navigate('/accountant');
    }
  }, [isAccountant, navigate]);

  if (loading || !user) return null;

  const handleSpecializationChange = (specId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      specializations: checked 
        ? [...(prev.specializations || []), specId]
        : (prev.specializations || []).filter(s => s !== specId),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.occ_number && !formData.cedula_number) {
      return; // At least one is required
    }
    
    submitRequest(formData);
  };

  // Already approved - redirect to accountant
  if (isApproved) {
    return (
      <DashboardLayout>
        <div className="space-y-8 animate-fade-in relative">
          <ZenDecorations />
          <ZenHeader
            icon={CheckCircle}
            title="Parabéns!"
            description="O seu registo como contabilista foi aprovado"
          />
          <ZenCard gradient="primary" withLine className="shadow-xl">
            <CardContent className="py-8 text-center space-y-4">
              <div className="p-4 rounded-full bg-green-500/20 w-fit mx-auto">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold">Registo Aprovado!</h3>
              <p className="text-muted-foreground">
                Pode agora aceder ao dashboard de contabilista e começar a gerir clientes.
              </p>
              <Button onClick={() => navigate('/accountant')} className="zen-button">
                Ir para Dashboard de Contabilista
              </Button>
            </CardContent>
          </ZenCard>
        </div>
      </DashboardLayout>
    );
  }

  // Pending request
  if (hasPendingRequest) {
    return (
      <DashboardLayout>
        <div className="space-y-8 animate-fade-in relative">
          <ZenDecorations />
          <ZenHeader
            icon={Clock}
            title="Pedido em Análise"
            description="O seu registo está a ser analisado pela nossa equipa"
          />
          <ZenCard gradient="muted" withCircle className="shadow-xl">
            <CardContent className="py-8 text-center space-y-4">
              <div className="p-4 rounded-full bg-warning/20 w-fit mx-auto">
                <Clock className="h-12 w-12 text-warning animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold">Pedido Pendente</h3>
              <p className="text-muted-foreground">
                O seu pedido de registo como contabilista está em análise.
                <br />
                Receberá uma notificação assim que for processado.
              </p>
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <p>Submetido em: {new Date(myRequest!.created_at).toLocaleDateString('pt-PT')}</p>
                {myRequest?.occ_number && (
                  <Badge variant="outline">OCC: {myRequest.occ_number}</Badge>
                )}
              </div>
            </CardContent>
          </ZenCard>
        </div>
      </DashboardLayout>
    );
  }

  // Rejected request
  if (isRejected) {
    return (
      <DashboardLayout>
        <div className="space-y-8 animate-fade-in relative">
          <ZenDecorations />
          <ZenHeader
            icon={XCircle}
            title="Pedido Não Aprovado"
            description="Infelizmente o seu pedido não foi aprovado"
          />
          <ZenCard gradient="muted" withCircle className="shadow-xl">
            <CardContent className="py-8 text-center space-y-4">
              <div className="p-4 rounded-full bg-destructive/20 w-fit mx-auto">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold">Pedido Rejeitado</h3>
              {myRequest?.admin_notes && (
                <div className="p-4 bg-muted/30 rounded-lg max-w-md mx-auto">
                  <p className="text-sm text-muted-foreground">
                    <strong>Motivo:</strong> {myRequest.admin_notes}
                  </p>
                </div>
              )}
              <p className="text-muted-foreground text-sm">
                Se tiver dúvidas, entre em contacto connosco.
              </p>
              <Button variant="outline" onClick={() => navigate('/contact')}>
                Contactar Suporte
              </Button>
            </CardContent>
          </ZenCard>
        </div>
      </DashboardLayout>
    );
  }

  // Registration form
  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in relative">
        <ZenDecorations />

        <ZenHeader
          icon={Briefcase}
          title="Tornar-se Contabilista"
          description="Registe-se como contabilista certificado para gerir clientes"
        />

        {isLoadingRequest ? (
          <ZenCard className="animate-pulse">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            </CardContent>
          </ZenCard>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
              {/* Professional Credentials */}
              <ZenCard gradient="primary" withLine className="shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <Award className="h-5 w-5 text-primary" />
                    </div>
                    Credenciais Profissionais
                  </CardTitle>
                  <CardDescription>
                    Indique pelo menos um número de identificação profissional
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="occ">Nº OCC (Ordem dos Contabilistas)</Label>
                      <Input
                        id="occ"
                        value={formData.occ_number}
                        onChange={(e) => setFormData({ ...formData, occ_number: e.target.value })}
                        placeholder="Ex: 12345"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cedula">Nº Cédula Profissional</Label>
                      <Input
                        id="cedula"
                        value={formData.cedula_number}
                        onChange={(e) => setFormData({ ...formData, cedula_number: e.target.value })}
                        placeholder="Ex: CP-12345"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  
                  {!formData.occ_number && !formData.cedula_number && (
                    <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg text-warning text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Preencha pelo menos um dos campos acima
                    </div>
                  )}
                </CardContent>
              </ZenCard>

              {/* Company Info */}
              <ZenCard gradient="muted" withCircle className="shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    Informação Profissional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company">Empresa / Gabinete</Label>
                      <Input
                        id="company"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        placeholder="Nome da empresa ou gabinete"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax_office">Repartição de Finanças</Label>
                      <Input
                        id="tax_office"
                        value={formData.tax_office}
                        onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                        placeholder="Ex: Lisboa 3"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="experience">Anos de Experiência</Label>
                    <Input
                      id="experience"
                      type="number"
                      min={0}
                      max={50}
                      value={formData.years_experience || ''}
                      onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) || undefined })}
                      placeholder="Ex: 5"
                      className="w-32"
                    />
                  </div>
                </CardContent>
              </ZenCard>

              {/* Specializations */}
              <ZenCard gradient="default" withLine className="shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                      <FileCheck className="h-5 w-5 text-primary" />
                    </div>
                    Áreas de Especialização
                  </CardTitle>
                  <CardDescription>
                    Seleccione as áreas em que tem maior experiência (opcional)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SPECIALIZATIONS.map((spec) => (
                      <div key={spec.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={spec.id}
                          checked={formData.specializations?.includes(spec.id)}
                          onCheckedChange={(checked) => 
                            handleSpecializationChange(spec.id, checked as boolean)
                          }
                        />
                        <Label htmlFor={spec.id} className="text-sm cursor-pointer">
                          {spec.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </ZenCard>

              {/* Motivation */}
              <ZenCard gradient="muted" className="shadow-xl">
                <CardHeader>
                  <CardTitle>Motivação</CardTitle>
                  <CardDescription>
                    Conte-nos brevemente porque pretende usar o IVAzen (opcional)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.motivation}
                    onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                    placeholder="Ex: Pretendo digitalizar a gestão de faturas dos meus clientes trabalhadores independentes..."
                    rows={4}
                    className="resize-none"
                  />
                </CardContent>
              </ZenCard>

              {/* Submit */}
              <Button 
                type="submit" 
                className="zen-button w-full gap-2 py-6 text-lg"
                disabled={isSubmitting || (!formData.occ_number && !formData.cedula_number)}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                {isSubmitting ? 'A Submeter...' : 'Submeter Pedido de Registo'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
