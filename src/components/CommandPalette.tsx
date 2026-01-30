import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import {
  FileText,
  Upload,
  CheckCircle,
  TrendingUp,
  ClipboardList,
  Shield,
  Receipt,
  Calculator,
  Settings,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  path: string;
  shortcut: string;
  shortcutKeys: string[];
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

const commands: CommandItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    shortcut: 'g d',
    shortcutKeys: ['g', 'd'],
    icon: FileText,
    keywords: ['home', 'inicio', 'principal'],
  },
  {
    id: 'upload',
    label: 'Carregar Factura',
    path: '/upload',
    shortcut: 'g u',
    shortcutKeys: ['g', 'u'],
    icon: Upload,
    keywords: ['upload', 'importar', 'fatura', 'documento'],
  },
  {
    id: 'validation',
    label: 'Validar Compras',
    path: '/validation',
    shortcut: 'g v',
    shortcutKeys: ['g', 'v'],
    icon: CheckCircle,
    keywords: ['compras', 'validacao', 'verificar', 'purchases'],
  },
  {
    id: 'sales',
    label: 'Validar Vendas',
    path: '/sales',
    shortcut: 'g s',
    shortcutKeys: ['g', 's'],
    icon: TrendingUp,
    keywords: ['vendas', 'sales', 'receitas'],
  },
  {
    id: 'reports',
    label: 'Relatorios',
    path: '/reports',
    shortcut: 'g r',
    shortcutKeys: ['g', 'r'],
    icon: ClipboardList,
    keywords: ['reports', 'relatorio', 'exportar', 'analytics'],
  },
  {
    id: 'seguranca-social',
    label: 'Seguranca Social',
    path: '/seguranca-social',
    shortcut: 'g ss',
    shortcutKeys: ['g', 's', 's'],
    icon: Shield,
    keywords: ['ss', 'social', 'contribuicoes'],
  },
  {
    id: 'modelo-10',
    label: 'Modelo 10',
    path: '/modelo-10',
    shortcut: 'g m',
    shortcutKeys: ['g', 'm'],
    icon: Receipt,
    keywords: ['modelo10', 'irs', 'retencao', 'declaracao'],
  },
  {
    id: 'iva-calculator',
    label: 'Calculadora IVA',
    path: '/iva-calculator',
    shortcut: 'g c',
    shortcutKeys: ['g', 'c'],
    icon: Calculator,
    keywords: ['calculator', 'iva', 'vat', 'calcular', 'imposto'],
  },
  {
    id: 'settings',
    label: 'Definicoes',
    path: '/settings',
    shortcut: 'g ,',
    shortcutKeys: ['g', ','],
    icon: Settings,
    keywords: ['settings', 'configuracoes', 'conta', 'perfil', 'preferences'],
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const keySequence = useRef<string[]>([]);
  const keySequenceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  // Handle Cmd+K / Ctrl+K to open palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // Don't process shortcuts if palette is open or if we're in an input
      if (open) return;

      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
                     target.tagName === 'TEXTAREA' ||
                     target.isContentEditable;

      if (isInput) return;

      // Handle global shortcuts (g + key sequences)
      const key = e.key.toLowerCase();

      // Clear sequence after timeout
      if (keySequenceTimeout.current) {
        clearTimeout(keySequenceTimeout.current);
      }

      keySequenceTimeout.current = setTimeout(() => {
        keySequence.current = [];
      }, 800);

      // Add key to sequence
      keySequence.current.push(key);

      // Check for matching commands
      for (const command of commands) {
        const shortcutKeys = command.shortcutKeys;
        const sequence = keySequence.current;

        // Check if sequence matches shortcut
        if (sequence.length === shortcutKeys.length) {
          const matches = shortcutKeys.every((k, i) => sequence[i] === k);
          if (matches) {
            e.preventDefault();
            keySequence.current = [];
            navigate(command.path);
            return;
          }
        }
      }

      // If sequence is too long without match, reset
      if (keySequence.current.length > 3) {
        keySequence.current = [];
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (keySequenceTimeout.current) {
        clearTimeout(keySequenceTimeout.current);
      }
    };
  }, [open, navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Pesquisar comandos..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        <CommandGroup heading="Navegacao">
          {commands.map((command) => {
            const Icon = command.icon;
            return (
              <CommandItem
                key={command.id}
                value={`${command.label} ${command.keywords?.join(' ') || ''}`}
                onSelect={() => handleSelect(command.path)}
                className="cursor-pointer"
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{command.label}</span>
                <CommandShortcut>{command.shortcut}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
