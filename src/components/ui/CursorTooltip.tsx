'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_TOOLTIP_DELAY_MS } from '@/hooks/useCursorTooltip';

export interface CursorTooltipProps {
  isVisible: boolean;
  mousePos: { x: number; y: number } | null;
  offset?: { x: number; y: number };
  children: React.ReactNode;
  className?: string;
  testId?: string;
  multiline?: boolean;
}

/**
 * Reusable zero-clipping cursor-tracking portal tooltip.
 * Renders directly into document.body to prevent parent container overflow clipping,
 * with automatic viewport right/bottom boundary flipping and optional multi-line wrapping.
 */
export const CursorTooltip: React.FC<CursorTooltipProps> = ({
  isVisible,
  mousePos,
  offset = { x: 12, y: 14 },
  children,
  className = '',
  testId = 'cursor-tooltip',
  multiline = false,
}) => {
  if (!isVisible || !mousePos || typeof document === 'undefined') {
    return null;
  }

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  const flipX = viewportWidth > 0 && mousePos.x > viewportWidth - 220;
  const flipY = viewportHeight > 0 && mousePos.y > viewportHeight - 80;

  const transformValue =
    !flipX && !flipY
      ? `translate3d(${offset.x}px, ${offset.y}px, 0)`
      : `translate3d(${flipX ? `calc(-100% - ${offset.x}px)` : `${offset.x}px`}, ${
          flipY ? `calc(-100% - ${offset.y}px)` : `${offset.y}px`
        }, 0)`;

  return createPortal(
    <div
      data-testid={testId}
      className={`fixed z-[9999] pointer-events-none items-center transition-opacity duration-150 animate-in fade-in select-none ${className}`}
      style={{
        left: `${mousePos.x}px`,
        top: `${mousePos.y}px`,
        transform: transformValue,
      }}
    >
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-900/95 dark:bg-stone-950/95 text-white text-[10px] sm:text-[11px] font-mono font-medium shadow-xl backdrop-blur-xs border border-white/15 ${
          multiline
            ? 'max-w-[260px] sm:max-w-[320px] whitespace-normal text-pretty leading-snug'
            : 'whitespace-nowrap'
        }`}
      >
        {children}
      </span>
    </div>,
    document.body
  );
};

function restoreElementTitle(el: HTMLElement | null) {
  if (!el) return;
  const original = el.getAttribute('data-original-title');
  if (original !== null) {
    if (!el.hasAttribute('title')) {
      el.setAttribute('title', original);
    }
    el.removeAttribute('data-original-title');
  }
}

function findTooltipTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  if (target.closest('[data-cursor-tooltip-zone="true"]')) return null;
  return target.closest<HTMLElement>('[title], [data-tooltip], [data-original-title]');
}

/**
 * Global event-delegated stylized tooltip controller.
 * Automatically upgrades native HTML `title` and `data-tooltip` attributes across the entire app
 * into Bookarium's stylized `CursorTooltip` with a unified 300ms hover delay while suppressing
 * the browser's unstyled OS tooltip during active hover.
 */
export const GlobalTitleTooltip: React.FC<{ delayMs?: number }> = ({
  delayMs = DEFAULT_TOOLTIP_DELAY_MS,
}) => {
  const [tooltipText, setTooltipText] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const clearActiveTooltip = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (activeElementRef.current) {
        restoreElementTitle(activeElementRef.current);
        activeElementRef.current = null;
      }
      setIsVisible(false);
      setTooltipText('');
      setMousePos(null);
    };

    const handleMouseOver = (e: MouseEvent) => {
      if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover: none)').matches
      ) {
        return;
      }

      const targetEl = findTooltipTarget(e.target);
      if (!targetEl) {
        clearActiveTooltip();
        return;
      }

      const rawTitle =
        targetEl.getAttribute('title') ??
        targetEl.getAttribute('data-tooltip') ??
        targetEl.getAttribute('data-original-title') ??
        '';
      const trimmed = rawTitle.trim();
      if (!trimmed) {
        clearActiveTooltip();
        return;
      }

      if (targetEl.hasAttribute('title')) {
        targetEl.setAttribute('data-original-title', rawTitle);
        targetEl.removeAttribute('title');
      }

      setMousePos({ x: e.clientX, y: e.clientY });

      if (activeElementRef.current === targetEl) {
        return;
      }

      if (activeElementRef.current && activeElementRef.current !== targetEl) {
        restoreElementTitle(activeElementRef.current);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      activeElementRef.current = targetEl;
      setTooltipText(trimmed);
      setIsVisible(false);

      timerRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delayMs);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!activeElementRef.current) return;
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (!activeElementRef.current) return;
      const related = e.relatedTarget as Node | null;
      if (related && activeElementRef.current.contains(related)) {
        const nestedTarget = findTooltipTarget(related);
        if (!nestedTarget || nestedTarget === activeElementRef.current) {
          return;
        }
      }
      clearActiveTooltip();
    };

    const handleDismiss = () => {
      if (activeElementRef.current || timerRef.current) {
        clearActiveTooltip();
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('mousedown', handleDismiss, { passive: true });
    document.addEventListener('keydown', handleDismiss, { passive: true });
    window.addEventListener('scroll', handleDismiss, { passive: true, capture: true });

    return () => {
      clearActiveTooltip();
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('mousedown', handleDismiss);
      document.removeEventListener('keydown', handleDismiss);
      window.removeEventListener('scroll', handleDismiss, true);
    };
  }, [delayMs]);

  return (
    <CursorTooltip
      isVisible={isVisible && Boolean(tooltipText)}
      mousePos={mousePos}
      multiline={tooltipText.length > 42}
      testId="global-cursor-tooltip"
    >
      <span>{tooltipText}</span>
    </CursorTooltip>
  );
};


