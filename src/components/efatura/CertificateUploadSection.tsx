/**
 * Certificate Upload Section
 * Upload PFX certificate and ChaveCifraPublicaAT for AT integration
 */

import { useState, useRef } from 'react';
import { ZenCard } from '@/components/zen';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Upload,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Key,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { useATConfig, useUploadCertificate } from '@/hooks/useATCredentials';
import { cn } from '@/lib/utils';

export function CertificateUploadSection() {
  const { data: atConfig, isLoading: isLoadingConfig } = useATConfig();
  const uploadMutation = useUploadCertificate();

  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState('');
  const [publicKeyFile, setPublicKeyFile] = useState<File | null>(null);
  const [caCertFile, setCaCertFile] = useState<File | null>(null);
  const [subuserId, setSubuserId] = useState('');
  const [subuserPassword, setSubuserPassword] = useState('');
  const [environment, setEnvironment] = useState<'test' | 'production'>('production');

  const pfxInputRef = useRef<HTMLInputElement>(null);
  const publicKeyInputRef = useRef<HTMLInputElement>(null);
  const caCertInputRef = useRef<HTMLInputElement>(null);

  const handlePfxSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
        toast.error('Tipo de ficheiro inválido', {
          description: 'Seleccione um ficheiro .pfx ou .p12',
        });
        return;
      }
      setPfxFile(file);
    }
  };

  const handlePublicKeySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.cer') && !file.name.endsWith('.crt') && !file.name.endsWith('.pem')) {
        toast.error('Tipo de ficheiro inválido', {
          description: 'Seleccione um ficheiro .cer, .crt ou .pem',
        });
        return;
      }
      setPublicKeyFile(file);
    }
  };

  const handleCACertSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExts = ['.cer', '.crt', '.pem', '.p7b'];
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      if (!validExts.includes(ext)) {
        toast.error('Tipo de ficheiro inválido', {
          description: 'Seleccione um ficheiro .cer, .crt, .pem ou .p7b',
        });
        return;
      }
      setCaCertFile(file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 part after data URL prefix
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (!pfxFile) {
      toast.error('Seleccione o ficheiro PFX');
      return;
    }
    if (!pfxPassword) {
      toast.error('Introduza a password do PFX');
      return;
    }
    if (!publicKeyFile) {
      toast.error('Seleccione a ChaveCifraPublicaAT');
      return;
    }
    if (!subuserId || !subuserId.includes('/')) {
      toast.error('Introduza o ID do subutilizador (formato: NIF/num)');
      return;
    }
    if (!subuserPassword) {
      toast.error('Introduza a password do subutilizador');
      return;
    }

    try {
      const pfxBase64 = await fileToBase64(pfxFile);
      const publicKeyBase64 = await fileToBase64(publicKeyFile);
      const caCertBase64 = caCertFile ? await fileToBase64(caCertFile) : undefined;

      await uploadMutation.mutateAsync({
        pfxBase64,
        pfxPassword,
        atPublicKeyBase64: publicKeyBase64,
        subuserId,
        subuserPassword,
        environment,
        certificateCN: subuserId.split('/')[0],
        caCertBase64,
      });

      // Clear form
      setPfxFile(null);
      setPfxPassword('');
      setPublicKeyFile(null);
      setCaCertFile(null);
      setSubuserPassword('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isConfigured = !!atConfig?.is_active;
  const isValidTo = atConfig?.certificate_valid_to 
    ? new Date(atConfig.certificate_valid_to)
    : null;
  const isExpired = isValidTo && isValidTo < new Date();
  const expiresInDays = isValidTo 
    ? Math.ceil((isValidTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  if (isLoadingConfig) {
    return (
      <ZenCard>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </ZenCard>
    );
  }

  return (
    <ZenCard>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Passo 5</Badge>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Configurar Certificado AT
            </CardTitle>
          </div>
          {isConfigured && (
            <Badge 
              variant={isExpired ? 'destructive' : 'default'} 
              className={cn(!isExpired && 'bg-green-600')}
            >
              {isExpired ? 'Expirado' : 'Configurado'}
            </Badge>
          )}
        </div>
        <CardDescription>
          Carregue o ficheiro PFX gerado e a chave pública da AT para activar a sincronização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Config Status */}
        {isConfigured && (
          <Alert className={isExpired ? 'border-red-500/50' : 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'}>
            {isExpired ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
            <AlertTitle className={isExpired ? 'text-red-700' : 'text-green-700'}>
              {isExpired ? 'Certificado Expirado' : 'Certificado Activo'}
            </AlertTitle>
            <AlertDescription className="space-y-1 text-sm">
              <div><strong>CN:</strong> {atConfig.certificate_cn}</div>
              <div><strong>Subutilizador:</strong> {atConfig.subuser_id}</div>
              <div><strong>Ambiente:</strong> {atConfig.environment === 'production' ? 'Produção' : 'Testes'}</div>
              {isValidTo && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Válido até: {isValidTo.toLocaleDateString('pt-PT')}
                    {expiresInDays !== null && expiresInDays > 0 && (
                      <span className="text-muted-foreground ml-1">
                        ({expiresInDays} dias)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Form */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* PFX File */}
          <div className="space-y-2">
            <Label htmlFor="pfx" className="flex items-center gap-1">
              <FileKey className="h-4 w-4" />
              Ficheiro PFX <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="pfx"
                type="text"
                value={pfxFile?.name || ''}
                placeholder="Seleccione o ficheiro .pfx"
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => pfxInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <input
                ref={pfxInputRef}
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={handlePfxSelect}
              />
            </div>
          </div>

          {/* PFX Password */}
          <div className="space-y-2">
            <Label htmlFor="pfxPassword" className="flex items-center gap-1">
              <Lock className="h-4 w-4" />
              Password do PFX <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pfxPassword"
              type="password"
              value={pfxPassword}
              onChange={(e) => setPfxPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {/* AT Public Key */}
          <div className="space-y-2">
            <Label htmlFor="publicKey" className="flex items-center gap-1">
              <Key className="h-4 w-4" />
              ChaveCifraPublicaAT <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="publicKey"
                type="text"
                value={publicKeyFile?.name || ''}
                placeholder="ChaveCifraPublicaAT2027.cer"
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => publicKeyInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <input
                ref={publicKeyInputRef}
                type="file"
                accept=".cer,.crt,.pem"
                className="hidden"
                onChange={handlePublicKeySelect}
              />
            </div>
          </div>

          {/* Environment */}
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={environment} onValueChange={(v) => setEnvironment(v as 'test' | 'production')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Testes (dados fictícios)</SelectItem>
                <SelectItem value="production">Produção (dados reais)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CA Certificate (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="caCert" className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Certificado CA (DGITA) <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="caCert"
                type="text"
                value={caCertFile?.name || ''}
                placeholder="Chave Cifra Publica AT 2027.p7b"
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => caCertInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <input
                ref={caCertInputRef}
                type="file"
                accept=".cer,.crt,.pem,.p7b"
                className="hidden"
                onChange={handleCACertSelect}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Ficheiro .p7b recebido da AT (cadeia de certificados CA para ligação TLS segura)
            </p>
          </div>

          {/* Subuser ID */}
          <div className="space-y-2">
            <Label htmlFor="subuserId">
              ID Subutilizador WFA <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subuserId"
              value={subuserId}
              onChange={(e) => setSubuserId(e.target.value)}
              placeholder="232945993/1"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Formato: NIF/número</p>
          </div>

          {/* Subuser Password */}
          <div className="space-y-2">
            <Label htmlFor="subuserPassword">
              Password Subutilizador <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subuserPassword"
              type="password"
              value={subuserPassword}
              onChange={(e) => setSubuserPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button
          onClick={handleUpload}
          disabled={uploadMutation.isPending}
          className="w-full"
          size="lg"
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Shield className="h-4 w-4 mr-2" />
          )}
          {isConfigured ? 'Actualizar Configuração' : 'Guardar Configuração'}
        </Button>

        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription className="text-sm">
            As passwords são encriptadas antes de serem guardadas e nunca são visíveis
            após a configuração. O ficheiro PFX é armazenado de forma segura.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ZenCard>
  );
}
