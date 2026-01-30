import { AlertTriangle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ProfileIncompleteWarningProps {
  missingNif?: boolean;
}

export function ProfileIncompleteWarning({ missingNif = true }: ProfileIncompleteWarningProps) {
  const navigate = useNavigate();

  if (!missingNif) return null;

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">Perfil Fiscal Incompleto</p>
        <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
          Complete o seu NIF no perfil para melhor detecção automática do tipo de factura.
        </p>
      </div>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => navigate('/settings')}
        className="shrink-0 border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
      >
        <Settings className="h-4 w-4 mr-1" />
        Completar
      </Button>
    </div>
  );
}
