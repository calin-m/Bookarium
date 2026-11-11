import { useEffect } from 'react';

export interface UseMobileViewportCardFocusOptions<T extends string | number> {
  /** ID of the DOM container holding the cards */
  containerId: string;
  /** Data attribute name on each card element (e.g. 'data-bookmark-card-id' or 'data-notebook-quote-id') */
  cardDataAttribute: string;
  /** Parser converting the raw attribute string into the typed ID (or null if invalid) */
  parseCardId: (rawAttr: string | null) => T | null;
  /** Setter invoked when the focused card ID changes or clears */
  onActiveIdChange: (id: T | null) => void;
  /** Viewport vertical ratio for the central focus band (default: 0.45) */
  focusBandRatio?: number;
  /** Dependencies that should re-trigger initial evaluation when the card list or pagination changes */
  deps?: ReadonlyArray<unknown>;
}

/**
 * Shared single-column mobile (`window.innerWidth < 1024`) scroll/resize focus zone
 * and outside-tap dismissal hook used by `BookmarksView` and `NotebookView`.
 */
export function useMobileViewportCardFocus<T extends string | number>({
  containerId,
  cardDataAttribute,
  parseCardId,
  onActiveIdChange,
  focusBandRatio = 0.45,
  deps = [],
}: UseMobileViewportCardFocusOptions<T>): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const selector = `[${cardDataAttribute}]`;

    const handleScrollOrResize = () => {
      if (window.innerWidth >= 1024) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const cardEls = Array.from(
        container.querySelectorAll<HTMLElement>(selector)
      );
      if (cardEls.length === 0) return;

      // Top boundary: near page top
      if (window.scrollY <= 32) {
        const firstId = parseCardId(cardEls[0].getAttribute(cardDataAttribute));
        if (firstId !== null) {
          onActiveIdChange(firstId);
          return;
        }
      }

      // Bottom boundary: near page bottom
      const isAtBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 32;
      if (isAtBottom) {
        const lastId = parseCardId(
          cardEls[cardEls.length - 1].getAttribute(cardDataAttribute)
        );
        if (lastId !== null) {
          onActiveIdChange(lastId);
          return;
        }
      }

      // Viewport central focus band
      const targetY = window.innerHeight * focusBandRatio;
      let closestId: T | null = null;
      let minDistance = Infinity;

      for (const el of cardEls) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
          const cardCenterY = rect.top + rect.height / 2;
          const dist = Math.abs(cardCenterY - targetY);
          if (dist < minDistance) {
            minDistance = dist;
            const parsed = parseCardId(el.getAttribute(cardDataAttribute));
            if (parsed !== null) {
              closestId = parsed;
            }
          }
        }
      }

      if (closestId !== null) {
        onActiveIdChange(closestId);
      }
    };

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScrollOrResize);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    handleScrollOrResize();

    // Tap outside cards clears active state
    const handleDocumentPointerDown = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        typeof target.closest !== 'function' ||
        !target.closest(selector)
      ) {
        onActiveIdChange(null);
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, {
      passive: true,
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, cardDataAttribute, focusBandRatio, ...deps]);
}
