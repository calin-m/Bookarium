import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { smartScrollToContent, attachHorizontalDragAndWheelScroll } from './scroll-utils';

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

