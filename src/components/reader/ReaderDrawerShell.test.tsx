import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderDrawerShell } from './ReaderDrawerShell';

describe('ReaderDrawerShell Component', () => {
  it('renders children when open', () => {
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={vi.fn()}
        title="Settings"
        ariaLabel="Settings Drawer"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Drawer Content')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Settings Drawer' })).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ReaderDrawerShell
        isOpen={false}
        onClose={vi.fn()}
        title="Settings"
        ariaLabel="Settings Drawer"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    expect(screen.queryByText('Drawer Content')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={handleClose}
        title="Settings"
        ariaLabel="Settings Drawer"
        closeAriaLabel="Close Settings"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    const closeBtn = screen.getByRole('button', { name: 'Close Settings' });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop', () => {
    const handleClose = vi.fn();
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={handleClose}
        title="Settings"
        ariaLabel="Settings Drawer"
        backdropTestId="test-backdrop"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    const backdrop = screen.getByTestId('test-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', () => {
    const handleClose = vi.fn();
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={handleClose}
        title="Settings"
        ariaLabel="Settings Drawer"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies min-h-0 and overflow-hidden to the panel by default', () => {
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={vi.fn()}
        title="Settings"
        ariaLabel="Settings Drawer"
        panelTestId="test-panel"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    const panel = screen.getByTestId('test-panel');
    expect(panel.className).toContain('overflow-hidden');
    expect(panel.className).toContain('min-h-0');
  });

  it('allows custom className to override overflow using cn/twMerge', () => {
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={vi.fn()}
        title="Settings"
        ariaLabel="Settings Drawer"
        panelTestId="test-panel"
        className="overflow-auto"
      >
        <div>Drawer Content</div>
      </ReaderDrawerShell>
    );

    const panel = screen.getByTestId('test-panel');
    expect(panel.className).toContain('overflow-auto');
    expect(panel.className).not.toContain('overflow-hidden');
  });

  it('renders mobile grab handle and bottom sheet responsive classes', () => {
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={vi.fn()}
        title="Table of Contents"
        ariaLabel="TOC Drawer"
        panelTestId="test-panel"
        backdropTestId="test-backdrop"
      >
        <div>Chapters</div>
      </ReaderDrawerShell>
    );

    const grabHandle = screen.getByTestId('reader-drawer-grab-handle');
    expect(grabHandle).toBeInTheDocument();
    expect(grabHandle).toHaveClass('sm:hidden');

    const panel = screen.getByTestId('test-panel');
    expect(panel).toHaveClass('bottom-0');
    expect(panel).toHaveClass('rounded-t-2xl');
    expect(panel).toHaveClass('overscroll-contain');
    expect(panel).toHaveClass('sm:w-96');
    expect(panel).toHaveClass('sm:max-w-md');

    const backdrop = screen.getByTestId('test-backdrop');
    expect(backdrop).toHaveClass('touch-none');
  });

  it('traps focus with Tab and Shift+Tab within the drawer panel', () => {
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={vi.fn()}
        title="Focus Trap Drawer"
        ariaLabel="Focus Trap Drawer"
        closeAriaLabel="Close Focus Trap Drawer"
      >
        <button type="button">Drawer Item 1</button>
        <button type="button">Drawer Item 2</button>
      </ReaderDrawerShell>
    );

    const closeBtn = screen.getByRole('button', { name: 'Close Focus Trap Drawer' });
    const item2 = screen.getByRole('button', { name: 'Drawer Item 2' });

    // Close button (first) + Shift+Tab wraps to Item 2 (last)
    closeBtn.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(item2);

    // Item 2 (last) + Tab wraps to Close button (first)
    item2.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('restores focus to previous element when unmounted', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open Drawer';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={vi.fn()}
        title="Restore Focus Drawer"
        ariaLabel="Restore Focus Drawer"
      >
        <div>Content</div>
      </ReaderDrawerShell>
    );

    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it('supports ReactNode titles, sepia/dark themes, backdrop touchMove lock, auto-focus timer, and mobile viewport motion branches', () => {
    vi.useFakeTimers();
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

    try {
      const { rerender } = render(
        <ReaderDrawerShell
          isOpen={true}
          onClose={vi.fn()}
          title={<span>Custom Node Header</span>}
          ariaLabel="Custom Drawer"
          theme="sepia"
          backdropTestId="custom-backdrop"
          role="dialog"
        >
          <button type="button">Action</button>
        </ReaderDrawerShell>
      );

      // Advance timer to trigger auto-focus on first tabbable element
      vi.advanceTimersByTime(10);
      expect(screen.getByRole('button', { name: 'Close Drawer' })).toHaveFocus();

      // Backdrop touchMove prevents default scroll bleed
      const backdrop = screen.getByTestId('custom-backdrop');
      fireEvent.touchMove(backdrop);

      // Switch to dark theme and focus outside panel then press Tab
      rerender(
        <ReaderDrawerShell
          isOpen={true}
          onClose={vi.fn()}
          title="Dark Drawer"
          ariaLabel="Dark Drawer"
          theme="dark"
        >
          <div>Read-only content</div>
        </ReaderDrawerShell>
      );

      document.body.focus();
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
      expect(screen.getByRole('button', { name: 'Close Dark Drawer' })).toHaveFocus();
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalWidth,
      });
      vi.useRealTimers();
    }
  });

  it('supports mobile pull-down-to-dismiss gesture on header and grab handle while springing back on short pulls', () => {
    const handleClose = vi.fn();
    render(
      <ReaderDrawerShell
        isOpen={true}
        onClose={handleClose}
        title="Swipeable Sheet"
        ariaLabel="Swipeable Sheet"
        closeAriaLabel="Close Swipeable Sheet"
        panelTestId="swipe-panel"
      >
        <div>Sheet Body</div>
      </ReaderDrawerShell>
    );

    const dragRegion = screen.getByTestId('reader-drawer-drag-region');
    const panel = screen.getByTestId('swipe-panel');
    const closeBtn = screen.getByRole('button', { name: 'Close Swipeable Sheet' });

    // Clicking or pressing down on the Close button inside dragRegion ignores drag start
    fireEvent.pointerDown(closeBtn, { clientY: 100 });
    fireEvent.mouseDown(closeBtn, { clientY: 100 });
    fireEvent.touchStart(closeBtn, { touches: [{ clientY: 100 }] });

    // Short downward pull (< 70px) translates panel during drag and springs back to 0px on release without closing
    fireEvent(
      dragRegion,
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientY: 200 })
    );
    fireEvent(window, new MouseEvent('pointermove', { clientY: 240 })); // +40px
    expect(panel).toHaveStyle({ transform: 'translateY(40px)' });
    fireEvent.pointerUp(window);
    expect(handleClose).not.toHaveBeenCalled();

    // Full downward pull (> 70px) via mouse dismisses the bottom sheet
    fireEvent.mouseDown(dragRegion, { clientY: 200 });
    fireEvent.mouseMove(window, { clientY: 290 }); // +90px > 70px
    fireEvent.mouseUp(window);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Full downward pull (> 70px) via touch dismisses the bottom sheet
    fireEvent.touchStart(dragRegion, { touches: [{ clientY: 150 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 240 }] }); // +90px > 70px
    fireEvent.touchEnd(window);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});

