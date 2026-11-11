import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseAmbientDockScrollStateOptions {
  /** Optional external visibility override */
  isVisible?: boolean;
  /** Scroll threshold parameter (preserved for prop compatibility) */
  threshold?: number;
  /** Idle duration in milliseconds after scrolling stops before the dock dims */
  idleTimeoutMs?: number;
  /** Whether an associated search bar or filter drawer is currently open (prevents idle dimming) */
  isPinnedAwake?: boolean;
  /** Scroll Y threshold in pixels below which the dock is considered at the top of the page (default: 60) */
  topThresholdPx?: number;
}

export interface AmbientDockScrollState {
  effectiveVisible: boolean;
  currentScrollY: number;
  isIdle: boolean;
  isHovered: boolean;
  isAtTop: boolean;
  isDockDimmed: boolean;
  handlePointerEnter: () => void;
  handlePointerLeave: () => void;
  handlePointerDown: () => void;
}

/**
 * Shared scroll-idle state machine for bottom floating capsule docks (`CollectionBottomDock`
 * and `CatalogMobileBottomDock`). Tracks scroll position, post-scroll idle dimming,
 * top-of-page threshold (`scrollY < 60`), and pointer/touch wake interactions.
 */
export function useAmbientDockScrollState(
  options: UseAmbientDockScrollStateOptions = {}
): AmbientDockScrollState {
  const {
    isVisible,
    threshold = 200,
    idleTimeoutMs = 1600,
    isPinnedAwake = false,
    topThresholdPx = 60,
  } = options;

  const [internalVisible, setInternalVisible] = useState(true);
  const [currentScrollY, setCurrentScrollY] = useState(0);
  const [isIdle, setIsIdle] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      setCurrentScrollY(scrollY);
      if (isVisible === undefined) {
        setInternalVisible(true);
      }

      setIsIdle(false);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (idleTimeoutMs > 0) {
        idleTimerRef.current = setTimeout(() => {
          setIsIdle(true);
        }, idleTimeoutMs);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [isVisible, threshold, idleTimeoutMs]);

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    if (idleTimeoutMs > 0) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(
        () => setIsIdle(true),
        idleTimeoutMs
      );
    }
  }, [idleTimeoutMs]);

  const handlePointerDown = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const effectiveVisible =
    isVisible !== undefined ? isVisible : internalVisible;
  const isAtTop = currentScrollY < topThresholdPx;
  const isDockDimmed =
    (isIdle || isAtTop) && !isHovered && !isPinnedAwake;

  return {
    effectiveVisible,
    currentScrollY,
    isIdle,
    isHovered,
    isAtTop,
    isDockDimmed,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerDown,
  };
}
