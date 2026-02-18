import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Breadcrumbs } from './Breadcrumbs';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccountantClients } from '@/hooks/useAccountantClients';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { ClientSearchSelector } from '@/components/ui/client-search-selector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InstallBanner } from '@/components/pwa/InstallBanner';
import { FloatingInstallButton } from '@/components/pwa/FloatingInstallButton';
import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  FileText,
  Upload,
  CheckCircle,
  Download,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  WifiOff,
  Wifi,
  Loader2,
  Shield,
  BarChart3,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Receipt,
  ClipboardList,
  Briefcase,
  Calculator,
  ChevronDown,
  LayoutDashboard,
  PieChart,
  Landmark,
  User,
  BookOpen,
  FileOutput,
  FileSpreadsheet,
  HelpCircle,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

// Definição dos grupos de navegação — fluxo linear "Declaração Periódica (IVA)"
const navGroups = [
  {
    id: 'inicio',
    label: 'Início',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: FileText, tourId: 'nav-dashboard' },
    ]
  },
  {
    id: 'declaracao-periodica',
    label: 'Declaração Periódica (IVA)',
    icon: Landmark,
    items: [
      { href: '/upload', label: '1. Carregar Faturas', icon: Upload, tourId: 'nav-upload' },
      { href: '/validation', label: '2. Compras', icon: CheckCircle, tourId: 'nav-validation' },
      { href: '/sales', label: '3. Vendas', icon: TrendingUp, tourId: 'nav-sales' },
      { href: '/export', label: '4. Apuramento', icon: FileOutput, tourId: 'nav-export' },
    ]
  },
  {
    id: 'importacao',
    label: 'Importação Automática',
    icon: FileSpreadsheet,
    items: [
      { href: '/efatura', label: 'e-Fatura (Portal AT)', icon: FileSpreadsheet, tourId: 'nav-efatura' },
    ]
  },
  {
    id: 'obrigacoes',
    label: 'Obrigações Fiscais',
    icon: Receipt,
    items: [
      { href: '/modelo-10', label: 'Modelo 10 (Retenções)', icon: Receipt, tourId: 'nav-modelo10' },
      { href: '/seguranca-social', label: 'Segurança Social', icon: Shield, tourId: 'nav-ss' },
      { href: '/iva-calculator', label: 'Calculadora IVA', icon: Calculator, tourId: 'nav-vat' },
    ]
  },
  {
    id: 'analise',
    label: 'Análise',
    icon: PieChart,
    items: [
      { href: '/documents', label: 'Todos os Documentos', icon: List, tourId: 'nav-documents' },
      { href: '/reports', label: 'Relatórios', icon: ClipboardList, tourId: 'nav-reports' },
      { href: '/glossario', label: 'Glossário', icon: BookOpen, tourId: 'nav-glossario' },
    ]
  },
  {
    id: 'conta',
    label: 'Conta',
    icon: User,
    items: [
      { href: '/settings', label: 'Definições', icon: Settings, tourId: 'nav-settings' },
    ]
  },
];

const adminNavItems = [
  { href: '/admin/super', label: 'Super Admin', icon: BarChart3 },
  { href: '/admin/users', label: 'Utilizadores', icon: Users },
  { href: '/admin/accountants', label: 'Contabilistas', icon: Briefcase },
  { href: '/admin/partners', label: 'Parceiros', icon: ShieldCheck },
];

// Componente para renderizar um grupo colapsável
interface NavGroupProps {
  group: typeof navGroups[0];
  isOpen: boolean;
  onToggle: () => void;
  location: ReturnType<typeof useLocation>;
  onItemClick?: () => void;
}

