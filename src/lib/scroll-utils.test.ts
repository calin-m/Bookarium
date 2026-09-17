import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { smartScrollToContent } from './scroll-utils';

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

