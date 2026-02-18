/**
 * Admin Certificates Page
 * Generate CSR for AT certificate request and manage certificates
 * 
 * REQUISITOS AT (corrigidos Fev 2025):
 * - CN = NIF (não nome da app)
 * - ST = Distrito (obrigatório)
 * - L = Cidade (obrigatório)
 * - E = Email (obrigatório)
 * - RSA 4096 bits
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ZenCard } from '@/components/zen';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileKey,
  Download,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Mail,
  Upload,
  Lock,
  Key,
  FileText,
  ExternalLink,
  Info,
  Building2,
  MapPin,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  generateCSR, 
  downloadFile, 
  validateCertificate,
  createPFX,
  downloadBinaryFile,
  type GeneratedCredentials,
  type CSRData,
} from '@/lib/csrGenerator';
import { PORTUGUESE_DISTRICTS } from '@/lib/portugueseDistricts';
import { useProfile } from '@/hooks/useProfile';
import { validatePortugueseNIF } from '@/lib/nifValidator';
import { CertificateUploadSection } from '@/components/efatura/CertificateUploadSection';

export default function AdminCertificates() {
  const { profile, isLoading: isLoadingProfile } = useProfile();

  // Step 1: Generate CSR - campos corrigidos conforme AT
  const [nif, setNif] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [stateOrProvince, setStateOrProvince] = useState('');
  const [locality, setLocality] = useState('');
  const [email, setEmail] = useState('');
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Private key from file upload (when credentials not in memory)
  const [uploadedPrivateKeyPem, setUploadedPrivateKeyPem] = useState('');

  // Step 2: Upload certificate from AT
  const [certPem, setCertPem] = useState('');
  const [certInfo, setCertInfo] = useState<any>(null);

  // Step 3: Generate PFX
  const [pfxPassword, setPfxPassword] = useState('');

  // Effective private key: from CSR generation or from file upload
  const effectivePrivateKey = credentials?.privateKeyPem || uploadedPrivateKeyPem;

  // Pré-preencher com dados do perfil
  useEffect(() => {
    if (profile) {
      if (profile.nif) setNif(profile.nif);
      if (profile.company_name) setOrganizationName(profile.company_name);
      else if (profile.full_name) setOrganizationName(profile.full_name);
      // at_contact_email será preenchido quando estiver na interface
    }
  }, [profile]);

  const handleGenerateCSR = async () => {
    // Validações
    const nifValidation = validatePortugueseNIF(nif);
    if (!nifValidation.valid) {
      toast.error(`NIF inválido: ${nifValidation.error}`);
      return;
    }
    if (!organizationName.trim()) {
      toast.error('Preencha o nome da empresa/pessoa');
      return;
    }
    if (!stateOrProvince) {
      toast.error('Seleccione o distrito');
      return;
    }
    if (!locality.trim()) {
      toast.error('Preencha a cidade');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Preencha um email válido');
      return;
    }

    setIsGenerating(true);
    try {
      // Simular delay para feedback visual (geração RSA 4096 é lenta)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const csrData: CSRData = {
        nif: nif.trim(),
        organizationName: organizationName.trim(),
        countryCode: 'PT',
        stateOrProvince: stateOrProvince.trim(),
        locality: locality.trim(),
        email: email.trim(),
        organizationalUnit: `NIF: ${nif.trim()}`,
      };
      
      const result = generateCSR(csrData);
      
      setCredentials(result);
      toast.success('CSR gerado com sucesso!', {
        description: 'Chave RSA 4096 bits + campos AT completos'
      });
    } catch (error: any) {
      toast.error('Erro ao gerar CSR', {
        description: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCSR = () => {
    if (!credentials) return;
    downloadFile(credentials.csrPem, `csr_${nif}.csr`);
    toast.success('Ficheiro CSR transferido');
  };

  const handleDownloadPrivateKey = () => {
    if (!credentials) return;
    downloadFile(credentials.privateKeyPem, `privkey_${nif}.pem`);
    toast.success('Chave privada transferida', {
      description: 'GUARDE ESTE FICHEIRO EM LOCAL SEGURO!'
    });
  };

  const copyEmailTemplate = () => {
    const districtName = PORTUGUESE_DISTRICTS.find(d => d.name === stateOrProvince)?.name || stateOrProvince;
    
    const template = `Exmos. Senhores,

Solicito a emissão de certificado digital para acesso aos webservices de faturação (e-Fatura).

DADOS DO PEDIDO (CSR):
- NIF (CN): ${nif}
- Nome/Firma (O): ${organizationName}
- País (C): PT
- Distrito (ST): ${districtName}
- Localidade (L): ${locality}
- Email (E): ${email}

Chave RSA: 4096 bits

Em anexo o ficheiro CSR (Certificate Signing Request).

Com os melhores cumprimentos,
${organizationName}`;

    navigator.clipboard.writeText(template);
    toast.success('Modelo de email copiado para a área de transferência');
  };

  const handleCertificateUpload = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCertPem(value);
    
    if (value.includes('-----BEGIN CERTIFICATE-----')) {
      const result = validateCertificate(value);
      if (result.valid) {
        setCertInfo(result.info);
        toast.success('Certificado válido!');
      } else {
        setCertInfo(null);
        toast.error('Certificado inválido', { description: result.error });
      }
    } else {
      setCertInfo(null);
    }
  };

  const handlePrivateKeyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (text.includes('-----BEGIN') && text.includes('PRIVATE KEY')) {
        setUploadedPrivateKeyPem(text);
        toast.success('Chave privada carregada com sucesso!');
      } else {
        toast.error('Ficheiro inválido - deve ser um ficheiro .pem com chave privada');
      }
    };
    reader.readAsText(file);
  };

  const handleGeneratePFX = () => {
    if (!effectivePrivateKey || !certPem) {
      toast.error('Falta a chave privada ou o certificado');
      return;
    }
    if (!pfxPassword || pfxPassword.length < 4) {
      toast.error('Password deve ter pelo menos 4 caracteres');
      return;
    }

    try {
      const pfxData = createPFX(effectivePrivateKey, certPem, pfxPassword);
      downloadBinaryFile(pfxData, `certificado_${nif}.pfx`);
      toast.success('Ficheiro PFX gerado!', {
        description: 'Use este ficheiro para configurar o acesso à AT'
      });
    } catch (error: any) {
      toast.error('Erro ao gerar PFX', { description: error.message });
    }
  };

  const isFormValid = nif.length === 9 && 
                      organizationName.trim() && 
                      stateOrProvince && 
                      locality.trim() && 
                      email.includes('@');

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Certificados AT
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerar e configurar certificado digital para acesso aos webservices da AT
          </p>
        </div>

        {/* Resumo dos Requisitos AT */}
        <Alert className="border-primary/50 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Requisitos AT (Fev 2025)</AlertTitle>
          <AlertDescription className="text-sm">
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>CN</strong> = NIF (não o nome da aplicação)</li>
              <li><strong>ST</strong> = Distrito (obrigatório)</li>
              <li><strong>L</strong> = Cidade/Localidade (obrigatório)</li>
              <li><strong>E</strong> = Email de contacto (obrigatório)</li>
              <li><strong>RSA 4096 bits</strong> (não 2048!)</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Step 1: Generate CSR */}
        <ZenCard>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Passo 1</Badge>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Gerar Pedido de Certificado (CSR)
                <Badge className="ml-2 bg-primary/20 text-primary text-xs">RSA 4096 bits</Badge>
              </CardTitle>
            </div>
            <CardDescription>
              Preencha todos os campos obrigatórios para gerar o CSR conforme requisitos da AT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dados do Titular */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Dados do Titular
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nif" className="flex items-center gap-1">
                    NIF <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground ml-1">(usado como CN)</span>
                  </Label>
                  <Input
                    id="nif"
                    value={nif}
                    onChange={(e) => setNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="123456789"
                    maxLength={9}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgName" className="flex items-center gap-1">
                    Nome/Firma <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground ml-1">(usado como O)</span>
                  </Label>
                  <Input
                    id="orgName"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Ex: João Silva ou Empresa Lda"
                  />
                </div>
              </div>
            </div>

            {/* Localização */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Localização
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="district" className="flex items-center gap-1">
                    Distrito <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground ml-1">(usado como ST)</span>
                  </Label>
                  <Select value={stateOrProvince} onValueChange={setStateOrProvince}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione o distrito" />
                    </SelectTrigger>
                    <SelectContent>
                      {PORTUGUESE_DISTRICTS.map((district) => (
                        <SelectItem key={district.code} value={district.name}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locality" className="flex items-center gap-1">
                    Cidade/Localidade <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground ml-1">(usado como L)</span>
                  </Label>
                  <Input
                    id="locality"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="Ex: Sintra"
                  />
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Contacto
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  Email de Contacto AT <span className="text-destructive">*</span>
                  <span className="text-xs text-muted-foreground ml-1">(usado como E)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                />
                <p className="text-xs text-muted-foreground">
                  A AT usará este email para comunicações sobre o certificado
                </p>
              </div>
            </div>

            <Button 
              onClick={handleGenerateCSR} 
              disabled={isGenerating || !isFormValid}
              className="w-full"
              size="lg"
            >
              <FileKey className="h-4 w-4 mr-2" />
              {isGenerating ? 'A gerar (RSA 4096 bits)...' : 'Gerar CSR'}
            </Button>

            {credentials && (
              <div className="mt-4 space-y-4">
                <Alert className="border-primary/50 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-primary">CSR Gerado com Sucesso!</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 text-xs font-mono bg-muted/50 p-2 rounded">
                      <div><strong>CN:</strong> {nif}</div>
                      <div><strong>O:</strong> {organizationName}</div>
                      <div><strong>C:</strong> PT</div>
                      <div><strong>ST:</strong> {stateOrProvince}</div>
                      <div><strong>L:</strong> {locality}</div>
                      <div><strong>E:</strong> {email}</div>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleDownloadCSR}>
                    <Download className="h-4 w-4 mr-2" />
                    Download CSR (.csr)
                  </Button>
                  <Button variant="destructive" onClick={handleDownloadPrivateKey}>
                    <Lock className="h-4 w-4 mr-2" />
                    Download Chave Privada (.pem)
                  </Button>
                </div>

                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>IMPORTANTE: Guarde a Chave Privada!</AlertTitle>
                  <AlertDescription>
                    A chave privada é ESSENCIAL para usar o certificado. Se a perder, terá de 
                    gerar um novo CSR e pedir novo certificado à AT. Guarde-a em local seguro!
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </ZenCard>

        {/* Step 2: Send Email */}
        <ZenCard>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Passo 2</Badge>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Enviar Pedido à AT
                </CardTitle>
              </div>
              <CardDescription>
                Envie email para a AT com o ficheiro CSR em anexo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="default" className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-400">Confirme o Email Oficial</AlertTitle>
                <AlertDescription className="text-amber-600 dark:text-amber-300">
                  <p className="mb-2">O email pode ter mudado. Confirme sempre no portal oficial antes de enviar:</p>
                  <a 
                    href="https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/Webservice_Faturas/Pages/default.aspx" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Portal AT - Webservices de Faturação
                  </a>
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm"><strong>Para:</strong> asi-cd@at.gov.pt <span className="text-xs text-muted-foreground">(verificar no portal)</span></p>
                <p className="text-sm"><strong>Assunto:</strong> Pedido de certificado digital webservice e-Fatura - NIF {nif}</p>
                <p className="text-sm"><strong>Anexo:</strong> csr_{nif}.csr</p>
              </div>

              <Button variant="outline" onClick={copyEmailTemplate}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Modelo de Email
              </Button>

              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>Tempo de Resposta</AlertTitle>
                <AlertDescription>
                  <p>A AT normalmente responde em <strong>1-3 semanas</strong> (variável).</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pode ser necessária troca de emails para esclarecimentos adicionais.
                  </p>
                </AlertDescription>
              </Alert>
            </CardContent>
          </ZenCard>

        {/* Step 3: Upload Certificate + Private Key */}
        <ZenCard>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Passo 3</Badge>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Carregar Certificado da AT
                </CardTitle>
              </div>
              <CardDescription>
                Após receber o certificado (.cer) da AT, cole-o aqui
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Private key status */}
              {effectivePrivateKey ? (
                <Alert className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-700 dark:text-green-400">Chave privada disponível</AlertTitle>
                  <AlertDescription className="text-green-600 dark:text-green-300">
                    {credentials ? 'Gerada na sessão actual' : 'Carregada de ficheiro'}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Chave privada necessária</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      Se já geraste o CSR anteriormente, carrega aqui o ficheiro da chave privada (.pem)
                      que foi transferido quando gerou o CSR.
                    </p>
                    <p className="text-xs">
                      Se não guardaste a chave privada, precisas de gerar um novo CSR (Passo 1)
                      e submeter novamente à AT.
                    </p>
                    <div>
                      <Label htmlFor="privateKeyUpload" className="cursor-pointer">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90">
                          <Upload className="h-4 w-4" />
                          Carregar Chave Privada (.pem)
                        </div>
                      </Label>
                      <input
                        id="privateKeyUpload"
                        type="file"
                        accept=".pem,.key"
                        onChange={handlePrivateKeyUpload}
                        className="hidden"
                      />
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="certPem">Conteúdo do Certificado (PEM)</Label>
                <Textarea
                  id="certPem"
                  value={certPem}
                  onChange={handleCertificateUpload}
                  placeholder="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
                  className="font-mono text-xs h-32"
                />
              </div>

              {certInfo && (
                <Alert className="border-primary/50 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-primary">Certificado Válido</AlertTitle>
                  <AlertDescription>
                    <div className="text-xs mt-2 space-y-1 text-muted-foreground">
                      <p><strong>Sujeito:</strong> {certInfo.subject}</p>
                      <p><strong>Emissor:</strong> {certInfo.issuer}</p>
                      <p><strong>Válido até:</strong> {new Date(certInfo.validTo).toLocaleDateString('pt-PT')}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </ZenCard>

        {/* Step 4: Generate PFX */}
        {certInfo && effectivePrivateKey && (
          <ZenCard>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Passo 4</Badge>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Gerar Ficheiro PFX
                </CardTitle>
              </div>
              <CardDescription>
                Combine a chave privada e o certificado num ficheiro .pfx para usar com a AT
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pfxPassword">Password do PFX</Label>
                <Input
                  id="pfxPassword"
                  type="password"
                  value={pfxPassword}
                  onChange={(e) => setPfxPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                />
                <p className="text-xs text-muted-foreground">
                  Esta password será necessária ao configurar o certificado
                </p>
              </div>

              <Button 
                onClick={handleGeneratePFX}
                disabled={!pfxPassword || pfxPassword.length < 4}
              >
                <Download className="h-4 w-4 mr-2" />
                Gerar e Download PFX
              </Button>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Próximo Passo</AlertTitle>
                <AlertDescription>
                  Após gerar o PFX, configure-o abaixo (Passo 5) para activar a sincronização AT real.
                </AlertDescription>
              </Alert>
            </CardContent>
          </ZenCard>
        )}

        {/* Step 5: Configure AT Connection - Upload existing PFX */}
        <CertificateUploadSection />
      </div>
    </DashboardLayout>
  );
}
