import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface NotificationPreferences {
  deadline_reminders: boolean;
  pending_invoices: boolean;
  new_uploads: boolean;
  reminder_days: number[];
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  deadline_reminders: true,
  pending_invoices: true,
  new_uploads: true,
  reminder_days: [3, 7],
};

// Convert base64 string to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Load preferences and subscription status
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Load preferences
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (prefs) {
          setPreferences({
            deadline_reminders: prefs.deadline_reminders,
            pending_invoices: prefs.pending_invoices,
            new_uploads: prefs.new_uploads,
            reminder_days: prefs.reminder_days,
          });
        }

        // Check subscription status
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        setIsSubscribed(!!subs);
      } catch (error) {
        console.error('Error loading notification data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  // Request notification permission and subscribe
  const subscribe = useCallback(async () => {
    if (!user?.id || !isSupported) {
      toast.error('Notificações push não são suportadas neste navegador');
      return false;
    }

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error('Permissão para notificações foi negada');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // For demo purposes, we'll use a placeholder VAPID key
      // In production, this should come from your backend
      const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
      
      // Subscribe to push
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const subJson = subscription.toJSON();
      
      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh,
          auth: subJson.keys!.auth,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      // Create default preferences if not exists
      await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...DEFAULT_PREFERENCES,
        }, {
          onConflict: 'user_id',
        });

      setIsSubscribed(true);
      toast.success('Notificações push activadas!');
      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      toast.error('Erro ao activar notificações');
      return false;
    }
  }, [user?.id, isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user?.id) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);

      setIsSubscribed(false);
      toast.success('Notificações push desactivadas');
      return true;
    } catch (error) {
      console.error('Unsubscribe error:', error);
      toast.error('Erro ao desactivar notificações');
      return false;
    }
  }, [user?.id]);

  // Update preferences
  const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    if (!user?.id) return false;

    setIsSavingPreferences(true);
    try {
      const updated = { ...preferences, ...newPrefs };
      
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...updated,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      setPreferences(updated);
      toast.success('Preferências guardadas');
      return true;
    } catch (error) {
      console.error('Save preferences error:', error);
      toast.error('Erro ao guardar preferências');
      return false;
    } finally {
      setIsSavingPreferences(false);
    }
  }, [user?.id, preferences]);

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    if (!isSubscribed) {
      toast.error('Primeiro active as notificações');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user?.id,
          title: 'Teste IVAzen',
          body: 'As notificações push estão a funcionar correctamente!',
          type: 'test',
        },
      });

      if (error) throw error;
      toast.success('Notificação de teste enviada');
    } catch (error) {
      console.error('Test notification error:', error);
      toast.error('Erro ao enviar notificação de teste');
    }
  }, [isSubscribed, user?.id]);

  return {
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
  };
}
