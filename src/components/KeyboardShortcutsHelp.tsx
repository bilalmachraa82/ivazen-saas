import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navegacao',
    shortcuts: [
      { keys: ['Cmd', 'K'], description: 'Abrir Command Palette' },
      { keys: ['g', 'd'], description: 'Ir para Dashboard' },
      { keys: ['g', 'u'], description: 'Ir para Upload' },
      { keys: ['g', 'v'], description: 'Ir para Compras' },
      { keys: ['g', 's'], description: 'Ir para Vendas' },
      { keys: ['g', 'r'], description: 'Ir para Relatorios' },
      { keys: ['g', 'm'], description: 'Ir para Modelo 10' },
      { keys: ['g', 'c'], description: 'Ir para Calculadora' },
      { keys: ['g', ','], description: 'Ir para Definicoes' },
    ],
  },
  {
    title: 'Geral',
    shortcuts: [
      { keys: ['Esc'], description: 'Fechar modal/dialog' },
      { keys: ['?'], description: 'Mostrar esta ajuda' },
      { keys: ['<-'], description: 'Navegar para item anterior' },
      { keys: ['->'], description: 'Navegar para proximo item' },
      { keys: ['Enter'], description: 'Confirmar/Selecionar' },
    ],
  },
];

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium text-foreground bg-muted border border-border rounded shadow-sm">
      {children}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, index) => (
          <span key={index} className="flex items-center">
            <KeyboardKey>{key}</KeyboardKey>
            {index < shortcut.keys.length - 1 && (
              <span className="mx-0.5 text-muted-foreground text-xs">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if we're in an input or the dialog is already open
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
                   target.tagName === 'TEXTAREA' ||
                   target.isContentEditable;

    // Shift+? or Cmd+/ to open help
    if (e.shiftKey && e.key === '?') {
      if (!isInput) {
        e.preventDefault();
        setOpen(true);
      }
    } else if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos de Teclado
          </DialogTitle>
          <DialogDescription>
            Utilize estes atalhos para navegar mais rapidamente na aplicacao.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-foreground mb-2 pb-1 border-b border-border">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.shortcuts.map((shortcut, index) => (
                  <ShortcutRow key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Prima <KeyboardKey>?</KeyboardKey> ou <KeyboardKey>Cmd</KeyboardKey>
            <span className="mx-0.5 text-muted-foreground">+</span>
            <KeyboardKey>/</KeyboardKey> para mostrar esta ajuda
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
