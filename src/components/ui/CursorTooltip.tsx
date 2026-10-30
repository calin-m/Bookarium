'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check } from 'lucide-react';
import { DEFAULT_TOOLTIP_DELAY_MS } from '@/hooks/useCursorTooltip';
import { buildBookShareUrl } from '@/lib/redirect-sanitizer';

export const BOOK_LINK_COPIED_EVENT = 'bookarium:book-link-copied';
export const COPY_FEEDBACK_DURATION_MS = 1800;

/**
 * Copies the canonical, origin-validated book link (`/read/:id`) to the clipboard
 * and broadcasts a synchronization event for inline tactile indicators and floating tooltips.
 */
export function copyBookLinkToClipboard(bookId: number | string): string {
  const normalizedId = String(bookId);
  const shareUrl = buildBookShareUrl(bookId);

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(BOOK_LINK_COPIED_EVENT, {
        detail: { bookId: normalizedId, url: shareUrl },
      })
    );
  }

  return shareUrl;
}

/**
 * Event handler helper for unified Title + Author blocks (`[data-copy-book-id]`).
 * Stops click/key event propagation so parent cards or spines do not navigate to the reader,
 * and copies the canonical book link to the clipboard.
 */
export function handleCopyBookLinkClick(
  e: React.MouseEvent | React.KeyboardEvent,
  bookId: number | string
): void {
  if ('key' in e && e.key !== 'Enter' && e.key !== ' ') {
    return;
  }
  if ('key' in e) {
    e.preventDefault();
  }
  e.stopPropagation();
  (e.nativeEvent as Event & { __bookLinkCopied?: boolean }).__bookLinkCopied = true;
  copyBookLinkToClipboard(bookId);
}

/**
 * Subtle inline tactile & desktop affordance rendered beside the book author name
 * inside unified `[data-copy-book-id]` title/author blocks.
 */
export const CopyBookLinkIndicator: React.FC<{
  bookId: number | string;
  className?: string;
}> = ({ bookId, className = '' }) => {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleCopied = (e: Event) => {
      const customEvent = e as CustomEvent<{ bookId: string }>;
      if (customEvent.detail?.bookId === String(bookId)) {
        setIsCopied(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setIsCopied(false);
        }, COPY_FEEDBACK_DURATION_MS);
      }
    };

    window.addEventListener(BOOK_LINK_COPIED_EVENT, handleCopied);
    return () => {
      window.removeEventListener(BOOK_LINK_COPIED_EVENT, handleCopied);
      if (timer) clearTimeout(timer);
    };
  }, [bookId]);

  return (
    <span
      data-testid={`copy-book-link-indicator-${bookId}`}
      aria-hidden="true"
      className={`inline-flex items-center gap-0.5 ml-1.5 align-middle transition-all duration-150 shrink-0 ${
        isCopied
          ? 'text-emerald-600 dark:text-emerald-400 opacity-100 font-mono text-[10px] font-semibold'
          : 'text-muted-foreground opacity-55 group-hover/copy:opacity-100 group-hover/copy:text-primary'
      } ${className}`.trim()}
    >
      {isCopied ? (
        <>
          <Check className="w-3 h-3 shrink-0" />
          <span>Copied!</span>
        </>
      ) : (
        <Copy className="w-3 h-3 shrink-0" />
      )}
    </span>
  );
};

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
  return target.closest<HTMLElement>(
    '[title], [data-tooltip], [data-original-title], [data-copy-book-id]'
  );
}

/**
 * Global event-delegated stylized tooltip controller.
 * Automatically upgrades native HTML `title` and `data-tooltip` attributes across the entire app
 * into Bookarium's stylized `CursorTooltip` with a unified 300ms hover delay while suppressing
 * the browser's unstyled OS tooltip during active hover.
 * Also supports `[data-copy-book-id]` unified Title + Author blocks with proprietary Lucide `Copy`
 * and `Check` icons and instant in-place `"Copied link to book!"` confirmation.
 */
