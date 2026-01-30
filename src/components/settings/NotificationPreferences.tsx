import { Bell, BellOff, Send, Loader2, Calendar, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ZenCard } from '@/components/zen';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Skeleton } from '@/components/ui/skeleton';

const REMINDER_DAYS_OPTIONS = [
  { value: 1, label: '1 dia antes' },
  { value: 3, label: '3 dias antes' },
  { value: 7, label: '1 semana antes' },
  { value: 14, label: '2 semanas antes' },
];

export function NotificationPreferences() {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    preferences,
    isSavingPreferences,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendTestNotification,
  } = usePushNotifications();

  if (isLoading) {
    return (
      <ZenCard gradient="muted" className="shadow-xl">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </ZenCard>
    );
  }

  if (!isSupported) {
    return (
      <ZenCard gradient="muted" className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30">
              <BellOff className="h-5 w-5 text-muted-foreground" />
            </div>
            Notificações Push
          </CardTitle>
          <CardDescription>
            O seu navegador não suporta notificações push
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Para receber notificações de prazos fiscais, utilize um navegador moderno como Chrome, Firefox, Edge ou Safari.
          </p>
        </CardContent>
      </ZenCard>
    );
  }

  return (
    <ZenCard gradient="muted" withCircle className="shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          Notificações Push
          {isSubscribed && (
            <Badge variant="success" className="ml-2">Activas</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Receba lembretes de prazos fiscais no seu dispositivo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Push */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Notificações Push</p>
              <p className="text-sm text-muted-foreground">
                {permission === 'denied' 
                  ? 'Permissão bloqueada nas definições do navegador'
                  : isSubscribed 
                    ? 'A receber notificações neste dispositivo'
                    : 'Activar para receber lembretes'
                }
              </p>
            </div>
          </div>
          <Switch
            checked={isSubscribed}
            onCheckedChange={(checked) => checked ? subscribe() : unsubscribe()}
            disabled={permission === 'denied'}
          />
        </div>

        {isSubscribed && (
          <>
            {/* Notification Types */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Tipos de Notificação</Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Prazos Fiscais</p>
                      <p className="text-xs text-muted-foreground">IVA, SS, Modelo 10, IRS</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.deadline_reminders}
                    onCheckedChange={(checked) => updatePreferences({ deadline_reminders: checked })}
                    disabled={isSavingPreferences}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="text-sm font-medium">Facturas Pendentes</p>
                      <p className="text-xs text-muted-foreground">Lembrete de facturas por validar</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.pending_invoices}
                    onCheckedChange={(checked) => updatePreferences({ pending_invoices: checked })}
                    disabled={isSavingPreferences}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-3">
                    <Upload className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Novos Uploads</p>
                      <p className="text-xs text-muted-foreground">Quando clientes enviam facturas</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.new_uploads}
                    onCheckedChange={(checked) => updatePreferences({ new_uploads: checked })}
                    disabled={isSavingPreferences}
                  />
                </div>
              </div>
            </div>

            {/* Reminder Days */}
            {preferences.deadline_reminders && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Antecedência dos Lembretes</Label>
                <div className="grid grid-cols-2 gap-2">
                  {REMINDER_DAYS_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/30"
                    >
                      <Checkbox
                        id={`reminder-${option.value}`}
                        checked={preferences.reminder_days.includes(option.value)}
                        onCheckedChange={(checked) => {
                          const newDays = checked
                            ? [...preferences.reminder_days, option.value]
                            : preferences.reminder_days.filter(d => d !== option.value);
                          updatePreferences({ reminder_days: newDays });
                        }}
                        disabled={isSavingPreferences}
                      />
                      <Label 
                        htmlFor={`reminder-${option.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Test Notification */}
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestNotification}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Enviar Notificação de Teste
            </Button>
          </>
        )}

        {permission === 'denied' && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            As notificações foram bloqueadas. Para activar, aceda às definições do navegador e permita notificações para este site.
          </div>
        )}
      </CardContent>
    </ZenCard>
  );
}
