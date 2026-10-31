import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  smartScrollToContent,
  attachHorizontalDragAndWheelScroll,
  resolveScrubbedTabId,
  createTabScrubberHandlers,
} from './scroll-utils';

describe('smartScrollToContent', () => {
  let scrollToMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollToMock = vi.fn();
    window.scrollTo = scrollToMock as unknown as typeof window.scrollTo;
    window.innerHeight = 1000;
    window.scrollY = 500;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false when element does not exist in DOM', () => {
    const didScroll = smartScrollToContent('non-existent-id');
    expect(didScroll).toBe(false);
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('does not scroll when element top is already comfortably in view', () => {
    const el = document.createElement('div');
    el.id = 'content-test';
    document.body.appendChild(el);

    // rect.top = 100px (between offsetTop - 24 = 56 and innerHeight * 0.45 = 450)
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 600,
      left: 0,
      right: 1000,
      width: 1000,
      height: 500,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    const didScroll = smartScrollToContent('content-test', { offsetTop: 80 });
    expect(didScroll).toBe(false);
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('scrolls smoothly to element when top is scrolled off-screen above viewport', () => {
    const el = document.createElement('div');
    el.id = 'content-test';
    document.body.appendChild(el);

    // rect.top = -200px (user scrolled deep down)
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: -200,
      bottom: 300,
      left: 0,
      right: 1000,
      width: 1000,
      height: 500,
      x: 0,
      y: -200,
      toJSON: () => {},
    });

    window.scrollY = 800;

    const didScroll = smartScrollToContent('content-test', { offsetTop: 80 });
    expect(didScroll).toBe(true);
    // targetY = scrollY (800) + rect.top (-200) - offsetTop (80) = 520
    expect(scrollToMock).toHaveBeenCalledWith({ top: 520, behavior: 'smooth' });
  });

  it('scrolls smoothly to element when top is far below the threshold ratio', () => {
    const el = document.createElement('div');
    el.id = 'content-test';
    document.body.appendChild(el);

    // rect.top = 700px (below threshold 450px)
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 1200,
      left: 0,
      right: 1000,
      width: 1000,
      height: 500,
      x: 0,
      y: 700,
      toJSON: () => {},
    });

    window.scrollY = 100;

    const didScroll = smartScrollToContent('content-test', { offsetTop: 80 });
    expect(didScroll).toBe(true);
    // targetY = 100 + 700 - 80 = 720
    expect(scrollToMock).toHaveBeenCalledWith({ top: 720, behavior: 'smooth' });
  });

  it('clamps targetY to minimum 0 if target position is negative', () => {
    const el = document.createElement('div');
    el.id = 'content-test';
    document.body.appendChild(el);

    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 20,
      bottom: 500,
      left: 0,
      right: 1000,
      width: 1000,
      height: 480,
      x: 0,
      y: 20,
      toJSON: () => {},
    });

    window.scrollY = 30; // 30 + 20 - 80 = -30 -> clamped to 0

    const didScroll = smartScrollToContent('content-test', { offsetTop: 80 });
    expect(didScroll).toBe(true);
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});

