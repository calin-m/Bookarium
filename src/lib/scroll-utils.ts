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

export interface HorizontalScrollOptions {
  /** Movement in pixels before pointer down is treated as a drag instead of a click (default: 5) */
  dragThreshold?: number;
}

/**
 * Attaches seamless vertical mouse-wheel and pointer click-and-drag (grab-to-scroll)
 * behavior to a horizontally scrollable container, with automatic click-suppression
 * on child buttons when dragging.
 *
 * @returns Cleanup function removing all registered event listeners.
 */
export function attachHorizontalDragAndWheelScroll(
  el: HTMLElement,
  options: HorizontalScrollOptions = {}
): () => void {
  if (!el || typeof window === 'undefined') return () => {};

  const { dragThreshold = 5 } = options;

  let isPointerDown = false;
  let hasDragged = false;
  let startX = 0;
  let startScrollLeft = 0;

  // 1. Mouse wheel translation (vertical deltaY -> horizontal scrollLeft)
  const handleWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  };

  // 2. Mouse down initiation
  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;

    isPointerDown = true;
    hasDragged = false;
    startX = e.clientX;
    startScrollLeft = el.scrollLeft;
  };

  // 3. Mouse move dragging on window
  const handleMouseMove = (e: MouseEvent) => {
    if (!isPointerDown) return;

    const dx = e.clientX - startX;

    if (!hasDragged && Math.abs(dx) > dragThreshold) {
      hasDragged = true;
      el.classList.add('cursor-grabbing');
      el.classList.remove('cursor-grab');
    }

    if (hasDragged) {
      e.preventDefault();
      el.scrollLeft = startScrollLeft - dx;
    }
  };

  // 4. Mouse up / cancel dragging
  const handleMouseUp = () => {
    if (!isPointerDown) return;
    isPointerDown = false;
    el.classList.remove('cursor-grabbing');
    el.classList.add('cursor-grab');
  };

  // 5. Capture-phase click suppression (prevents button click if user dragged > dragThreshold)
  const handleClickCapture = (e: MouseEvent) => {
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
      hasDragged = false;
    }
  };

  el.addEventListener('wheel', handleWheel, { passive: false });
  el.addEventListener('mousedown', handleMouseDown);
  el.addEventListener('click', handleClickCapture, { capture: true });
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  return () => {
    el.removeEventListener('wheel', handleWheel);
    el.removeEventListener('mousedown', handleMouseDown);
    el.removeEventListener('click', handleClickCapture, { capture: true });
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}

