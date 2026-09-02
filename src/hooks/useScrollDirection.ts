'use client';

import { useState, useEffect, useRef } from 'react';

export interface UseScrollDirectionOptions {
  threshold?: number;
  continuousThreshold?: number;
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
 * Implements a calibrated 3-state bidirectional scroll pipeline with Hero section guard:
 * 
 * 1. Hero Guard (scrollY <= dockOffset):
 *    - State 0: BOTH_VISIBLE (Nothing hides while browsing the Hero section)
 * 
 * 2. Past Hero Section:
 *    - Discrete Swipes: Each distinct swipe (after gestureEndTimeoutMs) steps 1 state (threshold: 15px).
 *    - Continuous Swipes: A long continuous swipe steps State 0 -> State 1 (at 15px), then State 1 -> State 2 (at continuousThreshold: 120px).
 *    - Reversing direction mid-scroll immediately unlocks and executes instant 15px response in the new direction.
 */
export function useScrollDirection({
  threshold = 15,
  continuousThreshold = 120,
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
    let wasInHero = true;

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
        wasInHero = true;
        return;
      }

      // 2. Initial Dock Transition Guard:
      // When scrolling down and the filter bar first reaches the header (dockOffset),
      // the filter bar docks under the header while the header remains visible.
      // The header does not hide immediately; only when the user scrolls down again does it hide.
      if (wasInHero) {
        wasInHero = false;
        hasSteppedInCurrentGesture = true;
        accumulatedDelta = 0;
        lastScrollY = scrollY;
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

      // Determine required delta: initial step uses threshold, continuous progression uses continuousThreshold
      const requiredDelta = hasSteppedInCurrentGesture ? continuousThreshold : threshold;

      if (accumulatedDelta >= requiredDelta && currentDir) {
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
  }, [threshold, continuousThreshold, gestureEndTimeoutMs, topOffset, heroDockSelector, enabled]);

  if (!enabled) {
    return { isHeaderVisible: true, isToolbarVisible: true };
  }

  return navState;
}
