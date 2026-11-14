'use client';

import { useEffect, useRef, type RefObject } from 'react';

const TABBABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseDialogFocusTrapOptions {
  /** Whether the modal or drawer is currently open. */
  isOpen: boolean;
  /** Container element that bounds Tab / Shift+Tab navigation. */
  containerRef: RefObject<HTMLElement | null>;
  /** Callback invoked when the user presses Escape. */
  onClose: () => void;
  /** Move initial focus to the first tabbable child on open when outside container (default: true). */
  autoFocus?: boolean;
}

/**
 * Shared accessible focus-trap, Escape dismissal, and previous-focus restoration
 * hook used across dialogs and bottom sheets.
 */
export function useDialogFocusTrap({
  isOpen,
  containerRef,
  onClose,
  autoFocus = true,
}: UseDialogFocusTrapOptions): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== 'undefined') {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    }

    const getTabbableElements = (): HTMLElement[] => {
      if (!containerRef.current) return [];
      return Array.from(containerRef.current.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
    };

    const timer = autoFocus
      ? setTimeout(() => {
          if (
            containerRef.current &&
            (!document.activeElement || !containerRef.current.contains(document.activeElement))
          ) {
            const tabbables = getTabbableElements();
            if (tabbables.length > 0) {
              tabbables[0].focus({ preventScroll: true });
            }
          }
        }, 0)
      : undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const tabbables = getTabbableElements();
        if (tabbables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = tabbables[0];
        const lastElement = tabbables[tabbables.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === firstElement ||
            !containerRef.current?.contains(document.activeElement)
          ) {
            e.preventDefault();
            lastElement.focus({ preventScroll: true });
          }
        } else {
          if (
            document.activeElement === lastElement ||
            !containerRef.current?.contains(document.activeElement)
          ) {
            e.preventDefault();
            firstElement.focus({ preventScroll: true });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      window.removeEventListener('keydown', handleKeyDown);
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === 'function' &&
        typeof document !== 'undefined' &&
        document.body.contains(previousFocusRef.current)
      ) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [isOpen, containerRef, autoFocus]);
}
