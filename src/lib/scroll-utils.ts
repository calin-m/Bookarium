export interface SmartScrollOptions {
  /** Offset in pixels from top of viewport, typically accounting for sticky navbar height (default: 80) */
  offsetTop?: number;
  /** Viewport height fraction within which the top of content is considered already in view (default: 0.45) */
  thresholdRatio?: number;
  /** Scroll behavior (default: 'smooth') */
  behavior?: ScrollBehavior;
}

/**
 * Smart threshold-based scroll utility for collection and catalog pagination.
 *
 * Why this exists:
 * Standard `element.scrollIntoView({ block: 'start' })` jumps abruptly to the top of outer section headers,
 * overshooting the content and forcing the user to scroll back down to find pagination controls.
 *
 * Behavior:
 * 1. If the content anchor is already comfortably visible below the navbar, zero scroll is performed.
 *    The content cross-fades seamlessly in place without jumping.
 * 2. If the user has scrolled down past the content (e.g. mobile vertical reading), it smoothly scrolls
 *    so the top of the content sits cleanly below the sticky navbar (`offsetTop`), never overshooting into
 *    the outer page headers.
 *
 * @returns boolean indicating whether a scroll action was triggered.
 */
export function smartScrollToContent(
  elementId: string,
  options: SmartScrollOptions = {}
): boolean {
  if (typeof window === 'undefined') return false;

  const {
    offsetTop = 80,
    thresholdRatio = 0.45,
    behavior = 'smooth',
  } = options;

  const el = document.getElementById(elementId);
  if (!el) return false;

  const rect = el.getBoundingClientRect();

  // Check if content top is already comfortably visible in viewport
  const isComfortablyInView =
    rect.top >= offsetTop - 24 &&
    rect.top <= window.innerHeight * thresholdRatio;

  if (isComfortablyInView) {
    return false;
  }

  const targetY = Math.max(0, (window.scrollY || 0) + rect.top - offsetTop);
  window.scrollTo({ top: targetY, behavior });
  return true;
}

