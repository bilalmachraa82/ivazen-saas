import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SessionTimeoutOptions {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onTimeout?: () => void;
}

const DEFAULT_TIMEOUT_MINUTES = 30;
const DEFAULT_WARNING_MINUTES = 5;

export function useSessionTimeout(options: SessionTimeoutOptions = {}) {
  const { user, signOut } = useAuth();
  const {
    timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
    warningMinutes = DEFAULT_WARNING_MINUTES,
    onTimeout,
  } = options;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef(false);

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

  const handleLogout = useCallback(async () => {
    toast.error('Sessão expirada por inactividade. Por favor, faça login novamente.');
    await signOut();
    onTimeout?.();
  }, [signOut, onTimeout]);

  const showWarning = useCallback(() => {
    if (!warningShownRef.current) {
      warningShownRef.current = true;
      toast.warning(
        `A sua sessão irá expirar em ${warningMinutes} minutos por inactividade.`,
        {
          duration: 10000,
          action: {
            label: 'Manter sessão',
            onClick: () => resetTimer(),
          },
        }
      );
    }
  }, [warningMinutes]);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
    clearTimers();

    if (user) {
      // Set warning timer
      warningRef.current = setTimeout(showWarning, warningMs);
      // Set logout timer
      timeoutRef.current = setTimeout(handleLogout, timeoutMs);
    }
  }, [user, clearTimers, showWarning, handleLogout, warningMs, timeoutMs]);

  // Track user activity
  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    const handleActivity = () => {
      const now = Date.now();
      // Only reset if at least 1 second has passed (debounce)
      if (now - lastActivityRef.current > 1000) {
        resetTimer();
      }
    };

    // Initial timer setup
    resetTimer();

    // Add event listeners
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Handle visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const inactiveTime = Date.now() - lastActivityRef.current;
        if (inactiveTime >= timeoutMs) {
          handleLogout();
        } else if (inactiveTime >= warningMs && !warningShownRef.current) {
          showWarning();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimers();
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, resetTimer, clearTimers, handleLogout, showWarning, timeoutMs, warningMs]);

  return {
    resetTimer,
    lastActivity: lastActivityRef.current,
  };
}