describe('attachHorizontalDragAndWheelScroll', () => {
  let container: HTMLDivElement;
  let childButton: HTMLButtonElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.scrollLeft = 0;
    container.classList.add('cursor-grab');

    childButton = document.createElement('button');
    childButton.textContent = 'Pill Button';
    container.appendChild(childButton);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('translates vertical wheel events to horizontal scroll', () => {
    const cleanup = attachHorizontalDragAndWheelScroll(container);

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 75,
      deltaX: 0,
      cancelable: true,
      bubbles: true,
    });

    container.dispatchEvent(wheelEvent);
    expect(container.scrollLeft).toBe(75);
    expect(wheelEvent.defaultPrevented).toBe(true);

    cleanup();
  });

  it('ignores horizontal wheel events with dominant deltaX', () => {
    const cleanup = attachHorizontalDragAndWheelScroll(container);

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 10,
      deltaX: 80,
      cancelable: true,
      bubbles: true,
    });

    container.dispatchEvent(wheelEvent);
    expect(container.scrollLeft).toBe(0);
    expect(wheelEvent.defaultPrevented).toBe(false);

    cleanup();
  });

  it('pans scrollLeft during mouse drag and suppresses click when drag exceeds threshold', () => {
    const cleanup = attachHorizontalDragAndWheelScroll(container, { dragThreshold: 5 });
    const buttonClickHandler = vi.fn();
    childButton.addEventListener('click', buttonClickHandler);

    // 1. Mouse down on child button
    const mousedownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      button: 0,
    });
    childButton.dispatchEvent(mousedownEvent);

    // 2. Mouse move by 40px (exceeds 5px threshold)
    const mousemoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 160, // dx = -40 -> scrollLeft increases by 40
    });
    window.dispatchEvent(mousemoveEvent);

    expect(container.scrollLeft).toBe(40);
    expect(container.classList.contains('cursor-grabbing')).toBe(true);
    expect(container.classList.contains('cursor-grab')).toBe(false);

    // 3. Mouse up
    const mouseupEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: 160,
    });
    window.dispatchEvent(mouseupEvent);

    expect(container.classList.contains('cursor-grabbing')).toBe(false);
    expect(container.classList.contains('cursor-grab')).toBe(true);

    // 4. Click event fired after drag should be suppressed by capture guard
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    childButton.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(buttonClickHandler).not.toHaveBeenCalled();

    cleanup();
  });

  it('allows button click to fire when movement is within threshold (stationary click)', () => {
    const cleanup = attachHorizontalDragAndWheelScroll(container, { dragThreshold: 5 });
    const buttonClickHandler = vi.fn();
    childButton.addEventListener('click', buttonClickHandler);

    // Mouse down
    childButton.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 200, button: 0 })
    );

    // Micro jitter (2px <= 5px threshold)
    window.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 198 })
    );

    expect(container.scrollLeft).toBe(0);
    expect(container.classList.contains('cursor-grabbing')).toBe(false);

    // Mouse up
    window.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 198 })
    );

    // Click event should fire normally
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    childButton.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
    expect(buttonClickHandler).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('ignores secondary and tertiary mouse buttons', () => {
    const cleanup = attachHorizontalDragAndWheelScroll(container);

    // Right-click down (button: 2)
    childButton.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 200, button: 2 })
    );

    window.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 100 })
    );

    expect(container.scrollLeft).toBe(0);

    cleanup();
  });

  it('cleans up listeners on returned cleanup invocation', () => {
    const cleanup = attachHorizontalDragAndWheelScroll(container);
    cleanup();

    // Wheel should no longer scroll
    const wheelEvent = new WheelEvent('wheel', { deltaY: 50, deltaX: 0, cancelable: true, bubbles: true });
    container.dispatchEvent(wheelEvent);
    expect(container.scrollLeft).toBe(0);

    // Mouse drag should no longer scroll
    childButton.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 200, button: 0 })
    );
    window.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 100 })
    );
    expect(container.scrollLeft).toBe(0);
  });
});

