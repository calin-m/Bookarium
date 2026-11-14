import React, { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useDialogFocusTrap } from './useDialogFocusTrap';

interface HarnessProps {
  isOpen: boolean;
  onClose: () => void;
  autoFocus?: boolean;
  withButtons?: boolean;
}

function FocusTrapHarness({
  isOpen,
  onClose,
  autoFocus = true,
  withButtons = true,
}: HarnessProps): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null);

  useDialogFocusTrap({
    isOpen,
    containerRef,
    onClose,
    autoFocus,
  });

  if (!isOpen) return null;

  return React.createElement(
    'div',
    { ref: containerRef, role: 'dialog', 'aria-modal': 'true' },
    withButtons
      ? [
          React.createElement('button', { key: 'disabled', type: 'button', disabled: true }, 'Disabled'),
          React.createElement(
            'button',
            { key: 'hidden', type: 'button', 'aria-hidden': 'true' },
            'Aria Hidden'
          ),
          React.createElement('button', { key: 'first', type: 'button' }, 'First Action'),
          React.createElement('button', { key: 'last', type: 'button' }, 'Last Action'),
        ]
      : React.createElement('p', null, 'No interactive controls')
  );
}

describe('useDialogFocusTrap', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('auto-focuses the first enabled visible tabbable element, handles Escape, wraps Tab/Shift+Tab, and restores prior focus on close', () => {
    vi.useFakeTimers();

    const trigger = document.createElement('button');
    trigger.textContent = 'Open Overlay';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const onClose = vi.fn();
    const { rerender } = render(
      React.createElement(FocusTrapHarness, { isOpen: true, onClose })
    );

    act(() => {
      vi.runAllTimers();
    });

    const firstBtn = screen.getByRole('button', { name: 'First Action' });
    const lastBtn = screen.getByRole('button', { name: 'Last Action' });
    expect(document.activeElement).toBe(firstBtn);

    // Shift+Tab from first tabbable wraps to last tabbable
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);

    // Tab from last tabbable wraps back to first tabbable
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(firstBtn);

    // Stable ref invokes latest onClose callback on Escape
    const nextOnClose = vi.fn();
    rerender(React.createElement(FocusTrapHarness, { isOpen: true, onClose: nextOnClose }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(nextOnClose).toHaveBeenCalledTimes(1);

    // Closing restores focus to previous active element
    rerender(React.createElement(FocusTrapHarness, { isOpen: false, onClose: nextOnClose }));
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it('skips initial focus jump when autoFocus is false while still containing Tab and Shift+Tab inside the dialog', () => {
    vi.useFakeTimers();

    const trigger = document.createElement('button');
    trigger.textContent = 'Open Drawer';
    document.body.appendChild(trigger);
    trigger.focus();

    render(
      React.createElement(FocusTrapHarness, {
        isOpen: true,
        onClose: vi.fn(),
        autoFocus: false,
      })
    );

    act(() => {
      vi.runAllTimers();
    });

    const firstBtn = screen.getByRole('button', { name: 'First Action' });
    const lastBtn = screen.getByRole('button', { name: 'Last Action' });

    // Focus stays on trigger until user presses Tab
    expect(document.activeElement).toBe(trigger);

    // Pressing Tab when focus is outside container traps onto first tabbable element
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(firstBtn);

    // Pressing Shift+Tab wraps onto last tabbable element
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);

    document.body.removeChild(trigger);
  });

  it('prevents Tab navigation when the container has zero tabbable descendants', () => {
    const onClose = vi.fn();
    render(
      React.createElement(FocusTrapHarness, {
        isOpen: true,
        onClose,
        withButtons: false,
      })
    );

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    window.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(true);
  });
});
