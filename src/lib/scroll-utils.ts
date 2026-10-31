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

/**
 * Resolves the `data-tab-id` of the tab button inside `container` whose horizontal
 * bounding box contains `clientX` (bridging small flex gaps between buttons when
 * `clientX` is within the bar's overall horizontal span, with fallback to
 * `document.elementFromPoint`).
 */
export function resolveScrubbedTabId<T extends string = string>(
  container: HTMLElement | null,
  clientX: number,
  clientY?: number,
  options?: { clampToEdges?: boolean }
): T | null {
  if (!container) return null;

  const buttons = Array.from(container.querySelectorAll<HTMLElement>('[data-tab-id]'));
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let closestBtn: HTMLElement | null = null;
  let closestDist = Infinity;

  for (const btn of buttons) {
    const rect = btn.getBoundingClientRect();
    if (rect.width > 0) {
      if (rect.left < minLeft) minLeft = rect.left;
      if (rect.right > maxRight) maxRight = rect.right;

      if (clientX >= rect.left && clientX <= rect.right) {
        const id = btn.getAttribute('data-tab-id');
        if (id) return id as T;
      }

      const dist = clientX < rect.left ? rect.left - clientX : clientX - rect.right;
      if (dist < closestDist) {
        closestDist = dist;
        closestBtn = btn;
      }
    }
  }

  // Bridge inter-button flex gaps (up to 16px from nearest button) or clamp to outermost tab when clampToEdges is enabled
  if (
    closestBtn &&
    (options?.clampToEdges || (clientX >= minLeft && clientX <= maxRight && closestDist <= 16))
  ) {
    const id = closestBtn.getAttribute('data-tab-id');
    if (id) return id as T;
  }

  if (typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
    const hit = document.elementFromPoint(clientX, clientY ?? 0);
    const tabBtn = hit?.closest?.('[data-tab-id]');
    if (tabBtn && container.contains(tabBtn)) {
      const id = tabBtn.getAttribute('data-tab-id');
      if (id) return id as T;
    }
  }

  return null;
}

export interface TabScrubberOptions {
  /** Minimum horizontal drag distance in pixels before live scrubbing activates (default: 4) */
  scrubThreshold?: number;
}

interface InternalScrubState {
  isScrubbing: boolean;
  isTouch: boolean;
  hasMoved: boolean;
  startX: number;
  startIndex: number;
  lastTabId: string | null;
  suppressClick: boolean;
  initialRects: DOMRect[];
  containerWidth: number;
  cleanupWindowListeners: (() => void) | null;
}

const scrubStateMap = new WeakMap<HTMLElement, InternalScrubState>();
const scrubCallbackMap = new WeakMap<HTMLElement, (tabId: string) => void>();

function applyScrubPreview(container: HTMLElement, activeTabId: string) {
  container.setAttribute('data-scrubbing', 'true');
  const buttons = Array.from(container.querySelectorAll<HTMLElement>('[data-tab-id]'));
  for (const btn of buttons) {
    if (btn.getAttribute('data-tab-id') === activeTabId) {
      btn.setAttribute('data-scrub-active', 'true');
      btn.removeAttribute('data-scrub-inactive');
    } else {
      btn.setAttribute('data-scrub-inactive', 'true');
      btn.removeAttribute('data-scrub-active');
    }
  }
}

function clearScrubPreview(container: HTMLElement | null) {
  if (!container) return;
  container.removeAttribute('data-scrubbing');
  const buttons = Array.from(container.querySelectorAll<HTMLElement>('[data-tab-id]'));
  for (const btn of buttons) {
    btn.removeAttribute('data-scrub-active');
    btn.removeAttribute('data-scrub-inactive');
  }
}

/**
 * Creates React pointer, mouse, and touch event handlers enabling continuous
 * bidirectional live tab scrubbing across `[data-tab-id]` buttons.
 *
 * - Persists scrub state in a module-level `WeakMap` and tracks movement on `window`
 *   so React re-renders and vertical cursor drift never interrupt multi-tab dragging.
 * - Supports one-finger relative thumb-arc stepping on wide mobile touch screens.
 * - Applies `[data-scrubbing="true"]` and `[data-scrub-active="true"]` DOM attributes
 *   for real-time visual feedback and suppresses post-drag synthetic clicks.
 */
