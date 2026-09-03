'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseCursorTooltipOptions<T = string> {
  delayMs?: number;
  initialAction?: T | null;
}

/**
 * Headless hook managing mouse position coordinates, delayed hover triggers,
 * and active action states for cursor-tracking portal tooltips.
 */
export function useCursorTooltip<T = string>(options: UseCursorTooltipOptions<T> = {}) {
  const { delayMs = 400, initialAction = null } = options;
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<T | null>(initialAction);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, delayMs);
  }, [delayMs]);

  const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    setMousePos({
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setShowTooltip(false);
    setHoveredAction(initialAction);
    setMousePos(null);
  }, [initialAction]);

  return {
    mousePos,
    setMousePos,
    showTooltip,
    hoveredAction,
    setHoveredAction,
    setShowTooltip,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
  };
}
