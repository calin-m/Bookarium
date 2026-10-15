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
});

