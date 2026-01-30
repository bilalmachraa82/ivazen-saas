import { useState, useCallback } from 'react';

interface RateLimitState {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
}

const STORAGE_KEY = 'auth_rate_limit';
const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30000; // 30 seconds
const MAX_LOCKOUT_MS = 900000; // 15 minutes

function getState(key: string): RateLimitState {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${key}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { attempts: 0, lastAttempt: 0, lockedUntil: 0 };
}

function setState(key: string, state: RateLimitState): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${key}`, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function clearState(key: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${key}`);
  } catch {
    // Ignore storage errors
  }
}

export function useRateLimiter() {
  const [remainingTime, setRemainingTime] = useState(0);

  const checkRateLimit = useCallback((identifier: string): { allowed: boolean; waitTime: number } => {
    const state = getState(identifier);
    const now = Date.now();

    // Check if currently locked
    if (state.lockedUntil > now) {
      const waitTime = Math.ceil((state.lockedUntil - now) / 1000);
      setRemainingTime(waitTime);
      return { allowed: false, waitTime };
    }

    // Reset attempts if last attempt was more than 30 minutes ago
    if (now - state.lastAttempt > 1800000) {
      clearState(identifier);
      setRemainingTime(0);
      return { allowed: true, waitTime: 0 };
    }

    setRemainingTime(0);
    return { allowed: true, waitTime: 0 };
  }, []);

  const recordFailedAttempt = useCallback((identifier: string): { locked: boolean; lockDuration: number } => {
    const state = getState(identifier);
    const now = Date.now();
    
    const newAttempts = state.attempts + 1;
    
    if (newAttempts >= MAX_ATTEMPTS) {
      // Calculate exponential backoff
      const lockoutMultiplier = Math.pow(2, Math.floor(newAttempts / MAX_ATTEMPTS) - 1);
      const lockDuration = Math.min(BASE_LOCKOUT_MS * lockoutMultiplier, MAX_LOCKOUT_MS);
      const lockedUntil = now + lockDuration;
      
      setState(identifier, {
        attempts: newAttempts,
        lastAttempt: now,
        lockedUntil,
      });
      
      const lockSeconds = Math.ceil(lockDuration / 1000);
      setRemainingTime(lockSeconds);
      
      return { locked: true, lockDuration: lockSeconds };
    }
    
    setState(identifier, {
      attempts: newAttempts,
      lastAttempt: now,
      lockedUntil: 0,
    });
    
    return { locked: false, lockDuration: 0 };
  }, []);

  const recordSuccess = useCallback((identifier: string): void => {
    clearState(identifier);
    setRemainingTime(0);
  }, []);

  const getRemainingAttempts = useCallback((identifier: string): number => {
    const state = getState(identifier);
    const now = Date.now();
    
    // Reset if last attempt was more than 30 minutes ago
    if (now - state.lastAttempt > 1800000) {
      return MAX_ATTEMPTS;
    }
    
    return Math.max(0, MAX_ATTEMPTS - state.attempts);
  }, []);

  return {
    checkRateLimit,
    recordFailedAttempt,
    recordSuccess,
    getRemainingAttempts,
    remainingTime,
    maxAttempts: MAX_ATTEMPTS,
  };
}
