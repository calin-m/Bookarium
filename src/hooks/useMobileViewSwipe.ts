'use client';

import { useRef, useCallback } from 'react';
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
}

export const DEFAULT_MOBILE_VIEW_SWIPE_CONFIG: Required<MobileViewSwipeConfig> = {
  minDistancePx: 50,
  maxDurationMs: 500,
  dominanceRatio: 1.8,
  edgeDeadZonePx: 25,
};

export interface UseMobileViewSwipeOptions {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  enabled?: boolean;
  config?: MobileViewSwipeConfig;
}

export interface UseMobileViewSwipeReturn {
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Headless touch gesture hook encapsulating full-page horizontal swipe
 * navigation between top-level mobile views.
 *
 * Implements 4 safety guards:
 * 1. Edge dead-zones (25px) protecting native iOS Safari and Android system back/forward gestures.
 * 2. Interactive control suppression (ignoring touches starting on inputs, buttons, links, or modals).
 * 3. Directional dominance ratio (requiring horizontal movement to strongly exceed vertical scrolling).
 * 4. Velocity and distance thresholds (requiring a deliberate, prompt flick).
 */
export function useMobileViewSwipe({
  activeView,
  onViewChange,
  enabled = true,
  config,
}: UseMobileViewSwipeOptions): UseMobileViewSwipeReturn {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const minDistancePx = config?.minDistancePx ?? DEFAULT_MOBILE_VIEW_SWIPE_CONFIG.minDistancePx;
  const maxDurationMs = config?.maxDurationMs ?? DEFAULT_MOBILE_VIEW_SWIPE_CONFIG.maxDurationMs;
  const dominanceRatio = config?.dominanceRatio ?? DEFAULT_MOBILE_VIEW_SWIPE_CONFIG.dominanceRatio;
  const edgeDeadZonePx = config?.edgeDeadZonePx ?? DEFAULT_MOBILE_VIEW_SWIPE_CONFIG.edgeDeadZonePx;

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

      // 2. Guard against touch originating inside interactive controls, text fields, or dialogs
      const target = e.target as HTMLElement | null;
      if (
        target &&
        typeof target.closest === 'function' &&
        target.closest('input, textarea, select, button, a, [data-no-swipe], [role="dialog"]')
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
        const currentIndex = MOBILE_VIEW_ORDER.indexOf(activeView);
        if (currentIndex === -1) return;

        if (deltaX < 0) {
          // Swiped Left -> Advance to next view
          if (currentIndex < MOBILE_VIEW_ORDER.length - 1) {
            onViewChange(MOBILE_VIEW_ORDER[currentIndex + 1]);
          }
        } else {
          // Swiped Right -> Return to previous view
          if (currentIndex > 0) {
            onViewChange(MOBILE_VIEW_ORDER[currentIndex - 1]);
          }
        }
      }
    },
    [enabled, activeView, onViewChange, minDistancePx, maxDurationMs, dominanceRatio]
  );

  return {
    handleTouchStart,
    handleTouchEnd,
  };
}

