import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CursorTooltip,
  GlobalTitleTooltip,
  CopyBookLinkIndicator,
  copyBookLinkToClipboard,
  handleCopyBookLinkClick,
  COPY_FEEDBACK_DURATION_MS,
} from './CursorTooltip';

describe('CursorTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders null when not visible', () => {
    const { container } = render(
      <CursorTooltip isVisible={false} mousePos={{ x: 100, y: 100 }}>
        <span>Tooltip Content</span>
      </CursorTooltip>
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();
  });

  it('renders null when mousePos is null', () => {
    const { container } = render(
      <CursorTooltip isVisible={true} mousePos={null}>
        <span>Tooltip Content</span>
      </CursorTooltip>
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();
  });

  it('renders in document.body with applied coordinate offsets', () => {
    render(
      <CursorTooltip isVisible={true} mousePos={{ x: 200, y: 300 }}>
        <span>Preview Mode</span>
      </CursorTooltip>
    );

    const tooltip = screen.getByTestId('cursor-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Preview Mode');
    expect(tooltip.style.left).toBe('200px');
    expect(tooltip.style.top).toBe('300px');
    expect(tooltip.style.transform).toBe('translate3d(12px, 14px, 0)');
  });

  it('flips horizontal and vertical transform offsets near right and bottom viewport edges and supports multiline wrapping', () => {
    render(
      <CursorTooltip
        isVisible={true}
        mousePos={{ x: 1150, y: 760 }}
        multiline={true}
      >
        <span>Long book title that wraps across multiple lines cleanly</span>
      </CursorTooltip>
    );

    const tooltip = screen.getByTestId('cursor-tooltip');
    expect(tooltip.style.transform).toBe('translate3d(calc(-100% - 12px), calc(-100% - 14px), 0)');
    expect(tooltip.firstElementChild?.className).toContain('whitespace-normal');
  });
});

