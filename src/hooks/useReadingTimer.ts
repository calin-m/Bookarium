import { useEffect, useRef } from 'react';
import { useHabitsStore } from '@/stores/useHabitsStore';

export interface UseReadingTimerOptions {
  bookId?: number;
  enabled?: boolean;
  userId?: string;
  idleTimeoutMs?: number; // default: 120,000 (2 minutes)
  flushIntervalMs?: number; // default: 15,000 (15 seconds)
  isPlayingTTS?: boolean; // whether Text-to-Speech audio narration is active
}

/**
 * useReadingTimer
 *
 * Silently records authentic reading and listening durations while interacting with a volume.
 * Protects telemetry integrity with a 2-minute idle detection guard, background tab visibility
 * pausing for visual reading, and audio-aware background tracking for speech synthesis.
 */
export function useReadingTimer({
  bookId,
  enabled = true,
  userId,
  idleTimeoutMs = 120000,
  flushIntervalMs = 15000,
  isPlayingTTS = false,
}: UseReadingTimerOptions = {}) {
  const accumulatedReadingSecondsRef = useRef<number>(0);
  const accumulatedListeningSecondsRef = useRef<number>(0);
  const lastInteractionTimeRef = useRef<number>(0);
  const isTabVisibleRef = useRef<boolean>(true);
  const isPlayingTTSRef = useRef<boolean>(isPlayingTTS);

  // Keep isPlayingTTSRef synchronized with current prop
  useEffect(() => {
    isPlayingTTSRef.current = isPlayingTTS;
    if (isPlayingTTS) {
      lastInteractionTimeRef.current = Date.now();
    }
  }, [isPlayingTTS]);

  // Helper to flush accumulated seconds to store
  const flushTime = useRef(() => {
    const readingSeconds = accumulatedReadingSecondsRef.current;
    const listeningSeconds = accumulatedListeningSecondsRef.current;

    if (readingSeconds > 0) {
      useHabitsStore.getState().addReadingDuration(readingSeconds, userId);
      accumulatedReadingSecondsRef.current = 0;
    }

    if (listeningSeconds > 0) {
      useHabitsStore.getState().addListeningDuration(listeningSeconds, userId);
      accumulatedListeningSecondsRef.current = 0;
    }
  });

  // Track user interactions (resets idle guard)
  const registerInteraction = useRef(() => {
    lastInteractionTimeRef.current = Date.now();
  });

  useEffect(() => {
    if (!enabled || !bookId) return;

    const flush = flushTime.current;
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

    // 1-second ticker accumulating active reading or listening time
    const tickInterval = setInterval(() => {
      if (isPlayingTTSRef.current) {
        // Audio narration is playing: count as listening time (including background tabs)
        accumulatedListeningSecondsRef.current += 1;
        return;
      }

      // Visual reading: must be visible and within idle timeout
      if (!isTabVisibleRef.current) return;

      const now = Date.now();
      const isIdle = now - lastInteractionTimeRef.current > idleTimeoutMs;

      if (!isIdle) {
        accumulatedReadingSecondsRef.current += 1;
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

      // Flush any remaining active durations on unmount
      flush();
    };
  }, [bookId, enabled, userId, idleTimeoutMs, flushIntervalMs]);

  return {
    registerInteraction: () => registerInteraction.current(),
  };
}

