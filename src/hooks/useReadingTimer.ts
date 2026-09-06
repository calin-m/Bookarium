import { useEffect, useRef } from 'react';
import { useHabitsStore } from '@/stores/useHabitsStore';

export interface UseReadingTimerOptions {
  bookId?: number;
  enabled?: boolean;
  userId?: string;
  idleTimeoutMs?: number; // default: 120,000 (2 minutes)
  flushIntervalMs?: number; // default: 15,000 (15 seconds)
}

/**
 * useReadingTimer
 *
 * Silently records authentic reading duration while reading a volume.
 * Protects telemetry integrity with a 2-minute idle detection guard
 * and background tab visibility pausing.
 */
export function useReadingTimer({
  bookId,
  enabled = true,
  userId,
  idleTimeoutMs = 120000,
  flushIntervalMs = 15000,
}: UseReadingTimerOptions = {}) {
  const accumulatedSecondsRef = useRef<number>(0);
  const lastInteractionTimeRef = useRef<number>(0);
  const isTabVisibleRef = useRef<boolean>(true);

  // Helper to flush accumulated seconds to store
  const flushTime = useRef(() => {
    const seconds = accumulatedSecondsRef.current;
    if (seconds > 0) {
      useHabitsStore.getState().addReadingDuration(seconds, userId);
      accumulatedSecondsRef.current = 0;
    }
  });

  // Track user interactions (resets idle guard)
  const registerInteraction = useRef(() => {
    lastInteractionTimeRef.current = Date.now();
  });

  useEffect(() => {
    if (!enabled || !bookId) return;

    const flush = flushTime.current;

    // Immediately record that user read today
    useHabitsStore.getState().recordDailyActivity(undefined, userId);
    lastInteractionTimeRef.current = Date.now();

    const handleInteraction = () => {
      registerInteraction.current();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isTabVisibleRef.current = false;
        flush();
      } else {
        isTabVisibleRef.current = true;
        lastInteractionTimeRef.current = Date.now();
      }
    };

    // Listen to user reading gestures
    window.addEventListener('keydown', handleInteraction, { passive: true });
    window.addEventListener('scroll', handleInteraction, { passive: true });
    window.addEventListener('pointerdown', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 1-second ticker accumulating active time
    const tickInterval = setInterval(() => {
      if (!isTabVisibleRef.current) return;

      const now = Date.now();
      const isIdle = now - lastInteractionTimeRef.current > idleTimeoutMs;

      if (!isIdle) {
        accumulatedSecondsRef.current += 1;
      }
    }, 1000);

    // Periodic flush to persistent store
    const flushInterval = setInterval(() => {
      flush();
    }, flushIntervalMs);

    return () => {
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      clearInterval(tickInterval);
      clearInterval(flushInterval);

      // Flush any remaining active reading duration on unmount
      flush();
    };
  }, [bookId, enabled, userId, idleTimeoutMs, flushIntervalMs]);

  return {
    registerInteraction: () => registerInteraction.current(),
  };
}