export const GlobalTitleTooltip: React.FC<{ delayMs?: number }> = ({
  delayMs = DEFAULT_TOOLTIP_DELAY_MS,
}) => {
  const [tooltipText, setTooltipText] = useState<string>('');
  const [copyBookId, setCopyBookId] = useState<string | null>(null);
  const [isCopiedFeedback, setIsCopiedFeedback] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRevertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const clearActiveTooltip = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (copyRevertTimerRef.current) {
        clearTimeout(copyRevertTimerRef.current);
        copyRevertTimerRef.current = null;
      }
      if (activeElementRef.current) {
        restoreElementTitle(activeElementRef.current);
        activeElementRef.current = null;
      }
      setIsVisible(false);
      setTooltipText('');
      setCopyBookId(null);
      setIsCopiedFeedback(false);
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
      const rawCopyId = targetEl.getAttribute('data-copy-book-id')?.trim() || null;

      if (!trimmed && !rawCopyId) {
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
      if (copyRevertTimerRef.current) {
        clearTimeout(copyRevertTimerRef.current);
        copyRevertTimerRef.current = null;
      }

      activeElementRef.current = targetEl;
      setTooltipText(trimmed);
      setCopyBookId(rawCopyId);
      setIsCopiedFeedback(false);
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

    const handleMouseDown = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-copy-book-id]')) {
        return;
      }
      if (activeElementRef.current || timerRef.current) {
        clearActiveTooltip();
      }
    };

    const handleDismiss = () => {
      if (activeElementRef.current || timerRef.current) {
        clearActiveTooltip();
      }
    };

    const handleDocumentClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const copyEl = e.target.closest<HTMLElement>('[data-copy-book-id]');
      if (!copyEl) return;
      const bookId = copyEl.getAttribute('data-copy-book-id')?.trim();
      if (bookId && !(e as MouseEvent & { __bookLinkCopied?: boolean }).__bookLinkCopied) {
        copyBookLinkToClipboard(bookId);
      }
    };

    const handleBookLinkCopied = (e: Event) => {
      const customEvent = e as CustomEvent<{ bookId: string; url: string }>;
      const copiedBookId = customEvent.detail?.bookId;
      if (!copiedBookId) return;

      if (
        activeElementRef.current &&
        activeElementRef.current.getAttribute('data-copy-book-id') === copiedBookId
      ) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (copyRevertTimerRef.current) {
          clearTimeout(copyRevertTimerRef.current);
        }
        setCopyBookId(copiedBookId);
        setIsCopiedFeedback(true);
        setIsVisible(true);

        copyRevertTimerRef.current = setTimeout(() => {
          setIsCopiedFeedback(false);
          copyRevertTimerRef.current = null;
        }, COPY_FEEDBACK_DURATION_MS);
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('mousedown', handleMouseDown, { passive: true });
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleDismiss, { passive: true });
    window.addEventListener('scroll', handleDismiss, { passive: true, capture: true });
    window.addEventListener(BOOK_LINK_COPIED_EVENT, handleBookLinkCopied);

    return () => {
      clearActiveTooltip();
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleDismiss);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener(BOOK_LINK_COPIED_EVENT, handleBookLinkCopied);
    };
  }, [delayMs]);

  return (
    <CursorTooltip
      isVisible={isVisible && Boolean(tooltipText || isCopiedFeedback)}
      mousePos={mousePos}
      multiline={!isCopiedFeedback && tooltipText.length > 42}
      testId="global-cursor-tooltip"
    >
      {isCopiedFeedback ? (
        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>Copied link to book!</span>
        </span>
      ) : copyBookId ? (
        <span className="inline-flex items-center gap-1.5">
          <Copy className="w-3 h-3 text-primary shrink-0" />
          <span>{tooltipText}</span>
        </span>
      ) : (
        <span>{tooltipText}</span>
      )}
    </CursorTooltip>
  );
};