describe('resolveScrubbedTabId & createTabScrubberHandlers', () => {
  let tablist: HTMLDivElement;
  let btnA: HTMLButtonElement;
  let btnB: HTMLButtonElement;
  let btnC: HTMLButtonElement;

  beforeEach(() => {
    tablist = document.createElement('div');
    btnA = document.createElement('button');
    btnA.setAttribute('data-tab-id', 'habits');
    btnB = document.createElement('button');
    btnB.setAttribute('data-tab-id', 'profile');
    btnC = document.createElement('button');
    btnC.setAttribute('data-tab-id', 'symposiums');

    vi.spyOn(btnA, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 100,
      width: 100,
      top: 0,
      bottom: 40,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    vi.spyOn(btnB, 'getBoundingClientRect').mockReturnValue({
      left: 105,
      right: 205,
      width: 100,
      top: 0,
      bottom: 40,
      height: 40,
      x: 105,
      y: 0,
      toJSON: () => {},
    });
    vi.spyOn(btnC, 'getBoundingClientRect').mockReturnValue({
      left: 210,
      right: 310,
      width: 100,
      top: 0,
      bottom: 40,
      height: 40,
      x: 210,
      y: 0,
      toJSON: () => {},
    });

    tablist.appendChild(btnA);
    tablist.appendChild(btnB);
    tablist.appendChild(btnC);
    document.body.appendChild(tablist);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('resolves tab IDs via bounding box, bridges inter-button flex gaps, clamps edges, and falls back to document.elementFromPoint when rects have zero width', () => {
    expect(resolveScrubbedTabId(null, 50)).toBeNull();
    expect(resolveScrubbedTabId(tablist, 50)).toBe('habits');
    expect(resolveScrubbedTabId(tablist, 150)).toBe('profile');
    expect(resolveScrubbedTabId(tablist, 260)).toBe('symposiums');
    // Inter-button flex gap (between btnA right=100 and btnB left=105)
    expect(resolveScrubbedTabId(tablist, 102)).toBe('habits');
    expect(resolveScrubbedTabId(tablist, 104)).toBe('profile');
    // Out-of-bounds without clamping vs with edge clamping
    expect(resolveScrubbedTabId(tablist, 500)).toBeNull();
    expect(resolveScrubbedTabId(tablist, -20, undefined, { clampToEdges: true })).toBe('habits');
    expect(resolveScrubbedTabId(tablist, 500, undefined, { clampToEdges: true })).toBe(
      'symposiums',
    );

    // Zero-width rects fallback to document.elementFromPoint
    vi.spyOn(btnB, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 0,
      width: 0,
      top: 0,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    const spanInsideB = document.createElement('span');
    btnB.appendChild(spanInsideB);
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn().mockReturnValue(spanInsideB);
    try {
      expect(resolveScrubbedTabId(tablist, 150, 20)).toBe('profile');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('scrubs live across multiple tabs across React handler re-renders, updates data-scrub-active attributes, tracks window move/up, and suppresses post-drag click', () => {
    const onSelectTab = vi.fn();
    let handlers = createTabScrubberHandlers(onSelectTab, { scrubThreshold: 4 });

    // Ignore right-click (button: 2)
    handlers.onPointerDown({
      button: 2,
      pointerType: 'mouse',
      clientX: 20,
      currentTarget: tablist,
    });
    handlers.onPointerMove({
      buttons: 2,
      pointerType: 'mouse',
      clientX: 150,
      currentTarget: tablist,
    });
    expect(onSelectTab).not.toHaveBeenCalled();

    // Primary mouse down on btnA (X=20)
    handlers.onPointerDown({
      button: 0,
      pointerType: 'mouse',
      clientX: 20,
      currentTarget: tablist,
    });

    // Sub-threshold movement (2px < 4px) does not trigger scrub
    handlers.onPointerMove({
      buttons: 1,
      pointerType: 'mouse',
      clientX: 22,
      currentTarget: tablist,
    });
    expect(onSelectTab).not.toHaveBeenCalled();

    // Drag into btnB (X=150) -> selects 'profile' and marks live DOM preview attributes
    handlers.onPointerMove({
      buttons: 1,
      pointerType: 'mouse',
      clientX: 150,
      currentTarget: tablist,
    });
    expect(onSelectTab).toHaveBeenCalledTimes(1);
    expect(onSelectTab).toHaveBeenLastCalledWith('profile');
    expect(tablist.getAttribute('data-scrubbing')).toBe('true');
    expect(btnB.getAttribute('data-scrub-active')).toBe('true');
    expect(btnA.getAttribute('data-scrub-inactive')).toBe('true');

    // Simulate React re-rendering the component and creating a brand-new handlers object mid-drag!
    handlers = createTabScrubberHandlers(onSelectTab, { scrubThreshold: 4 });

    // Drag further inside btnB (X=175) -> does not duplicate callback for same tab
    handlers.onPointerMove({
      buttons: 1,
      pointerType: 'mouse',
      clientX: 175,
      currentTarget: tablist,
    });
    expect(onSelectTab).toHaveBeenCalledTimes(1);

    // Continue dragging outside vertical bounds via window mousemove into btnC (X=250) -> selects 'symposiums'
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        buttons: 1,
        clientX: 250,
        clientY: -30,
      }),
    );
    expect(onSelectTab).toHaveBeenCalledTimes(2);
    expect(onSelectTab).toHaveBeenLastCalledWith('symposiums');
    expect(btnC.getAttribute('data-scrub-active')).toBe('true');

    // Drag back left via window pointermove into btnA (X=30) -> selects 'habits'
    window.dispatchEvent(
      new MouseEvent('pointermove', {
        buttons: 1,
        clientX: 30,
        clientY: 80,
      }),
    );
    expect(onSelectTab).toHaveBeenCalledTimes(3);
    expect(onSelectTab).toHaveBeenLastCalledWith('habits');
    expect(btnA.getAttribute('data-scrub-active')).toBe('true');

    // Release mouse button via window mouseup -> clears live preview attributes
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(tablist.hasAttribute('data-scrubbing')).toBe(false);
    expect(btnA.hasAttribute('data-scrub-active')).toBe(false);

    // Synthetic click immediately following a drag is suppressed by onClickCapture
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();
    handlers.onClickCapture?.({
      currentTarget: tablist,
      stopPropagation,
      preventDefault,
    });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    // If mouse button is already released mid-move (buttons: 0), resets scrub state cleanly
    handlers.onPointerDown({
      button: 0,
      pointerType: 'mouse',
      clientX: 20,
      currentTarget: tablist,
    });
    handlers.onPointerMove({
      buttons: 0,
      pointerType: 'mouse',
      clientX: 150,
      currentTarget: tablist,
    });
    expect(onSelectTab).toHaveBeenCalledTimes(3);

    handlers.onPointerUp({ currentTarget: tablist });
  });

  it('scrubs live across tabs during tactile touch hold-and-swipe and supports one-finger relative thumb-arc stepping across wide containers', () => {
    const onSelectTab = vi.fn();
    const handlers = createTabScrubberHandlers(onSelectTab);
    const stopPropagation = vi.fn();

    // Configure wide container (360px across 3 tabs -> stepPx = 42px) so one short thumb arc sweeps all tabs
    vi.spyOn(tablist, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 360,
      width: 360,
      top: 0,
      bottom: 40,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Touch move before touchStart is ignored
    handlers.onTouchMove({
      touches: [{ clientX: 150 }],
      currentTarget: tablist,
    });
    expect(onSelectTab).not.toHaveBeenCalled();

    // Start touch on btnA (index 0, X=30)
    handlers.onTouchStart({
      touches: [{ clientX: 30, clientY: 20 }],
      stopPropagation,
      currentTarget: tablist,
    });
    expect(stopPropagation).toHaveBeenCalledTimes(1);

    // Empty touches array is safely ignored
    handlers.onTouchMove({
      touches: [],
      currentTarget: tablist,
    });
    expect(onSelectTab).not.toHaveBeenCalled();

    // Swipe right by +45px (X=75, still physically inside btnA's 0..100px box, but >= 1 thumb step!) -> advances to 'profile'
    handlers.onTouchMove({
      touches: [{ clientX: 75, clientY: 20 }],
      currentTarget: tablist,
    });
    expect(onSelectTab).toHaveBeenLastCalledWith('profile');

    // Swipe right by +90px total (X=120, >= 2 thumb steps) -> advances to 'symposiums' (index 2)
    handlers.onTouchMove({
      touches: [{ clientX: 120, clientY: 20 }],
      currentTarget: tablist,
    });
    expect(onSelectTab).toHaveBeenLastCalledWith('symposiums');

    // Reverse thumb back to X=30 (delta = 0 steps) -> returns to 'habits' (index 0)
    handlers.onTouchMove({
      touches: [{ clientX: 30, clientY: 20 }],
      currentTarget: tablist,
    });
    expect(onSelectTab).toHaveBeenLastCalledWith('habits');
    expect(onSelectTab).toHaveBeenCalledTimes(3);

    handlers.onTouchEnd({ currentTarget: tablist });
    handlers.onTouchCancel({ currentTarget: tablist });
    handlers.onPointerCancel({ currentTarget: tablist });
    handlers.onPointerLeave();
  });

  it('tracks 1:1 cursor overlap on mouse across variable-width tabs without jumping ahead of the pointer', () => {
    const onSelectTab = vi.fn();
    const handlers = createTabScrubberHandlers(onSelectTab, { scrubThreshold: 4 });

    // Simulate desktop Accolade Compendium where btnA ("All") is 48px wide, btnB ("Reading Immersion") is 180px wide, and btnC ("Exploration") is 120px wide
    vi.spyOn(tablist, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 360,
      width: 360,
      top: 0,
      bottom: 40,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    vi.spyOn(btnA, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 48,
      width: 48,
      top: 0,
      bottom: 40,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    vi.spyOn(btnB, 'getBoundingClientRect').mockReturnValue({
      left: 52,
      right: 232,
      width: 180,
      top: 0,
      bottom: 40,
      height: 40,
      x: 52,
      y: 0,
      toJSON: () => {},
    });
    vi.spyOn(btnC, 'getBoundingClientRect').mockReturnValue({
      left: 236,
      right: 356,
      width: 120,
      top: 0,
      bottom: 40,
      height: 40,
      x: 236,
      y: 0,
      toJSON: () => {},
    });

    handlers.onPointerDown({
      button: 0,
      pointerType: 'mouse',
      clientX: 20,
      currentTarget: tablist,
    });

    // Drag into wide btnB (X=90 and X=180 are both physically inside btnB [52..232]) -> stays on 'profile', never jumps ahead to 'symposiums'
    handlers.onPointerMove({
      buttons: 1,
      pointerType: 'mouse',
      clientX: 90,
      currentTarget: tablist,
    });
    expect(onSelectTab).toHaveBeenLastCalledWith('profile');

    handlers.onPointerMove({
      buttons: 1,
      pointerType: 'mouse',
      clientX: 180,
      currentTarget: tablist,
    });
    expect(onSelectTab).toHaveBeenLastCalledWith('profile');
    expect(onSelectTab).toHaveBeenCalledTimes(1);

    // Only switches to 'symposiums' when cursor physically overlaps btnC [236..356]
    handlers.onPointerMove({
      buttons: 1,
      pointerType: 'mouse',
      clientX: 260,
      currentTarget: tablist,
    });
    expect(onSelectTab).toHaveBeenLastCalledWith('symposiums');
    expect(onSelectTab).toHaveBeenCalledTimes(2);

    handlers.onPointerUp({ currentTarget: tablist });
  });

  it('survives mobile pointercancel during touch gestures and disambiguates hold-to-scrub vs flick-to-scroll on overflowing tab bars', () => {
    vi.useFakeTimers();
    try {
      const onSelectTab = vi.fn();
      const handlers = createTabScrubberHandlers(onSelectTab, { holdDelayMs: 160 });

      // Configure overflowing container (scrollWidth 600 > clientWidth 300 + 4)
      Object.defineProperty(tablist, 'scrollWidth', { configurable: true, value: 600 });
      Object.defineProperty(tablist, 'clientWidth', { configurable: true, value: 300 });
      vi.spyOn(tablist, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        right: 300,
        width: 300,
        top: 0,
        bottom: 40,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
      const scrollIntoViewMock = vi.fn();
      btnB.scrollIntoView = scrollIntoViewMock;

      // 1. Quick horizontal flick (< 160ms, > 8px movement) yields to native horizontal scroll without scrubbing
      handlers.onPointerDown({
        pointerType: 'touch',
        clientX: 30,
        currentTarget: tablist,
      });
      handlers.onTouchStart({
        touches: [{ clientX: 30, clientY: 20 }],
        currentTarget: tablist,
      });
      handlers.onTouchMove({
        touches: [{ clientX: 80, clientY: 20 }],
        currentTarget: tablist,
      });
      expect(onSelectTab).not.toHaveBeenCalled();

      // 2. Hold for >= 160ms on overflowing bar locks into scrub mode, ignores touch pointercancel, and auto-centers active tab
      handlers.onPointerDown({
        pointerType: 'touch',
        clientX: 30,
        currentTarget: tablist,
      });
      handlers.onTouchStart({
        touches: [{ clientX: 30, clientY: 20 }],
        currentTarget: tablist,
      });
      vi.advanceTimersByTime(170);
      expect(tablist.getAttribute('data-scrubbing')).toBe('true');

      // Mobile browser fires pointercancel(touch) when finger begins moving horizontally
      handlers.onPointerCancel({ pointerType: 'touch', currentTarget: tablist });
      const cancelEv = new Event('pointercancel') as PointerEvent;
      Object.defineProperty(cancelEv, 'pointerType', { value: 'touch' });
      window.dispatchEvent(cancelEv);

      // Window touchmove continues tracking and switches to 'profile' (btnB)
      const touchMoveEv = new Event('touchmove', { cancelable: true }) as TouchEvent;
      Object.defineProperty(touchMoveEv, 'touches', {
        value: [{ clientX: 85, clientY: 20 }],
      });
      window.dispatchEvent(touchMoveEv);

      expect(onSelectTab).toHaveBeenCalledWith('profile');
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });

      window.dispatchEvent(new Event('touchend'));
      expect(tablist.hasAttribute('data-scrubbing')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});


