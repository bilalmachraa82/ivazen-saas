/**
 * useOnboardingProgress Hook
 *
 * Manages user onboarding progress tracking.
 * Uses database for persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface OnboardingProgress {
  completedSteps: string[];
  isLoading: boolean;
  error: Error | null;
  completeStep: (stepId: string) => Promise<void>;
  resetProgress: () => Promise<void>;
  dismissOnboarding: () => void;
  isDismissed: boolean;
}

export function useOnboardingProgress(): OnboardingProgress {
  const { user } = useAuth();
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Load progress from database
  useEffect(() => {
    const loadProgress = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('user_onboarding_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data) {
          setCompletedSteps(data.completed_steps || []);
          setIsDismissed(data.is_dismissed || false);
        } else {
          // Create initial record
          const { error: insertError } = await supabase
            .from('user_onboarding_progress')
            .insert({
              user_id: user.id,
              completed_steps: [],
              is_dismissed: false,
            });

          if (insertError && !insertError.message.includes('duplicate')) {
            throw insertError;
          }

          setCompletedSteps([]);
          setIsDismissed(false);
        }
      } catch (err) {
        console.error('Error loading onboarding progress:', err);
        setError(err instanceof Error ? err : new Error('Failed to load progress'));
      } finally {
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [user]);

  /**
   * Mark a step as completed
   */
  const completeStep = useCallback(async (stepId: string): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check if already completed
    if (completedSteps.includes(stepId)) {
      return;
    }

    const newSteps = [...completedSteps, stepId];

    try {
      const { error: updateError } = await supabase
        .from('user_onboarding_progress')
        .update({ completed_steps: newSteps })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setCompletedSteps(newSteps);
    } catch (err) {
      console.error('Error completing step:', err);
      throw err;
    }
  }, [user, completedSteps]);

  /**
   * Reset all progress (useful for testing or re-onboarding)
   */
  const resetProgress = useCallback(async (): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { error: updateError } = await supabase
        .from('user_onboarding_progress')
        .update({ 
          completed_steps: [],
          is_dismissed: false,
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setCompletedSteps([]);
      setIsDismissed(false);
    } catch (err) {
      console.error('Error resetting progress:', err);
      throw err;
    }
  }, [user]);

  /**
   * Dismiss the onboarding checklist (hide it from view)
   */
  const dismissOnboarding = useCallback(async () => {
    if (!user) return;

    try {
      const { error: updateError } = await supabase
        .from('user_onboarding_progress')
        .update({ is_dismissed: true })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setIsDismissed(true);
    } catch (err) {
      console.error('Error dismissing onboarding:', err);
    }
  }, [user]);

  return {
    completedSteps,
    isLoading,
    error,
    completeStep,
    resetProgress,
    dismissOnboarding,
    isDismissed,
  };
}
