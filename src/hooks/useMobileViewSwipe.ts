'use client';

import { useRef, useCallback, useState } from 'react';
import type { ViewId } from '@/config/views.config';

export const MOBILE_VIEW_ORDER: readonly ViewId[] = [
  'catalog',
  'bookshelf',
  'favorites',
  'notebook',
  'bookmarks',
  'account',
] as const;

export interface MobileViewSwipeConfig {
  minDistancePx?: number;
  maxDurationMs?: number;
  dominanceRatio?: number;
  edgeDeadZonePx?: number;
  wrapAround?: boolean;
}

export const DEFAULT_MOBILE_VIEW_SWIPE_CONFIG: Required<MobileViewSwipeConfig> = {
  minDistancePx: 40,
  maxDurationMs: 650,
  dominanceRatio: 1.25,
  edgeDeadZonePx: 20,
  wrapAround: true,
};

export interface UseMobileViewSwipeOptions {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  onSwipeDirection?: (direction: 'forward' | 'backward') => void;
  enabled?: boolean;
  config?: MobileViewSwipeConfig;
}

export interface UseMobileViewSwipeReturn {
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  handleTouchCancel: () => void;
  lastSwipeDirection: 'forward' | 'backward' | null;
}

/**
 * Headless touch gesture hook encapsulating full-page horizontal swipe
 * navigation between top-level mobile views.
 *
 * Implements safety guards tuned for zero false negatives and natural thumb ergonomics:
 * 1. Minimal edge dead-zones (20px) protecting native iOS Safari and Android back/forward gestures without rejecting bezel-adjacent swipes.
 * 2. Interactive text/scroll suppression (ignoring touches inside text inputs, horizontal scrollers [data-no-swipe], or dialogs, while permitting fluid swipes over buttons/links).
 * 3. Relaxed dominance ratio (1.25) accommodating natural biomechanical thumb arcs (up to ~38.6°).
 * 4. Forgiving duration (650ms) and distance (40px) ensuring relaxed or deliberate swipes register every time.
 */
export function useMobileViewSwipe({
  activeView,
  onViewChange,
  onSwipeDirection,
  enabled = true,
  config,
}: UseMobileViewSwipeOptions): UseMobileViewSwipeReturn {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [lastSwipeDirection, setLastSwipeDirection] = useState<'forward' | 'backward' | null>(null);

  const minDistancePx = config?.minDistancePx ?? DEFAULT_MOBILE_VIEW_SWIPE_CONFIG.minDistancePx;
  const maxDurationMs = config?.maxDurationMs ?? DEFAULT_MOBILE_VIEW_SWIPE_CONFIG.maxDurationMs;
  const dominanceRatio = config?.dominanceRatio ?? DEFAULT_MOBILE_VIEW_SWIPE_CONFIG.dominanceRatio;
  const edgeDeadZonePx = config?.edgeDeadZonePx ?? DEFAULT_MOBILE_VIEW_SWIPE_CONFIG.edgeDeadZonePx;
  const wrapAround = config?.wrapAround ?? DEFAULT_MOBILE_VIEW_SWIPE_CONFIG.wrapAround;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.touches[0];

      // 1. Guard against native browser edge swipe navigation (iOS Safari / Android system back-forward)
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
      if (touch.clientX < edgeDeadZonePx || touch.clientX > windowWidth - edgeDeadZonePx) {
        touchStartRef.current = null;
        return;
      }

      // 2. Guard against touch originating inside text fields, horizontal carousels, or dialogs
      const target = e.target as HTMLElement | null;
      if (
        target &&
        typeof target.closest === 'function' &&
        target.closest('input, textarea, select, [data-no-swipe], [role="dialog"]')
      ) {
        touchStartRef.current = null;
        return;
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    },
    [enabled, edgeDeadZonePx]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !touchStartRef.current || e.changedTouches.length !== 1) {
        touchStartRef.current = null;
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        typeof target.closest === 'function' &&
        target.closest('input, textarea, select, [data-no-swipe], [role="dialog"]')
      ) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      // 3. Strict horizontal dominance, velocity, and distance check
      if (
        deltaTime <= maxDurationMs &&
        Math.abs(deltaX) >= minDistancePx &&
        Math.abs(deltaX) >= Math.abs(deltaY) * dominanceRatio
      ) {
        if (e.cancelable) {
          e.preventDefault();
        }

        const currentIndex = MOBILE_VIEW_ORDER.indexOf(activeView);
        if (currentIndex === -1) return;

        if (deltaX < 0) {
          // Swiped Left -> Advance to next view
          if (currentIndex < MOBILE_VIEW_ORDER.length - 1) {
            setLastSwipeDirection('forward');
            onSwipeDirection?.('forward');
            onViewChange(MOBILE_VIEW_ORDER[currentIndex + 1]);
          } else if (wrapAround) {
            setLastSwipeDirection('forward');
            onSwipeDirection?.('forward');
            onViewChange(MOBILE_VIEW_ORDER[0]);
          }
        } else {
          // Swiped Right -> Return to previous view
          if (currentIndex > 0) {
            setLastSwipeDirection('backward');
            onSwipeDirection?.('backward');
            onViewChange(MOBILE_VIEW_ORDER[currentIndex - 1]);
          } else if (wrapAround) {
            setLastSwipeDirection('backward');
            onSwipeDirection?.('backward');
            onViewChange(MOBILE_VIEW_ORDER[MOBILE_VIEW_ORDER.length - 1]);
          }
        }
      }
    },
    [enabled, activeView, onViewChange, onSwipeDirection, minDistancePx, maxDurationMs, dominanceRatio, wrapAround]
  );

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  return {
    handleTouchStart,
    handleTouchEnd,
    handleTouchCancel,
    lastSwipeDirection,
  };
}