describe('GlobalTitleTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('suppresses native title on mouseover, renders stylized tooltip after 300ms, and restores title on mouseout', () => {
    render(
      <div>
        <GlobalTitleTooltip />
        <h3 data-testid="book-heading" title="Frankenstein; Or, The Modern Prometheus">
          Frankenstein
        </h3>
        <div data-testid="outside-area">Outside</div>
      </div>
    );

    const heading = screen.getByTestId('book-heading');
    expect(heading).toHaveAttribute('title', 'Frankenstein; Or, The Modern Prometheus');

    fireEvent.mouseOver(heading, { clientX: 240, clientY: 180 });
    fireEvent.mouseMove(heading, { clientX: 250, clientY: 190 });

    // Native title is stashed while hovered so OS browser tooltip is suppressed
    expect(heading).not.toHaveAttribute('title');
    expect(heading).toHaveAttribute(
      'data-original-title',
      'Frankenstein; Or, The Modern Prometheus'
    );
    expect(screen.queryByTestId('global-cursor-tooltip')).not.toBeInTheDocument();

    // Advance 300ms default delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const tooltip = screen.getByTestId('global-cursor-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Frankenstein; Or, The Modern Prometheus');
    expect(tooltip.style.left).toBe('250px');
    expect(tooltip.style.top).toBe('190px');

    // Mouseout restores original title attribute and dismisses tooltip
    fireEvent.mouseOut(heading, { relatedTarget: screen.getByTestId('outside-area') });
    expect(heading).toHaveAttribute('title', 'Frankenstein; Or, The Modern Prometheus');
    expect(heading).not.toHaveAttribute('data-original-title');
    expect(screen.queryByTestId('global-cursor-tooltip')).not.toBeInTheDocument();
  });

  it('ignores elements inside data-cursor-tooltip-zone="true" and dismisses on scroll or keydown', () => {
    render(
      <div>
        <GlobalTitleTooltip />
        <div data-cursor-tooltip-zone="true">
          <span data-testid="zoned-item" title="Inside Custom Zone">
            Zoned
          </span>
        </div>
        <button data-testid="action-btn" title="Quick Action">
          <span data-testid="nested-child">Child</span>
        </button>
      </div>
    );

    const zoned = screen.getByTestId('zoned-item');
    fireEvent.mouseOver(zoned, { clientX: 100, clientY: 100 });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.queryByTestId('global-cursor-tooltip')).not.toBeInTheDocument();
    expect(zoned).toHaveAttribute('title', 'Inside Custom Zone');

    const btn = screen.getByTestId('action-btn');
    const child = screen.getByTestId('nested-child');
    fireEvent.mouseOver(btn, { clientX: 120, clientY: 140 });
    // Moving between parent and nested child without its own title keeps tooltip alive
    fireEvent.mouseOut(btn, { relatedTarget: child });
    fireEvent.mouseOver(child, { clientX: 125, clientY: 145 });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByTestId('global-cursor-tooltip')).toHaveTextContent('Quick Action');

    // Keydown dismisses and restores title
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('global-cursor-tooltip')).not.toBeInTheDocument();
    expect(btn).toHaveAttribute('title', 'Quick Action');
  });

  it('copies book link on clicking a data-copy-book-id block, morphs tooltip in-place to "Copied link to book!", and reverts after 1800ms', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    render(
      <div>
        <GlobalTitleTooltip />
        <div
          data-testid="copyable-book-meta"
          data-copy-book-id="84"
          data-tooltip="Frankenstein — by Shelley, Mary"
          onClick={(e) => handleCopyBookLinkClick(e, 84)}
          onKeyDown={(e) => handleCopyBookLinkClick(e, 84)}
          role="button"
          tabIndex={0}
        >
          <h4>Frankenstein</h4>
          <p>
            Shelley, Mary
            <CopyBookLinkIndicator bookId={84} />
          </p>
        </div>
      </div>
    );

    const metaBlock = screen.getByTestId('copyable-book-meta');
    const indicator = screen.getByTestId('copy-book-link-indicator-84');
    expect(indicator).not.toHaveTextContent('Copied!');

    fireEvent.mouseOver(metaBlock, { clientX: 300, clientY: 220 });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const tooltip = screen.getByTestId('global-cursor-tooltip');
    expect(tooltip).toHaveTextContent('Frankenstein — by Shelley, Mary');

    // Mousedown and click on the copyable block must NOT dismiss the tooltip; instead it morphs to "Copied link to book!"
    fireEvent.mouseDown(metaBlock);
    fireEvent.click(metaBlock);

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringMatching(/\/read\/84$/));
    expect(screen.getByTestId('global-cursor-tooltip')).toHaveTextContent(
      'Copied link to book!'
    );
    expect(indicator).toHaveTextContent('Copied!');

    // Advance 1800ms to verify both tooltip and tactile indicator revert cleanly while still hovered
    act(() => {
      vi.advanceTimersByTime(COPY_FEEDBACK_DURATION_MS);
    });

    expect(screen.getByTestId('global-cursor-tooltip')).toHaveTextContent(
      'Frankenstein — by Shelley, Mary'
    );
    expect(indicator).not.toHaveTextContent('Copied!');
  });

  it('supports keyboard Enter/Space activation on handleCopyBookLinkClick and direct document click fallback', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    render(
      <div>
        <GlobalTitleTooltip />
        <div
          data-testid="keyboard-copy-meta"
          data-copy-book-id="1342"
          data-tooltip="Pride and Prejudice — by Austen, Jane"
          onKeyDown={(e) => handleCopyBookLinkClick(e, 1342)}
          tabIndex={0}
        >
          Pride and Prejudice
        </div>
      </div>
    );

    const el = screen.getByTestId('keyboard-copy-meta');
    // Unhandled key is ignored
    fireEvent.keyDown(el, { key: 'Tab' });
    expect(writeTextMock).not.toHaveBeenCalled();

    // Enter copies
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringMatching(/\/read\/1342$/));

    // Direct click without explicit React onClick handler also copies via GlobalTitleTooltip document listener
    writeTextMock.mockClear();
    fireEvent.click(el);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringMatching(/\/read\/1342$/));

    // Direct utility call returns the share URL
    const url = copyBookLinkToClipboard(2701);
    expect(url).toMatch(/\/read\/2701$/);
  });
});


