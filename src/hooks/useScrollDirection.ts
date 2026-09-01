'use client';

import { useState, useEffect, useRef } from 'react';

export interface UseScrollDirectionOptions {
  threshold?: number;
  gestureEndTimeoutMs?: number;
  topOffset?: number;
  heroDockSelector?: string;
  enabled?: boolean;
}

export interface ScrollNavState {
  isHeaderVisible: boolean;
  isToolbarVisible: boolean;
}

/**
 * useScrollDirection
 * Implements a strict session-isolated 3-state bidirectional scroll pipeline with Hero section guard:
 * 
 * 1. Hero Guard (scrollY <= dockOffset):
 *    - State 0: BOTH_VISIBLE (Nothing hides while browsing the Hero section)
 * 
 * 2. Past Hero Section:
 *    - 1 Continuous Scroll Session = EXACTLY 1 State Step (regardless of distance or mouse wheel velocity).
 *    - Scroll DOWN gesture 1: State 0 (Both) -> State 1 (Toolbar Only @ top-0)
 *    - Scroll DOWN gesture 2: State 1 (Toolbar Only) -> State 2 (Both Hidden)
 *    - Scroll UP gesture 1:   State 2 (Both Hidden) -> State 1 (Toolbar Only @ top-0)
 *    - Scroll UP gesture 2:   State 1 (Toolbar Only) -> State 0 (Both Visible @ top-16)
 *    - Reversing direction mid-scroll immediately unlocks and executes 1 step in the new direction.
 */
export function useScrollDirection({
  threshold = 15,
  gestureEndTimeoutMs = 180,
  topOffset = 64,
  heroDockSelector = '#catalog-section',
  enabled = true,
}: UseScrollDirectionOptions = {}): ScrollNavState {
  const [navState, setNavState] = useState<ScrollNavState>({
    isHeaderVisible: true,
    isToolbarVisible: true,
  });

  const stateRef = useRef<ScrollNavState>({
    isHeaderVisible: true,
    isToolbarVisible: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    let lastScrollY = window.scrollY || window.pageYOffset || 0;
    let accumulatedDelta = 0;
    let currentDir: 'down' | 'up' | null = null;
    let hasSteppedInCurrentGesture = false;
    let gestureTimer: ReturnType<typeof setTimeout> | null = null;
    let ticking = false;

    const resetGesture = () => {
      hasSteppedInCurrentGesture = false;
      accumulatedDelta = 0;
      currentDir = null;
    };

    const updateScrollDir = () => {
      ticking = false;
      const scrollY = window.scrollY || window.pageYOffset || 0;

      // Find the hero dock point (e.g. top of catalog section minus header + toolbar height)
      let dockOffset = topOffset;
      if (heroDockSelector) {
        const el = document.querySelector(heroDockSelector) as HTMLElement | null;
        if (el) {
          dockOffset = Math.max(topOffset, el.offsetTop - 120);
        }
      }

      // 1. Hero Guard: While in Hero section, EVERYTHING stays visible
      if (scrollY <= dockOffset) {
        if (!stateRef.current.isHeaderVisible || !stateRef.current.isToolbarVisible) {
          const next = { isHeaderVisible: true, isToolbarVisible: true };
          stateRef.current = next;
          setNavState(next);
        }
        lastScrollY = scrollY;
        resetGesture();
        return;
      }

      const diff = scrollY - lastScrollY;
      const newDir = diff > 0 ? 'down' : diff < 0 ? 'up' : null;

      // If user reverses direction mid-scroll, immediately reset session lock for instant response
      if (newDir && newDir !== currentDir) {
        currentDir = newDir;
        hasSteppedInCurrentGesture = false;
        accumulatedDelta = 0;
      }

      accumulatedDelta += Math.abs(diff);

      // Refresh the gesture end timeout on every scroll event
      if (gestureTimer) {
        clearTimeout(gestureTimer);
      }
      gestureTimer = setTimeout(() => {
        resetGesture();
      }, gestureEndTimeoutMs);

      // Only allow EXACTLY 1 state transition per continuous scroll gesture
      if (!hasSteppedInCurrentGesture && accumulatedDelta >= threshold && currentDir) {
        let changed = false;
        let next = { ...stateRef.current };

        if (currentDir === 'down') {
          // State 0 (Both Visible) -> State 1 (Toolbar Only at top-0)
          if (stateRef.current.isHeaderVisible) {
            next = { isHeaderVisible: false, isToolbarVisible: true };
            changed = true;
          }
          // State 1 (Toolbar Only) -> State 2 (Both Hidden)
          else if (stateRef.current.isToolbarVisible) {
            next = { isHeaderVisible: false, isToolbarVisible: false };
            changed = true;
          }
        } else if (currentDir === 'up') {
          // State 2 (Both Hidden) -> State 1 (Toolbar Only at top-0)
          if (!stateRef.current.isToolbarVisible) {
            next = { isHeaderVisible: false, isToolbarVisible: true };
            changed = true;
          }
          // State 1 (Toolbar Only) -> State 0 (Both Visible: Header at 0, Toolbar at 16)
          else if (!stateRef.current.isHeaderVisible) {
            next = { isHeaderVisible: true, isToolbarVisible: true };
            changed = true;
          }
        }

        if (changed) {
          stateRef.current = next;
          setNavState(next);
          hasSteppedInCurrentGesture = true;
          accumulatedDelta = 0;
        }
      }

      lastScrollY = scrollY > 0 ? scrollY : 0;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateScrollDir);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (gestureTimer) {
        clearTimeout(gestureTimer);
      }
    };
  }, [threshold, gestureEndTimeoutMs, topOffset, heroDockSelector, enabled]);

  if (!enabled) {
    return { isHeaderVisible: true, isToolbarVisible: true };
  }

  return navState;
}