function NavGroup({ group, isOpen, onToggle, location, onItemClick }: NavGroupProps) {
  const GroupIcon = group.icon;
  const hasActiveItem = group.items.some(item => location.pathname === item.href);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            hasActiveItem
              ? "text-sidebar-primary-foreground bg-sidebar-accent/50"
              : "text-sidebar-foreground hover:bg-sidebar-accent/30"
          )}
        >
          <div className="flex items-center gap-3">
            <GroupIcon className="h-4 w-4" />
            <span>{group.label}</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="pl-4 mt-1 space-y-0.5">
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onItemClick}
                data-tour={item.tourId}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isOnline, isSyncing, pendingCount, syncPendingUploads } = useOfflineSync();
  const { isInstalled } = usePWAInstall();
  const { clients, isAccountant, isLoading: isLoadingClients } = useAccountantClients();
  const { selectedClientId, setSelectedClientId } = useSelectedClient();

  // Resolve selected client for display
  const selectedClient = selectedClientId
    ? clients.find(c => c.id === selectedClientId) ?? null
    : null;

  // Estado para grupos colapsáveis (desktop)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Abrir o grupo que contém a página atual por defeito
    const initialState: Record<string, boolean> = {};
    navGroups.forEach(group => {
      const hasActiveItem = group.items.some(item => location.pathname === item.href);
      initialState[group.id] = hasActiveItem;
    });
    // Se nenhum grupo está ativo, abrir o primeiro
    if (!Object.values(initialState).some(v => v)) {
      initialState['inicio'] = true;
    }
    return initialState;
  });

  // Estado para grupos colapsáveis (mobile)
  const [mobileOpenGroups, setMobileOpenGroups] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    navGroups.forEach(group => {
      const hasActiveItem = group.items.some(item => location.pathname === item.href);
      initialState[group.id] = hasActiveItem;
    });
    if (!Object.values(initialState).some(v => v)) {
      initialState['inicio'] = true;
    }
    return initialState;
  });

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin-nav', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      });

      if (error) {
        console.warn('[DashboardLayout] has_role(admin) failed', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user?.id,
  });

  // Session timeout: 30 minutes of inactivity, warning at 5 minutes before
  useSessionTimeout({ timeoutMinutes: 30, warningMinutes: 5 });

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleMobileGroup = (groupId: string) => {
    setMobileOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <span className="font-semibold text-foreground">Raquel</span>
        </Link>
        <div className="flex items-center gap-2">
          {/* Mobile Offline Indicator */}
          <div className="flex items-center gap-1.5">
            {!isOnline ? (
              <WifiOff className="h-4 w-4 text-destructive" />
            ) : (
              <Wifi className="h-4 w-4 text-primary" />
            )}
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                {pendingCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "lg:hidden fixed top-16 left-0 bottom-0 z-40 w-72 bg-sidebar transform transition-transform duration-200 overflow-y-auto",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <nav className="p-4 space-y-2">
          {/* Client Selector for Accountants - Mobile */}
          {isAccountant && clients.length > 0 && (
            <div className="pb-3 mb-3 border-b border-sidebar-border">
              <div className="flex items-center gap-2 px-3 pb-2">
                <Users className="h-4 w-4 text-sidebar-foreground/60" />
                <span className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Cliente Activo</span>
              </div>
              <div className="px-1">
                <ClientSearchSelector
                  clients={clients}
                  selectedClientId={selectedClientId}
                  onSelect={setSelectedClientId}
                  isLoading={isLoadingClients}
                  className="w-full"
                  placeholder="Selecionar cliente..."
                />
                {selectedClient && selectedClient.nif && (
                  <p className="text-[10px] text-sidebar-foreground/50 font-mono mt-1 px-2">NIF: {selectedClient.nif}</p>
                )}
              </div>
            </div>
          )}

          {navGroups.map((group) => (
            <NavGroup
              key={group.id}
              group={group}
              isOpen={mobileOpenGroups[group.id]}
              onToggle={() => toggleMobileGroup(group.id)}
              location={location}
              onItemClick={() => setMobileMenuOpen(false)}
            />
          ))}

          {/* Admin Section - Mobile */}
          {isAdmin && (
            <div className="pt-4 mt-4 border-t-2 border-orange-500/50">
              <div className="flex items-center gap-2 px-3 pb-2">
                <ShieldCheck className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider">
                  Admin
                </span>
                <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 border-orange-500 text-orange-500">
                  Restrito
                </Badge>
              </div>
              <div className="space-y-0.5">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-4",
                        isActive
                          ? "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                          : "text-sidebar-foreground hover:bg-orange-500/10"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Install App Link - Mobile */}
          {!isInstalled && (
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <div className="flex items-center gap-2 px-3 pb-2">
                <Smartphone className="h-4 w-4 text-sidebar-foreground/60" />
                <span className="text-xs font-semibold text-sidebar-foreground/60 uppercase">App</span>
              </div>
              <Link
                to="/install"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-4",
                  location.pathname === '/install'
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Download className="h-4 w-4" />
                Instalar App
              </Link>
            </div>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-sidebar flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="p-2 bg-sidebar-primary rounded-lg">
              <FileText className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-foreground">Raquel</h1>
              <p className="text-xs text-sidebar-foreground/60">Assistente IVA</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Client Selector for Accountants - Desktop */}
          {isAccountant && clients.length > 0 && (
            <div className="pb-3 mb-3 border-b border-sidebar-border">
              <div className="flex items-center gap-2 px-3 pb-2">
                <Users className="h-4 w-4 text-sidebar-foreground/60" />
                <span className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Cliente Activo</span>
              </div>
              <div className="px-1">
                <ClientSearchSelector
                  clients={clients}
                  selectedClientId={selectedClientId}
                  onSelect={setSelectedClientId}
                  isLoading={isLoadingClients}
                  className="w-full"
                  placeholder="Selecionar cliente..."
                />
                {selectedClient && selectedClient.nif && (
                  <p className="text-[10px] text-sidebar-foreground/50 font-mono mt-1 px-2">NIF: {selectedClient.nif}</p>
                )}
              </div>
            </div>
          )}

          {navGroups.map((group) => (
            <NavGroup
              key={group.id}
              group={group}
              isOpen={openGroups[group.id]}
              onToggle={() => toggleGroup(group.id)}
              location={location}
            />
          ))}

          {/* Admin Section - Desktop */}
          {isAdmin && (
            <div className="pt-4 mt-4 border-t-2 border-orange-500/50">
              <div className="flex items-center gap-2 px-3 pb-2">
                <ShieldCheck className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider">
                  Admin
                </span>
                <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 border-orange-500 text-orange-500">
                  Restrito
                </Badge>
              </div>
              <div className="space-y-0.5">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-4",
                        isActive
                          ? "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                          : "text-sidebar-foreground hover:bg-orange-500/10"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Install App Link - Desktop */}
          {!isInstalled && (
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <div className="flex items-center gap-2 px-3 pb-2">
                <Smartphone className="h-4 w-4 text-sidebar-foreground/60" />
                <span className="text-xs font-semibold text-sidebar-foreground/60 uppercase">App</span>
              </div>
              <Link
                to="/install"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-4",
                  location.pathname === '/install'
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Download className="h-4 w-4" />
                Instalar App
              </Link>
            </div>
          )}
        </nav>

        {/* Desktop Offline Indicator */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-sidebar-accent/50">
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <>
                  <WifiOff className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-sidebar-foreground">Offline</span>
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 text-primary" />
                  <span className="text-xs text-sidebar-foreground">Online</span>
                </>
              )}
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                </Badge>
                {isOnline && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={syncPendingUploads}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <span className="text-sm font-medium text-sidebar-foreground">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <InstallBanner />
        <div className="p-6 lg:p-8">
          <Breadcrumbs />
          {children}
        </div>
      </main>

      {/* Floating Install Button */}
      <FloatingInstallButton />

      {/* Command Palette (Cmd+K) */}
      <CommandPalette />

      {/* Keyboard Shortcuts Help (Shift+? or Cmd+/) */}
      <KeyboardShortcutsHelp />
    </div>
  );
}
