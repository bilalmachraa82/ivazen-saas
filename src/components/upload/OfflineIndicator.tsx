import { WifiOff, Cloud, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface OfflineIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  onSync: () => void;
}

export function OfflineIndicator({ 
  isOnline, 
  isSyncing, 
  pendingCount, 
  onSync 
}: OfflineIndicatorProps) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4 text-destructive" />
          <span className="text-sm text-muted-foreground">
            Modo offline
          </span>
        </>
      ) : (
        <>
          <Cloud className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Online
          </span>
        </>
      )}
      
      {pendingCount > 0 && (
        <>
          <Badge variant="secondary" className="ml-2">
            {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
          </Badge>
          
          {isOnline && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onSync}
              disabled={isSyncing}
              className="ml-auto"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  A sincronizar...
                </>
              ) : (
                'Sincronizar'
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
