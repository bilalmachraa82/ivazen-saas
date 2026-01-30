import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home, Upload, FileCheck, Receipt, Calculator, FileText, Settings, Users, BarChart3, Shield, UserPlus, Briefcase, Download, Brain, AppWindow, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BreadcrumbItem {
  label: string;
  description: string;
  href?: string;
  icon?: LucideIcon;
}

interface RouteMetadata {
  label: string;
  description: string;
  icon?: LucideIcon;
}

const routeMetadata: Record<string, RouteMetadata> = {
  '': {
    label: 'Dashboard',
    description: 'Visao geral do seu negocio fiscal',
    icon: Home
  },
  'dashboard': {
    label: 'Dashboard',
    description: 'Visao geral do seu negocio fiscal',
    icon: Home
  },
  'upload': {
    label: 'Carregar Faturas',
    description: 'Digitalizar e processar novas faturas',
    icon: Upload
  },
  'validation': {
    label: 'Faturas de Compras',
    description: 'Validar e classificar faturas recebidas',
    icon: FileCheck
  },
  'sales': {
    label: 'Faturas de Vendas',
    description: 'Gerir faturas emitidas e receitas',
    icon: Receipt
  },
  'modelo-10': {
    label: 'Modelo 10 - Retencoes',
    description: 'Gerir retencoes na fonte para AT',
    icon: FileText
  },
  'seguranca-social': {
    label: 'Seguranca Social',
    description: 'Calcular e submeter contribuicoes SS',
    icon: Shield
  },
  'iva-calculator': {
    label: 'Calculadora IVA',
    description: 'Ferramentas de calculo de IVA',
    icon: Calculator
  },
  'reports': {
    label: 'Relatorios',
    description: 'Analise fiscal e exportacao de dados',
    icon: BarChart3
  },
  'settings': {
    label: 'Definicoes',
    description: 'Configurar perfil e preferencias',
    icon: Settings
  },
  'accountant': {
    label: 'Painel Contabilista',
    description: 'Gestao de clientes e validacao em massa',
    icon: Briefcase
  },
  'export': {
    label: 'Exportar',
    description: 'Exportar dados e relatorios',
    icon: Download
  },
  'ai-metrics': {
    label: 'Metricas IA',
    description: 'Monitorizar desempenho da IA',
    icon: Brain
  },
  'admin': {
    label: 'Administracao',
    description: 'Painel de administracao do sistema',
    icon: Settings
  },
  'users': {
    label: 'Utilizadores',
    description: 'Gerir utilizadores da plataforma',
    icon: Users
  },
  'partners': {
    label: 'Parceiros',
    description: 'Gerir parceiros e integracoes',
    icon: Users
  },
  'accountants': {
    label: 'Pedidos Contabilistas',
    description: 'Gerir pedidos de contabilistas',
    icon: Briefcase
  },
  'become-accountant': {
    label: 'Tornar-se Contabilista',
    description: 'Candidatura para contabilista certificado',
    icon: UserPlus
  },
  'onboarding': {
    label: 'Onboarding',
    description: 'Configuracao inicial da conta',
    icon: AppWindow
  },
  'install': {
    label: 'Instalar App',
    description: 'Instalar aplicacao no dispositivo',
    icon: AppWindow
  },
};

export function Breadcrumbs() {
  const location = useLocation();

  // Parse the pathname into segments
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Build breadcrumb items
  const homeMeta = routeMetadata[''] || { label: 'Inicio', description: 'Pagina inicial' };
  const breadcrumbs: BreadcrumbItem[] = [
    {
      label: 'Inicio',
      description: homeMeta.description,
      href: '/',
      icon: Home
    },
  ];

  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === pathSegments.length - 1;
    const meta = routeMetadata[segment] || {
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      description: `Pagina ${segment}`
    };

    breadcrumbs.push({
      label: meta.label,
      description: meta.description,
      href: isLast ? undefined : currentPath,
      icon: meta.icon,
    });
  });

  // Don't show breadcrumbs on dashboard (home)
  if (pathSegments.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        aria-label="Navegacao por breadcrumbs"
        className="mb-6"
        role="navigation"
      >
        <ol
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
          aria-label="Lista de navegacao"
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const Icon = item.icon;

            const content = (
              <span className="flex items-center gap-1.5">
                {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
                <span>{item.label}</span>
              </span>
            );

            return (
              <li
                key={index}
                className="flex items-center gap-1.5"
                aria-current={isLast ? 'page' : undefined}
              >
                {index > 0 && (
                  <ChevronRight
                    className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    {item.href ? (
                      <Link
                        to={item.href}
                        className={cn(
                          "flex items-center gap-1.5 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm",
                          index === 0 && "text-muted-foreground"
                        )}
                        aria-label={`Navegar para ${item.label}: ${item.description}`}
                      >
                        {content}
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          "font-medium cursor-default",
                          isLast && "text-foreground"
                        )}
                        aria-label={`Pagina atual: ${item.label}`}
                      >
                        {content}
                      </span>
                    )}
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-[200px] text-center"
                    role="tooltip"
                  >
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>
      </nav>
    </TooltipProvider>
  );
}