export function createTabScrubberHandlers<T extends string>(
  onSelectTab: ((tabId: T) => void) | ((value: T | ((prevState: T) => T)) => void),
  options: TabScrubberOptions = {}
) {
  const { scrubThreshold = 4 } = options;
  const invokeSelect = onSelectTab as (tabId: string) => void;

  // Fallback state for synthetic unit tests that invoke handlers without currentTarget on pointerDown
  let fallbackContainer: HTMLElement | null = null;
  const fallbackState: InternalScrubState = {
    isScrubbing: false,
    isTouch: false,
    hasMoved: false,
    startX: 0,
    startIndex: 0,
    lastTabId: null,
    suppressClick: false,
    initialRects: [],
    containerWidth: 0,
    cleanupWindowListeners: null,
  };

  const getOrInitState = (container: HTMLElement | null): InternalScrubState => {
    if (!container) return fallbackState;
    scrubCallbackMap.set(container, invokeSelect);
    let st = scrubStateMap.get(container);
    if (!st) {
      st = {
        isScrubbing: false,
        isTouch: false,
        hasMoved: false,
        startX: 0,
        startIndex: 0,
        lastTabId: null,
        suppressClick: false,
        initialRects: [],
        containerWidth: 0,
        cleanupWindowListeners: null,
      };
      scrubStateMap.set(container, st);
    }
    return st;
  };

  const finishScrub = (container: HTMLElement | null) => {
    const targetContainer = container || fallbackContainer;
    const state = targetContainer ? getOrInitState(targetContainer) : fallbackState;
    if (state.cleanupWindowListeners) {
      state.cleanupWindowListeners();
      state.cleanupWindowListeners = null;
    }
    if (state.hasMoved) {
      state.suppressClick = true;
      setTimeout(() => {
        state.suppressClick = false;
      }, 50);
    }
    state.isScrubbing = false;
    state.hasMoved = false;
    state.lastTabId = null;
    clearScrubPreview(targetContainer);
  };

  const resolveTargetForMove = (
    container: HTMLElement,
    state: InternalScrubState,
    clientX: number,
    clientY?: number
  ): T | null => {
    const buttons = Array.from(container.querySelectorAll<HTMLElement>('[data-tab-id]'));
    if (buttons.length === 0) return null;

    // 1. One-finger relative thumb-arc stepping on tactile screens with measured container width
    if (state.isTouch && state.containerWidth > 0 && buttons.length > 1) {
      const stepPx = Math.max(28, Math.min(42, state.containerWidth / (buttons.length + 0.5)));
      const stepDelta = Math.round((clientX - state.startX) / stepPx);
      const targetIndex = Math.max(0, Math.min(buttons.length - 1, state.startIndex + stepDelta));
      const id = buttons[targetIndex]?.getAttribute('data-tab-id');
      if (id) return id as T;
    }

    // 2. Direct 1:1 cursor overlap hit-testing on mouse (clamped to bar edges during active drag)
    return resolveScrubbedTabId<T>(container, clientX, clientY, { clampToEdges: true });
  };

  const scrubAtPosition = (
    container: HTMLElement | null,
    clientX: number,
    clientY?: number
  ) => {
    const targetContainer = container || fallbackContainer;
    if (!targetContainer) return;
    fallbackContainer = targetContainer;

    const state = getOrInitState(targetContainer);
    if (!state.isScrubbing) return;

    if (!state.hasMoved && Math.abs(clientX - state.startX) < scrubThreshold) {
      return;
    }
    state.hasMoved = true;

    const matchedId = resolveTargetForMove(targetContainer, state, clientX, clientY);
    if (matchedId) {
      applyScrubPreview(targetContainer, matchedId);
      if (matchedId !== state.lastTabId) {
        state.lastTabId = matchedId;
        const cb = scrubCallbackMap.get(targetContainer) || invokeSelect;
        cb(matchedId);
      }
    }
  };

  const beginScrub = (
    container: HTMLElement | null,
    clientX: number,
    isTouch: boolean
  ) => {
    if (container) {
      fallbackContainer = container;
    }
    const targetContainer = container || fallbackContainer;
    const state = getOrInitState(targetContainer);

    if (state.cleanupWindowListeners) {
      state.cleanupWindowListeners();
      state.cleanupWindowListeners = null;
    }

    state.isScrubbing = true;
    state.isTouch = isTouch;
    state.hasMoved = false;
    state.startX = clientX;
    state.lastTabId = null;

    if (targetContainer) {
      const buttons = Array.from(targetContainer.querySelectorAll<HTMLElement>('[data-tab-id]'));
      state.initialRects = buttons.map((b) => b.getBoundingClientRect());
      state.containerWidth = targetContainer.getBoundingClientRect().width;

      let detectedStartIdx = -1;
      for (let i = 0; i < state.initialRects.length; i++) {
        const r = state.initialRects[i];
        if (r.width > 0 && clientX >= r.left && clientX <= r.right) {
          detectedStartIdx = i;
          break;
        }
      }
      if (detectedStartIdx === -1) {
        detectedStartIdx = buttons.findIndex(
          (b) =>
            b.getAttribute('aria-selected') === 'true' ||
            b.getAttribute('aria-pressed') === 'true'
        );
      }
      state.startIndex = detectedStartIdx >= 0 ? detectedStartIdx : 0;

      if (typeof window !== 'undefined') {
        const onWindowPointerMove = (ev: PointerEvent) => {
          if (!state.isScrubbing) return;
          if (ev.pointerType === 'mouse' && ev.buttons !== undefined && (ev.buttons & 1) === 0) {
            finishScrub(targetContainer);
            return;
          }
          scrubAtPosition(targetContainer, ev.clientX, ev.clientY);
        };
        const onWindowMouseMove = (ev: MouseEvent) => {
          if (!state.isScrubbing || state.isTouch) return;
          if (ev.buttons !== undefined && (ev.buttons & 1) === 0) {
            finishScrub(targetContainer);
            return;
          }
          scrubAtPosition(targetContainer, ev.clientX, ev.clientY);
        };
        const onWindowUp = () => {
          finishScrub(targetContainer);
        };

        window.addEventListener('pointermove', onWindowPointerMove);
        window.addEventListener('mousemove', onWindowMouseMove);
        window.addEventListener('pointerup', onWindowUp);
        window.addEventListener('mouseup', onWindowUp);
        window.addEventListener('pointercancel', onWindowUp);

        state.cleanupWindowListeners = () => {
          window.removeEventListener('pointermove', onWindowPointerMove);
          window.removeEventListener('mousemove', onWindowMouseMove);
          window.removeEventListener('pointerup', onWindowUp);
          window.removeEventListener('mouseup', onWindowUp);
          window.removeEventListener('pointercancel', onWindowUp);
        };
      }
    }
  };

  return {
    onPointerDown: (e: {
      button?: number;
      pointerType?: string;
      clientX: number;
      currentTarget?: HTMLElement;
    }) => {
      if (e.pointerType === 'mouse' && e.button !== undefined && e.button !== 0) {
        return;
      }
      beginScrub(e.currentTarget ?? null, e.clientX, e.pointerType === 'touch');
    },
    onPointerMove: (e: {
      buttons?: number;
      pointerType?: string;
      clientX: number;
      clientY?: number;
      currentTarget: HTMLElement;
    }) => {
      const state = getOrInitState(e.currentTarget);
      if (!state.isScrubbing && !fallbackState.isScrubbing) return;
      if (fallbackState.isScrubbing && !state.isScrubbing) {
        state.isScrubbing = true;
        state.startX = fallbackState.startX;
        state.isTouch = fallbackState.isTouch;
      }
      if (e.pointerType === 'mouse' && e.buttons !== undefined && (e.buttons & 1) === 0) {
        finishScrub(e.currentTarget);
        return;
      }
      scrubAtPosition(e.currentTarget, e.clientX, e.clientY);
    },
    onPointerUp: (e?: { currentTarget?: HTMLElement }) => {
      finishScrub(e?.currentTarget ?? null);
    },
    onPointerCancel: (e?: { currentTarget?: HTMLElement }) => {
      finishScrub(e?.currentTarget ?? null);
    },
    onPointerLeave: () => {
      // Intentionally preserved as a no-op so vertical cursor drift never interrupts horizontal scrubbing
    },
    onTouchStart: (e: {
      touches?: ArrayLike<{ clientX: number; clientY?: number }>;
      stopPropagation?: () => void;
      currentTarget?: HTMLElement;
    }) => {
      e.stopPropagation?.();
      const firstTouch = e.touches?.[0];
      beginScrub(e.currentTarget ?? null, firstTouch ? firstTouch.clientX : 0, true);
    },
    onTouchMove: (e: {
      touches?: ArrayLike<{ clientX: number; clientY?: number }>;
      currentTarget: HTMLElement;
    }) => {
      const state = getOrInitState(e.currentTarget);
      if (!state.isScrubbing && !fallbackState.isScrubbing) return;
      if (fallbackState.isScrubbing && !state.isScrubbing) {
        state.isScrubbing = true;
        state.startX = fallbackState.startX;
        state.isTouch = true;
      }
      const firstTouch = e.touches?.[0];
      if (!firstTouch) return;
      scrubAtPosition(e.currentTarget, firstTouch.clientX, firstTouch.clientY);
    },
    onTouchEnd: (e?: { currentTarget?: HTMLElement }) => {
      finishScrub(e?.currentTarget ?? null);
    },
    onTouchCancel: (e?: { currentTarget?: HTMLElement }) => {
      finishScrub(e?.currentTarget ?? null);
    },
    onClickCapture: (e: {
      currentTarget?: HTMLElement;
      preventDefault?: () => void;
      stopPropagation?: () => void;
    }) => {
      const state = e.currentTarget ? scrubStateMap.get(e.currentTarget) : fallbackState;
      if (state?.suppressClick) {
        state.suppressClick = false;
        e.preventDefault?.();
        e.stopPropagation?.();
      }
    },
  };
}



