import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Modal } from './Modal';

describe('Modal component', () => {
  it('should not render anything when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });

  it('should render modal content when isOpen is true', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Reader Settings">
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.getByText('Reader Settings')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();

    const heading = screen.getByRole('heading', { name: 'Reader Settings' });
    const headerBar = heading.parentElement;
    expect(headerBar).toHaveClass('shrink-0', 'px-4', 'py-3', 'sm:px-6', 'sm:py-4');
    const modalSurface = headerBar?.parentElement;
    expect(modalSurface).toHaveClass('max-h-[calc(100dvh-2rem)]', 'sm:max-h-[90dvh]');

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should trigger onClose when clicking backdrop or pressing Escape', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('supports custom backdropClassName to override default dimming', () => {
    render(
      <Modal
        isOpen={true}
        onClose={() => {}}
        backdropClassName="bg-transparent backdrop-blur-none"
      >
        <div>Modal Content</div>
      </Modal>
    );

    const backdrop = screen.getByTestId('modal-backdrop');
    expect(backdrop).toHaveClass('bg-transparent');
    expect(backdrop).not.toHaveClass('bg-black/60');
  });

  it('portals modal dialog directly into document.body outside transformed parent containers and sets data-no-swipe', () => {
    const { container } = render(
      <div className="animate-page-turn" data-testid="transformed-wrapper">
        <Modal isOpen={true} onClose={() => {}} title="Portaled Modal">
          <div>Portaled Body</div>
        </Modal>
      </div>
    );

    const wrapper = screen.getByTestId('transformed-wrapper');
    const dialog = screen.getByRole('dialog');

    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('data-no-swipe');
    expect(wrapper.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('binds dynamic unique useId to dialog title and aria-labelledby', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Dynamic Accessible Dialog">
        <div>Accessible Body</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    const heading = screen.getByRole('heading', { level: 2, name: 'Dynamic Accessible Dialog' });

    expect(dialog).toHaveAttribute('aria-labelledby');
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(heading).toHaveAttribute('id', labelledById);
  });

  it('traps keyboard Tab and Shift+Tab navigation within modal dialog', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Focus Trap Dialog">
        <button type="button">Action 1</button>
        <button type="button">Action 2</button>
      </Modal>
    );

    const closeBtn = screen.getByLabelText('Close modal');
    const action2Btn = screen.getByRole('button', { name: 'Action 2' });

    // Focus close button (first tabbable) and press Shift+Tab -> wraps to last button
    closeBtn.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(action2Btn);

    // Focus last button and press Tab -> wraps to first button (close button)
    action2Btn.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('restores focus to previously active element on modal unmount', () => {
    const triggerBtn = document.createElement('button');
    triggerBtn.textContent = 'Open Dialog';
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    const { unmount } = render(
      <Modal isOpen={true} onClose={() => {}} title="Restoring Focus">
        <div>Content</div>
      </Modal>
    );

    unmount();
    expect(document.activeElement).toBe(triggerBtn);
    document.body.removeChild(triggerBtn);
  });

  it('preserves input focus when parent re-renders with a new inline onClose callback', () => {
    const ParentWithInput: React.FC = () => {
      const [val, setVal] = React.useState('');
      return (
        <Modal isOpen={true} onClose={() => setVal('')} title="Create Shelf">
          <input
            aria-label="Shelf Name"
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
        </Modal>
      );
    };

    render(<ParentWithInput />);
    const input = screen.getByLabelText('Shelf Name');
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'Gothic Classics' } });
    expect(document.activeElement).toBe(input);
    expect(input).toHaveValue('Gothic Classics');
  });
});

