import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ReaderFooter } from './ReaderFooter';

describe('ReaderFooter', () => {
  const defaultProps = {
    globalPage: 18,
    totalBookPages: 901,
    chapterTitle: 'Chapter 5',
    chapterPage: 2,
    chapterPageCount: 4,
    onPrevPage: vi.fn(),
    onNextPage: vi.fn(),
    onPageJump: vi.fn(),
    isPrevDisabled: false,
    isNextDisabled: false,
    readingMode: 'paginated' as const,
    theme: 'sepia' as const,
  };

  it('renders global volume pagination and chapter title', () => {
    render(<ReaderFooter {...defaultProps} />);

    expect(screen.getAllByText('Chapter 5').length).toBeGreaterThanOrEqual(1);
    const input = screen.getByLabelText('Current Page Number');
    expect(input).toHaveValue(18);
    expect(input).toHaveAttribute('aria-valuemin', '1');
    expect(input).toHaveAttribute('aria-valuemax', '901');
    expect(input).toHaveAttribute('aria-valuenow', '18');
    expect(screen.getByText('of 901')).toBeInTheDocument();
  });

  it('triggers onPrevPage and onNextPage callbacks when buttons are clicked', () => {
    const onPrevPage = vi.fn();
    const onNextPage = vi.fn();

    render(
      <ReaderFooter
        {...defaultProps}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
      />
    );

    fireEvent.click(screen.getByLabelText('Previous Page'));
    expect(onPrevPage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Next Page'));
    expect(onNextPage).toHaveBeenCalledTimes(1);
  });

  it('handles page jump input changes', () => {
    const onPageJump = vi.fn();
    render(<ReaderFooter {...defaultProps} onPageJump={onPageJump} />);

    const input = screen.getByLabelText('Current Page Number');
    fireEvent.change(input, { target: { value: '42' } });
    expect(onPageJump).toHaveBeenCalledWith(42);
  });

  it('disables previous and next buttons when boundary disabled flags are set', () => {
    render(
      <ReaderFooter
        {...defaultProps}
        isPrevDisabled={true}
        isNextDisabled={true}
      />
    );

    expect(screen.getByLabelText('Previous Page')).toBeDisabled();
    expect(screen.getByLabelText('Next Page')).toBeDisabled();
  });

  it('renders continuous flow indicator and chapter navigation when in scroll mode', () => {
    const onSelectChapter = vi.fn();
    render(
      <ReaderFooter
        {...defaultProps}
        readingMode="scroll"
        currentChapterIndex={2}
        totalChapters={10}
        onSelectChapter={onSelectChapter}
      />
    );

    expect(screen.getByText('Chapter 3 of 10')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Previous Chapter'));
    expect(onSelectChapter).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByLabelText('Next Chapter'));
    expect(onSelectChapter).toHaveBeenCalledWith(3);
  });

  it('renders contoured TOC button, [Search + Settings] mobile bar controls, and vertical draggable floating toolbar with modal auto-suspend/restore and idle translucency', async () => {
    vi.useFakeTimers();
    const onToggleToc = vi.fn();
    const onToggleSearch = vi.fn();
    const onToggleSpeech = vi.fn();
    const onToggleAnnotations = vi.fn();
    const onToggleControls = vi.fn();
    const onToggleTranslations = vi.fn();
    const onThemeChange = vi.fn();

    try {
      const { rerender } = render(
        <ReaderFooter
          {...defaultProps}
          onToggleToc={onToggleToc}
          onToggleSearch={onToggleSearch}
          onToggleSpeech={onToggleSpeech}
          onToggleAnnotations={onToggleAnnotations}
          onToggleControls={onToggleControls}
          onToggleTranslations={onToggleTranslations}
          onThemeChange={onThemeChange}
        />
      );

      // 1. Contoured Chapter / Table of Contents button on the left
      const tocTrigger = screen.getByTestId('footer-toc-trigger');
      expect(tocTrigger).toHaveClass('rounded-lg', 'border', 'shadow-2xs');
      expect(tocTrigger).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(tocTrigger);
      expect(onToggleToc).toHaveBeenCalledTimes(1);

      // 2. Right side bar has Search followed by Settings at the far right
      const quickTools = screen.getByTestId('footer-quick-tools');
      const barButtons = Array.from(quickTools.querySelectorAll(':scope > button'));
      expect(barButtons).toHaveLength(2);
      expect(barButtons[0]).toHaveAttribute('aria-label', 'Search in Book');
      expect(barButtons[1]).toHaveAttribute('aria-label', 'Reader Settings & Tools');

      // Search button triggers directly from the bottom bar
      fireEvent.click(screen.getByLabelText('Search in Book'));
      expect(onToggleSearch).toHaveBeenCalledTimes(1);

      // 3. Floating vertical toolbar is initially hidden until Settings is pressed
      const settingsBtn = screen.getByTestId('footer-settings-toggle');
      expect(settingsBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('footer-floating-tools-bar')).toBeNull();

      // Open floating vertical toolbar (rendered via document.body portal at z-[10002])
      fireEvent.click(settingsBtn);
      expect(settingsBtn).toHaveAttribute('aria-expanded', 'true');
      const floatingBar = screen.getByTestId('footer-floating-tools-bar');
      expect(floatingBar).toBeInTheDocument();
      expect(floatingBar).toHaveClass('fixed', 'right-2.5', 'z-[10002]', 'md:hidden', 'flex-col', 'opacity-100');
      expect(floatingBar).toHaveStyle({ bottom: '96px' });

      // 4. Deterministic Ref-Based Idle Opacity State Machine (3,000ms post-release countdown):
      // Advance 2,000ms while already at opacity-100, then tap the toolbar -> timer resets for a full 3,000ms
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveClass('opacity-100');

      fireEvent.touchStart(screen.getByTestId('footer-floating-tools-bar'));
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      // Still opacity-100 at 2,000ms after tap (would have dimmed at 1,000ms if timer hadn't reset!)
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveClass('opacity-100');

      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveClass('opacity-35');

      // Wakes back up to opacity-100 on pointer enter and schedules 3.0s dim on pointer leave
      fireEvent.pointerEnter(screen.getByTestId('footer-floating-tools-bar'));
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveClass('opacity-100');
      fireEvent.pointerLeave(screen.getByTestId('footer-floating-tools-bar'));

      // 5. Modal & Selection Popover Auto-Suspend / Auto-Restore + Annotations Count Badge:
      fireEvent.click(screen.getByLabelText('Typography & Theme Controls'));
      expect(onToggleControls).toHaveBeenCalledTimes(1);

      rerender(
        <ReaderFooter
          {...defaultProps}
          isControlsOpen={true}
          annotationsCount={4}
          onToggleToc={onToggleToc}
          onToggleSearch={onToggleSearch}
          onToggleSpeech={onToggleSpeech}
          onToggleAnnotations={onToggleAnnotations}
          onToggleControls={onToggleControls}
          onToggleTranslations={onToggleTranslations}
          onThemeChange={onThemeChange}
        />
      );
      expect(screen.queryByTestId('footer-floating-tools-bar')).toBeNull();

      // Auto-suspends when mobile text selection popover is open (isSelectionPopoverOpen=true)
      rerender(
        <ReaderFooter
          {...defaultProps}
          isControlsOpen={false}
          isSelectionPopoverOpen={true}
          annotationsCount={4}
          onToggleToc={onToggleToc}
          onToggleSearch={onToggleSearch}
          onToggleSpeech={onToggleSpeech}
          onToggleAnnotations={onToggleAnnotations}
          onToggleControls={onToggleControls}
          onToggleTranslations={onToggleTranslations}
          onThemeChange={onThemeChange}
        />
      );
      expect(screen.queryByTestId('footer-floating-tools-bar')).toBeNull();

      // Closing the modal/selection popover restores the floating vertical toolbar and shows annotations badge!
      rerender(
        <ReaderFooter
          {...defaultProps}
          isControlsOpen={false}
          isSelectionPopoverOpen={false}
          annotationsCount={4}
          onToggleToc={onToggleToc}
          onToggleSearch={onToggleSearch}
          onToggleSpeech={onToggleSpeech}
          onToggleAnnotations={onToggleAnnotations}
          onToggleControls={onToggleControls}
          onToggleTranslations={onToggleTranslations}
          onThemeChange={onThemeChange}
        />
      );
      expect(screen.getByTestId('footer-floating-tools-bar')).toBeInTheDocument();
      expect(screen.getByTestId('footer-annotations-badge')).toHaveTextContent('4');

      // Clicking Notes, Speech, and Translations triggers callbacks while keeping toolbar state active
      fireEvent.click(screen.getByLabelText('Notes & Highlights'));
      expect(onToggleAnnotations).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByLabelText('Read Aloud Narration'));
      expect(onToggleSpeech).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByLabelText('Language Editions & Translations'));
      expect(onToggleTranslations).toHaveBeenCalledTimes(1);

      // 6. Live Read Aloud Expanded (252px) vs. Minimized (152px) Clearance:
      rerender(
        <ReaderFooter
          {...defaultProps}
          theme="light"
          isSpeechOpen={true}
          annotationsCount={120}
          onToggleToc={onToggleToc}
          onToggleSearch={onToggleSearch}
          onToggleSpeech={onToggleSpeech}
          onToggleAnnotations={onToggleAnnotations}
          onToggleControls={onToggleControls}
          onToggleTranslations={onToggleTranslations}
          onThemeChange={onThemeChange}
        />
      );
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveStyle({ bottom: '252px' });
      expect(screen.getByTestId('footer-annotations-badge')).toHaveTextContent('99+');

      // Simulate Read Aloud minimizing to compact pill ([data-testid="speech-bar-minimized"])
      const minimizedPill = document.createElement('div');
      minimizedPill.setAttribute('data-testid', 'speech-bar-minimized');
      act(() => {
        document.body.appendChild(minimizedPill);
      });
      // Wait for MutationObserver microtask if needed or trigger re-render
      await act(async () => {});
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveStyle({ bottom: '152px' });

      act(() => {
        document.body.removeChild(minimizedPill);
      });
      await act(async () => {});
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveStyle({ bottom: '252px' });

      fireEvent.click(screen.getByLabelText('Current theme: light. Click to switch theme.'));
      expect(onThemeChange).toHaveBeenCalledWith('sepia');

      // 7. Clamped vertical dragging via top drag handle AND whole-pod 6px tap-vs-drag discrimination
      const dragHandle = screen.getByTestId('footer-floating-tools-drag-handle');
      fireEvent(
        dragHandle,
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientY: 500 })
      );
      fireEvent(window, new MouseEvent('pointermove', { clientY: 400 })); // Dragged up by 100px -> 252 + 100 = 352px
      fireEvent.pointerUp(window);
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveStyle({ bottom: '352px' });

      // Drag down past minimum bound -> clamps strictly at minBottomPx (252px when expanded speech is open)
      fireEvent.mouseDown(dragHandle, { clientY: 400 });
      fireEvent.mouseMove(window, { clientY: 900 });
      fireEvent.mouseUp(window);
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveStyle({ bottom: '252px' });

      // Whole-pod drag starting directly on a button (> 6px movement moves toolbar and suppresses accidental button click)
      const speechBtn = screen.getByLabelText('Read Aloud Narration');
      onToggleSpeech.mockClear();
      fireEvent.mouseDown(speechBtn, { clientY: 500 });
      fireEvent.mouseMove(window, { clientY: 497 }); // 3px <= 6px threshold -> no drag yet
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveStyle({ bottom: '252px' });
      fireEvent.mouseMove(window, { clientY: 420 }); // 80px > 6px threshold -> drags to 252 + 80 = 332px
      fireEvent.mouseUp(window);
      fireEvent.click(speechBtn); // Suppressed by onClickCapture after drag!
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveStyle({ bottom: '332px' });
      expect(onToggleSpeech).not.toHaveBeenCalled();

      // Touch drag on whole pod and drag handle
      fireEvent.touchStart(screen.getByTestId('footer-floating-tools-bar'), {
        touches: [{ clientY: 500 }],
      });
      fireEvent.touchMove(window, { touches: [{ clientY: 450 }] }); // +50px -> 382px
      fireEvent.touchEnd(window);
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveStyle({ bottom: '382px' });

      fireEvent.touchStart(dragHandle, { touches: [{ clientY: 500, clientX: 300 }] });
      fireEvent.touchMove(window, { touches: [{ clientY: 550, clientX: 300 }] }); // -50px -> 332px
      fireEvent.touchEnd(window);
      expect(screen.getByTestId('footer-floating-tools-bar')).toHaveStyle({ bottom: '332px' });
      fireEvent.touchStart(dragHandle, { touches: [] });

      // Velocity-based inertial flick projection on release (multi-frame swipe glides & clamps cleanly)
      fireEvent.mouseDown(dragHandle, { clientY: 500, clientX: 300 });
      act(() => {
        vi.advanceTimersByTime(16);
      });
      fireEvent.mouseMove(window, { clientY: 480, clientX: 300 }); // First sample (+20px -> 352px)
      act(() => {
        vi.advanceTimersByTime(20);
      });
      fireEvent.mouseMove(window, { clientY: 460, clientX: 300 }); // Second sample (+20px in 20ms -> vy = 1.0 px/ms, currentBottom = 372px)
      fireEvent.mouseUp(window);
      // Inertial projection: 372 + 1.0 * 140 = 512px, clamped to maxBottomPx (max(252, innerHeight - 340) = 428px in JSDOM 768px)
      expect(
        parseInt(screen.getByTestId('footer-floating-tools-bar').style.bottom, 10)
      ).toBeGreaterThan(372);

      // Pausing > 120ms between moves decays velocityY to 0 so careful placement stops at exact finger position
      fireEvent.mouseDown(dragHandle, { clientY: 500, clientX: 300 });
      act(() => {
        vi.advanceTimersByTime(20);
      });
      fireEvent.mouseMove(window, { clientY: 540, clientX: 300 });
      act(() => {
        vi.advanceTimersByTime(150);
      });
      fireEvent.mouseMove(window, { clientY: 560, clientX: 300 });
      fireEvent.mouseUp(window);

      // Horizontal swipe-right toward screen edge (> 42px) tucks/dismisses the floating toolbar
      fireEvent.mouseDown(screen.getByTestId('footer-floating-tools-bar'), {
        clientY: 500,
        clientX: 280,
      });
      fireEvent.mouseMove(window, { clientY: 502, clientX: 340 }); // deltaX = +60px > 42px
      fireEvent.mouseUp(window);
      expect(screen.queryByTestId('footer-floating-tools-bar')).toBeNull();

      // Re-open floating toolbar via Settings button
      fireEvent.click(settingsBtn);
      expect(screen.getByTestId('footer-floating-tools-bar')).toBeInTheDocument();

      // Dark theme cycle
      rerender(
        <ReaderFooter
          {...defaultProps}
          theme="dark"
          isSpeechOpen={false}
          onToggleToc={onToggleToc}
          onToggleSearch={onToggleSearch}
          onToggleSpeech={onToggleSpeech}
          onToggleAnnotations={onToggleAnnotations}
          onToggleControls={onToggleControls}
          onToggleTranslations={onToggleTranslations}
          onThemeChange={onThemeChange}
        />
      );
      fireEvent.click(screen.getByLabelText('Current theme: dark. Click to switch theme.'));
      expect(onThemeChange).toHaveBeenCalledWith('light');

      // 8. Pressing Settings button again turns off the floating toolbar
      fireEvent.click(settingsBtn);
      expect(screen.queryByTestId('footer-floating-tools-bar')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders Prev and Next buttons with visible labels and accessible touch target classes', () => {
    render(<ReaderFooter {...defaultProps} />);

    const prevBtn = screen.getByLabelText('Previous Page');
    expect(prevBtn).toHaveTextContent('Prev');
    expect(prevBtn.className).toContain('min-h-[42px]');

    const nextBtn = screen.getByLabelText('Next Page');
    expect(nextBtn).toHaveTextContent('Next');
    expect(nextBtn.className).toContain('min-h-[42px]');
  });

  it('slides footer down out of view as a fixed overlay when isHidden is true', () => {
    const { container, rerender } = render(<ReaderFooter {...defaultProps} isHidden={false} />);
    const footerEl = container.querySelector('footer');
    expect(footerEl).toHaveAttribute('data-bars-hidden', 'false');
    expect(footerEl).toHaveClass('fixed', 'bottom-0', 'inset-x-0', 'translate-y-0');

    rerender(<ReaderFooter {...defaultProps} isHidden={true} />);
    expect(footerEl).toHaveAttribute('data-bars-hidden', 'true');
    expect(footerEl).toHaveClass('fixed', 'bottom-0', 'inset-x-0', 'translate-y-full', 'opacity-0', 'pointer-events-none');
  });
});
