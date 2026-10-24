import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RemoveOfflineBookModal } from './RemoveOfflineBookModal';

describe('RemoveOfflineBookModal', () => {
  it('renders modal with book title and reassurance message when open', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <RemoveOfflineBookModal
        isOpen={true}
        bookTitle="Pride and Prejudice"
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/Remove “Pride and Prejudice” from offline storage\?/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your bookshelf curation, favorites, bookmarks, and notes will remain untouched\./i
      )
    ).toBeInTheDocument();
  });

  it('triggers onConfirm when Remove Download button is clicked', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <RemoveOfflineBookModal
        isOpen={true}
        bookTitle="Moby Dick"
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /remove download/i });
    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('triggers onClose when Cancel button is clicked', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <RemoveOfflineBookModal
        isOpen={true}
        bookTitle="Frankenstein"
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it('renders generic fallback prompt when bookTitle is omitted', () => {
    render(
      <RemoveOfflineBookModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/Remove this volume from offline storage\?/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <RemoveOfflineBookModal
        isOpen={false}
        bookTitle="Dracula"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

