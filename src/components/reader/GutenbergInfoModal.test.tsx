import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GutenbergInfoModal } from './GutenbergInfoModal';

describe('GutenbergInfoModal', () => {
  it('renders null when not open', () => {
    const { container } = render(
      <GutenbergInfoModal
        isOpen={false}
        onClose={vi.fn()}
        bookId={1342}
        title="Pride and Prejudice"
        author="Jane Austen"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders volume metadata, title, and handles close action', () => {
    const handleClose = vi.fn();
    render(
      <GutenbergInfoModal
        isOpen={true}
        onClose={handleClose}
        bookId={1342}
        title="Pride and Prejudice"
        author="Jane Austen"
        theme="sepia"
      />
    );

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('by Jane Austen')).toBeInTheDocument();
    expect(screen.getByText('#1342')).toBeInTheDocument();
    expect(screen.getByText('Public Domain (Zero Copyright)')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close Information Modal');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('triggers onClose when clicking backdrop', () => {
    const handleClose = vi.fn();
    render(
      <GutenbergInfoModal
        isOpen={true}
        onClose={handleClose}
        bookId={1342}
        title="Pride and Prejudice"
        author="Jane Austen"
      />
    );

    const backdrop = screen.getByTestId('gutenberg-info-modal-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalled();
  });
});

