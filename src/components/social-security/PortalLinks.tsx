import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, FileSpreadsheet, Key, Shield, Copy, Check, Sparkles, Info } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

const ICON_STYLE = { strokeWidth: 1.5 };

type CopyType = 'nif' | 'niss' | false;

interface PortalLink {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: typeof Shield;
  primary: boolean;
  copyType: CopyType;
  tip: string;
  recommended?: boolean;
}

const PORTAL_LINKS: PortalLink[] = [
  {
    id: 'ss-directa',
    title: 'SS Directa',
    description: 'Submeter declaração trimestral',
    url: 'https://app.seg-social.pt/sso/login',
    icon: Shield,
    primary: true,
    copyType: 'niss',
    tip: 'O seu NISS será copiado automaticamente para colar no login',
  },
  {
    id: 'portal-financas',
    title: 'Portal das Finanças',
    description: 'Aceder a Faturas e Recibos Verdes',
    url: 'https://faturas.portaldasfinancas.gov.pt',
    icon: FileSpreadsheet,
    primary: true,
    copyType: 'nif',
    tip: 'O seu NIF será copiado automaticamente para colar no login',
  },
  {
    id: 'e-fatura',
    title: 'e-Fatura (Painel Emitente)',
    description: 'Consultar faturas emitidas',
    url: 'https://www.acesso.gov.pt/jsp/loginRedirectForm.jsp?path=painelEmitente.action&partID=EFPF',
    icon: FileSpreadsheet,
    primary: false,
    copyType: 'nif',
    tip: 'Cole o NIF copiado no campo de utilizador',
  },
  {
    id: 'cmd',
    title: 'Chave Móvel Digital',
    description: 'Login único para todos os portais',
    url: 'https://www.autenticacao.gov.pt/a-chave-movel-digital',
    icon: Key,
    primary: false,
    copyType: false,
    recommended: true,
    tip: 'Método mais seguro - um único login para AT, SS e outros serviços públicos',
  },
];

// Mask identifier for privacy display
function maskIdentifier(value: string | null, expectedLength: number): string {
  if (!value || value.length !== expectedLength) return '---';
  return `${value.slice(0, 3)}****${value.slice(-2)}`;
}

export function PortalLinks() {
  const { profile, isLoading } = useProfile();
  const [copiedRecently, setCopiedRecently] = useState<string | null>(null);

  const userNif = profile?.nif || null;
  const userNiss = profile?.niss || null;

  const copyToClipboard = async (type: 'nif' | 'niss'): Promise<boolean> => {
    const value = type === 'nif' ? userNif : userNiss;
    const label = type === 'nif' ? 'NIF' : 'NISS';
    
    if (!value) {
      toast.error(`${label} não configurado no perfil`, {
        description: 'Vá a Definições para adicionar',
      });
      return false;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado!`, {
        description: 'Cole no campo de utilizador do portal',
        duration: 3000,
      });
      return true;
    } catch {
      toast.error(`Erro ao copiar ${label}`);
      return false;
    }
  };

  const handleOpenPortal = async (link: PortalLink) => {
    if (link.copyType) {
      const value = link.copyType === 'nif' ? userNif : userNiss;
      if (value) {
        const copied = await copyToClipboard(link.copyType);
        if (copied) {
          setCopiedRecently(link.id);
          setTimeout(() => setCopiedRecently(null), 5000);
        }
      }
    }
    window.open(link.url, '_blank');
  };

  const handleCopyOnly = async (type: 'nif' | 'niss') => {
    const copied = await copyToClipboard(type);
    if (copied) {
      setCopiedRecently(`${type}-only`);
      setTimeout(() => setCopiedRecently(null), 5000);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Quick Access Card */}
        {(userNif || userNiss) && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Sparkles className="h-5 w-5 text-primary" style={ICON_STYLE} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Quick Access</p>
                    <p className="text-xs text-muted-foreground">
                      Os seus identificadores são copiados automaticamente ao abrir portais
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 ml-11">
                  {userNif && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleCopyOnly('nif')}
                          className="gap-2"
                        >
                          {copiedRecently === 'nif-only' ? (
                            <Check className="h-4 w-4 text-green-600" style={ICON_STYLE} />
                          ) : (
                            <Copy className="h-4 w-4" style={ICON_STYLE} />
                          )}
                          NIF: {maskIdentifier(userNif, 9)}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copiar NIF para Portal das Finanças / e-Fatura</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {userNiss && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleCopyOnly('niss')}
                          className="gap-2"
                        >
                          {copiedRecently === 'niss-only' ? (
                            <Check className="h-4 w-4 text-green-600" style={ICON_STYLE} />
                          ) : (
                            <Copy className="h-4 w-4" style={ICON_STYLE} />
                          )}
                          NISS: {maskIdentifier(userNiss, 11)}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copiar NISS para SS Directa</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warning if no NIF or NISS */}
        {!isLoading && !userNif && !userNiss && (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-amber-600" style={ICON_STYLE} />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    NIF e NISS não configurados
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-500/80">
                    Configure nas Definições para activar o Quick Access
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Partial warning - only NISS missing */}
        {!isLoading && userNif && !userNiss && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <Info className="h-4 w-4 text-amber-500" style={ICON_STYLE} />
                <p className="text-xs text-amber-600/80 dark:text-amber-500/80">
                  NISS não configurado — adicione nas Definições para acesso rápido à SS Directa
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Portal Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PORTAL_LINKS.map((link) => (
            <Card 
              key={link.id} 
              className={`transition-all hover:shadow-md ${
                link.primary 
                  ? 'border-primary/30 bg-primary/5' 
                  : link.recommended 
                    ? 'border-green-500/30 bg-green-500/5'
                    : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    link.primary 
                      ? 'bg-primary/20' 
                      : link.recommended 
                        ? 'bg-green-500/20' 
                        : 'bg-muted'
                  }`}>
                    <link.icon className={`h-5 w-5 ${
                      link.primary 
                        ? 'text-primary' 
                        : link.recommended 
                          ? 'text-green-600' 
                          : 'text-muted-foreground'
                    }`} style={ICON_STYLE} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{link.title}</CardTitle>
                      {link.recommended && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs">
                          Recomendado
                        </Badge>
                      )}
                      {copiedRecently === link.id && (
                        <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">
                          <Check className="h-3 w-3 mr-1" style={ICON_STYLE} />
                          NIF copiado
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">{link.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={link.primary || link.recommended ? 'default' : 'outline'} 
                      className={`w-full gap-2 ${
                        link.recommended 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : ''
                      }`}
                      onClick={() => handleOpenPortal(link)}
                    >
                      {link.copyType === 'nif' && userNif 
                        ? 'Abrir (NIF copiado)' 
                        : link.copyType === 'niss' && userNiss
                          ? 'Abrir (NISS copiado)'
                          : 'Abrir'
                      }
                      <ExternalLink className="h-4 w-4" style={ICON_STYLE} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>{link.tip}</p>
                  </TooltipContent>
                </Tooltip>
                
                {link.recommended && (
                  <p className="text-xs text-center text-muted-foreground">
                    Um login único para todos os serviços públicos
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Security Note */}
        <Card className="bg-muted/30 border-muted">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" style={ICON_STYLE} />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Segurança das suas credenciais</p>
                <p>
                  Por razões de segurança, não guardamos passwords de portais externos. 
                  Recomendamos usar a <strong>Chave Móvel Digital</strong> ou o gestor de passwords do seu browser.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
